# Simple simulation script to create an in-memory sqlite DB, run migrations for auth/contenttypes and api,
# create a DeliveryPartner and a couple of Delivery rows, then attempt to delete the partner to observe
# any deletion-time errors (constraints, signals, etc.).

import os
import sys
import traceback

# Ensure backend package path is on sys.path so 'api' is importable
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
            'api',
        ],
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            }
        },
        MIDDLEWARE=[],
        USE_TZ=True,
        TIME_ZONE='UTC',
        ROOT_URLCONF=__name__,
    )

import django
from django.core.management import call_command

try:
    django.setup()
    print('Django setup complete')

    # Run migrations (this will apply built-in migrations + api migrations present in repo)
    call_command('migrate', '--noinput')
    print('migrations applied')

    # Now import models and do the simulation
    from api import models

    # Create a partner with partner_id 500 if not exists
    partner = models.DeliveryPartner.objects.create(name='Sim Partner 500', email='sim500@example.test')
    print('Created partner:', partner.partner_id)

    # Create a couple of orders and deliveries referencing this partner
    # Create a user and order for delivery linking
    user = models.User.objects.create(username='simuser', email='simuser@test', password_hash='x')
    order = models.Order.objects.create(user=user, total_cost=100.0, status='pending')
    d1 = models.Delivery.objects.create(order=order, partner=partner, status='assigned')
    d2 = models.Delivery.objects.create(order=order, partner=None, status='assigned')
    print('Deliveries:', d1.delivery_id, d2.delivery_id)

    # Attempt to delete partner — capture exception
    try:
        print('Attempting to delete partner', partner.partner_id)
        partner.delete()
        print('Delete succeeded')
    except Exception as e:
        print('Delete raised exception:', repr(e))
        traceback.print_exc()

    # Check deliveries now
    remaining = list(models.Delivery.objects.filter().values('delivery_id', 'partner_id', 'status'))
    print('Remaining deliveries:', remaining)

except Exception as e:
    print('Simulation failed to run:', e)
    traceback.print_exc()

print('Script complete')
