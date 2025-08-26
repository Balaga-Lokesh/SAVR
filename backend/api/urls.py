# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"marts", views.MartViewSet, basename="mart")
router.register(r"products", views.ProductViewSet, basename="product")
router.register(r"offers", views.OfferViewSet, basename="offer")

urlpatterns = [
    path("", views.index, name="index"),

    # --- Auth ---
    path("auth/register/", views.register, name="auth-register"),
    path("auth/login/", views.login, name="auth-login"),
    path("auth/request-otp/", views.request_otp, name="auth-request-otp"),
    path("auth/verify-otp/", views.verify_otp, name="auth-verify-otp"),
    path("auth/me/", views.me, name="auth-me"),  # <-- the missing comma was here

    # --- Addresses ---
    path("addresses/", views.addresses, name="addresses"),
    path("addresses/<int:address_id>/", views.address_detail, name="address-detail"),
    path("addresses/<int:address_id>/default/", views.set_default_address, name="address-set-default"),

    # --- Products ---
    path("products/with-images/", views.products_with_images, name="products-with-images"),

    # --- Basket & Orders ---
    path("basket/", views.basket_view, name="basket"),
    path("basket/optimize/", views.optimize_basket, name="optimize-basket"),
    path("orders/create-from-plan/", views.create_order_from_plan, name="create-order-from-plan"),
    path("orders/create/", views.create_order, name="create-order"),

    # --- Utilities ---
    path("utils/parse-shopping-list/", views.parse_shopping_list, name="parse-shopping-list"),

    # --- Router endpoints ---
    path("", include(router.urls)),
]
