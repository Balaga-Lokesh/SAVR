"""Make simuser an admin and test the admin login endpoint."""
import os, sys, json, requests
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
import django
django.setup()
from django.contrib.auth.hashers import make_password
from api import models

email = 'simuser@example.com'
user = models.User.objects.filter(email=email).first()
if not user:
    user = models.User.objects.create(username='simuser', email=email, password_hash=make_password('password123'))
    print('Created user', user.email)
else:
    print('Found user', user.email)

user.is_staff = True
user.is_superuser = True
user.password_hash = make_password('password123')
user.save()
print('Set staff/superuser and password for', user.email)

# call admin login endpoint
resp = requests.post('http://127.0.0.1:8000/api/v1/admin/auth/login/', json={'email': email, 'password': 'password123'})
print('admin login status', resp.status_code, resp.text)
if resp.ok:
    j = resp.json()
    print('token:', j.get('token'))
else:
    print('login failed')
