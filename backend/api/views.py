import stripe
import os
import hmac
import secrets
import random
import math
import re
import hashlib
import json
import requests
import traceback
import sys

from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from decimal import Decimal
from typing import Iterable, Optional, Tuple, List, Dict

from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail, get_connection, EmailMessage
from django.conf import settings

from rest_framework import viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from geopy.geocoders import Nominatim
from geopy.distance import geodesic

from .authentication import CustomTokenAuthentication
from . import models, serializers
from .agent_views import register_agent, admin_list_pending_agents, admin_approve_agent, admin_reject_agent
from .utils import fetch_product_image
from .serializers import PaymentSerializer

# --- Admin endpoints: list orders and update product stock
@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_list_orders(request):
    # only main admin (superuser) may view all orders
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    orders = models.Order.objects.select_related('user', 'delivery_address').all().order_by('-created_at')[:200]
    data = []
    for o in orders:
        items = list(models.OrderItem.objects.filter(order=o).select_related('product', 'mart'))
        data.append({
            'order_id': o.order_id,
            'user': o.user.username,
            'total_cost': str(o.total_cost),
            'status': o.status,
            'items': [{'product_id': it.product.product_id, 'name': it.product.name, 'qty': it.quantity, 'price': str(it.price_at_purchase), 'mart': it.mart.name} for it in items],
            'delivery_address': o.delivery_address_snapshot,
            'created_at': o.created_at.isoformat(),
        })
    return Response({'orders': data})


@api_view(["POST"])  # POST to update stock
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_update_stock(request):
    # Allow main admin to update any product. Allow mart_admin users (is_staff but not superuser)
    # to update only products that belong to marts they manage.
    if not getattr(request.user, 'is_staff', False) and not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    data = request.data or {}
    product_id = data.get('product_id')
    stock = data.get('stock')
    if product_id is None or stock is None:
        return Response({'error': 'product_id and stock required'}, status=400)
    try:
        p = models.Product.objects.get(pk=product_id)
        # If current user is not superuser, enforce mart ownership check
        if not getattr(request.user, 'is_superuser', False):
            # Try to match an Admin record to this user (by email or username)
            admin_obj = None
            try:
                admin_obj = models.Admin.objects.filter(models.Q(email__iexact=getattr(request.user, 'email', '')) | models.Q(username__iexact=getattr(request.user, 'username', ''))).first()
            except Exception:
                admin_obj = None

            if not admin_obj:
                return Response({'error': 'Forbidden: not a recognized mart admin'}, status=403)

            # Ensure the product's mart is managed by this admin
            if not p.mart or getattr(p.mart, 'admin_id', None) != getattr(admin_obj, 'admin_id', None):
                return Response({'error': 'Forbidden: cannot modify product from another mart'}, status=403)

        p.stock = int(stock)
        p.save(update_fields=['stock', 'updated_at'])
        return Response({'success': True, 'product_id': p.product_id, 'stock': p.stock})
    except models.Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)


# --- Delivery agent login
@api_view(["POST"])
@permission_classes([AllowAny])
def delivery_agent_login(request):
    data = request.data or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return Response({'error': 'email and password required'}, status=400)
    agent = models.DeliveryAgent.objects.filter(email__iexact=email).first()
    # Agent must exist and be approved by admin before password login is allowed
    if not agent or not agent.is_active or not getattr(agent, 'approved', False):
        return Response({'error': 'Invalid credentials or not approved'}, status=401)
    if not check_password(password, agent.password_hash):
        return Response({'error': 'Invalid credentials'}, status=401)
    # Credentials valid - create and send OTP immediately so agent receives code
    try:
        code = f"{random.randint(100000, 999999)}"
        models.OTPCode.objects.create(destination=agent.email, code=code, purpose="login")
        sent_via = "smtp"
        try:
            send_mail(
                f"SAVR Login OTP",
                f"Your OTP is {code}. It expires in 5 minutes.",
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
                [agent.email],
            )
        except Exception as e:
            # Log and return failure - require SMTP delivery for OTP
            print(f"Agent OTP email failed: {e}, Code: {code}")
            traceback.print_exc(file=sys.stdout)
            return Response({'otp_sent': False, 'error': 'Failed to send OTP via email'}, status=502)

        return Response({'message': 'Credentials validated. OTP sent.', 'destination': agent.email, 'sent_via': sent_via})
    except Exception:
        return Response({'message': 'Credentials validated. Proceed to OTP verification.', 'destination': agent.email})


# --- Delivery partner password login (mirrors agent login but for DeliveryPartner)
@api_view(["POST"])
@permission_classes([AllowAny])
def delivery_partner_login(request):
    data = request.data or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return Response({'error': 'email and password required'}, status=400)
    partner = models.DeliveryPartner.objects.filter(email__iexact=email).first()
    # Partner must exist and be approved by admin before password login is allowed
    if not partner or not partner.approved or not getattr(partner, 'availability', True):
        return Response({'error': 'Invalid credentials or not approved'}, status=401)
    if not check_password(password, partner.password_hash or ''):
        return Response({'error': 'Invalid credentials'}, status=401)
    # Credentials valid - create and send OTP immediately so partner receives code
    try:
        code = f"{random.randint(100000, 999999)}"
        models.OTPCode.objects.create(destination=partner.email, code=code, purpose="login")
        sent_via = "smtp"
        try:
            send_mail(
                f"SAVR Login OTP",
                f"Your OTP is {code}. It expires in 5 minutes.",
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
                [partner.email],
            )
        except Exception as e:
            print(f"Partner OTP email failed: {e}, Code: {code}")
            traceback.print_exc(file=sys.stdout)
            return Response({'otp_sent': False, 'error': 'Failed to send OTP via email'}, status=502)
    except Exception as e:
        print(f"Partner OTP creation failed: {e}")
        traceback.print_exc(file=sys.stdout)
        return Response({'otp_sent': False, 'error': 'Internal error'}, status=500)

    return Response({'otp_sent': True, 'destination': partner.email, 'sent_via': sent_via})

STRIPE_SECRET_KEY = getattr(settings, "STRIPE_SECRET_KEY", os.environ.get("STRIPE_SECRET_KEY"))
STRIPE_PUBLISHABLE_KEY = getattr(settings, "STRIPE_PUBLISHABLE_KEY", os.environ.get("STRIPE_PUBLISHABLE_KEY"))
STRIPE_WEBHOOK_SECRET = getattr(settings, "STRIPE_WEBHOOK_SECRET", os.environ.get("STRIPE_WEBHOOK_SECRET"))

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# --------------------- Index ---------------------
def index(request):
    return JsonResponse({"status": "ok", "message": "API v1 is up"})


# --------------------- ViewSets ---------------------
class MartViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Mart.objects.all()
    serializer_class = serializers.MartSerializer


class OfferViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Offer.objects.all()
    serializer_class = serializers.OfferSerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Product.objects.all()
    serializer_class = serializers.ProductSerializer

    def list(self, request, *args, **kwargs):
        products = list(self.get_queryset())
        for p in products:
            ensure_product_image(p)
        serializer = self.get_serializer(products, many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        product = self.get_object()
        ensure_product_image(product)
        serializer = self.get_serializer(product, context={"request": request})
        return Response(serializer.data)


# --------------------- Product images ---------------------
def get_google_image(query: str) -> str:
    return f"https://via.placeholder.com/150?text={query}"

def ensure_product_image(product: models.Product) -> models.Product:
    if not product.image_url:
        product.image_url = fetch_product_image(product.name) or f"https://via.placeholder.com/150?text={product.name}"
        product.save(update_fields=["image_url"])
    return product

@api_view(["GET"])
def products_with_images(request):
    products = list(models.Product.objects.all())
    for p in products:
        ensure_product_image(p)
    data = serializers.ProductSerializer(products, many=True, context={"request": request}).data
    return Response(data)


# --------------------- Geocoding helpers ---------------------
geolocator = Nominatim(user_agent="savr_backend")

def get_lat_long_from_address(address: str) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """
    Geocode with Nominatim, auto-appending country for better hit rate.
    Fallback: if a 6-digit Indian PIN is present and full address fails,
    try geocoding the PIN alone.
    """
    try:
        query = address if "india" in (address or "").lower() else f"{address}, India"
        location = geolocator.geocode(query, timeout=10)
        if location:
            return Decimal(str(location.latitude)), Decimal(str(location.longitude))
        # PIN-only fallback
        m = re.search(r"\b(\d{6})\b", address or "")
        if m:
            pin = m.group(1)
            alt = geolocator.geocode(f"{pin}, India", timeout=10)
            if alt:
                return Decimal(str(alt.latitude)), Decimal(str(alt.longitude))
    except Exception as e:
        print("Geocoding error:", e)
    return None, None


def distance_km_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return geodesic((lat1, lon1), (lat2, lon2)).km


def eta_minutes_from_distance(distance_km: float) -> int:
    """Very simple ETA: 20 km/h average → 3 min/km."""
    return int(math.ceil((distance_km / 20.0) * 60.0))


def calculate_delivery_charge(distance_km: float, total_weight_kg: float) -> int:
    """
    Pricing rule:
      - ₹5 per km
      - ₹5 per kg
      - no base
    """
    distance_component = 5.0 * max(0.0, float(distance_km or 0.0))
    weight_component = 5.0 * max(0.0, float(total_weight_kg or 0.0))
    return int(math.ceil(distance_component + weight_component))


def marts_with_distances_to(address_lat: Decimal, address_long: Decimal, marts: Iterable[models.Mart],
                            weight_kg: float = 1.0) -> List[Dict]:
    """
    For given address coordinates, compute distance to each mart and return list of dicts:
    { mart_id, mart_name, mart_lat, mart_long, distance_km, eta_min, delivery_charge } sorted by distance.
    """
    result = []
    for m in marts:
        try:
            mart_lat = float(m.location_lat)
            mart_long = float(m.location_long)
        except Exception:
            continue
        dist = distance_km_between(float(address_lat), float(address_long), mart_lat, mart_long)
        charge = calculate_delivery_charge(dist, weight_kg)
        result.append({
            "mart_id": m.mart_id,
            "mart_name": m.name,
            "mart_lat": mart_lat,
            "mart_long": mart_long,
            "distance_km": round(dist, 3),
            "eta_min": eta_minutes_from_distance(dist),
            "delivery_charge": charge,
        })
    result.sort(key=lambda x: x["distance_km"])
    return result


# --------------------- Auth & User ---------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    data = request.data or {}
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    contact_number = data.get("contact_number")

    if not (username and email and password and contact_number):
        return JsonResponse({"error": "Missing fields"}, status=400)
    if models.User.objects.filter(email=email).exists():
        return JsonResponse({"error": "Email already registered"}, status=400)
    if models.User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already taken"}, status=400)

    user = models.User.objects.create(
        username=username,
        email=email,
        password_hash=make_password(password),
        contact_number=contact_number,
    )
    return JsonResponse({
        "message": "User registered",
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "contact_number": user.contact_number,
    }, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    data = request.data or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return JsonResponse({"error": "Email and password required"}, status=400)

    try:
        user = models.User.objects.get(email=email)
    except models.User.DoesNotExist:
        return JsonResponse({"error": "Invalid email or password"}, status=400)

    if not check_password(password, user.password_hash):
        return JsonResponse({"error": "Invalid email or password"}, status=400)

    return JsonResponse({"message": "Login OK. Proceed to OTP.", "otp_destination": email}, status=200)


@api_view(["POST"])
@permission_classes([AllowAny])
def request_otp(request):
    data = request.data or {}
    destination = data.get("destination")
    purpose = data.get("purpose", "login")

    if not destination:
        return Response({"error": "destination required"}, status=400)

    code = f"{random.randint(100000, 999999)}"
    models.OTPCode.objects.create(destination=destination, code=code, purpose=purpose)

    sent_via = "smtp"
    try:
        send_mail(
            f"SAVR {purpose.capitalize()} OTP",
            f"Your OTP is {code}. It expires in 5 minutes.",
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
            [destination],
        )
        # audit log for OTP send
        try:
            models.AnalyticsLog.objects.create(admin=None, action_type="otp_sent", details=json.dumps({"destination": destination, "purpose": purpose}))
        except Exception:
            pass
    except Exception as e:
        # Print full traceback for debugging and return error to client.
        print(f"OTP email failed: {e}, Code: {code}")
        traceback.print_exc(file=sys.stdout)
        sent_via = "smtp_failed"
        # Do not fallback to console: require SMTP delivery. Surface failure to client.
        return Response({"otp_sent": False, "error": "Failed to send OTP via email"}, status=502)

    return Response({"otp_sent": True, "destination": destination, "sent_via": sent_via})


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp(request):
    data = request.data or {}
    destination = data.get("destination")
    code = data.get("code")
    purpose = data.get("purpose", "login")
    role = (data.get("role") or "user").lower()

    if not destination or not code:
        return Response({"error": "destination and code required"}, status=400)

    try:
        otp = models.OTPCode.objects.filter(
            destination=destination, purpose=purpose, code=code, used=False
        ).latest("created_at")
    except models.OTPCode.DoesNotExist:
        return Response({"error": "Invalid OTP code"}, status=400)

    if timezone.now() > otp.expires_at:
        return Response({"error": "OTP expired"}, status=400)

    otp.used = True
    otp.save()

    # Depending on role, issue appropriate token
    if role in ("agent", "partner"):
        partner = models.DeliveryPartner.objects.filter(email__iexact=destination, approved=True).first()
        if not partner:
            # audit failed verify
            try:
                models.AnalyticsLog.objects.create(admin=None, action_type="otp_verify_failed", details=json.dumps({"destination": destination, "purpose": purpose, "reason": "partner_not_found_or_unapproved"}))
            except Exception:
                pass
            return Response({"error": "Partner not found or not approved"}, status=404)

        # If frontend supplied a new_password during OTP verification, set it now (one-step onboarding)
        new_password = request.data.get("new_password")
        if new_password:
            try:
                if len(new_password) < 8:
                    return Response({"error": "new_password must be at least 8 characters"}, status=400)
                partner.password_hash = make_password(new_password)
                partner.save(update_fields=["password_hash"])
            except Exception:
                pass

        token_value = secrets.token_hex(32)
        token_obj = models.DeliveryPartnerToken.objects.create(partner=partner, token_key=token_value)
        resp = Response({
            "verified": True,
            "token": token_obj.token_key,
            "partner_id": partner.partner_id,
            "name": partner.name,
            "role": "partner",
        })
        # Always set secure=False for dev/local
        resp.set_cookie(
    key=getattr(settings, "AUTH_COOKIE_NAME", "auth_token"),
    value=token_obj.token_key,
    httponly=True,
    secure=False,  # for dev
    samesite='Lax',
    path="/",
)
        # audit successful partner verify
        try:
            models.AnalyticsLog.objects.create(admin=None, action_type="otp_verified", details=json.dumps({"destination": destination, "partner_id": partner.partner_id}))
        except Exception:
            pass
        return resp

    # default: user/admin -> create UserToken
    user = models.User.objects.filter(Q(email=destination) | Q(username=destination)).first()
    if not user:
        return Response({"error": "User not found"}, status=404)

    if role == "admin" and not (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)):
        return Response({"error": "Not an admin"}, status=403)

    token_value = secrets.token_hex(32)
    token_obj = models.UserToken.objects.create(user=user, token_key=token_value)
    role_out = "admin" if (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)) else "user"
    resp = Response({
        "verified": True,
        "token": token_obj.token_key,
        "user_id": user.user_id,
        "username": user.username,
        "role": role_out,
    })
    resp.set_cookie(
        key=getattr(settings, "AUTH_COOKIE_NAME", "auth_token"),
        value=token_obj.token_key,
        httponly=True,
        secure=False,
        samesite=getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax"),
        path="/",
    )
    return resp

    token = UserToken.objects.create(user=user)
    response = Response({"token": token.token_key})
    response.set_cookie(
    key="auth_token",
    value=token.token_key,
    httponly=True,
    samesite="Lax",  # Use "None" if you ever switch to HTTPS
    secure=False,    # Must be False on localhost dev
)
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def admin_login(request):
    """
    Admin login endpoint. Accepts JSON { email, password, remember_device? }
    Returns { token, user: { user_id, username, email } } on success.
    Logs attempt to AdminAuthAudit.
    """
    data = request.data or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    ip = request.META.get("REMOTE_ADDR") or request.META.get("HTTP_X_FORWARDED_FOR")
    ua = request.META.get("HTTP_USER_AGENT", "")

    # find user
    user = models.User.objects.filter(email__iexact=email).first()
    outcome = "failed_invalid_credentials"

    if not user:
        try:
            models.AdminAuthAudit.objects.create(user=None, email=email, ip_address=ip, user_agent=ua, outcome=outcome, reason="user not found")
        except Exception:
            pass
        return Response({"error": "Invalid credentials."}, status=401)

    # ensure admin/staff privileges
    if not getattr(user, "is_staff", False) and not getattr(user, "is_superuser", False):
        try:
            models.AdminAuthAudit.objects.create(user=user, email=email, ip_address=ip, user_agent=ua, outcome="failed_not_admin", reason="user lacks admin privileges")
        except Exception:
            pass
        return Response({"error": "Invalid credentials."}, status=401)

    # verify password
    if not check_password(password, user.password_hash):
        try:
            models.AdminAuthAudit.objects.create(user=user, email=email, ip_address=ip, user_agent=ua, outcome=outcome, reason="bad password")
        except Exception:
            pass
        return Response({"error": "Invalid credentials."}, status=401)
    # credentials valid - admin should proceed to OTP verification
    outcome = "success_credentials"
    try:
        models.AdminAuthAudit.objects.create(user=user, email=email, ip_address=ip, user_agent=ua, outcome=outcome)
    except Exception:
        pass

    # Create and send OTP immediately so admin receives code by email without needing a separate request
    try:
        code = f"{random.randint(100000, 999999)}"
        models.OTPCode.objects.create(destination=user.email, code=code, purpose="login")
        sent_via = "smtp"
        try:
            send_mail(
                f"SAVR Login OTP",
                f"Your OTP is {code}. It expires in 5 minutes.",
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
                [user.email],
            )
        except Exception as e:
            print(f"Admin OTP email failed: {e}, Code: {code}")
            traceback.print_exc(file=sys.stdout)
            return Response({"otp_sent": False, "error": "Failed to send OTP via email"}, status=502)
        return Response({"message": "Credentials validated. OTP sent.", "destination": user.email, "sent_via": sent_via})
    except Exception:
        return Response({"message": "Credentials validated. Proceed to OTP verification.", "destination": user.email})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_admin(request):
    """
    Create a new admin user. Only a main admin (superuser) may call this endpoint.
    Body: { username, email, password, role } where role is one of ["main_admin","mart_admin"].
    If a User with the email exists, it will be updated to is_staff and (optionally) is_superuser.
    This endpoint is intended to be called by an existing superuser to bootstrap admins.
    """
    # Only superuser may create admins
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)

    data = request.data or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    role = (data.get('role') or 'mart_admin').strip().lower()

    if not username or not email or not password or role not in ('main_admin', 'mart_admin'):
        return Response({'error': 'username, email, password and valid role required'}, status=400)

    # Create or update a User record so admin can also use User-based login flows
    user_obj = models.User.objects.filter(email__iexact=email).first()
    if user_obj:
        # update password and flags
        user_obj.password_hash = make_password(password)
        user_obj.is_staff = True
        user_obj.is_superuser = True if role == 'main_admin' else False
        user_obj.save(update_fields=['password_hash', 'is_staff', 'is_superuser', 'updated_at'])
    else:
        user_obj = models.User.objects.create(
            username=username,
            email=email,
            password_hash=make_password(password),
            is_staff=True,
            is_superuser=True if role == 'main_admin' else False,
        )

    # Create Admin record (application-level Admin table) if not exists
    admin_obj = models.Admin.objects.filter(username__iexact=username).first()
    if admin_obj:
        admin_obj.email = email
        admin_obj.role = role
        admin_obj.password_hash = user_obj.password_hash
        admin_obj.save(update_fields=['email', 'role', 'password_hash', 'updated_at'])
    else:
        admin_obj = models.Admin.objects.create(
            username=username,
            email=email,
            password_hash=user_obj.password_hash,
            role=role,
        )

    return Response({'created': True, 'admin_id': admin_obj.admin_id, 'username': admin_obj.username, 'role': admin_obj.role})


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_admins(request):
    # only main admin may list all admins
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    admins = models.Admin.objects.all().order_by('-created_at')
    data = [{'admin_id': a.admin_id, 'username': a.username, 'email': a.email, 'role': a.role} for a in admins]
    return Response({'admins': data})


@api_view(["DELETE"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_admin(request, admin_id):
    # only main admin may delete admins
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        a = models.Admin.objects.get(pk=admin_id)
        a.delete()
        return Response({'deleted': True})
    except models.Admin.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_agents(request):
    # superuser sees all agents; mart admins see agents linked to their mart if any
    # Return DeliveryPartner records normalized into the legacy 'agents' shape for compatibility.
    if getattr(request.user, 'is_superuser', False):
        qs = models.DeliveryPartner.objects.all()
    else:
        # mart admin: find their mart(s) and partners associated (via partner->mart relation if any)
        admin_obj = models.Admin.objects.filter(models.Q(email__iexact=getattr(request.user, 'email', '')) | models.Q(username__iexact=getattr(request.user, 'username', ''))).first()
        if not admin_obj:
            return Response({'error': 'Forbidden'}, status=403)
        marts = models.Mart.objects.filter(admin=admin_obj)
        # Partners may not be directly linked to marts; fall back to empty set if no partners mapped.
        qs = models.DeliveryPartner.objects.filter(partner_id__in=[p.partner_id for p in models.DeliveryPartner.objects.all()])
    data = []
    for p in qs:
        data.append({
            'agent_id': p.partner_id,
            'name': p.name,
            'email': p.email,
            'phone': p.phone,
            'is_active': True,
            'partner': {'partner_id': p.partner_id, 'name': p.name},
        })
    return Response({'agents': data})


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_list_partners(request):
    # Only main admin may list partners
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    qs = models.DeliveryPartner.objects.all().order_by('name')
    out = []
    for p in qs:
        out.append({'partner_id': p.partner_id, 'name': p.name, 'email': p.email, 'approved': p.approved})
    return Response({'partners': out})


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_inspect_partner(request, partner_id):
    """Admin utility: return counts of related objects for a DeliveryPartner to help debug delete failures."""
    # Only staff may inspect
    if not getattr(request.user, 'is_staff', False) and not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        p = models.DeliveryPartner.objects.get(pk=partner_id)
    except models.DeliveryPartner.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    out = {
        'partner_id': p.partner_id,
        'name': p.name,
        'email': p.email,
        'deliveries_count': models.Delivery.objects.filter(partner=p).count(),
        'agents_count': models.DeliveryAgent.objects.filter(partner=p).count(),
        'partner_tokens_count': models.DeliveryPartnerToken.objects.filter(partner=p).count(),
    }

    # Try to find analytics logs that mention this partner id (simple string search in details)
    try:
        out['analytics_logs_count'] = models.AnalyticsLog.objects.filter(details__contains=f'"partner_id": {p.partner_id}').count()
    except Exception:
        out['analytics_logs_count'] = None

    # Introspect related objects dynamically
    rels = {}
    for rel in p._meta.related_objects:
        try:
            accessor = rel.get_accessor_name()
            qs = getattr(p, accessor).all()
            rels[rel.related_model.__name__] = qs.count()
        except Exception as e:
            rels[rel.related_model.__name__] = str(e)
    out['related_counts_by_model'] = rels

    return Response(out)


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_list_deliveries(request):
    # Only main admin may list all deliveries
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    # by default exclude already-delivered deliveries from the admin "Deliveries" view
    include_delivered = str(request.GET.get('include_delivered', '')).lower() in ['1', 'true', 'yes']
    qs = models.Delivery.objects.select_related('order', 'partner')
    if not include_delivered:
        qs = qs.exclude(status='delivered')
    qs = qs.order_by('-created_at')[:500]
    out = []
    for d in qs:
        out.append({
            'delivery_id': d.delivery_id,
            'order_id': d.order_id,
            'status': d.status,
            'partner': {'partner_id': d.partner.partner_id, 'name': d.partner.name} if d.partner else None,
            'created_at': d.created_at.isoformat(),
        })
    return Response({'deliveries': out})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_fix_delivery(request, delivery_id):
    """Admin utility: fix a stuck delivery/order by forcing delivered and optionally auto-assign next.

    Only superuser may call this endpoint.
    Returns before/after snapshot and next_assigned_delivery_id when applicable.
    """
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        d = models.Delivery.objects.select_related('order', 'partner').get(pk=delivery_id)
    except models.Delivery.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    before = {
        'delivery_id': d.delivery_id,
        'delivery_status': d.status,
        'partner_id': d.partner_id,
        'order_id': getattr(d.order, 'order_id', None),
        'order_status': getattr(d.order, 'status', None),
    }

    next_assigned = None
    try:
        with transaction.atomic():
            # Force delivery delivered
            d.status = 'delivered'
            d.save(update_fields=['status', 'updated_at'])

            # Force associated order delivered
            if d.order:
                o = d.order
                o.status = 'delivered'
                o.save(update_fields=['status', 'updated_at'])

            # If this delivery had a partner, try to auto-assign the next unassigned delivery to same partner
            if d.partner:
                next_qs = models.Delivery.objects.select_for_update(skip_locked=True).filter(partner__isnull=True).exclude(status='delivered').order_by('created_at')
                next_d = next_qs.first()
                if next_d:
                    next_d.partner = d.partner
                    next_d.status = 'assigned'
                    next_d.save(update_fields=['partner', 'status', 'updated_at'])
                    next_assigned = next_d.delivery_id

    except Exception as e:
        print(f"[admin_fix_delivery] failed for {delivery_id}: {e}")
        traceback.print_exc(file=sys.stdout)
        return Response({'error': 'Failed to fix delivery', 'details': str(e)}, status=500)

    # Reload fresh state
    d.refresh_from_db()
    o_status = getattr(d.order, 'status', None)
    after = {
        'delivery_id': d.delivery_id,
        'delivery_status': d.status,
        'partner_id': d.partner_id,
        'order_status': o_status,
    }

    resp = {'fixed': True, 'before': before, 'after': after}
    if next_assigned:
        resp['next_assigned_delivery_id'] = next_assigned
    # audit log for admin repair
    try:
        admin_obj = models.Admin.objects.filter(models.Q(email__iexact=getattr(request.user, 'email', '')) | models.Q(username__iexact=getattr(request.user, 'username', ''))).first()
        details = json.dumps({'delivery_id': d.delivery_id, 'admin_id': getattr(admin_obj, 'admin_id', None), 'next_assigned': next_assigned})
        try:
            models.AnalyticsLog.objects.create(admin=admin_obj, action_type='delivery_fixed', details=details)
        except Exception:
            pass
    except Exception:
        pass
    return Response(resp)


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_list_logs(request):
    """Return recent AnalyticsLog entries for auditing. Superuser only."""
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    qs = models.AnalyticsLog.objects.select_related('admin').order_by('-timestamp')[:500]
    out = []
    for l in qs:
        out.append({
            'log_id': l.log_id,
            'action_type': l.action_type,
            'details': l.details,
            'admin': {'admin_id': l.admin.admin_id, 'username': l.admin.username} if l.admin else None,
            'timestamp': l.timestamp.isoformat() if l.timestamp else None,
        })
    return Response({'logs': out})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_assign_delivery(request, delivery_id):
    # Only main admin may assign deliveries
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    data = request.data or {}
    agent_id = data.get('agent_id')
    partner_id = data.get('partner_id')
    if not agent_id and not partner_id:
        return Response({'error': 'agent_id or partner_id required'}, status=400)
    try:
        delivery = models.Delivery.objects.get(pk=delivery_id)
    except models.Delivery.DoesNotExist:
        return Response({'error': 'Delivery not found'}, status=404)
    partner_obj = None
    # If partner_id provided, prefer direct partner assignment
    if partner_id:
        try:
            partner_obj = models.DeliveryPartner.objects.get(pk=partner_id)
        except models.DeliveryPartner.DoesNotExist:
            return Response({'error': 'Provided partner_id not found'}, status=404)
        delivery.partner = partner_obj
    else:
        # agent_id provided: try legacy DeliveryAgent lookup first, then treat as partner id fallback
        try:
            agent = models.DeliveryAgent.objects.get(pk=agent_id)
            if agent.partner:
                delivery.partner = agent.partner
            else:
                # If agent exists but has no partner, require partner_id to be supplied
                return Response({'error': 'Agent has no partner assigned. Provide partner_id in request.'}, status=400)
        except models.DeliveryAgent.DoesNotExist:
            # Maybe caller supplied a partner id in agent_id (migration case) — try partner lookup
            try:
                partner_obj = models.DeliveryPartner.objects.get(pk=agent_id)
                delivery.partner = partner_obj
            except models.DeliveryPartner.DoesNotExist:
                return Response({'error': 'Agent not found (and no partner with that id)'}, status=404)
    delivery.status = 'assigned'
    delivery.save(update_fields=['partner', 'status', 'updated_at'])

    try:
        # Log whichever identifier we have: legacy agent or new partner
        details = {'delivery_id': delivery.delivery_id}
        try:
            details['agent_id'] = agent.agent_id
        except Exception:
            pass
        try:
            if partner_obj:
                details['partner_id'] = partner_obj.partner_id
        except Exception:
            pass
        models.AnalyticsLog.objects.create(admin=None, action_type='delivery_assigned', details=json.dumps(details))
    except Exception:
        pass

    # Build response with whichever identifier is available for compatibility
    out = {'assigned': True, 'delivery_id': delivery.delivery_id}
    try:
        out['agent_id'] = agent.agent_id
    except Exception:
        pass
    try:
        if partner_obj:
            out['partner_id'] = partner_obj.partner_id
    except Exception:
        pass
    return Response(out)


@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def agent_deliveries(request):
    """
    Returns deliveries assigned to the currently authenticated delivery agent.
    """
    # request.user may be a DeliveryAgent (monkey-patched in CustomTokenAuthentication)
    user = request.user
    # support both legacy DeliveryAgent and new DeliveryPartner authentication
    if not (getattr(user, 'is_agent', False) or getattr(user, 'is_partner', False)):
        return Response({'error': 'Forbidden'}, status=403)

    # find deliveries where partner matches the authenticated partner
    partner_obj = None
    if getattr(user, 'is_partner', False):
        partner_obj = user
    else:
        partner_obj = getattr(user, 'partner', None)
    if not partner_obj:
        return Response({'deliveries': []})
    qs = models.Delivery.objects.filter(partner=partner_obj).order_by('-created_at')
    data = []
    for d in qs:
        data.append({
            'delivery_id': d.delivery_id,
            'order_id': d.order_id,
            'status': d.status,
            'estimated_time': d.estimated_time,
            'route_data': d.route_data,
            'created_at': d.created_at,
        })
    return Response({'deliveries': data})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def agent_mark_delivered(request, delivery_id):
    """
    Agent marks a delivery as delivered. Only allowed for agents assigned to the delivery partner.
    Body: { actual_time_minutes?: int }
    """
    user = request.user
    if not (getattr(user, 'is_agent', False) or getattr(user, 'is_partner', False)):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        d = models.Delivery.objects.get(pk=delivery_id)
    except models.Delivery.DoesNotExist:
        print(f"[agent_mark_delivered] Delivery not found: {delivery_id}")
        return Response({'error': 'Not found'}, status=404)

    print(f"[agent_mark_delivered] called by user={getattr(user, 'partner_id', getattr(user, 'agent_id', None))} for delivery={delivery_id} (current partner_id={getattr(d, 'partner_id', None)}, status={d.status})")

    # ensure this authenticated partner/agent is assigned via partner
    partner_obj = user if getattr(user, 'is_partner', False) else getattr(user, 'partner', None)
    if not d.partner or d.partner_id != getattr(partner_obj, 'partner_id', None):
        return Response({'error': 'Forbidden'}, status=403)

    # mark delivered
    d.status = 'delivered'
    if request.data.get('actual_time') is not None:
        try:
            d.actual_time = int(request.data.get('actual_time'))
        except Exception:
            pass
    try:
        d.save(update_fields=['status', 'actual_time', 'updated_at'])
    except Exception as e:
        print(f"[agent_mark_delivered] failed to save delivery {delivery_id}: {e}")
        traceback.print_exc(file=sys.stdout)
        return Response({'error': 'Failed to update delivery', 'details': str(e)}, status=500)

    # optionally update the associated order status
    try:
        o = d.order
        if not o:
            print(f"[agent_mark_delivered] delivery {delivery_id} has no associated order")
        else:
            o.status = 'delivered'
            try:
                o.save(update_fields=['status', 'updated_at'])
            except Exception as e:
                print(f"[agent_mark_delivered] failed to update order {getattr(o,'order_id', None)}: {e}")
                traceback.print_exc(file=sys.stdout)
    except Exception as e:
        print(f"[agent_mark_delivered] unexpected error updating order for delivery {delivery_id}: {e}")
        traceback.print_exc(file=sys.stdout)

    # After marking delivered, try to auto-assign the next available delivery to this partner
    # Audit log: record that this delivery was marked delivered
    try:
        try:
            models.AnalyticsLog.objects.create(admin=None, action_type='delivery_delivered', details=json.dumps({'delivery_id': d.delivery_id, 'partner_id': getattr(partner_obj, 'partner_id', None), 'order_id': getattr(d.order, 'order_id', None)}))
        except Exception:
            pass
    except Exception:
        pass
    try:
        partner_obj = partner_obj if 'partner_obj' in locals() and partner_obj is not None else (user if getattr(user, 'is_partner', False) else getattr(user, 'partner', None))
        if partner_obj:
            with transaction.atomic():
                # pick the oldest unassigned delivery (partner is null) that is not delivered
                next_qs = models.Delivery.objects.select_for_update(skip_locked=True).filter(partner__isnull=True).exclude(status='delivered').order_by('created_at')
                next_d = next_qs.first()
                if next_d:
                    next_d.partner = partner_obj
                    next_d.status = 'assigned'
                    next_d.save(update_fields=['partner', 'status', 'updated_at'])
                    try:
                        models.AnalyticsLog.objects.create(admin=None, action_type='delivery_auto_assigned', details=json.dumps({'delivery_id': next_d.delivery_id, 'partner_id': partner_obj.partner_id}))
                    except Exception:
                        pass
                    return Response({'marked': True, 'next_assigned_delivery_id': next_d.delivery_id})
    except Exception as e:
        # don't fail the main action if auto-assign fails
        print(f"[agent_mark_delivered] auto-assign failed: {e}")

    return Response({'marked': True})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_agent(request):
    # Admin-side creation of agents is disabled to enforce self-registration + admin approval.
    # Use POST /api/v1/agents/register/ for agent sign-up. Admins may approve via admin endpoints.
    return Response({'error': 'Admin-side agent creation disabled. Use /api/v1/agents/register/ and admin approval endpoints.'}, status=403)


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def admin_resend_agent_otp(request):
    """Admin-only: resend onboarding/login OTP to an agent by agent_id."""
    # Only staff (superuser or mart_admin) may call
    if not getattr(request.user, 'is_staff', False):
        return Response({'error': 'Forbidden'}, status=403)

    data = request.data or {}
    partner_id = data.get('partner_id') or data.get('agent_id')
    if not partner_id:
        return Response({'error': 'partner_id required'}, status=400)

    try:
        p = models.DeliveryPartner.objects.get(pk=partner_id)
    except models.DeliveryPartner.DoesNotExist:
        return Response({'error': 'Partner not found'}, status=404)

    # Create OTP and send
    try:
        code = f"{random.randint(100000, 999999)}"
        models.OTPCode.objects.create(destination=p.email or '', code=code, purpose="login")
        try:
            if p.email:
                send_mail(
                    "SAVR Partner OTP",
                    f"Hello {p.name},\n\nUse this OTP to sign in as a SAVR delivery partner: {code}\nIt expires in 5 minutes.",
                    getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
                    [p.email],
                )
        except Exception as e:
            print(f"[admin_resend_agent_otp] failed to send OTP to {p.email}: {e}")
            traceback.print_exc(file=sys.stdout)
            return Response({'otp_sent': False, 'error': 'Failed to send OTP via email'}, status=502)

        return Response({'otp_sent': True, 'destination': p.email})
    except Exception as e:
        print(f"[admin_resend_agent_otp] error: {e}")
        traceback.print_exc(file=sys.stdout)
        return Response({'otp_sent': False, 'error': 'Internal error'}, status=500)


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def agent_set_password(request):
    """Authenticated delivery agent may set/change their password.

    Requires the agent to be authenticated (DeliveryAgentToken cookie or header).
    Body: { "new_password": "..." }
    """
    user = request.user
    if not (getattr(user, 'is_agent', False) or getattr(user, 'is_partner', False)):
        return Response({'error': 'Forbidden'}, status=403)

    data = request.data or {}
    new_password = data.get('new_password') or ''
    if not new_password or len(new_password) < 8:
        return Response({'error': 'new_password required and must be at least 8 characters'}, status=400)

    try:
        # Update password using Django's hashing
        user.password_hash = make_password(new_password)
        user.save(update_fields=['password_hash'])
        return Response({'changed': True})
    except Exception as e:
        print(f"[agent_set_password] failed to set password for user {getattr(user, 'agent_id', getattr(user, 'partner_id', None))}: {e}")
        traceback.print_exc(file=sys.stdout)
        return Response({'error': 'Failed to set password'}, status=500)


@api_view(["DELETE"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_agent(request, agent_id):
    # superuser or mart admin may delete agents; mart admin only for their mart
    if not getattr(request.user, 'is_staff', False):
        return Response({'error': 'Forbidden'}, status=403)
    # support deleting partners (new) or legacy agents
    target = None
    try:
        target = models.DeliveryAgent.objects.get(pk=agent_id)
        legacy = True
    except models.DeliveryAgent.DoesNotExist:
        try:
            target = models.DeliveryPartner.objects.get(pk=agent_id)
            legacy = False
        except models.DeliveryPartner.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

    if not getattr(request.user, 'is_superuser', False):
        admin_obj = models.Admin.objects.filter(models.Q(email__iexact=getattr(request.user, 'email', '')) | models.Q(username__iexact=getattr(request.user, 'username', ''))).first()
        if not admin_obj:
            return Response({'error': 'Forbidden'}, status=403)
        # for legacy agent, the partner->mart check applies; for partner, no mart relation so deny non-superuser
        if legacy:
            if not target.partner or target.partner.mart_id not in [m.mart_id for m in models.Mart.objects.filter(admin=admin_obj)]:
                return Response({'error': 'Forbidden'}, status=403)
        else:
            return Response({'error': 'Forbidden'}, status=403)

    try:
        target.delete()
        return Response({'deleted': True})
    except Exception as e:
        # Log and return error details to help admins debug why deletion failed (e.g., DB constraints, signal errors)
        print(f"[delete_agent] failed to delete target {agent_id}: {e}")
        traceback.print_exc(file=sys.stdout)
        return Response({'error': 'Failed to delete target', 'details': str(e)}, status=500)


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def assign_mart_to_admin(request):
    # main admin only: assign an Admin user to a Mart
    if not getattr(request.user, 'is_superuser', False):
        return Response({'error': 'Forbidden'}, status=403)
    data = request.data or {}
    admin_id = data.get('admin_id')
    mart_id = data.get('mart_id')
    if not admin_id or not mart_id:
        return Response({'error': 'admin_id and mart_id required'}, status=400)
    try:
        admin_obj = models.Admin.objects.get(pk=admin_id)
        mart = models.Mart.objects.get(pk=mart_id)
    except (models.Admin.DoesNotExist, models.Mart.DoesNotExist):
        return Response({'error': 'Not found'}, status=404)
    mart.admin = admin_obj
    mart.save(update_fields=['admin', 'updated_at'])
    return Response({'assigned': True})

# --- Forgot / Reset Password ---
def _six_digit_code():
    # always 6 digits, left-padded with zeros
    return f"{secrets.randbelow(1_000_000):06d}"

@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    """
    Body: { "email": "user@example.com" }
    Creates a 6-digit reset code (purpose='reset') and emails it in a link.
    """
    data = request.data or {}
    email = (data.get("email") or "").strip()
    if not email:
        return Response({"error": "email required"}, status=400)

    # Privacy: always respond 200 even if user doesn't exist
    if models.User.objects.filter(email=email).exists():
        code = _six_digit_code()  # fits a CharField(max_length=6)
        # store it as OTPCode (purpose='reset')
        models.OTPCode.objects.create(destination=email, code=code, purpose="reset")

        # Build link the frontend can open: /reset-password/<code>
        fe_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
        reset_link = f"{fe_base}/reset-password/{code}"

        sent_via = "smtp"
        try:
            send_mail(
                "SAVR Password Reset",
                f"Use this link to reset your password: {reset_link}\n"
                f"Or enter this code on the reset page: {code}\n\n"
                f"If you didn't request this, you can ignore it.",
                getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
                [email],
            )
        except Exception as e:
            print(f"[forgot_password] send_mail failed: {e}, Code: {code}")
            traceback.print_exc(file=sys.stdout)
            return Response({"sent": False, "error": "Failed to send password reset email"}, status=502)

    return Response({"sent": True})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Body: { "token": "<6-digit-code>", "new_password": "..." }
    Uses OTPCode(purpose='reset', code=token).
    """
    data = request.data or {}
    token = (data.get("token") or "").strip()
    new_password = (data.get("new_password") or "")

    if not token or not new_password:
        return Response({"error": "token and new_password required"}, status=400)
    if len(new_password) < 8:
        return Response({"error": "Password too short"}, status=400)

    try:
        otp = models.OTPCode.objects.filter(
            purpose="reset", code=token, used=False
        ).latest("created_at")
    except models.OTPCode.DoesNotExist:
        return Response({"error": "Invalid or expired reset token"}, status=400)

    if timezone.now() > otp.expires_at:
        return Response({"error": "Reset token expired"}, status=400)

    user = models.User.objects.filter(email=otp.destination).first()
    if not user:
        return Response({"error": "User not found"}, status=404)

    # Update password (adapt to your field names/auth)
    from django.contrib.auth.hashers import make_password
    user.password_hash = make_password(new_password)
    user.save(update_fields=["password_hash"])

    otp.used = True
    otp.save(update_fields=["used"])
    return Response({"reset": True})
# ---------- NEW: auth/me ----------
@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user

    # If authenticated as a delivery partner (new flow) or legacy delivery agent
    if getattr(user, 'is_partner', False):
        return Response({
            "partner_id": user.partner_id,
            "name": user.name,
            "email": user.email,
            "phone": getattr(user, 'phone', None),
            "role": "partner",
        })
    if getattr(user, 'is_agent', False):
        partner_id = getattr(user.partner, 'partner_id', None) if getattr(user, 'partner', None) else None
        return Response({
            "agent_id": user.agent_id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "partner_id": partner_id,
            "role": "agent",
        })

    # Otherwise treat as normal User/Admin
    default_addr = (
        models.Address.objects.filter(user=user, is_default=True).first()
        or models.Address.objects.filter(user=user).order_by("-updated_at").first()
    )
    addr_payload = None
    if default_addr:
        addr_payload = {
            "id": default_addr.address_id,
            "label": default_addr.label,
            "line1": default_addr.line1,
            "line2": default_addr.line2,
            "city": default_addr.city,
            "state": default_addr.state,
            "pincode": default_addr.pincode,
            "is_default": default_addr.is_default,
            "lat": float(default_addr.location_lat) if default_addr.location_lat else None,
            "long": float(default_addr.location_long) if default_addr.location_long else None,
        }
    return Response({
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "contact_number": user.contact_number,
        "is_staff": getattr(user, 'is_staff', False),
        "is_superuser": getattr(user, 'is_superuser', False),
        "default_address": addr_payload,
    })


# Dev-only: echo request cookies and key headers so we can debug cookie behavior locally
@api_view(["GET"])
@permission_classes([AllowAny])
def debug_cookies(request):
    # Only enable on DEBUG to avoid exposing headers in production
    try:
        from django.conf import settings as _settings
        if not getattr(_settings, 'DEBUG', False):
            return Response({'error': 'Not available'}, status=404)
    except Exception:
        pass

    data = {
        'cookies': request.COOKIES,
        'origin': request.META.get('HTTP_ORIGIN'),
        'cookie_header': request.META.get('HTTP_COOKIE'),
        'authorization': request.META.get('HTTP_AUTHORIZATION'),
        'user_agent': request.META.get('HTTP_USER_AGENT'),
    }
    return Response(data)


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def logout(request):
    # If the token is a UserToken and present in header, delete it. Also clear cookie.
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    token_key = None
    if auth_header.startswith('Token '):
        token_key = auth_header.split(' ', 1)[1].strip()
    # attempt delete user token
    try:
        if token_key:
            models.UserToken.objects.filter(token_key=token_key).delete()
    except Exception:
        pass

    resp = Response({"logout": True})
    # Clear cookie
    resp.delete_cookie(getattr(settings, "AUTH_COOKIE_NAME", "auth_token"), path='/')
    return resp


# --------------------- Address Management ---------------------
@api_view(["GET", "POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def addresses(request):
    user = request.user

    if request.method == "GET":
        addrs = models.Address.objects.filter(user=user).order_by("-is_default", "-updated_at")
        return Response(serializers.AddressSerializer(addrs, many=True).data)

    # POST
    data = request.data or {}
    # Accept either a textual address (line1) or explicit coordinates from client
    if not data.get("line1") and not (data.get("location_lat") and data.get("location_long")):
        return Response({"error": "line1 or location_lat/location_long is required"}, status=400)

    # Prefer client-supplied coords when present (skip server geocoding)
    lat = None
    lng = None
    if data.get("location_lat") is not None and data.get("location_long") is not None:
        try:
            lat = data.get("location_lat")
            lng = data.get("location_long")
        except Exception:
            lat, lng = None, None

    # If we don't have coords yet, validate + try geocoding the assembled address
    if lat is None or lng is None:
        pin = (data.get("pincode") or "").strip()
        if not pin or not re.fullmatch(r"\d{6}", str(pin)):
            return Response({"error": "Valid 6-digit pincode required"}, status=400)

        full = ", ".join(filter(None, [
            data.get("line1"), data.get("line2"),
            data.get("city") or "Visakhapatnam",
            data.get("state") or "Andhra Pradesh",
            pin,
        ]))
        if full:
            lat, lng = get_lat_long_from_address(full)

    addr = models.Address.objects.create(
        user=user,
        label=data.get("label"),
        contact_name=data.get("contact_name"),
        contact_phone=data.get("contact_phone"),
        line1=data.get("line1") or '',
        line2=data.get("line2"),
        city=data.get("city", "Visakhapatnam"),
        state=data.get("state", "Andhra Pradesh"),
        pincode=data.get("pincode"),
        location_lat=lat,
        location_long=lng,
        is_default=bool(data.get("is_default", False)),
        instructions=data.get("instructions"),
    )
    # ensure only one default
    if addr.is_default or models.Address.objects.filter(user=user).count() == 1:
        models.Address.objects.filter(user=user).exclude(pk=addr.pk).update(is_default=False)
        addr.is_default = True
        addr.save(update_fields=["is_default"])

    return Response(serializers.AddressSerializer(addr).data, status=201)

# --------------------- Address Management ---------------------
@api_view(["GET", "POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def addresses(request):
    user = request.user

    if request.method == "GET":
        addrs = models.Address.objects.filter(user=user).order_by("-is_default", "-updated_at")
        return Response(serializers.AddressSerializer(addrs, many=True).data)

    # POST
    data = request.data or {}
    # Accept either a textual address (line1) or explicit coordinates from client
    if not data.get("line1") and not (data.get("location_lat") and data.get("location_long")):
        return Response({"error": "line1 or location_lat/location_long is required"}, status=400)

    # Prefer client-supplied coords when present (skip server geocoding)
    lat = None
    lng = None
    if data.get("location_lat") is not None and data.get("location_long") is not None:
        try:
            lat = data.get("location_lat")
            lng = data.get("location_long")
        except Exception:
            lat, lng = None, None

    # If we don't have coords yet, validate + try geocoding the assembled address
    if lat is None or lng is None:
        pin = (data.get("pincode") or "").strip()
        if not pin or not re.fullmatch(r"\d{6}", str(pin)):
            return Response({"error": "Valid 6-digit pincode required"}, status=400)

        full = ", ".join(filter(None, [
            data.get("line1"), data.get("line2"),
            data.get("city") or "Visakhapatnam",
            data.get("state") or "Andhra Pradesh",
            pin,
        ]))
        if full:
            lat, lng = get_lat_long_from_address(full)

    addr = models.Address.objects.create(
        user=user,
        label=data.get("label"),
        contact_name=data.get("contact_name"),
        contact_phone=data.get("contact_phone"),
        line1=data.get("line1") or '',
        line2=data.get("line2"),
        city=data.get("city", "Visakhapatnam"),
        state=data.get("state", "Andhra Pradesh"),
        pincode=data.get("pincode"),
        location_lat=lat,
        location_long=lng,
        is_default=bool(data.get("is_default", False)),
        instructions=data.get("instructions"),
    )
    # ensure only one default
    if addr.is_default or models.Address.objects.filter(user=user).count() == 1:
        models.Address.objects.filter(user=user).exclude(pk=addr.pk).update(is_default=False)
        addr.is_default = True
        addr.save(update_fields=["is_default"])

    return Response(serializers.AddressSerializer(addr).data, status=201)


@api_view(["PUT", "DELETE"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def address_detail(request, address_id):
    try:
        addr = models.Address.objects.get(pk=address_id, user=request.user)
    except models.Address.DoesNotExist:
        return Response({"error": "Address not found"}, status=404)

    if request.method == "DELETE":
        was_default = addr.is_default
        addr.delete()
        if was_default:
            nxt = models.Address.objects.filter(user=request.user).order_by("-updated_at").first()
            if nxt:
                nxt.is_default = True
                nxt.save(update_fields=["is_default"])
        return Response({"deleted": True})

    # PUT
    data = request.data or {}
    for f in ["label","contact_name","contact_phone","line1","line2","city","state","pincode","instructions","is_default"]:
        if f in data:
            setattr(addr, f, data[f])

    if any(k in data for k in ["line1","line2","city","state","pincode"]):
        # require a valid PIN if we need to re-geocode (when coords missing or text changed)
        pin = (addr.pincode or "").strip()
        if not pin or not re.fullmatch(r"\d{6}", str(pin)):
            return Response({"error": "Valid 6-digit pincode required"}, status=400)

        full = ", ".join(filter(None, [addr.line1, addr.line2, addr.city, addr.state, addr.pincode]))
        lat, lng = get_lat_long_from_address(full) if full else (None, None)
        addr.location_lat, addr.location_long = lat, lng

    addr.save()

    if data.get("is_default"):
        models.Address.objects.filter(user=request.user).exclude(pk=addr.pk).update(is_default=False)

    return Response(serializers.AddressSerializer(addr).data)


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def set_default_address(request, address_id):
    user = request.user
    try:
        addr = models.Address.objects.get(pk=address_id, user=user)
    except models.Address.DoesNotExist:
        return Response({"error": "Address not found"}, status=404)

    models.Address.objects.filter(user=user).update(is_default=False)
    addr.is_default = True
    addr.save()

    return Response({"message": "Default address set"})


# --------------------- Basket & Optimizer ---------------------
@api_view(["GET", "POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def basket_view(request):
    if request.method == "GET":
        baskets = models.Basket.objects.filter(user=request.user).order_by("-created_at")
        return Response(serializers.BasketSerializer(baskets, many=True).data)

    data = request.data or {}
    basket = models.Basket.objects.create(
        user=request.user,
        items=data.get("items", []),
        optimized_cost=data.get("optimized_cost"),
    )
    return Response(serializers.BasketSerializer(basket).data, status=201)


def _get_user_delivery_point(user: models.User, address_id: Optional[int] = None) -> Tuple[models.Address, float, float]:
    """
    Resolve an Address for the user and return (address_obj, lat, long).
    Prefers passed address_id, else default address, else newest address.
    """
    addr_qs = models.Address.objects.filter(user=user)
    if address_id:
        addr = addr_qs.filter(pk=address_id).first()
        if not addr:
            raise ValueError("Address not found")
    else:
        addr = addr_qs.filter(is_default=True).first() or addr_qs.order_by("-updated_at").first()
        if not addr:
            raise ValueError("No address on file")

    if not (addr.location_lat and addr.location_long):
        full = ", ".join(filter(None, [addr.line1, addr.line2, addr.city, addr.state, addr.pincode]))
        lat, lng = get_lat_long_from_address(full)
        if not (lat and lng):
            raise ValueError("Address could not be geocoded. Please include City, State, and a 6-digit PIN code.")
        addr.location_lat, addr.location_long = lat, lng
        addr.save(update_fields=["location_lat", "location_long"])

    return addr, float(addr.location_lat), float(addr.location_long)


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def optimize_basket(request):
    """
    Body:
    {
      "items": [{ "product_id": 1, "quantity": 2, "weight_kg": 1.5? }, ...],
      "address_id": 123?,                     # optional; else uses default address
      "allow_swaps": true/false               # default true
    }
    Returns a plan grouped per mart with delivery charges, ETAs, and item images.
    """
    try:
        data = request.data or {}
        items = data.get("items", [])
        allow_swaps = bool(data.get("allow_swaps", True))
        address_id = data.get("address_id")

        if not isinstance(items, list) or not items:
            return Response({"error": "items are required"}, status=400)

        # 1) Resolve user address + coordinates (will geocode if needed)
        try:
            addr, addr_lat, addr_long = _get_user_delivery_point(request.user, address_id=address_id)
        except ValueError as e:
            # e.g., "Address could not be geocoded..."
            return Response({"error": str(e)}, status=400)

        # 2) Load products referenced in items (map id -> product)
        product_map: Dict[int, models.Product] = {}
        for it in items:
            pid = it.get("product_id")
            if pid is None:
                continue
            p = models.Product.objects.filter(pk=pid).select_related("mart").first()
            if p:
                product_map[pid] = p

        if not product_map:
            return Response({"error": "No valid products found for given items"}, status=400)

        # 3) Build swap candidates by product name (approved & in stock only)
        variants_by_name: Dict[str, List[models.Product]] = {}
        if allow_swaps:
            for nm in {p.name for p in product_map.values()}:
                variants_by_name[nm] = list(
                    models.Product.objects.filter(
                        name=nm, mart__approved=True, stock__gt=0
                    ).select_related("mart")
                )

        # 4) Normalize working items (quantity, per-unit weight, pick cheapest variant if allowed)
        work_items: List[Dict] = []
        for it in items:
            pid = it.get("product_id")
            qty = int(it.get("quantity", 1))
            base = product_map.get(pid)
            if not base:
                continue

            # per-unit weight: request override > product.unit_weight_kg > 1.0 default
            if it.get("weight_kg") is not None:
                weight_each = float(it.get("weight_kg"))
            else:
                uw = getattr(base, "unit_weight_kg", None)
                weight_each = float(uw) if uw is not None else 1.0

            # skip non-approved or OOS, unless we can swap
            if (not getattr(base.mart, "approved", True)) or (getattr(base, "stock", 0) <= 0):
                if allow_swaps:
                    alts = variants_by_name.get(base.name, [])
                    if not alts:
                        continue
                    base = min(alts, key=lambda pr: float(pr.price))
                else:
                    continue

            chosen = base
            if allow_swaps:
                cand = variants_by_name.get(base.name) or [base]
                if cand:
                    chosen = min(cand, key=lambda pr: float(pr.price))

            work_items.append({
                "name": chosen.name,
                "product": chosen,
                "qty": qty,
                "weight_total": weight_each * qty,
                "unit_price": float(chosen.price),
            })

        if not work_items:
            return Response({"error": "No purchasable items (all out-of-stock or unapproved)"}, status=400)

        # 5) Helper to compute totals for a mart assignment
        def compute_totals(assign: Dict[int, List[Dict]]) -> Dict:
            total_price = 0.0
            total_delivery = 0.0
            total_eta = 0
            mart_breakdown = []

            for mart_id, its in assign.items():
                if not its:
                    continue
                mart = its[0]["product"].mart
                if not getattr(mart, "approved", True):
                    continue

                mart_weight = sum(i["weight_total"] for i in its)
                items_price = sum(i["unit_price"] * i["qty"] for i in its)
                dist = distance_km_between(addr_lat, addr_long, float(mart.location_lat), float(mart.location_long))
                delivery = calculate_delivery_charge(dist, mart_weight)
                eta = eta_minutes_from_distance(dist)

                total_price += items_price
                total_delivery += delivery
                total_eta += eta

                # Attach image_url (ensuring product has one)
                mart_breakdown.append({
                    "mart_id": mart.mart_id,
                    "mart_name": mart.name,
                    "distance_km": round(dist, 3),
                    "eta_min": eta,
                    "weight_kg": round(mart_weight, 3),
                    "delivery_charge": int(delivery),
                    "items": [
                        {
                            "product_id": i["product"].product_id,
                            "name": i["name"],
                            "qty": i["qty"],
                            "unit_price": i["unit_price"],
                            "line_price": round(i["unit_price"] * i["qty"], 2),
                            "image_url": ensure_product_image(i["product"]).image_url,
                        }
                        for i in its
                    ]
                })

            grand_total = round(total_price + total_delivery, 2)
            return {
                "items_price": round(total_price, 2),
                "delivery_total": int(total_delivery),
                "grand_total": grand_total,
                "eta_total_min": int(total_eta),
                "marts": mart_breakdown,
            }

        # 6) Initial assignment (group by mart, only approved)
        assignment: Dict[int, List[Dict]] = {}
        for wi in work_items:
            if getattr(wi["product"].mart, "approved", True):
                m_id = wi["product"].mart_id
                assignment.setdefault(m_id, []).append(wi)

        if not assignment:
            return Response({"error": "No approved marts available for these items"}, status=400)

        best_plan = compute_totals(assignment)

        # 7) Greedy improvements: move items across marts to reduce grand_total (break ties by ETA)
        if allow_swaps:
            improved = True
            iters = 0
            while improved and iters < 50:
                improved = False
                iters += 1

                for src_mart_id, items_list in list(assignment.items()):
                    # Make a snapshot of list since we may mutate
                    for itm in list(items_list):
                        name = itm["name"]
                        candidates = [
                            pr for pr in variants_by_name.get(name, [])
                            if getattr(pr.mart, "approved", True) and getattr(pr, "stock", 0) > 0
                        ]
                        if not candidates:
                            continue

                        for cand_prod in candidates:
                            tgt_mart_id = cand_prod.mart_id
                            if tgt_mart_id == src_mart_id:
                                continue

                            # ensure current still present (could be moved in same pass)
                            if src_mart_id not in assignment or itm not in assignment.get(src_mart_id, []):
                                continue

                            # simulate move
                            assignment[src_mart_id].remove(itm)
                            if not assignment.get(src_mart_id):
                                assignment.pop(src_mart_id, None)

                            moved = dict(itm)
                            moved["product"] = cand_prod
                            moved["unit_price"] = float(cand_prod.price)
                            assignment.setdefault(tgt_mart_id, []).append(moved)

                            new_plan = compute_totals(assignment)

                            if (new_plan["grand_total"] < best_plan["grand_total"]) or (
                                new_plan["grand_total"] == best_plan["grand_total"]
                                and new_plan["eta_total_min"] < best_plan["eta_total_min"]
                            ):
                                best_plan = new_plan
                                improved = True
                            else:
                                # revert
                                assignment[tgt_mart_id].remove(moved)
                                if not assignment.get(tgt_mart_id):
                                    assignment.pop(tgt_mart_id, None)
                                assignment.setdefault(src_mart_id, []).append(itm)

                    if src_mart_id in assignment and not assignment[src_mart_id]:
                        assignment.pop(src_mart_id, None)

        # 8) Always return a Response
        return Response({
            "address": {
                "id": addr.address_id,
                "summary": f"{addr.line1}, {addr.city}" + (f" {addr.pincode}" if addr.pincode else ""),
                "lat": addr_lat,
                "long": addr_long,
            },
            "items_count": sum(i["qty"] for bucket in assignment.values() for i in bucket),
            "result": best_plan,
            "notes": "Pricing: ₹5/km + ₹5/kg. ETA tie-break when costs are equal. Approved marts & in-stock only.",
        })

    except Exception as e:
        # Final safety net so we never return None
        print("optimize_basket crashed:", e)
        return Response({"error": f"Internal error: {e.__class__.__name__}"}, status=500)

# --------------------- Orders ---------------------
@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_order(request):
    """
    Creates a single Order in DB from a list of items (non-plan flow).
    Body:
      {
        "items": [{ "product_id": X, "quantity": N, "weight_kg": opt? }, ...],
        "address_id": 123,                # or "address": { ... } to create
        "contact_number": "9999999999",
        "payment_id": <optional local Payment.payment_id>,   # numeric
        "payment_method": "COD" | "online" (optional),
        "amount": <optional explicit total>  # optional override
      }

    Behaviour:
      - Validates address and geocodes if necessary.
      - Creates Order + OrderItem rows, selects a best mart (nearest approved),
        computes delivery charge (your existing rules), and stores snapshot.
      - If `payment_id` passed and Payment exists, links it to the created Order;
        if Payment.status == "success", mark order.status = "confirmed".
      - Returns serialized order payload.
    """
    data = request.data or {}
    items = data.get("items", [])
    address_id = data.get("address_id")
    address_obj_payload = data.get("address")
    contact_number = data.get("contact_number")
    payment_id = data.get("payment_id")  # optional
    payment_method = (data.get("payment_method") or "").lower() or None
    explicit_amount = data.get("amount", None)

    if not items:
        return Response({"error": "items are required"}, status=400)
    if not (address_id or address_obj_payload):
        return Response({"error": "address_id or address object is required"}, status=400)
    if not contact_number:
        return Response({"error": "contact_number is required"}, status=400)

    # Resolve / create address
    addr = None
    if address_id:
        try:
            addr = models.Address.objects.get(pk=address_id, user=request.user)
        except models.Address.DoesNotExist:
            return Response({"error": "Address not found"}, status=404)
    elif address_obj_payload:
        ap = address_obj_payload
        addr = models.Address.objects.create(
            user=request.user,
            line1=ap.get('line1', ''),
            line2=ap.get('line2'),
            city=ap.get('city', 'Visakhapatnam'),
            state=ap.get('state', 'Andhra Pradesh'),
            pincode=ap.get('pincode'),
            contact_phone=ap.get('contact_phone'),
            location_lat=ap.get('location_lat'),
            location_long=ap.get('location_long'),
        )

    # Ensure address coordinates exist (geocode if necessary)
    if not (addr.location_lat and addr.location_long):
        full_addr = ", ".join(filter(None, [addr.line1, addr.line2, addr.city, addr.state, addr.pincode]))
        lat, lng = get_lat_long_from_address(full_addr)
        if not (lat and lng):
            return Response({"error": "Address could not be geocoded. Please include City, State, and a 6-digit PIN code."}, status=400)
        addr.location_lat, addr.location_long = lat, lng
        addr.save(update_fields=["location_lat", "location_long"])

    # Build order inside a transaction
    try:
        with transaction.atomic():
            # create a skeleton order (total_cost will be set later)
            order = models.Order.objects.create(user=request.user, total_cost=0, status="pending")

            total_cost = Decimal("0")
            total_weight = 0.0
            marts_in_order = set()

            # validate items, add OrderItem rows
            for item in items:
                pid = item.get("product_id")
                qty = int(item.get("quantity", item.get("qty", 1)))
                if not pid or qty <= 0:
                    continue

                product = models.Product.objects.filter(pk=pid).select_related("mart").first()
                if not product:
                    # skip unknown products silently (mirror previous behavior)
                    continue

                # per-unit weight: request override > product.unit_weight_kg > 1.0
                if item.get("weight_kg") is not None:
                    weight_each = float(item.get("weight_kg"))
                else:
                    uw = getattr(product, "unit_weight_kg", None)
                    weight_each = float(uw) if uw is not None else 1.0

                line_price = (Decimal(qty) * product.price)
                total_cost += line_price
                total_weight += weight_each * qty
                marts_in_order.add(product.mart_id)

                models.OrderItem.objects.create(
                    order=order,
                    product=product,
                    mart=product.mart,
                    quantity=qty,
                    price_at_purchase=product.price,
                )

            # If explicit amount override provided, prefer it for total calculation baseline
            if explicit_amount is not None:
                try:
                    total_cost = Decimal(str(explicit_amount))
                except Exception:
                    pass


            # (admin_login was previously mistakenly nested here; moved to top-level after verify_otp)

            # choose nearest approved mart among candidate marts; fallback to any approved mart
            candidate_marts = models.Mart.objects.filter(mart_id__in=list(marts_in_order), approved=True)
            if not candidate_marts.exists():
                candidate_marts = models.Mart.objects.filter(approved=True)

            chosen_mart = None
            best_dist = None
            for m in candidate_marts:
                try:
                    d = distance_km_between(
                        float(addr.location_lat), float(addr.location_long),
                        float(m.location_lat), float(m.location_long)
                    )
                except Exception:
                    d = 0.0
                if chosen_mart is None or d < best_dist:
                    chosen_mart = m
                    best_dist = d

            # compute delivery charge using your existing rule
            delivery_charge = calculate_delivery_charge(best_dist if best_dist is not None else 0.0, total_weight)
            total_cost += Decimal(delivery_charge)

            # attach delivery address snapshot and coordinates
            if addr:
                order.delivery_address = addr
                try:
                    order.delivery_address_snapshot = f"{addr.line1}, {addr.city}, {addr.state} {addr.pincode}"
                    order.delivery_address_lat = addr.location_lat
                    order.delivery_address_long = addr.location_long
                except Exception:
                    pass

            order.total_cost = total_cost
            order.save()

            # Link Payment if payment_id supplied
            if payment_id:
                try:
                    p = models.Payment.objects.filter(payment_id=payment_id).first()
                except Exception:
                    p = None

                if p:
                    p.order = order
                    p.save(update_fields=["order", "updated_at"])
                    # If payment already successful, update order status
                    if getattr(p, "status", "") == "success":
                        order.status = "confirmed"
                        order.save(update_fields=["status", "updated_at"])

            # If client explicitly chose payment_method == 'cod', we can keep 'pending' status
            # Optionally, you can store payment_method on order if you add such a field.
            # Prepare payload similar to other order responses you return elsewhere.
            payload = serializers.OrderSerializer(order).data
            payload.update({
                "delivery_address": f"{addr.line1}, {addr.city}",
                "contact_number": contact_number,
                "chosen_mart_id": chosen_mart.mart_id if chosen_mart else None,
                "chosen_mart_name": chosen_mart.name if chosen_mart else None,
                "distance_km": round(best_dist, 3) if best_dist is not None else None,
                "delivery_charge": int(delivery_charge),
                "total_weight_kg": round(total_weight, 3),
            })

            return Response(payload, status=201)

    except Exception as e:
        # transaction will roll back automatically
        print("create_order failed:", e)
        return Response({"error": f"Order creation failed: {str(e)}"}, status=500)

@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_order_from_plan(request):
    """
    Accepts a full optimizer plan and creates one Order per mart described in the plan.
    Body:
    {
      "plan": { "marts": [ { "mart_id": 1, "items": [{"product_id":X, "qty":N}, ...] }, ... ] },
      "address_id": 123,
      "contact_number": "999..."
    }
    Returns: { orders: [ order_payload, ... ] }
    """
    data = request.data or {}
    # create_order_from_plan receives a plan produced by the optimizer
    plan = data.get("plan")
    address_id = data.get("address_id")
    contact_number = data.get("contact_number")

    if not plan or not isinstance(plan, dict) or not plan.get("marts"):
        return Response({"error": "plan with marts is required"}, status=400)
    if not address_id or not contact_number:
        return Response({"error": "address_id and contact_number are required"}, status=400)

    addr = None
    if address_id:
        try:
            addr = models.Address.objects.get(pk=address_id, user=request.user)
        except models.Address.DoesNotExist:
            return Response({"error": "Address not found"}, status=404)
    elif data.get('address'):
        ap = data.get('address')
        addr = models.Address.objects.create(
            user=request.user,
            line1=ap.get('line1',''),
            line2=ap.get('line2'),
            city=ap.get('city','Visakhapatnam'),
            state=ap.get('state','Andhra Pradesh'),
            pincode=ap.get('pincode'),
            contact_phone=ap.get('contact_phone'),
            location_lat=ap.get('location_lat'),
            location_long=ap.get('location_long'),
        )

    # ensure address coords
    if not (addr.location_lat and addr.location_long):
        full_addr = ", ".join(filter(None, [addr.line1, addr.line2, addr.city, addr.state, addr.pincode]))
        lat, lng = get_lat_long_from_address(full_addr)
        if not (lat and lng):
            return Response({"error": "Address could not be geocoded. Please include City, State, and a 6-digit PIN code."}, status=400)
        addr.location_lat, addr.location_long = lat, lng
        addr.save(update_fields=["location_lat", "location_long"])

    created = []
    try:
        with transaction.atomic():
            for mart_entry in plan.get("marts", []):
                mart_id = mart_entry.get("mart_id")
                items = mart_entry.get("items", [])
                if not mart_id or not items:
                    continue

                # resolve mart object
                mart_obj = models.Mart.objects.filter(mart_id=mart_id, approved=True).first()
                if not mart_obj:
                    # skip this mart
                    continue

                # collect valid products first; skip mart if nothing valid
                total_cost = Decimal("0")
                total_weight = 0.0
                collected_items = []

                for it in items:
                    pid = it.get("product_id")
                    qty = int(it.get("qty", it.get("quantity", 1)))
                    product = models.Product.objects.filter(pk=pid, mart__mart_id=mart_id).select_related("mart").first()
                    # fallback: try to fetch product irrespective of mart
                    if not product:
                        product = models.Product.objects.filter(pk=pid).select_related("mart").first()
                    if not product:
                        continue

                    # per-unit weight: product.unit_weight_kg > 1.0 default
                    uw = getattr(product, "unit_weight_kg", None)
                    weight_each = float(uw) if uw is not None else 1.0
                    total_weight += weight_each * qty

                    total_cost += Decimal(qty) * product.price

                    collected_items.append((product, qty))

                if not collected_items:
                    # nothing valid for this mart -> skip
                    continue

                order = models.Order.objects.create(user=request.user, total_cost=0, status="pending")

                for product, qty in collected_items:
                    models.OrderItem.objects.create(
                        order=order,
                        product=product,
                        mart=product.mart,
                        quantity=qty,
                        price_at_purchase=product.price,
                    )

                # compute delivery charge based on distance between mart and address
                try:
                    dist = distance_km_between(float(addr.location_lat), float(addr.location_long), float(mart_obj.location_lat), float(mart_obj.location_long))
                except Exception:
                    dist = 0.0

                delivery_charge = calculate_delivery_charge(dist, total_weight)
                total_cost += Decimal(delivery_charge)

                # attach delivery address snapshot
                if addr:
                    order.delivery_address = addr
                    try:
                        order.delivery_address_snapshot = f"{addr.line1}, {addr.city}, {addr.state} {addr.pincode}"
                        order.delivery_address_lat = addr.location_lat
                        order.delivery_address_long = addr.location_long
                    except Exception:
                        pass

                order.total_cost = total_cost
                order.save()

                payload = serializers.OrderSerializer(order).data
                payload.update({
                    "delivery_address": f"{addr.line1}, {addr.city}",
                    "contact_number": contact_number,
                    "chosen_mart_id": mart_obj.mart_id,
                    "chosen_mart_name": mart_obj.name,
                    "distance_km": round(dist, 3),
                    "delivery_charge": int(delivery_charge),
                    "total_weight_kg": round(total_weight, 3),
                })
                created.append(payload)

    except Exception as e:
        # rollback will occur automatically because of transaction.atomic()
        print('create_order_from_plan failed:', e)
        return Response({"error": f"Plan creation failed: {str(e)}"}, status=500)

    if not created:
        return Response({"error": "No orders were created from plan"}, status=400)

    return Response({"orders": created})


# --------------------- Nearby marts (by free-form address string) ---------------------
@api_view(["POST"])
def nearby_marts(request):
    data = request.data or {}
    address = data.get("address")
    radius_km = data.get("radius_km", None)
    weight_kg = float(data.get("weight_kg", 1.0))

    if not address:
        return Response({"error": "address is required"}, status=400)

    lat, lng = get_lat_long_from_address(address)
    if not (lat and lng):
        return Response({"error": "Could not geocode address"}, status=400)

    marts_qs = models.Mart.objects.filter(approved=True)
    marts_list = marts_with_distances_to(lat, lng, marts_qs, weight_kg=weight_kg)

    if radius_km is not None:
        try:
            r = float(radius_km)
            marts_list = [m for m in marts_list if m["distance_km"] <= r]
        except Exception:
            pass

    return Response({
        "address": address,
        "address_lat": float(lat),
        "address_long": float(lng),
        "assumed_weight_kg": weight_kg,
        "marts": marts_list
    })


@api_view(["POST"])
def parse_shopping_list(request):
    text = (request.data or {}).get("text", "")
    if not text:
        return Response({"error": "text required"}, status=400)
    items = [i.strip() for i in text.replace("\n", ",").split(",") if i.strip()]
    return Response({"items": items})

@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def list_orders(request):
    qs = models.Order.objects.filter(user=request.user).order_by("-created_at")
    # optimize queries
    qs = qs.select_related("delivery_address").prefetch_related("orderitem_set__product__mart")
    data = serializers.OrderSerializer(qs, many=True).data
    return Response(data)

# ---------- Razorpay endpoints ----------
@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_razorpay_order(request):
    """
    POST body: { amount: 499.00, currency: "INR", receipt: "optional", notes: {...} }
    Returns: { key_id, razorpay_order_id, payment_id, amount, currency }
    """
    data = request.data or {}
    amount = data.get("amount")
    currency = data.get("currency", "INR")
    receipt = data.get("receipt")
    notes = data.get("notes", {})

    if amount is None:
        return Response({"error": "amount is required"}, status=400)

    try:
        # create local Payment row (amount in main units, e.g. 499.00)
        payment = models.Payment.objects.create(
            order=None,
            provider="razorpay",
            amount=Decimal(str(amount)),
            currency=currency,
            status="pending",
            raw_payload={"notes": notes},
        )

        # convert to paise (integer)
        amount_paise = int(round(float(amount) * 100))

        key_id = getattr(settings, "RAZORPAY_KEY_ID", os.environ.get("RAZORPAY_KEY_ID"))
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", os.environ.get("RAZORPAY_KEY_SECRET"))
        if not key_id or not key_secret:
            return Response({"error": "Razorpay credentials not configured"}, status=500)

        payload = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt or f"savr_rcpt_{payment.payment_id}",
            "payment_capture": 1,
            "notes": notes or {},
        }

        r = requests.post("https://api.razorpay.com/v1/orders", auth=(key_id, key_secret), json=payload, timeout=10)
        if r.status_code not in (200, 201):
            # store error payload and mark payment failed
            payment.raw_payload = {"rzp_error": r.text}
            payment.status = "failed"
            payment.save(update_fields=["raw_payload", "status", "updated_at"])
            return Response({"error": "Failed to create razorpay order", "detail": r.text}, status=500)

        rz = r.json()
        provider_order_id = rz.get("id")
        payment.provider_order_id = provider_order_id
        payment.raw_payload = {"razorpay_order": rz}
        payment.save(update_fields=["provider_order_id", "raw_payload", "updated_at"])

        return Response({
            "key_id": key_id,
            "razorpay_order_id": provider_order_id,
            "payment_id": payment.payment_id,
            "amount": float(payment.amount),
            "currency": payment.currency,
        })
    except Exception as exc:
        return Response({"error": "server_error", "detail": str(exc)}, status=500)

# --- Razorpay verify endpoint ---
@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request):
    """
    Client posts after checkout success:
    { payment_id, razorpay_payment_id, razorpay_order_id, razorpay_signature }
    Verifies HMAC and updates Payment.status.
    """
    data = request.data or {}
    payment_id = data.get("payment_id")
    rz_payment_id = data.get("razorpay_payment_id")
    rz_order_id = data.get("razorpay_order_id")
    rz_signature = data.get("razorpay_signature")

    if not all([payment_id, rz_payment_id, rz_order_id, rz_signature]):
        return Response({"error": "missing fields"}, status=400)

    try:
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", os.environ.get("RAZORPAY_KEY_SECRET"))
        generated = hmac.new(
            key_secret.encode(),
            f"{rz_order_id}|{rz_payment_id}".encode(),
            hashlib.sha256
        ).hexdigest()

        payment = models.Payment.objects.filter(payment_id=payment_id).first()
        if not payment:
            return Response({"error": "Payment not found"}, status=404)

        if hmac.compare_digest(generated, rz_signature):
            payment.status = "success"
            payment.provider_payment_id = rz_payment_id
            payment.save(update_fields=["status", "provider_payment_id", "updated_at"])
            return Response({"success": True})
        else:
            payment.status = "failed"
            payment.save(update_fields=["status", "updated_at"])
            return Response({"success": False, "error": "Invalid signature"}, status=400)
    except Exception as e:
        return Response({"error": "server_error", "detail": str(e)}, status=500)


# --- Razorpay webhook handler ---
@csrf_exempt
def razorpay_webhook(request):
    if request.method != "POST":
        return JsonResponse({"error": "method not allowed"}, status=405)

    body = request.body
    signature = request.headers.get("X-Razorpay-Signature")
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", os.environ.get("RAZORPAY_WEBHOOK_SECRET"))

    if not secret or not signature:
        return JsonResponse({"error": "Missing webhook secret or signature"}, status=400)

    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return JsonResponse({"error": "Invalid signature"}, status=400)

    event = json.loads(body.decode())
    ev_type = event.get("event")

    if ev_type == "payment.captured":
        pay = event["payload"]["payment"]["entity"]
        rz_payment_id = pay["id"]
        amt = pay["amount"] / 100.0
        # update Payment row
        p = models.Payment.objects.filter(provider_payment_id=rz_payment_id).first()
        if p:
            p.status = "success"
            p.amount = amt
            p.raw_payload = pay
            p.save(update_fields=["status", "amount", "raw_payload", "updated_at"])
    elif ev_type == "payment.failed":
        pay = event["payload"]["payment"]["entity"]
        rz_payment_id = pay["id"]
        p = models.Payment.objects.filter(provider_payment_id=rz_payment_id).first()
        if p:
            p.status = "failed"
            p.raw_payload = pay
            p.save(update_fields=["status", "raw_payload", "updated_at"])

    return JsonResponse({"ok": True})
