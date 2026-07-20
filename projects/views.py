import logging

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from django.conf import settings

from chat_app.throttles import UploadRateThrottle
from .models import Project, Prompt, ProjectFile
from .serializers import (
    ProjectSerializer, ProjectListSerializer,
    PromptSerializer, ProjectFileSerializer,
)

logger = logging.getLogger('chat')


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        if hasattr(obj, 'project'):
            return obj.project.owner == request.user
        return False


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectSerializer

    def perform_create(self, serializer):
        project = serializer.save(owner=self.request.user)
        logger.info('Project created: %s (id=%s, user=%s)', project.name, project.pk, self.request.user.pk)

    def perform_destroy(self, instance):
        logger.info('Project deleted: %s (id=%s, user=%s)', instance.name, instance.pk, self.request.user.pk)
        instance.delete()


class PromptViewSet(viewsets.ModelViewSet):
    serializer_class = PromptSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Prompt.objects.filter(
            project__owner=self.request.user,
            project_id=self.kwargs['project_pk'],
        )

    def perform_create(self, serializer):
        project = Project.objects.get(id=self.kwargs['project_pk'], owner=self.request.user)
        serializer.save(project=project)

    def perform_destroy(self, instance):
        logger.info('Prompt deleted: %s (id=%s)', instance.name, instance.pk)
        instance.delete()


class ProjectFileViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectFileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [UploadRateThrottle]

    def get_queryset(self):
        return ProjectFile.objects.filter(
            project__owner=self.request.user,
            project_id=self.kwargs['project_pk'],
        )

    def perform_create(self, serializer):
        project = Project.objects.get(id=self.kwargs['project_pk'], owner=self.request.user)
        uploaded_file = self.request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {'error': 'No file provided. Please select a file to upload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file.size > settings.FILE_UPLOAD_MAX_MEMORY_SIZE:
            max_mb = settings.FILE_UPLOAD_MAX_MEMORY_SIZE // (1024 * 1024)
            return Response(
                {'error': f'File is too large ({uploaded_file.size // (1024*1024)}MB). Maximum size is {max_mb}MB.'},
                status=status.HTTP_413_PAYLOAD_TOO_LARGE,
            )

        instance = serializer.save(
            project=project,
            original_name=uploaded_file.name,
            size_bytes=uploaded_file.size,
            mime_type=uploaded_file.content_type or '',
        )
        logger.info('File uploaded: %s (id=%s, project=%s)', instance.original_name, instance.pk, project.pk)
        return Response(ProjectFileSerializer(instance).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.file:
            instance.file.delete(save=False)
        logger.info('File deleted: %s (id=%s)', instance.original_name, instance.pk)
        return super().destroy(request, *args, **kwargs)
