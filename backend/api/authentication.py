# api/authentication.py
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework import exceptions
from .models import UserToken

class CustomTokenAuthentication(BaseAuthentication):
    """
    Authenticate with header: Authorization: Token <token>
    """
    keyword = b"token"

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth:
            return None
        if len(auth) != 2:
            raise exceptions.AuthenticationFailed("Invalid token header.")
        if auth[0].lower() != self.keyword:
            return None

        key = auth[1].decode()
        if not key:
            raise exceptions.AuthenticationFailed("Empty token.")

        try:
            token = UserToken.objects.select_related("user").get(token_key=key)
        except UserToken.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid token.")

        # Token TTL check
        ttl_minutes = int(getattr(settings, "TOKEN_TTL_MINUTES", 0) or 0)
        if ttl_minutes > 0:
            if timezone.now() > token.created_at + timedelta(minutes=ttl_minutes):
                raise exceptions.AuthenticationFailed("Token expired. Please login again.")

        user = token.user
        # ✅ Monkey-patch to satisfy DRF's permission checks
        user.is_authenticated = True  
        return (user, None)
