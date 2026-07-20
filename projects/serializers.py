from rest_framework import serializers
from django.conf import settings
from .models import Project, Prompt, ProjectFile


class PromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prompt
        fields = ['id', 'name', 'content', 'is_system_prompt', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectFile
        fields = ['id', 'file', 'original_name', 'size_bytes', 'mime_type', 'uploaded_at']
        read_only_fields = ['id', 'original_name', 'size_bytes', 'mime_type', 'uploaded_at']


class ProjectSerializer(serializers.ModelSerializer):
    prompts = PromptSerializer(many=True, read_only=True)
    files = ProjectFileSerializer(many=True, read_only=True)
    prompt_count = serializers.SerializerMethodField()
    file_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'model', 'memory_window', 'is_active',
            'prompts', 'files', 'prompt_count', 'file_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'model', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['model'] = getattr(settings, 'GROQ_MODEL', '') or 'llama-3.1-8b-instant'
        return super().create(validated_data)

    def get_prompt_count(self, obj):
        return obj.prompts.filter(is_active=True).count()

    def get_file_count(self, obj):
        return obj.files.count()


class ProjectListSerializer(serializers.ModelSerializer):
    prompt_count = serializers.SerializerMethodField()
    file_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'model', 'memory_window', 'is_active',
            'prompt_count', 'file_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'model', 'created_at', 'updated_at']

    def get_prompt_count(self, obj):
        return obj.prompts.filter(is_active=True).count()

    def get_file_count(self, obj):
        return obj.files.count()
