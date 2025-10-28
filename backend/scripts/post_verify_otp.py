import requests
url='http://127.0.0.1:8000/api/v1/auth/verify-otp/'
payload={'destination':'balaga23bcs141@iiitkottayam.ac.in','code':'', 'role':'admin'}
# Fill code programmatically if provided as an arg
import sys
if len(sys.argv) > 1:
    payload['code'] = sys.argv[1]
else:
    print('Usage: python post_verify_otp.py <code>')
    print('Will print this payload template for manual editing:')
    print(payload)
    sys.exit(1)

s = requests.Session()
# We need to include cookies if any set earlier; Session will manage them.
print('Posting verify-otp to', url, 'with payload', payload)
r = s.post(url, json=payload)
print('status', r.status_code)
try:
    print(r.json())
except Exception:
    print(r.text)

# Print response cookies
print('Response cookies:', r.cookies)
