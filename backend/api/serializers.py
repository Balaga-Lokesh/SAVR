from rest_framework import serializers
from .models import (
    User, Admin, Mart, Product, Offer, Review, Basket,
    Order, OrderItem, DeliveryPartner, Delivery, AnalyticsLog
)

# -------------------- User --------------------
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'date_joined']
        extra_kwargs = {'password': {'write_only': True}}

# -------------------- Admin --------------------
class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = '__all__'

# -------------------- Mart --------------------
class MartSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mart
        fields = '__all__'

# -------------------- Product --------------------
class ProductSerializer(serializers.ModelSerializer):
    mart_name = serializers.CharField(source='mart.name', read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['product_id', 'name', 'category', 'price', 'quality_score', 'mart_name', 'image_url']

    def get_image_url(self, obj):
        if obj.image_url:
            return obj.image_url
        # Optional: fetch from Google if missing
        try:
            from .views import get_google_image
            img_url = get_google_image(obj.name)
            obj.image_url = img_url
            obj.save(update_fields=['image_url'])
            return img_url
        except:
            return "https://via.placeholder.com/80"

# -------------------- Offer --------------------
class OfferSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Offer
        fields = '__all__'

# -------------------- Review --------------------
class ReviewSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Review
        fields = '__all__'

# -------------------- Basket --------------------
class BasketSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    products = ProductSerializer(many=True, read_only=True)

    class Meta:
        model = Basket
        fields = '__all__'

# -------------------- OrderItem --------------------
class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = '__all__'

# -------------------- Order --------------------
class OrderSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = '__all__'

# -------------------- DeliveryPartner --------------------
class DeliveryPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryPartner
        fields = '__all__'

# -------------------- Delivery --------------------
class DeliverySerializer(serializers.ModelSerializer):
    partner = DeliveryPartnerSerializer(read_only=True)
    order = OrderSerializer(read_only=True)

    class Meta:
        model = Delivery
        fields = '__all__'

# -------------------- AnalyticsLog --------------------
class AnalyticsLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsLog
        fields = '__all__'
