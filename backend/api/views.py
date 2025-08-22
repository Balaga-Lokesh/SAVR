import secrets
import random, json, requests
from decimal import Decimal
from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .authentication import CustomTokenAuthentication
from . import models, serializers


# --------------------- Basic Index ---------------------
def index(request):
    return JsonResponse({'status': 'ok', 'message': 'API is up'})


# --------------------- Read-only ViewSets ---------------------
class MartViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Mart.objects.all()
    serializer_class = serializers.MartSerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Product.objects.all()
    serializer_class = serializers.ProductSerializer


class OfferViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.Offer.objects.all()
    serializer_class = serializers.OfferSerializer


# --------------------- Google Image Helper ---------------------
GOOGLE_API_KEY = getattr(settings, 'GOOGLE_API_KEY', None)
GOOGLE_CX = getattr(settings, 'GOOGLE_CX', None)


def get_google_image(query: str) -> str:
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "q": query + " product",
        "cx": GOOGLE_CX,
        "key": GOOGLE_API_KEY,
        "searchType": "image",
        "num": 1,
    }
    try:
        res = requests.get(url, params=params)
        res.raise_for_status()
        data = res.json()
        return data.get("items", [{}])[0].get("link", "https://via.placeholder.com/80")
    except:
        return "https://via.placeholder.com/80"


# --------------------- Products with Images ---------------------
@api_view(['GET'])
def products_with_images(request):
    """Return all products with image_url (fetch from Google if missing)."""
    products = models.Product.objects.all()
    serializer = serializers.ProductSerializer(products, many=True, context={'request': request})
    return Response(serializer.data)


# --------------------- User Registration ---------------------
@api_view(['POST'])
def register(request):
    """Register a new user into custom `users` table."""
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        if not (username and email and password):
            return JsonResponse({"error": "Missing fields"}, status=400)

        if models.User.objects.filter(email=email).exists():
            return JsonResponse({"error": "Email already registered"}, status=400)

        user = models.User.objects.create(
            username=username,
            email=email,
            password_hash=make_password(password),  # store hashed
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        return JsonResponse({"message": "User registered", "user_id": user.user_id})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# --------------------- OTP: Request + Verify ---------------------
@api_view(['POST'])
def request_otp(request):
    """Request OTP (for login/verification)."""
    data = request.data or {}
    destination = data.get('destination')  # email or phone
    purpose = data.get('purpose', 'login')

    if not destination:
        return Response({'error': 'destination (email/phone) required'}, status=400)

    code = f"{random.randint(100000, 999999)}"
    otp = models.OTPCode.objects.create(destination=destination, code=code, purpose=purpose)

    subject = f"SAVR {purpose.capitalize()} OTP"
    message = f"Your OTP is {code}. It will expire in 5 minutes."
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@savr.local')

    try:
        send_mail(subject, message, from_email, [destination])
    except Exception as e:
        print(f"Email send failed: {e}, OTP: {code}")

    return Response({'otp_sent': True, 'destination': destination})


@api_view(['POST'])
def verify_otp(request):
    """Verify OTP for login/verification."""
    data = request.data or {}
    destination = data.get('destination')
    code = data.get('code')
    purpose = data.get('purpose', 'login')

    if not destination or not code:
        return Response({'error': 'destination and code required'}, status=400)

    try:
        otp = models.OTPCode.objects.filter(
            destination=destination, purpose=purpose, code=code, used=False
        ).latest('created_at')
    except models.OTPCode.DoesNotExist:
        return Response({'error': 'Invalid OTP code'}, status=400)

    # Check if OTP expired
    if timezone.now() > otp.expires_at:
        return Response({'error': 'OTP expired'}, status=400)

    otp.used = True
    otp.save()

    user = models.User.objects.filter(Q(email=destination) | Q(username=destination)).first()
    if not user:
        return Response({'error': 'User not found'}, status=404)

    # Create a custom token for this user
    token_key = secrets.token_hex(32)
    token_obj = models.UserToken.objects.create(
        user=user,
        key=token_key,
        created_at=timezone.now()
    )

    return Response({
        'verified': True,
        'token': token_obj.key,
        'user_id': user.user_id,
        'username': user.username,
    })


# --------------------- Login with Email/Password ---------------------
@api_view(['POST'])
def login(request):
    data = request.data
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

    # Create a custom user token
    token_key = secrets.token_hex(32)
    token_obj = models.UserToken.objects.create(
        user=user,
        key=token_key,
        created_at=timezone.now()
    )

    return JsonResponse({
        "message": "Login successful",
        "token": token_obj.key,
        "user_id": user.user_id,
        "username": user.username,
    })


# --------------------- Basket & Checkout ---------------------
@api_view(['POST'])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def save_basket(request):
    data = request.data or {}
    items = data.get('items', [])
    optimized_cost = data.get('optimized_cost')

    basket = models.Basket.objects.create(
        user=request.user,
        items=items,  # JSONField
        optimized_cost=optimized_cost,
        created_at=timezone.now(),
        updated_at=timezone.now()
    )
    return Response(serializers.BasketSerializer(basket).data)


@api_view(['GET'])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def get_basket(request):
    baskets = models.Basket.objects.filter(user=request.user).order_by('-created_at')
    return Response(serializers.BasketSerializer(baskets, many=True).data)


@api_view(['POST'])
def optimize_basket(request):
    items = request.data.get('items', [])
    result = {'optimized': items, 'notes': 'placeholder - integrate real optimizer later'}
    return Response(result)


@api_view(['POST'])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_order(request):
    data = request.data or {}
    items = data.get('items', [])

    total_cost = Decimal(0)
    order = models.Order.objects.create(
        user=request.user,
        total_cost=0,
        status='pending',
        created_at=timezone.now(),
        updated_at=timezone.now()
    )

    for item in items:
        product = models.Product.objects.filter(pk=item.get('product_id')).first()
        if product:
            line_cost = Decimal(item.get('quantity', 1)) * product.price
            total_cost += line_cost
            models.OrderItem.objects.create(
                order=order,
                product=product,
                mart=product.mart,
                quantity=item.get('quantity', 1),
                price_at_purchase=product.price
            )

    order.total_cost = total_cost
    order.save()

    return Response(serializers.OrderSerializer(order).data)


# --------------------- Shopping List Parsing ---------------------
@api_view(['POST'])
def parse_shopping_list(request):
    text = request.data.get('text')
    if not text:
        return Response({'error': 'text required'}, status=400)

    items = [i.strip() for i in text.replace('\n', ',').split(',') if i.strip()]
    return Response({'items': items})
