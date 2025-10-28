# api/models.py
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.utils import timezone
from datetime import timedelta

# ---------------------- Helper ----------------------
def otp_expires_at():
    """Return a timezone-aware datetime 5 minutes in the future."""
    return timezone.now() + timedelta(minutes=5)

# ---------------------- User ----------------------
class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    password_hash = models.CharField(max_length=255)

    address = models.TextField(null=True, blank=True)
    contact_number = models.CharField(max_length=20, null=True, blank=True)

    # Admin flags for permission checks (default False)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, db_index=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, db_index=True)
    preferences = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.username

# ---------------------- Admin ----------------------
class Admin(models.Model):
    admin_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=[("main_admin","Main Admin"),("mart_admin","Mart Admin")])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "admins"

    def __str__(self):
        return self.username

# ---------------------- Mart ----------------------
class Mart(models.Model):
    mart_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, db_index=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, db_index=True)
    address = models.TextField(null=True, blank=True)
    admin = models.ForeignKey(Admin, on_delete=models.PROTECT, db_column="admin_id", related_name="marts")
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "marts"
        indexes = [
            models.Index(fields=["location_lat", "location_long"], name="mart_loc_idx"),
        ]

    def __str__(self):
        return self.name




# ---------------------- Address ----------------------
_pin_validator = RegexValidator(regex=r"^\d{6}$", message="PIN code must be a 6-digit number.")

class Address(models.Model):
    address_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id", related_name="addresses")
    label = models.CharField(max_length=50, null=True, blank=True)
    contact_name = models.CharField(max_length=100, null=True, blank=True)
    contact_phone = models.CharField(max_length=20, null=True, blank=True)

    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=80, default="Visakhapatnam")
    state = models.CharField(max_length=80, default="Andhra Pradesh")
    pincode = models.CharField(max_length=6, null=True, blank=True, validators=[_pin_validator], db_index=True)

    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, db_index=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, db_index=True)

    is_default = models.BooleanField(default=False)
    instructions = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "addresses"
        indexes = [
            models.Index(fields=["user", "is_default"], name="addr_user_default_idx"),
            models.Index(fields=["pincode"], name="addr_pin_idx"),
            models.Index(fields=["location_lat", "location_long"], name="addr_loc_idx"),
        ]

    def __str__(self):
        return f"{self.label or 'Address'} · {self.city}"

    @property
    def summary(self) -> str:
        parts = [self.line1, self.line2, self.city, self.state, self.pincode]
        return ", ".join([p for p in parts if p])

# ---------------------- Product ----------------------
class Product(models.Model):
    CATEGORY_CHOICES = [
        ("grocery", "Grocery"),
        ("clothing", "Clothing"),
        ("essential", "Essential"),
        ("other", "Other"),
        ("dairy", "Dairy"),
    ]
    product_id = models.AutoField(primary_key=True)
    mart = models.ForeignKey(Mart, on_delete=models.CASCADE, db_column="mart_id")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    description = models.TextField(blank=True, null=True)
    quality_score = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    unit_weight_kg = models.DecimalField(max_digits=6, decimal_places=3, default=1.0, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "products"

    def __str__(self):
        return self.name

# ---------------------- Offer ----------------------
class Offer(models.Model):
    offer_id = models.AutoField(primary_key=True)
    mart = models.ForeignKey(Mart, null=True, blank=True, on_delete=models.CASCADE, db_column="mart_id")
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.CASCADE, db_column="product_id")
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    description = models.TextField(null=True, blank=True)
    is_global = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "offers"

    def __str__(self):
        return f"Offer {self.offer_id} - {self.discount_percentage}%"

# ---------------------- Review ----------------------
class Review(models.Model):
    review_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column="product_id")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(null=True, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reviews"

    def __str__(self):
        return f"{self.user} -> {self.product}: {self.rating}"

# ---------------------- Basket ----------------------
class Basket(models.Model):
    basket_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    items = models.JSONField()
    optimized_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "baskets"

    def __str__(self):
        return f"Basket {self.basket_id} ({self.user})"

# ---------------------- Order ----------------------
class Order(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]
    order_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    total_cost = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    # Delivery address + snapshot (for history)
    delivery_address = models.ForeignKey(
        "Address", null=True, blank=True, on_delete=models.SET_NULL,
        db_column="delivery_address_id", related_name="orders"
    )
    delivery_address_snapshot = models.TextField(null=True, blank=True)
    delivery_address_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    delivery_address_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"

    def __str__(self):
        return f"Order {self.order_id} ({self.user})"

class OrderItem(models.Model):
    item_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column="order_id")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column="product_id")
    mart = models.ForeignKey(Mart, on_delete=models.CASCADE, db_column="mart_id")
    quantity = models.IntegerField()
    price_at_purchase = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "order_items"

    def __str__(self):
        return f"{self.quantity}x {self.product}"

# ---------------------- Delivery ----------------------
class DeliveryPartner(models.Model):
    partner_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    password_hash = models.CharField(max_length=255, null=True, blank=True)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    availability = models.BooleanField(default=True)
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "delivery_partners"

    def __str__(self):
        return self.name

class Delivery(models.Model):
    STATUS_CHOICES = [
        ("assigned", "Assigned"),
        ("in_transit", "In Transit"),
        ("delivered", "Delivered"),
    ]
    delivery_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column="order_id")
    partner = models.ForeignKey(DeliveryPartner, null=True, blank=True, on_delete=models.SET_NULL, db_column="partner_id")
    estimated_time = models.IntegerField(null=True, blank=True)
    actual_time = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="assigned")
    route_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "deliveries"

    def __str__(self):
        return f"Delivery {self.delivery_id} ({self.status})"


# ---------------------- Delivery Agent (auth) ----------------------
class DeliveryAgent(models.Model):
    agent_id = models.AutoField(primary_key=True)
    partner = models.ForeignKey(DeliveryPartner, null=True, blank=True, on_delete=models.SET_NULL, db_column='partner_id')
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    # Whether an admin has approved this agent for access. New registrations start as False.
    approved = models.BooleanField(default=False)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'delivery_agents'

    def __str__(self):
        return f"Agent {self.agent_id} {self.name}"


class DeliveryAgentToken(models.Model):
    token_id = models.BigAutoField(primary_key=True)
    agent = models.ForeignKey(DeliveryAgent, on_delete=models.CASCADE, db_column='agent_id', related_name='tokens')
    token_key = models.CharField(max_length=128, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'delivery_agent_tokens'

    def __str__(self):
        return f"AgentToken {self.token_id} {self.agent_id}"


class DeliveryPartnerToken(models.Model):
    token_id = models.BigAutoField(primary_key=True)
    partner = models.ForeignKey('DeliveryPartner', on_delete=models.CASCADE, db_column='partner_id', related_name='tokens')
    token_key = models.CharField(max_length=128, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'delivery_partner_tokens'

    def __str__(self):
        return f"PartnerToken {self.token_id} {self.partner_id}"

# ---------------------- Analytics ----------------------
class AnalyticsLog(models.Model):
    log_id = models.AutoField(primary_key=True)
    admin = models.ForeignKey(Admin, on_delete=models.CASCADE, db_column="admin_id", null=True, blank=True)
    action_type = models.CharField(max_length=50, null=True, blank=True)
    details = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "analytics_logs"

    def __str__(self):
        return f"Log {self.log_id} by {self.admin}"


class AdminAuthAudit(models.Model):
    """Record admin auth attempts for auditing and monitoring."""
    audit_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_column='user_id')
    email = models.CharField(max_length=254, null=True, blank=True)
    ip_address = models.CharField(max_length=100, null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    outcome = models.CharField(max_length=50)
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admin_auth_audit"

    def __str__(self):
        return f"AdminAuthAudit {self.audit_id} {self.email} {self.outcome}"

# ---------------------- OTP ----------------------
class OTPCode(models.Model):
    PURPOSE_CHOICES = [("login", "Login"), ("register", "Register")]
    id = models.BigAutoField(primary_key=True)
    destination = models.CharField(max_length=254)  # email or phone
    code = models.CharField(max_length=10)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default="login")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=otp_expires_at)
    used = models.BooleanField(default=False)

    class Meta:
        db_table = "otp_codes"

    def __str__(self):
        return f"{self.destination} - {self.purpose}"

# ---------------------- UserToken (for auth) ----------------------
class UserToken(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens")
    token_key = models.CharField(max_length=128, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_tokens"

    def __str__(self):
        return f"{self.user.username} · {self.token_key[:8]}…"

# <- add near other models in api/models.py

class Payment(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("success", "Success"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
    ]

    payment_id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey("Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="payments")
    provider = models.CharField(max_length=50, default="razorpay")  # e.g. razorpay, cod, stripe
    provider_order_id = models.CharField(max_length=255, null=True, blank=True)  # razorpay order id
    provider_payment_id = models.CharField(max_length=255, null=True, blank=True)  # razorpay payment id
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="INR")
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default="pending")
    raw_payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"

    def __str__(self):
        return f"Payment #{self.payment_id} {self.provider} {self.status}"
