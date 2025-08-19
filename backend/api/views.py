from django.http import JsonResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from . import models, serializers
import json
from django.contrib.auth.hashers import make_password, check_password
import secrets
from django.core.mail import send_mail
from django.conf import settings
from .models import OTPCode
from django.utils import timezone
from decimal import Decimal, InvalidOperation
import json
from django.db.models import Q
import random


def index(request):
    return JsonResponse({'status': 'ok', 'message': 'API is up'})


class MartViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Mart.objects.all()
    serializer_class = serializers.MartSerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Product.objects.all()
    serializer_class = serializers.ProductSerializer


class OfferViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Offer.objects.all()
    serializer_class = serializers.OfferSerializer


@api_view(['POST'])
def parse_shopping_list(request):
    # Very small parser: split by commas/newlines, return items
    text = request.data.get('text') or request.data.get('list') or ''
    if not text:
        return Response({'error': 'no text provided'}, status=status.HTTP_400_BAD_REQUEST)
    items = [s.strip() for s in json.dumps(text).split(',') if s.strip()]
    # In real implementation we'd call NLP parser
    return Response({'items': items})



@api_view(['POST'])
def register_user(request):
    data = request.data or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    location_lat = data.get('location_lat')
    location_long = data.get('location_long')
    preferences = data.get('preferences')
    if not username or not email or not password:
        return Response({'error': 'username, email, password required'}, status=400)
    # If a user already exists with this email or username, attempt sign-in
    existing = models.User.objects.filter(Q(email=email) | Q(username=username)).first()
    if existing:
        # verify provided password
        if check_password(password, existing.password_hash):
            # return existing token or create one
            existing_token = models.UserToken.objects.filter(user=existing).first()
            if existing_token:
                return Response({'username': existing.username, 'token': existing_token.key})
            token_key = secrets.token_urlsafe(48)
            user_token = models.UserToken.objects.create(user=existing, key=token_key)
            return Response({'username': existing.username, 'token': token_key})
        else:
            return Response({'error': 'user already exists; invalid credentials for sign in'}, status=400)

    # Create user in users table (custom users table)
    now = timezone.now()
    # coerce optional numeric fields
    lat_val = None
    long_val = None
    try:
        if location_lat is not None and location_lat != '':
            lat_val = Decimal(str(location_lat))
    except (InvalidOperation, ValueError):
        return Response({'error': 'invalid location_lat'}, status=400)
    try:
        if location_long is not None and location_long != '':
            long_val = Decimal(str(location_long))
    except (InvalidOperation, ValueError):
        return Response({'error': 'invalid location_long'}, status=400)

    prefs_val = None
    if preferences is not None:
        # accept dict or JSON string
        if isinstance(preferences, str):
            try:
                prefs_val = json.loads(preferences)
            except Exception:
                # fall back to storing raw string
                prefs_val = preferences
        else:
            prefs_val = preferences

    user = models.User(
        username=username,
        email=email,
        password_hash=make_password(password),
        location_lat=lat_val,
        location_long=long_val,
        preferences=prefs_val,
        created_at=now,
        updated_at=now,
    )
    user.save()

    # create token in our UserToken table
    token_key = secrets.token_urlsafe(48)
    user_token = models.UserToken.objects.create(user=user, key=token_key)
    return Response({'username': username, 'token': user_token.key})


@api_view(['POST'])
def login_user(request):
    data = request.data or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return Response({'error': 'username and password required'}, status=400)
    try:
        # allow logging in with username or email
        user = models.User.objects.get(Q(username=username) | Q(email=username))
    except models.User.DoesNotExist:
        return Response({'error': 'invalid credentials'}, status=400)
    # check password - note: password_hash field may not be compatible; treat as placeholder
    if not check_password(password, user.password_hash):
        return Response({'error': 'invalid credentials'}, status=400)
    # create or reuse token in our UserToken table
    existing = models.UserToken.objects.filter(user=user).first()
    if existing:
        token_key = existing.key
    else:
        token_key = secrets.token_urlsafe(48)
        models.UserToken.objects.create(user=user, key=token_key)
    return Response({'username': username, 'token': token_key})


@api_view(['POST'])
def optimize_basket(request):
    # Accepts a basket {items: [...]}, returns a naive optimization placeholder
    data = request.data or {}
    items = data.get('items', [])
    # Placeholder logic: return same items grouped by mart if product has mart
    result = {'optimized': items, 'notes': 'placeholder optimization - integrate cost optimizer later'}
    return Response(result)



@api_view(['POST'])
def request_otp(request):
    data = request.data or {}
    dest = data.get('destination')
    purpose = data.get('purpose', 'login')
    if not dest:
        return Response({'error': 'destination required'}, status=400)
    code = f"{random.randint(100000, 999999)}"
    otp = OTPCode.objects.create(destination=dest, code=code, purpose=purpose)
    # send via email for now
    subject = f"Your SAVR OTP code ({purpose})"
    message = f"Your OTP code is: {code}. It expires in 5 minutes."
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@savr.local')
    try:
        send_mail(subject, message, from_email, [dest])
    except Exception:
        # fallback: console-only (already configured by Django dev settings)
        print(f"OTP for {dest}: {code}")
    return Response({'sent': True})


@api_view(['POST'])
def verify_otp(request):
    data = request.data or {}
    dest = data.get('destination')
    code = data.get('code')
    purpose = data.get('purpose', 'login')
    if not dest or not code:
        return Response({'error': 'destination and code required'}, status=400)
    try:
        otp = OTPCode.objects.filter(destination=dest, purpose=purpose, code=code, used=False).latest('created_at')
    except OTPCode.DoesNotExist:
        return Response({'error': 'invalid code'}, status=400)
    if not otp.is_valid():
        return Response({'error': 'code expired or used'}, status=400)
    otp.used = True
    otp.save()
    return Response({'verified': True})
