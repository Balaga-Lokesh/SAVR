from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from datetime import timedelta

# ---------------------- Helper Functions ----------------------
def otp_expires_at():
    """Return a timezone-aware datetime 5 minutes in the future."""
    return timezone.now() + timedelta(minutes=5)

# ---------------------- Models ----------------------
class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    password_hash = models.CharField(max_length=255)

    address = models.TextField(null=True, blank=True)  # delivery address
    contact_number = models.CharField(max_length=20, null=True, blank=True)

    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, db_index=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, db_index=True)
    preferences = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username


class Admin(models.Model):
    admin_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=[('main_admin','Main Admin'),('mart_admin','Mart Admin')])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admins'

    def __str__(self):
        return self.username


class Mart(models.Model):
    mart_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, db_index=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, db_index=True)
    address = models.TextField(null=True, blank=True)
    # SAVR acts as delivery assistant; each mart still has an admin account
    admin = models.ForeignKey(
        Admin,
        on_delete=models.PROTECT,
        db_column='admin_id',
        related_name='marts',
    )
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'marts'

    def __str__(self):
        return self.name


class Address(models.Model):
    address_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id', related_name='addresses')
    label = models.CharField(max_length=50, null=True, blank=True)
    contact_name = models.CharField(max_length=100, null=True, blank=True)
    contact_phone = models.CharField(max_length=20, null=True, blank=True)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=80, default="Visakhapatnam")
    state = models.CharField(max_length=80, default="Andhra Pradesh")
    pincode = models.CharField(max_length=10, null=True, blank=True)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    instructions = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'addresses'

    def __str__(self):
        return f"{self.label or 'Address'} · {self.city}"


class Product(models.Model):
    CATEGORY_CHOICES = [
        ('grocery', 'Grocery'),
        ('clothing', 'Clothing'),
        ('essential', 'Essential'),
        ('other', 'Other'),
        ('dairy', 'Dairy'),
    ]
    product_id = models.AutoField(primary_key=True)
    mart = models.ForeignKey(Mart, on_delete=models.CASCADE, db_column='mart_id')
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    description = models.TextField(blank=True, null=True)
    quality_score = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    # NEW: per-unit weight (kg) for delivery cost calculation
    unit_weight_kg = models.DecimalField(max_digits=6, decimal_places=3, default=1.0,
                                         validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'products'

    def __str__(self):
        return self.name


class Offer(models.Model):
    offer_id = models.AutoField(primary_key=True)
    mart = models.ForeignKey(Mart, null=True, blank=True, on_delete=models.CASCADE, db_column='mart_id')
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.CASCADE, db_column='product_id')
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    description = models.TextField(null=True, blank=True)
    is_global = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'offers'

    def __str__(self):
        return f"Offer {self.offer_id} - {self.discount_percentage}%"


class Review(models.Model):
    review_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id')
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(null=True, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews'

    def __str__(self):
        return f"{self.user} -> {self.product}: {self.rating}"


class Basket(models.Model):
    basket_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    items = models.JSONField()
    optimized_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'baskets'

    def __str__(self):
        return f"Basket {self.basket_id} ({self.user})"


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    order_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    total_cost = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    # Delivery address reference and snapshot for historical consistency
    delivery_address = models.ForeignKey(
        'Address', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='delivery_address_id', related_name='orders'
    )
    delivery_address_snapshot = models.TextField(null=True, blank=True)
    delivery_address_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    delivery_address_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders'

    def __str__(self):
        return f"Order {self.order_id} ({self.user})"


class OrderItem(models.Model):
    item_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id')
    mart = models.ForeignKey(Mart, on_delete=models.CASCADE, db_column='mart_id')
    quantity = models.IntegerField()
    price_at_purchase = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'order_items'

    def __str__(self):
        return f"{self.quantity}x {self.product}"


class DeliveryPartner(models.Model):
    partner_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    availability = models.BooleanField(default=True)
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'delivery_partners'

    def __str__(self):
        return self.name


class Delivery(models.Model):
    STATUS_CHOICES = [
        ('assigned', 'Assigned'),
        ('in_transit', 'In Transit'),
        ('delivered', 'Delivered'),
    ]
    delivery_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id')
    partner = models.ForeignKey(DeliveryPartner, null=True, blank=True, on_delete=models.SET_NULL, db_column='partner_id')
    estimated_time = models.IntegerField(null=True, blank=True)
    actual_time = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    route_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'deliveries'

    def __str__(self):
        return f"Delivery {self.delivery_id} ({self.status})"


class AnalyticsLog(models.Model):
    log_id = models.AutoField(primary_key=True)
    admin = models.ForeignKey(
        Admin,
        on_delete=models.CASCADE,
        db_column='admin_id',
        null=True,
        blank=True,
    )
    action_type = models.CharField(max_length=50, null=True, blank=True)
    details = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analytics_logs'

    def __str__(self):
        return f"Log {self.log_id} by {self.admin}"


class OTPCode(models.Model):
    PURPOSE_CHOICES = [
        ('login', 'Login'),
        ('register', 'Register'),
    ]
    id = models.BigAutoField(primary_key=True)
    destination = models.CharField(max_length=254)  # email or phone
    code = models.CharField(max_length=10)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(default=otp_expires_at)
    used = models.BooleanField(default=False)

    class Meta:
        db_table = 'otp_codes'

    def is_valid(self):
        return (not self.used) and (timezone.now() <= self.expires_at)


class UserToken(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    token_key = models.CharField(max_length=80, unique=True, db_column='token_key')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'user_tokens'

    def __str__(self):
        return f"Token for {self.user}: {self.token_key[:8]}..."
