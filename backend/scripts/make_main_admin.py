# Script to be executed inside `python manage.py shell -c "exec(open('scripts/make_main_admin.py').read())"`
from api.models import User, Admin
from django.contrib.auth.hashers import make_password
import sys

EMAIL = 'balaga23bcs141@iiitkottayam.ac.in'
NEW_PASSWORD = 'Admin@141'  # change if you prefer

u = User.objects.filter(email__iexact=EMAIL).first()
if not u:
    print('User not found for email:', EMAIL)
    sys.exit(1)

print('Before:', u.user_id, u.email, 'is_staff=', u.is_staff, 'is_superuser=', u.is_superuser)

u.is_staff = True
u.is_superuser = True
u.password_hash = make_password(NEW_PASSWORD)
u.save(update_fields=['is_staff','is_superuser','password_hash','updated_at'])

print('Updated user:', u.user_id, u.email, 'is_staff=', u.is_staff, 'is_superuser=', u.is_superuser)

admin = Admin.objects.filter(email__iexact=u.email).first()
if admin:
    print('Admin row exists:', admin.admin_id, admin.username, admin.role)
    admin.role = 'main_admin'
    admin.email = u.email
    admin.password_hash = u.password_hash
    admin.save(update_fields=['role','email','password_hash','updated_at'])
    print('Admin row updated')
else:
    admin = Admin.objects.create(username=u.username, email=u.email, password_hash=u.password_hash, role='main_admin')
    print('Admin row created:', admin.admin_id)

# Print last AdminAuthAudit entries for visibility
from api.models import AdminAuthAudit
print('Recent AdminAuthAudit entries:')
for a in AdminAuthAudit.objects.order_by('-created_at')[:5]:
    print(a.audit_id, a.email, a.outcome, a.reason, a.created_at)

print('\nNow you can attempt /api/v1/admin/auth/login/ with email and password:', EMAIL, NEW_PASSWORD)
