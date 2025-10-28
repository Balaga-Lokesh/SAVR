# Simulation: test agent_mark_delivered flow in an in-memory sqlite DB
# - Runs migrations
# - Creates: superuser admin, DeliveryPartner with token, User and Order and Delivery
# - Calls partner mark-delivered endpoint via Django test client using token header
# - Prints responses and DB state before and after

import os
import sys
import traceback

base = os.path.dirname(os.path.dirname(__file__))  # backend/
sys.path.insert(0, base)

from django.conf import settings

if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY='test-secret-key',
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'django.contrib.sessions',
            'django.contrib.messages',
            'django.contrib.admin',
            'rest_framework',
            'api',
        ],
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            }
        },
        MIDDLEWARE=[],
        ROOT_URLCONF='api.urls',
        ALLOWED_HOSTS=['testserver','127.0.0.1','localhost'],
        USE_TZ=True,
        TIME_ZONE='UTC',
    )

import django
from django.core.management import call_command

try:
    django.setup()
    print('Django setup complete')
    call_command('migrate', '--noinput')
    print('migrations applied')

    from django.test import Client
    from api import models
    from django.contrib.auth.hashers import make_password

    # Create admin user and UserToken
    admin_user = models.User.objects.create(username='admin', email='admin@test', password_hash=make_password('pass'), is_staff=True, is_superuser=True)
    admin_token = models.UserToken.objects.create(user=admin_user, token_key='admintoken123')
    print('Admin created, token:', admin_token.token_key)

    # Create partner and partner token
    partner = models.DeliveryPartner.objects.create(name='Partner A', email='pa@example.test', approved=True)
    ptoken = models.DeliveryPartnerToken.objects.create(partner=partner, token_key='partnertoken123')
    print('Partner created:', partner.partner_id, 'token:', ptoken.token_key)

    # Create a user and order and delivery assigned to partner
    user = models.User.objects.create(username='cust', email='cust@test', password_hash='x')
    order = models.Order.objects.create(user=user, total_cost=50.0, status='pending')
    delivery = models.Delivery.objects.create(order=order, partner=partner, status='assigned')
    delivery_unassigned = models.Delivery.objects.create(order=order, partner=None, status='assigned')
    print('Deliveries:', delivery.delivery_id, delivery_unassigned.delivery_id)

    client = Client()
    # Before: print order and delivery statuses
    print('Before: delivery status:', models.Delivery.objects.get(pk=delivery.delivery_id).status)
    print('Before: order status:', models.Order.objects.get(pk=order.order_id).status)

    # Call mark-delivered as partner
    # In this test environment we mount api.urls as root, so use path without 'api/v1' prefix
    url = f'/partners/deliveries/{delivery.delivery_id}/mark-delivered/'
    resp = client.post(url, {}, HTTP_AUTHORIZATION='Token ' + ptoken.token_key, content_type='application/json')
    print('Response status:', resp.status_code)
    try:
        print('Response data:', resp.json())
    except Exception:
        print('Response content:', resp.content)

    # After: reload objects
    d2 = models.Delivery.objects.get(pk=delivery.delivery_id)
    o2 = models.Order.objects.get(pk=order.order_id)
    print('After: delivery status:', d2.status, 'partner_id:', d2.partner_id)
    print('After: order status:', o2.status)

    # Check auto-assigned next delivery
    ua = models.Delivery.objects.get(pk=delivery_unassigned.delivery_id)
    print('Unassigned delivery now partner_id:', ua.partner_id, 'status:', ua.status)

except Exception as e:
    print('Simulation failed to run:', e)
    traceback.print_exc()

print('Script complete')
