from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from . import models
from .authentication import CustomTokenAuthentication
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.conf import settings
import random, traceback, sys, json


@api_view(["POST"])
@permission_classes([AllowAny])
def register_agent(request):
    """Public endpoint: delivery agent self-registration.

    Creates a DeliveryAgent with is_active=False and approved=False.
    Admins must approve before the agent can login.
    """
    data = request.data or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    phone = (data.get('phone') or '').strip()

    if not name or not email:
        return Response({'error': 'name and email required'}, status=400)

    if models.DeliveryPartner.objects.filter(email__iexact=email).exists():
        return Response({'error': 'Email already registered'}, status=400)

    partner = models.DeliveryPartner.objects.create(name=name, email=email, location_lat=None, location_long=None, availability=True, approved=False)

    # Log registration event for admins
    try:
        models.AnalyticsLog.objects.create(admin=None, action_type='partner_registered', details=json.dumps({'partner_id': partner.partner_id, 'email': email}))
    except Exception:
        pass

    return Response({'registered': True, 'partner_id': partner.partner_id, 'message': 'Registration submitted — pending admin approval'})


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_list_pending_agents(request):
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    qs = models.DeliveryPartner.objects.filter(approved=False)
    out = []
    for p in qs:
        out.append({'partner_id': p.partner_id, 'name': p.name, 'email': p.email, 'created_at': p.created_at.isoformat()})
    return Response({'pending': out})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_approve_agent(request, agent_id):
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        p = models.DeliveryPartner.objects.get(pk=agent_id)
    except models.DeliveryPartner.DoesNotExist:
        return Response({'error': 'Partner not found'}, status=404)
    p.approved = True
    p.availability = True
    p.save(update_fields=['approved', 'availability'])

    # send onboarding OTP
    try:
        code = f"{random.randint(100000, 999999)}"
        models.OTPCode.objects.create(destination=p.email, code=code, purpose="login")
        send_mail(
            "SAVR Partner Approved — OTP",
            f"Hello {p.name},\n\nYour partner account has been approved. Use this OTP to sign in: {code}\nExpires in 5 minutes.",
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
            [p.email],
        )
    except Exception as e:
        print(f"[admin_approve_agent] failed to send OTP to {p.email}: {e}")
        traceback.print_exc(file=sys.stdout)

    try:
        models.AnalyticsLog.objects.create(admin=None, action_type='partner_approved', details=json.dumps({'partner_id': p.partner_id}))
    except Exception:
        pass

    return Response({'approved': True, 'partner_id': p.partner_id})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_reject_agent(request, agent_id):
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        p = models.DeliveryPartner.objects.get(pk=agent_id)
    except models.DeliveryPartner.DoesNotExist:
        return Response({'error': 'Partner not found'}, status=404)
    # delete/cleanup
    p.delete()
    try:
        models.AnalyticsLog.objects.create(admin=None, action_type='partner_rejected', details=json.dumps({'partner_id': agent_id}))
    except Exception:
        pass
    return Response({'rejected': True})
