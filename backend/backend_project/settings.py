# settings.py — modified for safe dev CORS + cookie handling
import os
from pathlib import Path
import dj_database_url
from datetime import timedelta
from dotenv import load_dotenv

# Load .env (if present)
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep secret in environment for production
SECRET_KEY = os.getenv("SECRET_KEY", "unsafe-secret-key")

# DEBUG: set via .env (DEBUG=True for local development)
DEBUG = os.getenv("DEBUG", "False") == "True"

# Hosts allowed (comma-separated in env)
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",") if os.getenv("ALLOWED_HOSTS", "") else []

# ---------- INSTALLED APPS ----------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",

    # Local apps
    "api",
]

# ---------- MIDDLEWARE ----------
# CorsMiddleware must be high (before CommonMiddleware)
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# auto-detect Django project package (folder containing urls.py & wsgi.py)
PROJECT_PACKAGE = Path(__file__).resolve().parent.name
ROOT_URLCONF = f"{PROJECT_PACKAGE}.urls"
WSGI_APPLICATION = f"{PROJECT_PACKAGE}.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------- DATABASE ----------
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=False
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("DB_NAME", "savr_db"),
            "USER": os.getenv("DB_USER", "root"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "3306"),
            "OPTIONS": {"init_command": "SET sql_mode='STRICT_TRANS_TABLES'"},
            "CONN_MAX_AGE": 600,
        }
    }

# ---------- AUTH / PASSWORD ----------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Prefer Argon2 when available (optional)
try:
    import argon2  # type: ignore
    PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.Argon2PasswordHasher",
        "django.contrib.auth.hashers.PBKDF2PasswordHasher",
        "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
        "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    ]
except Exception:
    PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.PBKDF2PasswordHasher",
        "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
        "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    ]

# ---------- STATIC ----------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------- REST FRAMEWORK ----------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
}

# ---------- CORS baseline ----------
# Ensure corsheaders is present and middleware is ordered
if "corsheaders" not in INSTALLED_APPS:
    INSTALLED_APPS = ["corsheaders", *INSTALLED_APPS]

_middleware = list(MIDDLEWARE)
if "corsheaders.middleware.CorsMiddleware" not in _middleware:
    _middleware.insert(0, "corsheaders.middleware.CorsMiddleware")
    MIDDLEWARE = _middleware

# Default: don't allow wildcard when credentials are needed
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:8080", "http://127.0.0.1:8080",
]
# add render host if present
_render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if _render_host:
    _render_origin = _render_host if _render_host.startswith("http") else f"https://{_render_host}"
    if _render_origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(_render_origin)

# allow cookies
CORS_ALLOW_CREDENTIALS = True

# Allow common headers (Authorization, CSRF)
try:
    from corsheaders.defaults import default_headers
    CORS_ALLOW_HEADERS = list(default_headers) + ["x-csrftoken", "x-csrf-token", "authorization"]
except Exception:
    CORS_ALLOW_HEADERS = ["content-type", "authorization", "x-csrftoken", "x-csrf-token"]

CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

# CSRF trusted origins (default to common dev hosts)
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8080", "http://127.0.0.1:8080",
]

# ---------- EMAIL configuration ----------
env_email_backend = os.getenv("EMAIL_BACKEND", "").strip()
if env_email_backend:
    EMAIL_BACKEND = env_email_backend
    if "smtp" in env_email_backend.lower():
        EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com").strip()
        EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587") or 587)
        EMAIL_HOST_USER = os.getenv("EMAIL_USER", "").strip()
        EMAIL_HOST_PASSWORD = os.getenv("EMAIL_PASSWORD", "").replace(" ", "").strip()
        EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() in ("1", "true", "yes")
        EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False").lower() in ("1", "true", "yes")
        env_default_from = os.getenv("DEFAULT_FROM_EMAIL", "").strip()
        DEFAULT_FROM_EMAIL = env_default_from or EMAIL_HOST_USER or "no-reply@savr.local"
        SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)
else:
    env_host = os.getenv("EMAIL_HOST", "").strip()
    if env_host:
        EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
        EMAIL_HOST = env_host
        EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587") or 587)
        EMAIL_HOST_USER = os.getenv("EMAIL_USER", "").strip()
        EMAIL_HOST_PASSWORD = os.getenv("EMAIL_PASSWORD", "").replace(" ", "").strip()
        EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() in ("1", "true", "yes")
        EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False").lower() in ("1", "true", "yes")
        env_default_from = os.getenv("DEFAULT_FROM_EMAIL", "").strip()
        DEFAULT_FROM_EMAIL = env_default_from or EMAIL_HOST_USER or "no-reply@savr.local"
        SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)
    else:
        EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
        DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@savr.local")

# ---------- Dev overrides (safe for development only) ----------
if DEBUG:
    # Do not redirect HTTP → HTTPS during local dev
    SECURE_SSL_REDIRECT = False

    # Cookies not secure in local dev
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

    # IMPORTANT: use explicit allowed origins and enable credentials for cookie auth in dev
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOW_CREDENTIALS = True

    # Ensure common dev origins are present
    for origin in (
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ):
        if origin not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(origin)

    # Use Lax for SameSite to allow top-level navigations in dev
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

    # Keep CSRF trusted origins helpful for Django's CSRF checks
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:8080", "http://127.0.0.1:8080",
    ]

# ---------- Optional manual override to prevent accidental SSL redirect ----------
DISABLE_SSL_REDIRECT = os.getenv("DISABLE_SSL_REDIRECT", "False").lower() in ("1", "true", "yes")
if DISABLE_SSL_REDIRECT:
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

# Auto-disable redirect in case ALLOWED_HOSTS are only localhost-ish and DEBUG is False
if not DEBUG:
    _local_hosts = {"127.0.0.1", "localhost", "0.0.0.0", ""}
    if ALLOWED_HOSTS and all(any(h.strip() in _local_hosts for h in (host or "").split(",")) for host in ALLOWED_HOSTS):
        SECURE_SSL_REDIRECT = False
        SESSION_COOKIE_SECURE = False
        CSRF_COOKIE_SECURE = False

# ---------- Security production defaults ----------
if not DEBUG:
    try:
        if SECURE_SSL_REDIRECT is not False:
            SECURE_SSL_REDIRECT = True
    except NameError:
        SECURE_SSL_REDIRECT = True

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_HTTPONLY = True

# ---------- Razorpay / misc placeholders ----------
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")

# django-axes configuration (basic sensible defaults)
AXES_ENABLED = True
AXES_FAILURE_LIMIT = int(os.getenv("AXES_FAILURE_LIMIT", "5"))
AXES_COOLOFF_TIME = timedelta(minutes=int(os.getenv("AXES_COOLOFF_MINUTES", "15")))
AXES_LOCKOUT_CALLABLE = None
AXES_ONLY_USER_FAILURES = False
AXES_LOCKOUT_TEMPLATE = None
AXES_USE_USER_AGENT = True

try:
    import axes  # type: ignore
    if 'axes' not in INSTALLED_APPS:
        INSTALLED_APPS.append('axes')
    try:
        idx = MIDDLEWARE.index('django.contrib.auth.middleware.AuthenticationMiddleware')
        MIDDLEWARE.insert(idx + 1, 'axes.middleware.AxesMiddleware')
    except ValueError:
        MIDDLEWARE.append('axes.middleware.AxesMiddleware')

    AXES_ENABLED = True
except Exception:
    AXES_ENABLED = False

# Default cookie behavior in dev
SESSION_COOKIE_SAMESITE = globals().get("SESSION_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = globals().get("SESSION_COOKIE_SECURE", False)
CSRF_COOKIE_SECURE = globals().get("CSRF_COOKIE_SECURE", False)

# ------------------- FORCE CORS CONFIG (dev debug) -------------------
# This block ensures final values are correct; safe for dev only.
try:
    if "corsheaders" not in INSTALLED_APPS:
        INSTALLED_APPS = ["corsheaders", *INSTALLED_APPS]
except NameError:
    INSTALLED_APPS = ["corsheaders"]

try:
    _m = list(MIDDLEWARE)
    if _m[0] != "corsheaders.middleware.CorsMiddleware":
        if "corsheaders.middleware.CorsMiddleware" in _m:
            _m.remove("corsheaders.middleware.CorsMiddleware")
        _m.insert(0, "corsheaders.middleware.CorsMiddleware")
        MIDDLEWARE = _m
except NameError:
    MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", "django.middleware.common.CommonMiddleware"]

# Force correct CORS behavior for dev (no wildcard allowed when credentials used)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ORIGIN_ALLOW_ALL = False

# Allow only these frontend origins
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:8080", "http://127.0.0.1:8080",
]

# allow cookies
CORS_ALLOW_CREDENTIALS = True

# CSRF trust
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8080", "http://127.0.0.1:8080",
]
# ---------------------------------------------------------------------

# Allow a FRONTEND_ORIGIN from environment (useful for Vercel/Netlify deployments)
# Example: export FRONTEND_ORIGIN=https://savr-frontend-weld.vercel.app
_FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "").strip()
if _FRONTEND_ORIGIN:
    # Add to CORS origins
    try:
        if _FRONTEND_ORIGIN not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(_FRONTEND_ORIGIN)
    except NameError:
        CORS_ALLOWED_ORIGINS = [_FRONTEND_ORIGIN]

    # Add to CSRF trusted origins
    try:
        if _FRONTEND_ORIGIN not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(_FRONTEND_ORIGIN)
    except NameError:
        CSRF_TRUSTED_ORIGINS = [_FRONTEND_ORIGIN]

    # If you rely on cookie-based auth across origins, set cookies to allow cross-site
    # NOTE: prefer Token header auth for cross-origin API calls when possible.
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "None")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "None")
    CSRF_COOKIE_SECURE = True
