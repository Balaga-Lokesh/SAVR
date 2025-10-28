# api/authentication.py
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework import exceptions
from .models import UserToken, DeliveryAgentToken, DeliveryAgent, DeliveryPartnerToken, DeliveryPartner

class CustomTokenAuthentication(BaseAuthentication):
    """
    Authenticate with header: Authorization: Token <token>
    """
    keyword = b"token"

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        key = None
        if auth and len(auth) == 2 and auth[0].lower() == self.keyword:
            key = auth[1].decode()

        # Fallback: read token from cookie (auth_token by default)
        if not key:
            cookie_name = getattr(settings, 'AUTH_COOKIE_NAME', 'auth_token')
            cookie_val = request.COOKIES.get(cookie_name)
            if cookie_val:
                key = cookie_val

        if not key:
            print("[CustomTokenAuthentication] No token found in header or cookie.")
            return None

    # First try UserToken (normal users / admins)
        token = None
        try:
            token = UserToken.objects.select_related("user").get(token_key=key)
            # Token TTL check
            ttl_minutes = int(getattr(settings, "TOKEN_TTL_MINUTES", 0) or 0)
            if ttl_minutes > 0 and timezone.now() > token.created_at + timedelta(minutes=ttl_minutes):
                print(f"[CustomTokenAuthentication] User token expired: {key}")
                raise exceptions.AuthenticationFailed("Token expired. Please login again.")

            user = token.user
            user.is_authenticated = True
            print(f"[CustomTokenAuthentication] Authenticated user {user.username} (id={user.user_id})")
            return (user, None)
        except UserToken.DoesNotExist:
            # Not a user token — try partner tokens first (new model)
            try:
                ptoken = DeliveryPartnerToken.objects.select_related("partner").get(token_key=key)
                # TTL check for partner tokens
                ttl_minutes = int(getattr(settings, "TOKEN_TTL_MINUTES", 0) or 0)
                if ttl_minutes > 0 and timezone.now() > ptoken.created_at + timedelta(minutes=ttl_minutes):
                    print(f"[CustomTokenAuthentication] Partner token expired: {key}")
                    raise exceptions.AuthenticationFailed("Token expired. Please login again.")
                partner = ptoken.partner
                partner.is_authenticated = True
                setattr(partner, "is_partner", True)
                print(f"[CustomTokenAuthentication] Authenticated partner {partner.name} (id={partner.partner_id})")
                return (partner, None)
            except DeliveryPartnerToken.DoesNotExist:
                # Not a partner token — fall back to agent tokens for backward compatibility
                try:
                    atok = DeliveryAgentToken.objects.select_related("agent").get(token_key=key)
                except DeliveryAgentToken.DoesNotExist:
                    print(f"[CustomTokenAuthentication] Invalid token: {key}")
                    raise exceptions.AuthenticationFailed("Invalid token.")

                # TTL check for agent tokens (reuse same TTL setting)
                ttl_minutes = int(getattr(settings, "TOKEN_TTL_MINUTES", 0) or 0)
                if ttl_minutes > 0 and timezone.now() > atok.created_at + timedelta(minutes=ttl_minutes):
                    print(f"[CustomTokenAuthentication] Agent token expired: {key}")
                    raise exceptions.AuthenticationFailed("Token expired. Please login again.")

                agent = atok.agent
                # Monkey-patch minimal attributes expected by downstream code
                agent.is_authenticated = True
                # Mark role-like flag so views can detect agent vs user
                setattr(agent, "is_agent", True)
                print(f"[CustomTokenAuthentication] Authenticated agent {agent.name} (id={agent.agent_id})")
                return (agent, None)
