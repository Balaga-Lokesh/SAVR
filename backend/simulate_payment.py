"""
Simulate a Razorpay payment flow without a browser.

Steps:
 - Create (or reuse) a test user and UserToken via Django ORM
 - Call /api/v1/payments/razorpay/create-order/ with the token
 - Compute valid HMAC signature for the returned razorpay_order_id and a fake razorpay_payment_id
 - Post to /api/v1/payments/razorpay/verify/ with the computed signature
 - Finally call /api/v1/orders/from-plan/ to create orders tied to the payment_id

Run from the backend folder while runserver is running: python simulate_payment.py
"""

import os
import sys
import json
import hmac
import hashlib
import time
from decimal import Decimal

# Ensure Django settings are loaded
sys.path.insert(0, os.path.dirname(__file__))

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
    import django
    django.setup()

    from django.conf import settings
    from api import models
    from django.utils import timezone
    import requests

    # Create or get a test user
    test_email = os.getenv('SIM_TEST_EMAIL', 'simuser@example.com')
    test_username = 'simuser'
    user = models.User.objects.filter(email=test_email).first()
    if not user:
        user = models.User.objects.create(username=test_username, email=test_email, password_hash='dummy')
        print('Created test user:', user.email)
    else:
        print('Using existing user:', user.email)

    # create token row
    token_obj = models.UserToken.objects.create(user=user, token_key=f"simtoken-{int(time.time())}")
    token = token_obj.token_key
    print('Created token:', token)

    # prepare headers
    headers = {'Authorization': f'Token {token}', 'Content-Type': 'application/json'}

    # create razorpay order via backend
    create_url = 'http://127.0.0.1:8000/api/v1/payments/razorpay/create-order/'
    amount = 1.00
    create_payload = {'amount': amount, 'currency': 'INR', 'receipt': f'sim-{int(time.time())}'}
    r = requests.post(create_url, headers=headers, json=create_payload, timeout=20)
    print('create-order status', r.status_code, r.text)
    if r.status_code != 200:
        print('Failed to create razorpay order; abort.')
        sys.exit(1)
    j = r.json()
    payment_id = j.get('payment_id')
    rz_order_id = j.get('razorpay_order_id')
    key_id = j.get('key_id')
    print('Got payment_id:', payment_id, 'rz_order_id:', rz_order_id)

    # simulate razorpay giving a payment id
    fake_rz_payment_id = f"pay_sim_{int(time.time())}"

    # compute signature: HMAC_SHA256(key_secret, f"{rz_order_id}|{rz_payment_id}")
    key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', os.environ.get('RAZORPAY_KEY_SECRET'))
    if not key_secret:
        print('No RAZORPAY_KEY_SECRET found in settings or env; abort.')
        sys.exit(1)

    generated = hmac.new(key_secret.encode(), f"{rz_order_id}|{fake_rz_payment_id}".encode(), hashlib.sha256).hexdigest()
    print('Generated signature:', generated)

    # call verify endpoint
    verify_url = 'http://127.0.0.1:8000/api/v1/payments/razorpay/verify/'
    verify_payload = {
        'payment_id': payment_id,
        'razorpay_payment_id': fake_rz_payment_id,
        'razorpay_order_id': rz_order_id,
        'razorpay_signature': generated,
    }
    v = requests.post(verify_url, headers=headers, json=verify_payload, timeout=20)
    print('verify status', v.status_code, v.text)
    if v.status_code != 200:
        print('Verification failed; abort.')
        sys.exit(1)

    # ensure a valid address exists for the user (orders/from-plan requires address_id)
    addr = models.Address.objects.filter(user=user).first()
    if not addr:
        addr = models.Address.objects.create(
            user=user,
            line1='Test address, SimCity',
            city='Visakhapatnam',
            state='Andhra Pradesh',
            pincode='530016',
            contact_phone='9999999999',
            is_default=True,
            # Provide coordinates to bypass external geocoding in tests
            location_lat=17.6868,
            location_long=83.2185,
        )
        print('Created test address id:', addr.address_id)
    else:
        # If an address exists but lacks coordinates, add sensible defaults so
        # the orders/from-plan endpoint doesn't attempt external geocoding.
        if not getattr(addr, 'location_lat', None) or not getattr(addr, 'location_long', None):
            addr.location_lat = 17.6868
            addr.location_long = 83.2185
            addr.save()
            print('Updated existing address with lat/long:', addr.address_id)

    # Ensure a mart and product exist that the plan can reference
    mart = models.Mart.objects.filter(mart_id=1).first()
    if not mart:
        admin = models.Admin.objects.first()
        if not admin:
            admin = models.Admin.objects.create(username='sim_admin', password_hash='dummy')
            print('Created admin for mart:', admin.admin_id)
        mart = models.Mart.objects.create(name='Sim Mart', location_lat=17.6868, location_long=83.2185, admin=admin, approved=True)
        print('Created test mart id:', mart.mart_id)

    product = models.Product.objects.filter(pk=1).first()
    if not product:
        product = models.Product.objects.create(mart=mart, name='Sim Product', category='grocery', price=Decimal('1.00'), stock=100, unit_weight_kg=Decimal('0.5'))
        print('Created test product id:', product.product_id)

    # create an orders/from-plan/ (simulate using a minimal plan)
    orders_url = 'http://127.0.0.1:8000/api/v1/orders/from-plan/'
    plan_payload = {
        'plan': { 'marts': [ { 'mart_id': mart.mart_id, 'items': [ { 'product_id': product.product_id, 'qty': 1 } ] } ] },
        'address_id': addr.address_id,
        'contact_number': addr.contact_phone or '9999999999',
        'payment_id': payment_id,
        'amount': amount,
    }
    o = requests.post(orders_url, headers=headers, json=plan_payload, timeout=20)
    print('orders/from-plan status', o.status_code, o.text)
    if o.status_code == 200:
        print('Order creation simulated successfully')
    else:
        print('Order creation failed; check server logs and ensure mart/product ids exist')
