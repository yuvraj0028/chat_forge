import time
import logging

from django.http import JsonResponse
from django.db import connection
from django.views import View

logger = logging.getLogger('chat')


class HealthCheckView(View):
    """
    Liveness / readiness probe.
    GET /api/health/ -> 200 {status: "ok"} or 503 {status: "degraded"}
    """

    def get(self, request):
        checks = {}
        healthy = True

        # DB check
        try:
            start = time.monotonic()
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            checks['database'] = {
                'status': 'ok',
                'latency_ms': round((time.monotonic() - start) * 1000, 2),
            }
        except Exception as e:
            checks['database'] = {'status': 'error', 'detail': str(e)}
            healthy = False

        code = 200 if healthy else 503
        return JsonResponse({
            'status': 'ok' if healthy else 'degraded',
            'checks': checks,
        }, status=code)
