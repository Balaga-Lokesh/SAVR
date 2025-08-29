# views.py

import secrets
import random
import math
import re
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
from django.db import transaction

from geopy.geocoders import Nominatim
from geopy.distance import geodesic

from .authentication import CustomTokenAuthentication
from . import models, serializers
from .utils import fetch_product_image

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

    token_value = secrets.token_hex(32)
    token_obj = models.UserToken.objects.create(user=user, token_key=token_value)

    return Response({
        "verified": True,
        "token": token_obj.token_key,
        "user_id": user.user_id,
        "username": user.username,
    })


# ---------- NEW: auth/me ----------
@api_view(["GET"])
@authentication_classes([CustomTokenAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
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
        "default_address": addr_payload,
    })


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
    data = request.data or {}
    items = data.get("items", [])
    address_id = data.get("address_id")
    address_obj_payload = data.get("address")
    contact_number = data.get("contact_number")

    if not items:
        return Response({"error": "items are required"}, status=400)
    if not address_id or not contact_number:
        return Response({"error": "address_id and contact_number are required"}, status=400)

    addr = None
    if address_id:
        try:
            addr = models.Address.objects.get(pk=address_id, user=request.user)
        except models.Address.DoesNotExist:
            return Response({"error": "Address not found"}, status=404)
    elif address_obj_payload:
        # create an address object for the user from provided payload
        addr = models.Address.objects.create(
            user=request.user,
            line1=address_obj_payload.get('line1', ''),
            line2=address_obj_payload.get('line2'),
            city=address_obj_payload.get('city', 'Visakhapatnam'),
            state=address_obj_payload.get('state', 'Andhra Pradesh'),
            pincode=address_obj_payload.get('pincode'),
            contact_phone=address_obj_payload.get('contact_phone'),
            location_lat=address_obj_payload.get('location_lat'),
            location_long=address_obj_payload.get('location_long'),
        )

    # ensure address has coordinates
    if not (addr.location_lat and addr.location_long):
        full_addr = ", ".join(filter(None, [addr.line1, addr.line2, addr.city, addr.state, addr.pincode]))
        lat, lng = get_lat_long_from_address(full_addr)
        if not (lat and lng):
            return Response({"error": "Address could not be geocoded. Please include City, State, and a 6-digit PIN code."}, status=400)
        addr.location_lat, addr.location_long = lat, lng
        addr.save(update_fields=["location_lat", "location_long"])

    total_cost = Decimal("0")
    total_weight = 0.0
    order = models.Order.objects.create(user=request.user, total_cost=0, status="pending")

    marts_in_order = set()
    for item in items:
        pid = item.get("product_id")
        qty = int(item.get("quantity", 1))
        product = models.Product.objects.filter(pk=pid).select_related("mart").first()
        if not product:
            continue

        # per-unit weight: request override > product.unit_weight_kg > 1.0
        if item.get("weight_kg") is not None:
            weight_each = float(item.get("weight_kg"))
        else:
            uw = getattr(product, "unit_weight_kg", None)
            weight_each = float(uw) if uw is not None else 1.0

        total_cost += Decimal(qty) * product.price
        total_weight += weight_each * qty
        marts_in_order.add(product.mart_id)

        models.OrderItem.objects.create(
            order=order,
            product=product,
            mart=product.mart,
            quantity=qty,
            price_at_purchase=product.price,
        )

    # choose nearest approved mart among candidates
    candidate_marts = models.Mart.objects.filter(mart_id__in=list(marts_in_order), approved=True)
    if not candidate_marts.exists():
        candidate_marts = models.Mart.objects.filter(approved=True)

    best = None
    best_dist = None
    for m in candidate_marts:
        d = distance_km_between(
            float(addr.location_lat), float(addr.location_long),
            float(m.location_lat), float(m.location_long)
        )
        if best is None or d < best_dist:
            best = m
            best_dist = d

    chosen_mart = best
    delivery_charge = calculate_delivery_charge(best_dist if best_dist is not None else 0.0, total_weight)
    total_cost += Decimal(delivery_charge)

    # attach delivery address and snapshot for historical traceability
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
        "chosen_mart_id": chosen_mart.mart_id if chosen_mart else None,
        "chosen_mart_name": chosen_mart.name if chosen_mart else None,
        "distance_km": round(best_dist, 3) if best_dist is not None else None,
        "delivery_charge": delivery_charge,
        "total_weight_kg": round(total_weight, 3),
    })
    return Response(payload)


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
