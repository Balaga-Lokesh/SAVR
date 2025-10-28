# backend/api/management/commands/create_admin.py
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.hashers import make_password
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
import getpass

# Try to use get_user_model first for maximum compatibility.
try:
    from django.contrib.auth import get_user_model
    UserModel = get_user_model()
except Exception:
    # Fallback: import your app's User model directly
    try:
        from api.models import User as UserModel  # adjust if your model path differs
    except Exception as e:
        raise RuntimeError("Could not import User model; please ensure api.models.User exists.") from e


class Command(BaseCommand):
    help = "Create or update an admin user (sets is_staff and is_superuser). Dev-only utility."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email", "-e", dest="email", required=False, help="Email address for the admin user"
        )
        parser.add_argument(
            "--username", "-u", dest="username", required=False, help="Username for the admin user"
        )
        parser.add_argument(
            "--password", "-p", dest="password", required=False, help="Password (if omitted you will be prompted)"
        )
        parser.add_argument(
            "--superuser", action="store_true", dest="superuser", help="Also set is_superuser=True"
        )

    def handle(self, *args, **options):
        email = options.get("email")
        username = options.get("username")
        password = options.get("password")
        make_super = options.get("superuser", False)

        if not email:
            email = input("Admin email: ").strip()
        if not email:
            raise CommandError("Email is required.")

        # validate email
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError("Invalid email address provided.")

        if not username:
            # default username to the local-part of the email if not provided
            username = email.split("@")[0]

        if not password:
            # prompt securely for password
            while True:
                password = getpass.getpass("Password: ")
                pw2 = getpass.getpass("Password (again): ")
                if password != pw2:
                    self.stdout.write(self.style.WARNING("Passwords do not match — try again."))
                    continue
                if len(password) < 8:
                    ok = input("Password is short (<8). Use anyway? (y/N): ").strip().lower()
                    if ok != "y":
                        continue
                break

        # Try to find existing user by email first, then username
        user = None
        try:
            user = UserModel.objects.filter(email__iexact=email).first()
        except Exception:
            # fallback: try username
            user = UserModel.objects.filter(username=username).first()

        if user:
            self.stdout.write(self.style.WARNING(f"User with email {email} already exists (id={getattr(user, 'id', getattr(user, 'user_id', 'unknown') )}). Updating flags and password."))
            # update password and flags
            try:
                user.password_hash = make_password(password) if hasattr(user, "password_hash") else make_password(password)
                # Try common field names
                if hasattr(user, "is_staff"):
                    user.is_staff = True
                else:
                    setattr(user, "is_staff", True)
                if make_super:
                    if hasattr(user, "is_superuser"):
                        user.is_superuser = True
                    else:
                        setattr(user, "is_superuser", True)
                user.save()
            except Exception as e:
                raise CommandError(f"Failed to update existing user: {e}")
            self.stdout.write(self.style.SUCCESS(f"Updated user {email} to admin (is_staff=True)."))
            return

        # create new user
        try:
            # adapt to your model fields: many projects use 'password' or 'password_hash'
            create_kwargs = {
                "username": username,
                "email": email,
            }
            # If model expects 'password_hash' or 'password', we will try both safely.
            if "password_hash" in [f.name for f in UserModel._meta.get_fields()]:
                create_kwargs["password_hash"] = make_password(password)
            elif "password" in [f.name for f in UserModel._meta.get_fields()]:
                create_kwargs["password"] = make_password(password)
            else:
                # fallback: set attribute after creation
                pass

            # try to include contact_number default (not required)
            if "contact_number" in [f.name for f in UserModel._meta.get_fields()]:
                create_kwargs.setdefault("contact_number", "")

            user = UserModel.objects.create(**create_kwargs)
            # set flags
            if hasattr(user, "is_staff"):
                user.is_staff = True
            else:
                setattr(user, "is_staff", True)
            if make_super:
                if hasattr(user, "is_superuser"):
                    user.is_superuser = True
                else:
                    setattr(user, "is_superuser", True)

            # if password field wasn't set via create, set it now
            if not (hasattr(user, "password") or hasattr(user, "password_hash")):
                # many custom models have a different API; we'll try to set 'password_hash' attribute
                try:
                    setattr(user, "password_hash", make_password(password))
                except Exception:
                    pass

            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created admin user: {email} (username: {username})"))
        except Exception as e:
            raise CommandError(f"Failed to create admin user: {e}")
