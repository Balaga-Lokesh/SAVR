from rest_framework import serializers
from . import models


class MartSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.Mart
		fields = ('mart_id', 'name', 'location_lat', 'location_long', 'address', 'approved')


class ProductSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.Product
		fields = ('product_id', 'mart', 'name', 'category', 'price', 'stock', 'quality_score')


class OfferSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.Offer
		fields = ('offer_id', 'mart', 'product', 'discount_percentage', 'start_date', 'end_date', 'is_global')


class OrderItemSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.OrderItem
		fields = ('item_id', 'order', 'product', 'mart', 'quantity', 'price_at_purchase')


class OrderSerializer(serializers.ModelSerializer):
	order_items = OrderItemSerializer(many=True, source='orderitem_set', required=False)

	class Meta:
		model = models.Order
		fields = ('order_id', 'user', 'total_cost', 'status', 'created_at', 'order_items')


class BasketSerializer(serializers.ModelSerializer):
	class Meta:
		model = models.Basket
		fields = ('basket_id', 'user', 'items', 'optimized_cost')
