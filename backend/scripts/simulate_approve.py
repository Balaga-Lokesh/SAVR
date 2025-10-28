"""
Script to run inside `python manage.py shell < simulate_approve.py`.
Finds a pending DeliveryPartner (approved=False), approves them, creates OTP, and prints the OTP.
This is the partner-first replacement for the older agent-focused simulation.
"""
import random, traceback, sys
from django.contrib.auth.hashers import make_password
from api import models

try:
    partner = models.DeliveryPartner.objects.filter(approved=False).first()
    created = False
    if not partner:
        partner = models.DeliveryPartner.objects.create(
            name='SIM_TEST_PARTNER',
            email='sim.test.partner@example.com',
            phone='9999999999',
            password_hash=make_password(''),
            availability=True,
            approved=False,
        )
        created = True
    print('Partner found: id=', partner.partner_id, 'email=', partner.email, 'approved=', partner.approved)

    # Approve
    partner.approved = True
    partner.save(update_fields=['approved'])
    print('Partner approved in DB')

    # Create OTP
    code = f"{random.randint(100000, 999999)}"
    otp = models.OTPCode.objects.create(destination=partner.email, code=code, purpose='login')
    print('Created OTP:', code)

    # Print summary
    print('Done. Partner approved and OTP created. If SMTP is configured, the real endpoint also emails the OTP.')
    if created:
        print('Note: partner record was created by this script for simulation.')
except Exception:
    traceback.print_exc(file=sys.stdout)
    sys.exit(1)
