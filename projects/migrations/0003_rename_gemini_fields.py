from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0002_remove_projectfile_openai_file_id_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='projectfile',
            old_name='gemini_uri',
            new_name='ai_uri',
        ),
        migrations.RenameField(
            model_name='projectfile',
            old_name='gemini_file_name',
            new_name='ai_file_name',
        ),
    ]
