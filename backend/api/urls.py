from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from api import views

# --- DRF Router for ViewSets ---
# The router automatically generates URLs for your ViewSets (e.g., /marts/, /products/).
router = routers.DefaultRouter()
router.register(r'marts', views.MartViewSet, basename='mart')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'offers', views.OfferViewSet, basename='offer')

# --- Main URL Patterns ---
urlpatterns = [
    # Django Admin
    path('admin/', admin.site.urls),

    # --- API v1 Endpoints ---
    
    # API Index
    path('api/v1/', views.index, name='api-index'),

    # Authentication
    path('api/v1/register/', views.register, name="register"),
    path('api/v1/login/', views.login, name="login"),
    path('api/v1/request-otp/', views.request_otp, name='request-otp'),
    path('api/v1/verify-otp/', views.verify_otp, name='verify-otp'),

    # Products
    path('api/v1/products-with-images/', views.products_with_images, name='products-with-images'),

    # Basket
    # MODIFICATION: Combined save_basket (POST) and get_basket (GET) into one endpoint.
    path('api/v1/baskets/', views.save_basket, name='save-basket'),
    path('api/v1/baskets/', views.get_basket, name='get-basket'),
    path('api/v1/optimize-basket/', views.optimize_basket, name='optimize-basket'),

    # Orders
    path('api/v1/orders/', views.create_order, name='create-order'),

    # Utilities
    path('api/v1/parse-shopping-list/', views.parse_shopping_list, name='parse-shopping-list'),

    # Include DRF router URLs at the end
    # This adds the /marts/, /products/, and /offers/ endpoints to your API.
    path('api/v1/', include(router.urls)),
]