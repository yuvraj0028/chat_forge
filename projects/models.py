import uuid
from django.db import models
from django.contrib.auth.models import User


def project_file_path(instance, filename):
    return f'projects/{instance.project.id}/files/{uuid.uuid4().hex}_{filename}'


class Project(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    model = models.CharField(
        max_length=100,
        default='llama-3.1-8b-instant',
        help_text='LLM model to use (e.g. llama-3.1-8b-instant, mixtral-8b-32768)',
    )
    memory_window = models.PositiveIntegerField(
        default=20,
        help_text='Number of recent messages to include as context (lower = cheaper)',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner', '-created_at']),
            models.Index(fields=['owner', 'is_active']),
        ]


class Prompt(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='prompts')
    name = models.CharField(max_length=255)
    content = models.TextField()
    is_system_prompt = models.BooleanField(default=True, help_text='If True, used as system prompt')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.name} - {self.name}"

    class Meta:
        ordering = ['-is_system_prompt', 'name']
        indexes = [
            models.Index(fields=['project', 'is_system_prompt', 'is_active']),
        ]


class ProjectFile(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to=project_file_path)
    original_name = models.CharField(max_length=255)
    gemini_uri = models.CharField(
        max_length=500, blank=True, default='',
        help_text='Gemini File API URI',
    )
    gemini_file_name = models.CharField(
        max_length=500, blank=True, default='',
        help_text='Gemini File API resource name for deletion',
    )
    size_bytes = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['project', '-uploaded_at']),
        ]
