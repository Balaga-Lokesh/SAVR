"""
Simulate a Razorpay payment flow end-to-end without the browser.

Steps:
- Ensure a test user and token exist (create if necessary via Django ORM).
- Call the backend `create-order` endpoint to create a Payment and Razorpay order.
- Simulate Razorpay successful payment by computing the signature using the backend secret and posting to the verify endpoint.
- Finally call `orders/from-plan/` to place orders using the payment_id after verification.

Run from repo root: python backend/tests_simulate_payment.py
Requires backend server running at http://127.0.0.1:8000
"""

import os
import sys
import time
import json
import hmac
import hashlib
import requests
from decimal import Decimal

BASE = "http://127.0.0.1:8000"

# helper to run a Django snippet to create a user and token (if not present) and print Token
def ensure_test_token():
    # Use manage.py shell to run a small snippet
    snippet = r"""
from django.contrib.auth import get_user_model
from api.models import UserToken
User = get_user_model()
user, created = User.objects.get_or_create(username='testbot', defaults={'email':'testbot@example.com', 'password_hash': 'pbkdf2_sha256$260000$test$test'})
# ensure password usable: set via set_password? user model uses password_hash field; we'll bypass by creating token directly
if created:
    print('created')
# create token if not exists
tok = UserToken.objects.filter(user=user).first()
if not tok:
    import secrets
    tok = UserToken.objects.create(user=user, token_key=secrets.token_hex(32))
print(tok.token_key)
"""
    backend_dir = os.path.join(os.getcwd(), 'backend')
    # Use manage.py inside backend directory
    p = os.popen(f'cd "{backend_dir}" & python manage.py shell -c "{snippet}"')
    out = p.read().strip()
    if not out:
        raise SystemExit("Failed to obtain token via manage.py shell")
    # token is last line
    token = out.splitlines()[-1].strip()
    return token


def main():
    token = os.environ.get('AUTH_TOKEN')
    if not token:
        print('Ensuring test token via manage.py...')
        token = ensure_test_token()
        print('Got token:', token)

    headers = {'Authorization': f'Token {token}', 'Content-Type': 'application/json'}

    # 1) create razorpay order
    payload = { 'amount': 1.00, 'currency': 'INR', 'receipt': f'test_{int(time.time())}' }
    r = requests.post(f'{BASE}/api/v1/payments/razorpay/create-order/', json=payload, headers=headers, timeout=15)
    print('create-order status', r.status_code, r.text)
    if r.status_code != 200:
        print('Failed to create order')
        return
    data = r.json()
    payment_id = data.get('payment_id')
    rz_order_id = data.get('razorpay_order_id')
    key_id = data.get('key_id')
    if not payment_id or not rz_order_id:
        print('Missing payment/order id in create response')
        return

    print('Created payment:', payment_id, 'rz_order_id:', rz_order_id)

    # 2) simulate razorpay success: we need to compute signature = HMAC_SHA256(key_secret, f"{rz_order_id}|{rz_payment_id}")
    # We'll fabricate a razorpay_payment_id value (since create-order returns only order id), e.g. 'pay_TEST123'
    rz_payment_id = f'pay_test_{int(time.time())}'

    # get key secret from env or settings file
    key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
    if not key_secret:
        # try reading from .env
        env_path = os.path.join(os.getcwd(), '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for ln in f:
                    if ln.startswith('RAZORPAY_KEY_SECRET='):
                        key_secret = ln.split('=',1)[1].strip()
                        break
    if not key_secret:
        print('Razorpay key secret not found in env or .env; cannot compute signature')
        return

    to_sign = f"{rz_order_id}|{rz_payment_id}".encode()
    signature = hmac.new(key_secret.encode(), to_sign, hashlib.sha256).hexdigest()

    verify_payload = {
        'payment_id': payment_id,
        'razorpay_payment_id': rz_payment_id,
        'razorpay_order_id': rz_order_id,
        'razorpay_signature': signature,
    }

    v = requests.post(f'{BASE}/api/v1/payments/razorpay/verify/', json=verify_payload, headers=headers, timeout=15)
    print('verify status', v.status_code, v.text)
    if v.status_code != 200:
        print('Verification failed')
        return

    # 3) now call orders/from-plan/ to finalize orders using a trivial plan (must match backend expected format)
    plan_payload = {
        'plan': {
            'marts': [
                { 'mart_id': 1, 'items': [ { 'product_id': 1, 'qty': 1 } ] }
            ]
        },
        'address_id': 1,
        'contact_number': '9999999999',
        'payment_id': payment_id,
        'amount': 1.00,
    }
    o = requests.post(f'{BASE}/api/v1/orders/from-plan/', json=plan_payload, headers=headers, timeout=15)
    print('orders/from-plan status', o.status_code, o.text)

if __name__ == '__main__':
    main()
