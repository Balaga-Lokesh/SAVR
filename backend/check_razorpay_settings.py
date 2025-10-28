#!/usr/bin/env python3
"""
Print important Razorpay and CORS settings from Django settings.
Run from the backend folder: python check_razorpay_settings.py
"""
import django
import os
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
try:
    django.setup()
except Exception as e:
    print('Failed to setup Django:', e)
    raise

from django.conf import settings

out = {
    'RAZORPAY_KEY_ID_set': bool(getattr(settings, 'RAZORPAY_KEY_ID', None)),
    'RAZORPAY_KEY_SECRET_set': bool(getattr(settings, 'RAZORPAY_KEY_SECRET', None)),
    'RAZORPAY_WEBHOOK_SECRET_set': bool(getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', None)),
    'CORS_ALLOWED_ORIGINS': getattr(settings, 'CORS_ALLOWED_ORIGINS', []),
    'CSRF_TRUSTED_ORIGINS': getattr(settings, 'CSRF_TRUSTED_ORIGINS', []),
    'ALLOWED_HOSTS': getattr(settings, 'ALLOWED_HOSTS', []),
    'CORS_ALLOW_CREDENTIALS': getattr(settings, 'CORS_ALLOW_CREDENTIALS', False),
    'DEBUG': getattr(settings, 'DEBUG', False),
}

print(json.dumps(out, indent=2, default=str))
