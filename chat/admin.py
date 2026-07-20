from django.contrib import admin
from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ['role', 'content', 'token_count', 'created_at']


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'user', 'created_at', 'updated_at']
    list_filter = ['project']
    search_fields = ['title']
    raw_id_fields = ['project', 'user']
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'role', 'content_preview', 'token_count', 'created_at']
    list_filter = ['role']
    raw_id_fields = ['conversation']

    def content_preview(self, obj):
        return obj.content[:100]
