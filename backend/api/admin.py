from django.contrib import admin
from django.utils.html import format_html
from . import models
import requests
from bs4 import BeautifulSoup

# ------------------- Helper Function -------------------
def fetch_google_image(query):
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        cx_id = os.getenv("GOOGLE_CX")
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "q": query,
            "cx": cx_id,
            "key": api_key,
            "searchType": "image",
            "num": 1
        }
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        if "items" in data and data["items"]:
            return data["items"][0]["link"]
    except Exception as e:
        print("Image fetch failed:", e)
    return None

# ------------------- User Admin -------------------
@admin.register(models.User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'username', 'email')
    search_fields = ('username', 'email')

# ------------------- Admin Admin -------------------
@admin.register(models.Admin)
class AdminAdmin(admin.ModelAdmin):
    list_display = ('admin_id', 'username', 'email', 'role')
    search_fields = ('username', 'email')

# ------------------- Mart Admin -------------------
@admin.register(models.Mart)
class MartAdmin(admin.ModelAdmin):
    list_display = ('mart_id', 'name', 'approved')
    search_fields = ('name',)

# ------------------- Product Admin -------------------
@admin.register(models.Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('product_id', 'name', 'category', 'price', 'stock', 'quality_score', 'image_preview')
    search_fields = ('name', 'category')

    def image_preview(self, obj):
        if obj.image_url:
            return format_html('<img src="{}" width="50" height="50" />', obj.image_url)
        return "No Image"
    image_preview.short_description = "Image"

    def save_model(self, request, obj, form, change):
        # Auto-fetch image from Google if not set
        if not obj.image_url:
            image_url = fetch_google_image(obj.name)
            if image_url:
                obj.image_url = image_url
        super().save_model(request, obj, form, change)

# ------------------- Order Admin -------------------
@admin.register(models.Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'user', 'total_cost', 'status')
    list_filter = ('status',)

# ------------------- Delivery Admin -------------------
@admin.register(models.Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('delivery_id', 'order', 'partner', 'status')
    list_filter = ('status',)
