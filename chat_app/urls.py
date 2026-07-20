from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from chat_app.health import HealthCheckView
from frontend.views import FrontendView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', HealthCheckView.as_view(), name='health-check'),
    path('api/auth/', include('accounts.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/chat/', include('chat.urls')),
    path('', FrontendView.as_view(), name='frontend'),
    path('<path:path>/', FrontendView.as_view(), name='frontend-catch'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
