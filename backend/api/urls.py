from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'marts', views.MartViewSet, basename='mart')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'offers', views.OfferViewSet, basename='offer')

urlpatterns = [
    path('', views.index, name='api-index'),
    path('v1/', include(router.urls)),
    path('v1/auth/register/', views.register_user, name='register'),
    path('v1/auth/login/', views.login_user, name='login'),
    path('v1/auth/request-otp/', views.request_otp, name='request-otp'),
    path('v1/auth/verify-otp/', views.verify_otp, name='verify-otp'),
    path('v1/parse/', views.parse_shopping_list, name='parse-shopping-list'),
    path('v1/optimize/', views.optimize_basket, name='optimize-basket'),
]
