from api.models import Admin, User, DeliveryPartner

print('Admins:')
for a in Admin.objects.all():
    print('  admin_id:', a.admin_id, 'username:', a.username, 'email:', a.email, 'role:', a.role, 'created:', a.created_at)

print('\nUsers flagged as staff/superuser:')
for u in User.objects.filter(is_staff=True):
    print('  user_id:', u.user_id, 'username:', u.username, 'email:', u.email, 'is_superuser:', u.is_superuser)

print('\nDelivery Partners:')
for p in DeliveryPartner.objects.all():
    print('  partner_id:', p.partner_id, 'name:', p.name, 'email:', p.email, 'approved:', p.approved)
