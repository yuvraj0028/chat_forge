from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('', views.ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
    path('<int:project_pk>/prompts/', views.PromptViewSet.as_view({
        'get': 'list', 'post': 'create',
    }), name='project-prompts-list'),
    path('<int:project_pk>/prompts/<int:pk>/', views.PromptViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy',
    }), name='project-prompts-detail'),
    path('<int:project_pk>/files/', views.ProjectFileViewSet.as_view({
        'get': 'list', 'post': 'create',
    }), name='project-files-list'),
    path('<int:project_pk>/files/<int:pk>/', views.ProjectFileViewSet.as_view({
        'get': 'retrieve', 'delete': 'destroy',
    }), name='project-files-detail'),
]
