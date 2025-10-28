#!/usr/bin/env python3
"""Check a Razorpay payment by ID using env keys or a local .env file.
Usage: python check_payment.py <payment_id>
"""
import os
import sys
import json
import requests


def load_dotenv(path):
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def get_keys():
    key = os.getenv('RAZORPAY_KEY_ID')
    secret = os.getenv('RAZORPAY_KEY_SECRET')
    # try loading .env if not present
    if not key or not secret:
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            key = key or os.getenv('RAZORPAY_KEY_ID')
            secret = secret or os.getenv('RAZORPAY_KEY_SECRET')
    return key, secret


def main():
    if len(sys.argv) < 2:
        print('Usage: python check_payment.py <payment_id>')
        sys.exit(2)
    pid = sys.argv[1].strip()
    key, secret = get_keys()
    if not key or not secret:
        print('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not set in env or .env')
        sys.exit(1)

    url = f'https://api.razorpay.com/v1/payments/{pid}'
    try:
        r = requests.get(url, auth=(key, secret), timeout=15)
    except Exception as e:
        print('Request failed:', e)
        sys.exit(1)

    print('HTTP', r.status_code)
    try:
        j = r.json()
        print(json.dumps(j, indent=2, default=str))
    except Exception:
        print(r.text)


if __name__ == '__main__':
    main()
# backend/check_payment.py
# Usage: python check_payment.py pay_RYmPXXYA20Wrm8
import os, sys, requests

def main(pid):
    key = os.getenv("RAZORPAY_KEY_ID")
    secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key or not secret:
        print("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in env.")
        sys.exit(1)
    r = requests.get(f"https://api.razorpay.com/v1/payments/{pid}", auth=(key, secret))
    print("HTTP", r.status_code)
    try:
        j = r.json()
    except Exception:
        print(r.text)
        return
    import json
    print(json.dumps(j, indent=2, default=str))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_payment.py <payment_id>")
        sys.exit(1)
    main(sys.argv[1])