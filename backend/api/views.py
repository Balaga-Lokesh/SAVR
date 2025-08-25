import secrets
import random
import math
from decimal import Decimal
from typing import Iterable, Optional, Tuple, List, Dict

from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.conf import settings

from rest_framework import viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from geopy.geocoders import Nominatim
from geopy.distance import geodesic

from .authentication import CustomTokenAuthentication
from . import models, serializers

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


# --------------------- Product images (simple placeholder) ---------------------
def get_google_image(query: str) -> str:
    # Replace with a real provider if needed
    return f"https://via.placeholder.com/150?text={query}"


def ensure_product_image(product: models.Product) -> models.Product:
    if not product.image_url:
        product.image_url = get_google_image(product.name)
        product.save(update_fields=["image_url"])
    return product


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


@api_view(["GET"])
def products_with_images(request):
    products = list(models.Product.objects.all())
    for p in products:
        ensure_product_image(p)
    data = serializers.ProductSerializer(products, many=True, context={"request": request}).data
    return Response(data)


# --------------------- Geocoding & Delivery helpers ---------------------
geolocator = Nominatim(user_agent="savr_backend")


def get_lat_long_from_address(address: str) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """
    Geocode with Nominatim; returns (Decimal lat, Decimal long) or (None, None).
    """
    try:
        location = geolocator.geocode(address, timeout=10)
        if location:
            return Decimal(str(location.latitude)), Decimal(str(location.longitude))
    except Exception as e:
        print("Geocoding error:", e)
    return None, None


def calculate_delivery_charge(distance_km: float) -> int:
    """
    Example policy: base ₹30, plus ₹10 per km (rounded up).
    Feel free to replace with your own pricing logic.
    """
    base = 30
    per_km = 10
    return max(base, math.ceil(distance_km * per_km))


def distance_km_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return geodesic distance in km (float)."""
    return geodesic((lat1, lon1), (lat2, lon2)).km


def marts_with_distances_to(address_lat: Decimal, address_long: Decimal, marts: Iterable[models.Mart]) -> List[Dict]:
    """
    For given address coordinates, compute distance to each mart and return list of dicts:
    { mart, distance_km, delivery_charge } sorted by distance.
    """
    result = []
    for m in marts:
        try:
            mart_lat = float(m.location_lat)
            mart_long = float(m.location_long)
        except Exception:
            continue
        dist = distance_km_between(float(address_lat), float(address_long), mart_lat, mart_long)
        charge = calculate_delivery_charge(dist)
        result.append({
            "mart_id": m.mart_id,
            "mart_name": m.name,
            "mart_lat": mart_lat,
            "mart_long": mart_long,
            "distance_km": round(dist, 3),
            "delivery_charge": charge,
        })
    result.sort(key=lambda x: x["distance_km"])
    return result


# --------------------- Auth & User ---------------------
@api_view(["POST"])
def register(request):
    """
    Register a new user. Auto-geocodes address to lat/long (if provided).
    """
    data = request.data or {}
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    address = data.get("address")
    contact_number = data.get("contact_number")

    if not (username and email and password and address and contact_number):
        return JsonResponse({"error": "Missing fields"}, status=400)

    if models.User.objects.filter(email=email).exists():
        return JsonResponse({"error": "Email already registered"}, status=400)
    if models.User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already taken"}, status=400)

    lat, lng = get_lat_long_from_address(address)

    user = models.User.objects.create(
        username=username,
        email=email,
        password_hash=make_password(password),
        address=address if hasattr(models.User, "address") else None,
        contact_number=contact_number if hasattr(models.User, "contact_number") else None,
        location_lat=lat,
        location_long=lng,
    )

    return JsonResponse(
        {
            "message": "User registered",
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "address": getattr(user, "address", None),
            "contact_number": getattr(user, "contact_number", None),
            "location_lat": str(user.location_lat) if user.location_lat else None,
            "location_long": str(user.location_long) if user.location_long else None,
        }
    )


@api_view(["POST"])
def request_otp(request):
    data = request.data or {}
    destination = data.get("destination")
    purpose = data.get("purpose", "login")

    if not destination:
        return Response({"error": "destination required"}, status=400)

    code = f"{random.randint(100000, 999999)}"
    models.OTPCode.objects.create(destination=destination, code=code, purpose=purpose)

    try:
        send_mail(
            f"SAVR {purpose.capitalize()} OTP",
            f"Your OTP is {code}. It expires in 5 minutes.",
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@savr.local"),
            [destination],
        )
    except Exception as e:
        print(f"OTP email failed: {e}, Code: {code}")

    return Response({"otp_sent": True, "destination": destination})


@api_view(["POST"])
def verify_otp(request):
    data = request.data or {}
    destination = data.get("destination")
    code = data.get("code")
    purpose = data.get("purpose", "login")

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

    user = models.User.objects.filter(Q(email=destination) | Q(username=destination)).first()
    if not user:
        return Response({"error": "User not found"}, status=404)

    token_key = secrets.token_hex(32)
    token_obj = models.UserToken.objects.create(user=user, key=token_key)

    return Response(
        {
            "verified": True,
            "token": token_obj.key,
            "user_id": user.user_id,
            "username": user.username,
        }
    )


@api_view(["POST"])
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

    token_key = secrets.token_hex(32)
    token_obj = models.UserToken.objects.create(user=user, key=token_key)

    return JsonResponse(
        {
            "message": "Login successful",
            "token": token_obj.key,
            "user_id": user.user_id,
            "username": user.username,
        }
    )


# --------------------- Nearby marts endpoint ---------------------
@api_view(["POST"])
def nearby_marts(request):
    """
    Find nearby marts for any delivery address.

    Body:
      {
        "address": "delivery address string",   # required
        "radius_km": 5.0                        # optional - filter within radius
      }

    Response:
      {
        "address": "...",
        "address_lat": ...,
        "address_long": ...,
        "marts": [
           { mart_id, mart_name, mart_lat, mart_long, distance_km, delivery_charge }, ...
        ]
      }
    """
    data = request.data or {}
    address = data.get("address")
    radius_km = data.get("radius_km", None)

    if not address:
        return Response({"error": "address is required"}, status=400)

    lat, lng = get_lat_long_from_address(address)
    if not (lat and lng):
        return Response({"error": "Could not geocode address"}, status=400)

    marts = models.Mart.objects.filter(approved=True)  # only approved marts
    marts_list = marts_with_distances_to(lat, lng, marts)

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
        "marts": marts_list
    })


# --------------------- Delivery quote (single mart) ---------------------
@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def delivery_quote(request):
    """
    Quote delivery from a specific mart to the provided delivery address
    (or user's saved address if authenticated user and no override provided).
    Body:
      { "mart_id": <int>, "address": "optional override address" }
    """
    data = request.data or {}
    mart_id = data.get("mart_id")
    override_address = data.get("address")

    if not mart_id:
        return Response({"error": "mart_id is required"}, status=400)

    try:
        mart = models.Mart.objects.get(pk=mart_id)
    except models.Mart.DoesNotExist:
        return Response({"error": "Mart not found"}, status=404)

    # Determine delivery address coordinates
    if override_address:
        lat, lng = get_lat_long_from_address(override_address)
        used_address = override_address
    else:
        # try use user's saved address
        user_lat = getattr(request.user, "location_lat", None)
        user_long = getattr(request.user, "location_long", None)
        used_address = getattr(request.user, "address", None)
        lat, lng = (user_lat, user_long)

    if not (lat and lng):
        return Response({"error": "Delivery address unavailable; provide address"}, status=400)

    distance_km = distance_km_between(float(lat), float(lng), float(mart.location_lat), float(mart.location_long))
    delivery_charge = calculate_delivery_charge(distance_km)

    return Response({
        "mart_id": mart.mart_id,
        "mart_name": mart.name,
        "distance_km": round(distance_km, 3),
        "delivery_charge": delivery_charge,
        "used_address": used_address,
    })


# --------------------- Basket & Orders ---------------------
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


@api_view(["POST"])
def optimize_basket(request):
    items = request.data.get("items", [])
    return Response({"optimized": items, "notes": "placeholder - real optimizer coming soon"})


@api_view(["POST"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def create_order(request):
    """
    Create an order for a delivery address supplied in payload.

    Body:
    {
      "items": [{ "product_id": 1, "quantity": 2 }, ...],
      "delivery_address": "string",          # required
      "contact_number": "string",            # required
      "selected_mart_id": 123 (optional)     # if user chooses a mart from nearby list
    }

    Logic:
    - Geocode delivery_address
    - Compute nearest mart among (a) selected_mart_id (if provided, validated) or
      (b) marts containing ordered products (if any) -> choose the nearest
      (c) fallback: nearest approved mart in DB
    - Compute delivery_charge from chosen mart -> add to order total
    - Save order and order items (order model unchanged; delivery fields are returned in response)
    """
    data = request.data or {}
    items = data.get("items", [])
    delivery_address = data.get("delivery_address")
    contact_number = data.get("contact_number")
    selected_mart_id = data.get("selected_mart_id", None)

    if not items:
        return Response({"error": "items are required"}, status=400)
    if not delivery_address or not contact_number:
        return Response({"error": "delivery_address and contact_number are required"}, status=400)

    # Geocode the delivery address
    lat, lng = get_lat_long_from_address(delivery_address)
    if not (lat and lng):
        return Response({"error": "Could not geocode delivery address"}, status=400)

    # Create order (we keep existing Order schema; not persisting delivery fields to DB unless you add them)
    total_cost = Decimal("0")
    order = models.Order.objects.create(user=request.user, total_cost=0, status="pending")

    marts_in_order = set()
    for item in items:
        pid = item.get("product_id")
        qty = int(item.get("quantity", 1))
        product = models.Product.objects.filter(pk=pid).first()
        if not product:
            continue

        total_cost += Decimal(qty) * product.price
        marts_in_order.add(product.mart_id)

        models.OrderItem.objects.create(
            order=order,
            product=product,
            mart=product.mart,
            quantity=qty,
            price_at_purchase=product.price,
        )

    # Determine chosen mart:
    chosen_mart = None
    distance_km = None
    delivery_charge = 0

    if selected_mart_id:
        chosen_mart = models.Mart.objects.filter(pk=selected_mart_id, approved=True).first()
        if not chosen_mart:
            return Response({"error": "Selected mart not found or not approved"}, status=400)
    else:
        # If products are from specific marts, consider only those; otherwise consider all approved marts
        if marts_in_order:
            candidate_marts = models.Mart.objects.filter(mart_id__in=list(marts_in_order), approved=True)
            # if no candidate marts (shouldn't happen), fallback to all approved marts
            if not candidate_marts.exists():
                candidate_marts = models.Mart.objects.filter(approved=True)
        else:
            candidate_marts = models.Mart.objects.filter(approved=True)

        # find nearest mart among candidates
        best = None
        best_dist = None
        for m in candidate_marts:
            mlat = float(m.location_lat)
            mlong = float(m.location_long)
            d = distance_km_between(float(lat), float(lng), mlat, mlong)
            if best is None or d < best_dist:
                best = m
                best_dist = d
        chosen_mart = best
        distance_km = best_dist

    if chosen_mart:
        # compute delivery charge for chosen mart
        if distance_km is None:
            distance_km = distance_km_between(float(lat), float(lng), float(chosen_mart.location_lat), float(chosen_mart.location_long))
        delivery_charge = calculate_delivery_charge(distance_km)
        total_cost += Decimal(delivery_charge)

    order.total_cost = total_cost
    order.save()

    # response payload
    payload = serializers.OrderSerializer(order).data
    payload.update({
        "delivery_address": delivery_address,
        "delivery_lat": float(lat),
        "delivery_long": float(lng),
        "contact_number": contact_number,
        "chosen_mart_id": chosen_mart.mart_id if chosen_mart else None,
        "chosen_mart_name": chosen_mart.name if chosen_mart else None,
        "distance_km": round(distance_km, 3) if distance_km is not None else None,
        "delivery_charge": delivery_charge,
    })

    return Response(payload)


# --------------------- Shopping List Parsing ---------------------
@api_view(["POST"])
def parse_shopping_list(request):
    text = request.data.get("text")
    if not text:
        return Response({"error": "text required"}, status=400)

    items = [i.strip() for i in text.replace("\n", ",").split(",") if i.strip()]
    return Response({"items": items})
