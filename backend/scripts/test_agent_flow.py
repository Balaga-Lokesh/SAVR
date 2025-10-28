"""
Script to simulate delivery partner assignment and delivery flow.
Run with:
  python -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','backend_project.settings'); import django; django.setup(); exec(open('scripts/test_agent_flow.py').read())"

This will:
  - Ensure there's an approved DeliveryPartner (create if needed)
  - Create a dummy User and Order
  - Create two Deliveries: one assigned to the partner and one unassigned
  - Create a DeliveryPartnerToken and use Django test Client to:
      - GET /api/v1/partners/deliveries/ as the partner
      - POST /api/v1/partners/deliveries/<delivery_id>/mark-delivered/
  - Verify that after marking delivered the next unassigned delivery is auto-assigned to the same partner

Prints responses and DB state.
"""

import random
import traceback
import sys
from decimal import Decimal
from django.contrib.auth.hashers import make_password
from django.test import Client
from api import models

try:
    # Find or create an approved partner
    partner = models.DeliveryPartner.objects.filter(approved=True).first()
    if not partner:
        partner = models.DeliveryPartner.objects.create(name='SimPartner', email='partner@example.com', availability=True, approved=True)
        print('Created partner', partner.partner_id)
    else:
        print('Found partner', partner.partner_id)

    # Create or find a test user
    user = models.User.objects.filter(username='sim_user').first()
    if not user:
        user = models.User.objects.create(username='sim_user', email='sim.user@example.com', password_hash=make_password('password'), contact_number='9990001111')
        print('Created user', user.user_id)

    # Create two orders/deliveries: one assigned to the partner, one unassigned
    order1 = models.Order.objects.create(user=user, total_cost=Decimal('199.00'), status='pending')
    delivery1 = models.Delivery.objects.create(order=order1, partner=partner, estimated_time=30, status='assigned')
    print('Created delivery1', delivery1.delivery_id, 'partner', partner.partner_id)

    order2 = models.Order.objects.create(user=user, total_cost=Decimal('59.00'), status='pending')
    # delivery2 intentionally partner=None and status='assigned' so it's eligible for auto-assign
    delivery2 = models.Delivery.objects.create(order=order2, partner=None, estimated_time=20, status='assigned')
    print('Created delivery2 (unassigned)', delivery2.delivery_id)

    # Create partner token
    token_value = 'simtoken' + str(random.randint(100000,999999))
    models.DeliveryPartnerToken.objects.create(partner=partner, token_key=token_value)
    print('Created partner token', token_value)

    # Use Django test client to simulate partner requests
    client = Client()
    auth_header = {'HTTP_AUTHORIZATION': f'Token {token_value}'}
    auth_header_with_host = {**auth_header, 'HTTP_HOST': 'localhost'}

    # GET partner deliveries
    res = client.get('/api/v1/partners/deliveries/', **auth_header_with_host)
    print('\n---- GET /api/v1/partners/deliveries/ ----')
    print('status=', res.status_code)
    try:
        print('json=', res.json())
    except Exception:
        print('body=', res.content.decode()[:1000])

    # POST mark delivered for delivery1
    res2 = client.post(f'/api/v1/partners/deliveries/{delivery1.delivery_id}/mark-delivered/', data='{"actual_time":35}', content_type='application/json', **auth_header_with_host)
    print('\n---- POST mark-delivered (delivery1) ----')
    print('status=', res2.status_code)
    try:
        print('json=', res2.json())
    except Exception:
        print('body=', res2.content.decode()[:1000])

    # Refresh deliveries and orders
    delivery1.refresh_from_db()
    delivery2.refresh_from_db()
    print('After marking: delivery1.status=', delivery1.status, 'delivery2.partner=', getattr(delivery2.partner, 'partner_id', None), 'delivery2.status=', delivery2.status)

except Exception:
    traceback.print_exc(file=sys.stdout)
    sys.exit(1)
