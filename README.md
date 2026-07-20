# ChatForge — AI Agent Chatbot Platform

A minimal, production-grade chatbot platform built with Django + Groq AI. Create projects, configure agents with custom prompts, upload files for context, and chat with your AI agents.

---

## Quick Start

### 1. Clone & Install

```bash
cd chat_app
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Edit .env and set your Groq API key
# Get one free at: https://console.groq.com/keys (no credit card needed)
```

```
GROQ_API_KEY=gsk_your_api_key_here
```

### 3. Run Migrations & Start

```bash
python manage.py migrate
python manage.py createsuperuser   # optional, for admin panel
python manage.py runserver
```

Open **http://127.0.0.1:8000** in your browser.

### 4. Create Your First Agent

1. Register an account on the login page
2. Click **+ New Project** → give it a name
3. Go to the project → **Prompts** tab → add a system prompt
4. Upload files (PDF, Word, Excel, PowerPoint, code files) for context
5. Click **💬 Chat** and start talking to your agent

---

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register/` | Create account | No |
| POST | `/api/auth/login/` | Get JWT tokens | No |
| POST | `/api/auth/token/refresh/` | Refresh access token | No |
| GET/PATCH | `/api/auth/profile/` | View/update profile | Yes |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/projects/` | List / create projects |
| GET/PATCH/DELETE | `/api/projects/{id}/` | Retrieve / update / delete project |
| GET/POST | `/api/projects/{id}/prompts/` | List / add prompts |
| GET/DELETE | `/api/projects/{id}/prompts/{id}/` | Retrieve / delete prompt |
| GET/POST | `/api/projects/{id}/files/` | List / upload files |
| GET/DELETE | `/api/projects/{id}/files/{id}/` | Retrieve / delete file |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/chat/conversations/` | List / create conversations |
| GET | `/api/chat/conversations/{id}/` | Get conversation with messages |
| POST | `/api/chat/send/` | Send message, get AI response |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health/` | Health check (DB latency) |
| GET | `/admin/` | Django admin panel |

---

## Architecture

```
chat_app/
├── chat_app/          # Django project config (settings, urls, wsgi)
├── accounts/          # User registration, login, JWT auth
├── projects/          # Projects, prompts, file management
├── chat/              # Conversations, messages, LLM integration
├── frontend/          # SPA view served by Django
├── templates/         # HTML templates
├── static/            # CSS, JS (SPA frontend)
├── manage.py
├── .env               # Environment variables
└── requirements.txt
```

### Backend Layers

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (SPA)                     │
│         Vanilla HTML/CSS/JS served by Django          │
├──────────────────────────────────────────────────────┤
│                  Django REST Framework                │
│     Views → Serializers → Models → SQLite/Postgres   │
├──────────────────────────────────────────────────────┤
│                   Middleware Layer                    │
│  RequestID │ SecurityHeaders │ CORS │ RateLimiting   │
├──────────────────────────────────────────────────────┤
│                   LLM Service Layer                  │
│  LLMService │ CircuitBreaker │ RateLimiter │ Retry   │
├──────────────────────────────────────────────────────┤
│                     Groq API                         │
│              chat.completions.create()               │
└──────────────────────────────────────────────────────┘
```

### Data Flow (Chat Request)

```
Client ──POST /api/chat/send/──▶ DRF View
                                    │
                     ┌──────────────┤
                     ▼              ▼
              Validate request   Fetch project
              (serializer)       + prompts + files + memory
                     │
                     ▼
              Read uploaded files
              (PDF, Word, Excel, etc.)
                     │
                     ▼
              Build message array
              [system prompt + file contents, ...history, user msg]
                     │
                     ▼
              LLMService
              ├── Rate limiter (token bucket, 30 RPM)
              ├── Circuit breaker (5 failures → open 60s)
              ├── Retry (3x exponential backoff)
              └── Timeout (60s)
                     │
                     ▼
              Groq API ──response──▶ Save to DB
                     │                    │
                     ▼                    ▼
              Return to client     Log token usage
```

### Design Decisions

**Why Groq?**
- Free tier with no credit card required
- `llama-3.1-8b-instant` is fast and free
- OpenAI-compatible API — simple integration
- 30 requests/min on free tier

**Why Memory Window?**
Every message in a conversation is stored in the database, but only the N most recent messages are sent to the LLM. This:
- Keeps costs predictable (bounded token usage per request)
- Prevents context overflow on long conversations
- Is configurable per-project and per-request

**Why Circuit Breaker?**
If Groq goes down or rate-limits heavily, the circuit breaker opens and immediately rejects requests instead of waiting for timeouts. This:
- Protects your server from hanging on dead upstreams
- Gives users fast failure responses instead of 60s timeouts
- Auto-recovers after a cooldown period

---

## Supported File Types

| Type | Extensions | How it works |
|------|-----------|--------------|
| PDF | `.pdf` | Text extraction via `pypdf` |
| Word | `.docx` | Text + tables via `python-docx` |
| Excel | `.xlsx` | Sheets, headers, rows via `openpyxl` |
| PowerPoint | `.pptx` | Slides, text, tables via `python-pptx` |
| Text/Code | `.txt`, `.py`, `.js`, `.json`, `.csv`, `.md`, `.html`, `.css`, `.java`, `.c`, `.cpp`, `.go`, `.rs`, `.sql`, etc. | Direct read |

Uploaded files are read and injected into the system prompt so the AI agent can reference their content during conversations.

---

## Security

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT (access + refresh tokens) |
| Authorization | Owner-only access to projects/prompts/files |
| Rate Limiting | DRF throttling (30/min burst, 200/hr sustained) |
| CORS | Explicit origin whitelist |
| Security Headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Input Validation | DRF serializers + Django password validators |
| Error Handling | Custom exception handler — never leaks stack traces |
| Request Tracing | UUID on every request/response via X-Request-ID header |
| Production Mode | HSTS, secure cookies, SSL redirect when DEBUG=False |

---

## Configuration Reference

### `.env` Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | (insecure dev key) | Django secret key |
| `DJANGO_DEBUG` | `True` | Debug mode |
| `DJANGO_ALLOWED_HOSTS` | `*` | Comma-separated allowed hosts |
| `GROQ_API_KEY` | — | Your Groq API key (free at console.groq.com) |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Default model for new projects |
| `GROQ_MEMORY_WINDOW` | `20` | Default messages in context |
| `GROQ_TIMEOUT` | `60` | Request timeout (seconds) |
| `GROQ_RPM` | `30` | Max Groq API requests/min (free tier: 30) |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated frontend origins |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

### Available Groq Models (Free Tier)

| Model | Speed | Quality | Context |
|-------|-------|---------|---------|
| `llama-3.1-8b-instant` | Very fast | Good | 128k |
| `llama-3.3-70b-versatile` | Moderate | Great | 128k |
| `mixtral-8b-32768` | Fast | Good | 32k |

### Rate Limits

| Scope | Limit | Applied To |
|-------|-------|-----------|
| Burst | 30/min | All authenticated endpoints |
| Sustained | 200/hr | All authenticated endpoints |
| Auth | 10/min | Login / register (per IP) |
| Chat | 20/min | Chat send (per user) |
| Upload | 10/min | File uploads (per user) |

---

## Tech Stack

- **Backend:** Django 6.0 + Django REST Framework 3.17
- **Auth:** SimpleJWT (JWT access/refresh tokens)
- **AI:** Groq API (`groq` SDK) — free tier
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Frontend:** Vanilla JS SPA (no framework dependencies)
- **File Processing:** pypdf, python-docx, openpyxl, python-pptx, Pillow
- **Resilience:** tenacity (retries), circuit breaker, token-bucket rate limiter

---

## License

MIT
