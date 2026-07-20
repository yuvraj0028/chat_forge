from django.contrib import admin
from .models import Project, Prompt, ProjectFile


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'model', 'is_active', 'created_at']
    list_filter = ['is_active', 'model']
    search_fields = ['name', 'description']
    raw_id_fields = ['owner']


@admin.register(Prompt)
class PromptAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'is_system_prompt', 'is_active']
    list_filter = ['is_system_prompt', 'is_active']
    search_fields = ['name', 'content']
    raw_id_fields = ['project']


@admin.register(ProjectFile)
class ProjectFileAdmin(admin.ModelAdmin):
    list_display = ['original_name', 'project', 'size_bytes', 'mime_type', 'uploaded_at']
    raw_id_fields = ['project']
