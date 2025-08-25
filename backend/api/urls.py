from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# --- DRF Router for ViewSets ---
router = DefaultRouter()
router.register(r'marts', views.MartViewSet, basename='mart')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'offers', views.OfferViewSet, basename='offer')

# --- API v1 Endpoints ---
urlpatterns = [
    # Root index
    path('', views.index, name='index'),

    # --- Authentication ---
    path('auth/register/', views.register, name='auth-register'),
    path('auth/login/', views.login, name='auth-login'),
    path('auth/request-otp/', views.request_otp, name='auth-request-otp'),
    path('auth/verify-otp/', views.verify_otp, name='auth-verify-otp'),

    # --- Products (extra endpoint for bulk with images if frontend needs it) ---
    path('products/with-images/', views.products_with_images, name='products-with-images'),

    # --- Basket & Orders ---
    path('basket/', views.basket_view, name='basket'),
    path('basket/optimize/', views.optimize_basket, name='optimize-basket'),
    path('orders/create/', views.create_order, name='create-order'),

    # --- Utilities ---
    path('utils/parse-shopping-list/', views.parse_shopping_list, name='parse-shopping-list'),

    # --- Router endpoints (DRF ViewSets) ---
    path('', include(router.urls)),  # /marts/, /products/, /offers/
]
