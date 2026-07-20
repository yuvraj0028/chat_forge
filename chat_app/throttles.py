from rest_framework.throttling import SimpleRateThrottle


class BurstRateThrottle(SimpleRateThrottle):
    scope = 'burst'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return f'burst_{request.user.pk}'
        return f'burst_{self.get_ident(request)}'


class SustainedRateThrottle(SimpleRateThrottle):
    scope = 'sustained'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return f'sustained_{request.user.pk}'
        return f'sustained_{self.get_ident(request)}'


class AuthRateThrottle(SimpleRateThrottle):
    scope = 'auth'

    def get_cache_key(self, request, view):
        return f'auth_{self.get_ident(request)}'


class ChatRateThrottle(SimpleRateThrottle):
    scope = 'chat'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return f'chat_{request.user.pk}'
        return f'chat_{self.get_ident(request)}'


class UploadRateThrottle(SimpleRateThrottle):
    scope = 'upload'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return f'upload_{request.user.pk}'
        return f'upload_{self.get_ident(request)}'
