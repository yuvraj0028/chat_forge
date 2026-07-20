import logging

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('chat')


def custom_exception_handler(exc, context):
    """
    Centralized exception handler. Never leaks stack traces in production.
    Logs full details server-side, returns safe messages to client.
    """
    response = exception_handler(exc, context)

    request = context.get('request')
    request_id = getattr(request, 'request_id', '-') if request else '-'

    if response is not None:
        logger.warning(
            'API error %s %s -> %s | request_id=%s',
            request.method if request else '?',
            request.get_full_path() if request else '?',
            response.status_code,
            request_id,
        )
        return response

    logger.exception(
        'Unhandled exception | request_id=%s',
        request_id,
    )
    return Response(
        {
            'error': 'An internal server error occurred.',
            'request_id': request_id,
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
