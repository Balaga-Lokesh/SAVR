import os,sys
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE','backend_project.settings')
import django
django.setup()
from api import models
from django.contrib.auth.hashers import make_password
u = models.User.objects.filter(email='simuser@example.com').first()
if not u:
    u = models.User.objects.create(username='simuser', email='simuser@example.com', password_hash=make_password('AdminPass123!'))
    print('Created simuser')
else:
    print('Found simuser', u.email)
u.password_hash = make_password('AdminPass123!')
# set admin flags if model has fields
if hasattr(u,'is_staff'):
    setattr(u,'is_staff', True)
if hasattr(u,'is_superuser'):
    setattr(u,'is_superuser', True)
# If those fields don't exist, we can also create an Admin row mapping or rely on Admin model
u.save()
print('Updated simuser to be admin and set password')

# call endpoint
import requests
r = requests.post('http://127.0.0.1:8000/api/v1/admin/auth/login/', json={'email':'simuser@example.com','password':'AdminPass123!'})
print('status', r.status_code, r.text)
