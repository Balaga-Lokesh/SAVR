import os
import sys

# Adjust these if your project layout differs
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')

import django
django.setup()

from api.models import OTPCode

email = 'balaga23bcs141@iiitkottayam.ac.in'
print('Querying latest OTPs for', email)
# The OTPCode model uses `destination` for the email/phone column (not `email`).
qs = OTPCode.objects.filter(destination=email).order_by('-created_at')[:5]
if not qs:
    qs = OTPCode.objects.filter(destination=email).order_by('-id')[:5]

for o in qs:
    try:
        created = o.created_at
    except Exception:
        created = getattr(o, 'created', getattr(o, 'timestamp', 'unknown'))
    print('OTP id=', o.id, 'code=', getattr(o, 'code', '<no-code>'), 'destination=', getattr(o, 'destination', None), 'created=', created, 'used=', getattr(o, 'used', None))

if qs:
    print('\nLatest OTP (first):', getattr(qs[0], 'code', '<no-code>'))
else:
    print('No OTPs found for', email)
