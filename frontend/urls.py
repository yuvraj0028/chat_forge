from django.urls import path
from .views import FrontendView

urlpatterns = [
    path('', FrontendView.as_view(), name='frontend'),
    path('app/', FrontendView.as_view(), name='frontend-app'),
    path('login/', FrontendView.as_view(), name='frontend-login'),
]
