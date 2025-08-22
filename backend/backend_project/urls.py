# backend_project/urls.py
from django.contrib import admin
from django.urls import include, path
from api import views
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('api.urls'))
]
