from rest_framework import serializers
from . import models
from .models import (
    User, Admin, Mart, Product, Offer, Review, Basket,
    Order, OrderItem, DeliveryPartner, Delivery, AnalyticsLog, Address
)

# -------------------- User --------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "user_id", "username", "email",
            "address", "contact_number",
            "location_lat", "location_long",
            "preferences", "created_at", "updated_at",
        ]

# -------------------- Address --------------------
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = "__all__"

# -------------------- Admin --------------------
class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        # Expose only safe admin fields to the API (do not leak password_hash)
        fields = ("admin_id", "username", "email", "role", "created_at", "updated_at")

# -------------------- Mart --------------------
class MartSerializer(serializers.ModelSerializer):
    # Return nested admin object so frontend can read admin.username and admin.admin_id
    admin = AdminSerializer(read_only=True)

    class Meta:
        model = Mart
        fields = "__all__"

# -------------------- Product --------------------
class ProductSerializer(serializers.ModelSerializer):
    mart_id = serializers.IntegerField(source="mart.mart_id", read_only=True)
    mart_name = serializers.CharField(source="mart.name", read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "product_id", "name", "category", "price",
            "quality_score", "stock", "mart_id", "mart_name", "image_url",
        ]

    def get_image_url(self, obj):
        # views.ensure_product_image already tries to populate this;
        # fall back to a tiny placeholder if still empty
        return obj.image_url or "https://via.placeholder.com/80"

# -------------------- Review --------------------
class ReviewSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Review
        fields = "__all__"

# -------------------- Offer --------------------
class OfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = "__all__"

# -------------------- Basket --------------------
class BasketSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Basket
        fields = "__all__"

# -------------------- OrderItem --------------------
class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = "__all__"

# -------------------- Order --------------------
class OrderSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    items = OrderItemSerializer(source="orderitem_set", many=True, read_only=True)

    class Meta:
        model = Order
        fields = "__all__"

# -------------------- DeliveryPartner --------------------
class DeliveryPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryPartner
        fields = "__all__"

# -------------------- Delivery --------------------
class DeliverySerializer(serializers.ModelSerializer):
    partner = DeliveryPartnerSerializer(read_only=True)
    order = OrderSerializer(read_only=True)

    class Meta:
        model = Delivery
        fields = "__all__"

# -------------------- AnalyticsLog --------------------
class AnalyticsLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsLog
        fields = "__all__"

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Payment
        fields = "__all__"


