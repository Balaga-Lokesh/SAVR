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
    path("auth/me/", views.me, name="auth-me"),
    # api/urls.py
    path("auth/forgot-password/", views.forgot_password, name="auth-forgot-password"),
    path("auth/reset-password/", views.reset_password, name="auth-reset-password"),


    # --- Addresses ---
    path("addresses/", views.addresses, name="addresses"),
    path("addresses/<int:address_id>/", views.address_detail, name="address-detail"),
    path("addresses/<int:address_id>/default/", views.set_default_address, name="address-set-default"),
    # alias to match frontend calls:
    path("addresses/<int:address_id>/set-default/", views.set_default_address, name="address-set-default-legacy"),

    # --- Products ---
    path("products/with-images/", views.products_with_images, name="products-with-images"),

    # --- Basket & Orders ---
    path("basket/", views.basket_view, name="basket"),
    path("basket/optimize/", views.optimize_basket, name="optimize-basket"),

    # multi-mart orders
    path("orders/create-from-plan/", views.create_order_from_plan, name="create-order-from-plan"),
    # alias to match frontend calls:
    path("orders/from-plan/", views.create_order_from_plan, name="orders-from-plan"),

    path("orders/create/", views.create_order, name="create-order"),
    path("orders/", views.list_orders, name="orders-list"),

    # --- Utilities ---
    path("utils/parse-shopping-list/", views.parse_shopping_list, name="parse-shopping-list"),

    # --- Router endpoints ---
    path("", include(router.urls)),

    # add to urlpatterns in api/urls.py
path("payments/razorpay/create-order/", views.create_razorpay_order, name="payments-razorpay-create"),
path("payments/razorpay/verify/", views.verify_razorpay_payment, name="payments-razorpay-verify"),
path("payments/razorpay/webhook/", views.razorpay_webhook, name="payments-razorpay-webhook"),
]
