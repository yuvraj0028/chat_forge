import time
import math
import threading
import logging

import groq
from django.conf import settings
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger('chat')


# ─── Approximate token counting ───────────────────────────────────────
CHARS_PER_TOKEN = 4
MAX_INPUT_CHARS = 1_000_000


def approx_tokens(text):
    return max(1, math.ceil(len(text) / CHARS_PER_TOKEN))


def truncate_to_budget(text, max_tokens):
    max_chars = max_tokens * CHARS_PER_TOKEN
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 20] + '\n[...truncated]'


# ─── Token-bucket rate limiter ────────────────────────────────────────
class GroqRateLimiter:
    def __init__(self, rpm=30):
        self.rpm = rpm
        self.tokens = float(rpm)
        self.last_refill = time.monotonic()
        self._lock = threading.Lock()

    def acquire(self, timeout=30):
        deadline = time.monotonic() + timeout
        while True:
            with self._lock:
                now = time.monotonic()
                elapsed = now - self.last_refill
                self.tokens = min(self.rpm, self.tokens + elapsed * (self.rpm / 60.0))
                self.last_refill = now

                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return

            if time.monotonic() > deadline:
                raise TimeoutError(
                    f'Groq rate limit: no slot available within {timeout}s '
                    f'(limit: {self.rpm} req/min)'
                )
            time.sleep(0.1)


# ─── Circuit breaker ──────────────────────────────────────────────────
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._failure_count = 0
        self._last_failure_time = 0
        self._state = 'CLOSED'
        self._lock = threading.Lock()

    @property
    def state(self):
        with self._lock:
            if self._state == 'OPEN':
                if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                    self._state = 'HALF_OPEN'
            return self._state

    def record_success(self):
        with self._lock:
            self._failure_count = 0
            self._state = 'CLOSED'

    def record_failure(self):
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._failure_count >= self.failure_threshold:
                self._state = 'OPEN'
                logger.error(
                    'Circuit breaker OPEN after %d failures. Blocking for %ds.',
                    self._failure_count, self.recovery_timeout,
                )

    def allow_request(self):
        return self.state in ('CLOSED', 'HALF_OPEN')


# ─── Module-level singletons ──────────────────────────────────────────
_groq_rpm = getattr(settings, 'GROQ_RPM', 30)
_rate_limiter = GroqRateLimiter(rpm=_groq_rpm)
_circuit = CircuitBreaker(failure_threshold=5, recovery_timeout=60)


# ─── Exceptions ───────────────────────────────────────────────────────
class LLMError(Exception):
    pass


class LLMRateLimitError(LLMError):
    pass


# ─── Service ──────────────────────────────────────────────────────────
class LLMService:
    """
    Resilient Groq API client with:
      - Token-bucket rate limiting
      - Retry with exponential backoff
      - Circuit breaker
      - Timeout enforcement
      - Token-aware message budgeting
    """

    def __init__(self, api_key=None):
        self.api_key = api_key or settings.GROQ_API_KEY
        timeout = getattr(settings, 'GROQ_TIMEOUT', 60)
        self.client = groq.Groq(
            api_key=self.api_key,
            timeout=timeout,
        )
        self.timeout = timeout

    def generate_content(self, model, messages, temperature=0.7, max_output_tokens=4096):
        if not _circuit.allow_request():
            raise LLMError('Service temporarily unavailable (circuit breaker open). Try again later.')

        _rate_limiter.acquire(timeout=30)

        groq_messages = self._parse_messages(messages)

        if not groq_messages:
            raise LLMError('No user messages to process.')

        input_chars = sum(len(m.get('content', '')) for m in groq_messages)
        if input_chars > MAX_INPUT_CHARS:
            raise LLMError(
                f'Input too large (~{approx_tokens("x" * input_chars)} tokens). '
                f'Maximum is ~{MAX_INPUT_CHARS // CHARS_PER_TOKEN:,} tokens.'
            )

        try:
            result = self._call_with_retry(model, groq_messages, temperature, max_output_tokens)
            _circuit.record_success()

            input_toks = approx_tokens(''.join(m.get('content', '') for m in groq_messages))
            output_toks = approx_tokens(result)
            logger.info(
                'Groq token estimate: input=~%d output=~%d model=%s',
                input_toks, output_toks, model,
            )
            return result, {'input_tokens': input_toks, 'output_tokens': output_toks}

        except groq.AuthenticationError:
            _circuit.record_failure()
            raise LLMError('AI service is not configured. Please set a valid API key.')

        except groq.RateLimitError:
            _circuit.record_failure()
            raise LLMError('AI service rate limit reached. Please wait a moment and try again.')

        except groq.PermissionDeniedError:
            _circuit.record_failure()
            raise LLMError('AI service access denied. Please check API key permissions.')

        except groq.NotFoundError:
            _circuit.record_failure()
            raise LLMError(f'Model "{model}" is not available. Please choose a different model.')

        except groq.BadRequestError as e:
            _circuit.record_failure()
            err_str = str(e).lower()
            if 'tokens per minute' in err_str or 'tpm' in err_str:
                raise LLMError('Message too long for this model. Please send a shorter message or start a new conversation.')
            if 'context_length' in err_str or 'context window' in err_str:
                raise LLMError('Conversation is too long. Please start a new conversation.')
            raise LLMError('Invalid request. Please try a different message.')

        except groq.APIStatusError as e:
            _circuit.record_failure()
            if e.status_code == 413:
                raise LLMError('Message too long. Please shorten it or start a new conversation.')
            if e.status_code == 503:
                raise LLMError('AI model is temporarily overloaded. Please try again in a moment.')
            raise LLMError('AI service error. Please try again.')

        except groq.APIStatusError as e:
            _circuit.record_failure()
            if e.status_code == 503:
                raise LLMError('AI model is temporarily overloaded. Please try again in a moment.')
            raise LLMError(f'AI service error: {e}')

        except (groq.APIConnectionError, groq.APITimeoutError):
            _circuit.record_failure()
            raise LLMError('AI service is unreachable. Please check your connection and try again.')

        except LLMError:
            raise

        except Exception:
            _circuit.record_failure()
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _call_with_retry(self, model, messages, temperature, max_output_tokens):
        logger.info('Groq request: model=%s messages=%d', model, len(messages))
        start = time.monotonic()

        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_output_tokens,
        )

        elapsed = round((time.monotonic() - start) * 1000)
        logger.info('Groq response: %dms', elapsed)

        text = response.choices[0].message.content or ''
        if approx_tokens(text) > max_output_tokens * 1.5:
            text = truncate_to_budget(text, max_output_tokens)
        return text

    def _parse_messages(self, messages):
        groq_messages = []
        system_parts = []

        for msg in messages:
            role = msg['role']
            content = msg['content']
            if role == 'system':
                system_parts.append(content)
            elif role == 'user':
                groq_messages.append({'role': 'user', 'content': truncate_to_budget(content, 30000)})
            elif role == 'assistant':
                groq_messages.append({'role': 'assistant', 'content': truncate_to_budget(content, 30000)})

        if system_parts:
            combined_system = '\n\n'.join(system_parts)
            groq_messages.insert(0, {'role': 'system', 'content': combined_system})

        return groq_messages
