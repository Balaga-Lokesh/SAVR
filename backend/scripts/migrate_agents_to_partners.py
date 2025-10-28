"""Utility script to migrate existing DeliveryAgent rows into DeliveryPartner rows.
Run with Django context, e.g.:
    python -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','backend_project.settings'); import django; django.setup(); exec(open('scripts/migrate_agents_to_partners.py').read())"

This script is idempotent by email: if a partner with the same email exists it will reuse it.
It will also copy DeliveryAgentToken -> DeliveryPartnerToken when present.
It will NOT delete the original DeliveryAgent rows by default; it prints mappings for manual review.
"""

from django.utils import timezone
from api import models

print('Starting migration of DeliveryAgent -> DeliveryPartner')
count = 0
for ag in models.DeliveryAgent.objects.all():
    email = (ag.email or '').strip().lower()
    if email:
        partner = models.DeliveryPartner.objects.filter(email__iexact=email).first()
    else:
        partner = None

    if partner:
        print(f"Skipping agent {ag.agent_id} ({ag.email}) — partner {partner.partner_id} already exists")
    else:
        partner = models.DeliveryPartner.objects.create(
            name=ag.name,
            email=ag.email,
            phone=ag.phone,
            password_hash=getattr(ag, 'password_hash', '') or None,
            location_lat=getattr(ag, 'location_lat', None),
            location_long=getattr(ag, 'location_long', None),
            availability=ag.is_active,
            approved=ag.approved
        )
        print(f"Created partner {partner.partner_id} from agent {ag.agent_id} ({ag.email})")
        count += 1

    # copy tokens
    try:
        atoks = models.DeliveryAgentToken.objects.filter(agent=ag)
        for at in atoks:
            # avoid duplicate token_key
            if not models.DeliveryPartnerToken.objects.filter(token_key=at.token_key).exists():
                models.DeliveryPartnerToken.objects.create(partner=partner, token_key=at.token_key, created_at=at.created_at)
                print(f"  Copied token {at.token_key[:8]}… to partner {partner.partner_id}")
    except Exception as e:
        print('  Token copy failed for agent', ag.agent_id, e)

print(f'Done. Created {count} partners.')
print('Note: Review results before deleting DeliveryAgent rows or tokens.')
