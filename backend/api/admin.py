from django.contrib import admin
from . import models


@admin.register(models.User)
class UserAdmin(admin.ModelAdmin):
	list_display = ('user_id', 'username', 'email')
	search_fields = ('username', 'email')


@admin.register(models.Admin)
class AdminAdmin(admin.ModelAdmin):
	list_display = ('admin_id', 'username', 'email', 'role')
	search_fields = ('username', 'email')


@admin.register(models.Mart)
class MartAdmin(admin.ModelAdmin):
	list_display = ('mart_id', 'name', 'approved')
	search_fields = ('name',)


@admin.register(models.Product)
class ProductAdmin(admin.ModelAdmin):
	list_display = ('product_id', 'name', 'mart', 'price', 'stock')
	search_fields = ('name',)


@admin.register(models.Order)
class OrderAdmin(admin.ModelAdmin):
	list_display = ('order_id', 'user', 'total_cost', 'status')
	list_filter = ('status',)

@admin.register(models.Delivery)
class DeliveryAdmin(admin.ModelAdmin):
	list_display = ('delivery_id', 'order', 'partner', 'status')

