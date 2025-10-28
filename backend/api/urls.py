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
    path("auth/logout/", views.logout, name="auth-logout"),
    path("auth/me/", views.me, name="auth-me"),
    path("debug/cookies/", views.debug_cookies, name="debug-cookies"),
    path("auth/forgot-password/", views.forgot_password, name="auth-forgot-password"),
    path("auth/reset-password/", views.reset_password, name="auth-reset-password"),
    # Admin auth
    path("admin/auth/login/", views.admin_login, name="admin-auth-login"),
    path("admin/auth/create/", views.create_admin, name="admin-auth-create"),

    # --- Addresses ---
    path("addresses/", views.addresses, name="addresses"),
    path("addresses/<int:address_id>/", views.address_detail, name="address-detail"),
    path("addresses/<int:address_id>/default/", views.set_default_address, name="address-set-default"),
    path("addresses/<int:address_id>/set-default/", views.set_default_address, name="address-set-default-legacy"),

    # --- Products ---
    path("products/with-images/", views.products_with_images, name="products-with-images"),

    # --- Basket & Orders ---
    path("basket/", views.basket_view, name="basket"),
    path("basket/optimize/", views.optimize_basket, name="optimize-basket"),

    # multi-mart orders
    path("orders/create-from-plan/", views.create_order_from_plan, name="create-order-from-plan"),
    path("orders/from-plan/", views.create_order_from_plan, name="orders-from-plan"),

    path("orders/create/", views.create_order, name="create-order"),
    path("orders/", views.list_orders, name="orders-list"),
    # Admin endpoints
    path("admin/orders/", views.admin_list_orders, name="admin-orders-list"),
    path("admin/products/update-stock/", views.admin_update_stock, name="admin-update-stock"),
    path("admin/auth/create/", views.create_admin, name="admin-auth-create"),
    path("admin/auth/list/", views.list_admins, name="admin-auth-list"),
    path("admin/auth/<int:admin_id>/", views.delete_admin, name="admin-auth-delete"),
    path("admin/agents/", views.list_agents, name="admin-agents-list"),
    path("admin/agents/create/", views.create_agent, name="admin-agents-create"),
    path("admin/agents/resend-otp/", views.admin_resend_agent_otp, name="admin-agents-resend-otp"),
    path("admin/agents/pending/", views.admin_list_pending_agents, name="admin-agents-pending"),
    path("admin/agents/<int:agent_id>/approve/", views.admin_approve_agent, name="admin-agents-approve"),
    path("admin/agents/<int:agent_id>/reject/", views.admin_reject_agent, name="admin-agents-reject"),
    path("admin/agents/<int:agent_id>/", views.delete_agent, name="admin-agents-delete"),
    # Partners (alias routes for transition)
    path("admin/partners/pending/", views.admin_list_pending_agents, name="admin-partners-pending"),
    path("admin/partners/<int:partner_id>/approve/", views.admin_approve_agent, name="admin-partners-approve"),
    path("admin/partners/<int:partner_id>/reject/", views.admin_reject_agent, name="admin-partners-reject"),
    path("admin/partners/<int:partner_id>/", views.delete_agent, name="admin-partners-delete"),
    path("admin/partners/<int:partner_id>/inspect/", views.admin_inspect_partner, name="admin-partners-inspect"),
    path("admin/partners/", views.admin_list_partners, name="admin-partners-list"),
    path("admin/deliveries/", views.admin_list_deliveries, name="admin-deliveries-list"),
    path("admin/deliveries/<int:delivery_id>/assign/", views.admin_assign_delivery, name="admin-deliveries-assign"),
    path("admin/deliveries/<int:delivery_id>/fix/", views.admin_fix_delivery, name="admin-deliveries-fix"),
    path("admin/logs/", views.admin_list_logs, name="admin-logs-list"),
    path("admin/marts/assign/", views.assign_mart_to_admin, name="admin-mart-assign"),
    # Delivery agent
    path("agents/login/", views.delivery_agent_login, name="delivery-agent-login"),
    path("agents/set-password/", views.agent_set_password, name="agent-set-password"),
    path("agents/deliveries/", views.agent_deliveries, name="agent-deliveries"),
    path("agents/deliveries/<int:delivery_id>/mark-delivered/", views.agent_mark_delivered, name="agent-mark-delivered"),
    path("agents/register/", views.register_agent, name="agents-register"),
    # Partners (new canonical routes, keep agents as aliases)
    path("partners/login/", views.delivery_partner_login, name="delivery-partner-login"),
    path("partners/set-password/", views.agent_set_password, name="partner-set-password"),
    path("partners/deliveries/", views.agent_deliveries, name="partner-deliveries"),
    path("partners/deliveries/<int:delivery_id>/mark-delivered/", views.agent_mark_delivered, name="partner-mark-delivered"),
    path("partners/register/", views.register_agent, name="partners-register"),

    # --- Utilities ---
    path("utils/parse-shopping-list/", views.parse_shopping_list, name="parse-shopping-list"),

    # --- Router endpoints ---
    path("", include(router.urls)),

    # --- Razorpay endpoints ---
    path("payments/razorpay/create-order/", views.create_razorpay_order, name="payments-razorpay-create-order"),
    path("payments/razorpay/verify/", views.verify_razorpay_payment, name="payments-razorpay-verify"),
    path("payments/razorpay/webhook/", views.razorpay_webhook, name="payments-razorpay-webhook"),
]
