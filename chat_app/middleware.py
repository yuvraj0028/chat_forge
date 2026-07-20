import uuid
import logging

from django.http import JsonResponse

logger = logging.getLogger('chat')


class RequestIDMiddleware:
    """Attach a unique request ID to every request/response for distributed tracing."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        request.request_id = request_id
        response = self.get_response(request)
        response['X-Request-ID'] = request_id
        return response


class SecurityHeadersMiddleware:
    """Add security headers to every response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        return response


class RequestIDFilter(logging.Filter):
    """Inject request_id into log records."""

    def filter(self, record):
        if not hasattr(record, 'request_id'):
            record.request_id = '-'
        return True
