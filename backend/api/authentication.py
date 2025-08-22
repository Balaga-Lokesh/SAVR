from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from .models import UserToken

class CustomTokenAuthentication(BaseAuthentication):
    """
    Authenticates requests using a custom token model (models.UserToken).
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Token '):
            return None

        try:
            token_key = auth_header.split(' ')[1]
            token = UserToken.objects.select_related('user').get(key=token_key)
        except (UserToken.DoesNotExist, IndexError):
            raise exceptions.AuthenticationFailed('Invalid token')

        return (token.user, token)