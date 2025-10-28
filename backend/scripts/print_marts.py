import os
import sys

# Ensure we run from the project root where manage.py lives
# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
import django
django.setup()

from api import models

print('Listing marts and assigned admins:')
for m in models.Mart.objects.all():
    admin = getattr(m, 'admin', None)
    admin_id = getattr(admin, 'admin_id', None) if admin else None
    admin_username = getattr(admin, 'username', None) if admin else None
    print(f"mart_id={m.mart_id}\tname={m.name}\tadmin_id={admin_id}\tadmin_username={admin_username}")
