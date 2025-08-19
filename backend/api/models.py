from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from datetime import timedelta


def otp_expires_at():
    """Return a timezone-aware datetime 5 minutes in the future.

    Defined at module level so Django migrations can serialize it.
    """
    return timezone.now() + timedelta(minutes=5)


class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    email = models.CharField(max_length=100, unique=True)
    password_hash = models.CharField(max_length=255)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    preferences = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'users'

    def __str__(self):
        return self.username


class Admin(models.Model):
    ROLE_CHOICES = [
        ('main_admin', 'Main Admin'),
        ('mart_admin', 'Mart Admin'),
    ]

    admin_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    email = models.CharField(max_length=100, unique=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    mart = models.ForeignKey('Mart', null=True, blank=True, on_delete=models.SET_NULL, db_column='mart_id', related_name='+')
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'admins'

    def __str__(self):
        return self.username


class Mart(models.Model):
    mart_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6)
    location_long = models.DecimalField(max_digits=10, decimal_places=6)
    address = models.TextField(null=True, blank=True)
    admin = models.ForeignKey(Admin, null=True, blank=True, on_delete=models.SET_NULL, db_column='admin_id', related_name='+')
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'marts'

    def __str__(self):
        return self.name


class Product(models.Model):
    CATEGORY_CHOICES = [
        ('grocery', 'Grocery'),
        ('clothing', 'Clothing'),
        ('essential', 'Essential'),
        ('other', 'Other'),
    ]

    product_id = models.AutoField(primary_key=True)
    mart = models.ForeignKey(Mart, on_delete=models.CASCADE, db_column='mart_id')
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    description = models.TextField(null=True, blank=True)
    quality_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'products'

    def __str__(self):
        return f"{self.name} @ {self.mart}"


class Offer(models.Model):
    offer_id = models.AutoField(primary_key=True)
    mart = models.ForeignKey(Mart, null=True, blank=True, on_delete=models.CASCADE, db_column='mart_id')
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.CASCADE, db_column='product_id')
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    description = models.TextField(null=True, blank=True)
    is_global = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
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
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'reviews'

    def __str__(self):
        return f"{self.user} -> {self.product}: {self.rating}"


class Basket(models.Model):
    basket_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    items = models.JSONField()
    optimized_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
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
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
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
        managed = False
        db_table = 'order_items'

    def __str__(self):
        return f"{self.quantity}x {self.product}"


class DeliveryPartner(models.Model):
    partner_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.CharField(max_length=100, unique=True, null=True, blank=True)
    location_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    location_long = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    availability = models.BooleanField(default=True)
    approved = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
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
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'deliveries'

    def __str__(self):
        return f"Delivery {self.delivery_id} ({self.status})"


class AnalyticsLog(models.Model):
    log_id = models.AutoField(primary_key=True)
    admin = models.ForeignKey(Admin, on_delete=models.CASCADE, db_column='admin_id')
    action_type = models.CharField(max_length=50, null=True, blank=True)
    details = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField()

    class Meta:
        managed = False
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
    """Simple token model linked to the custom `users` table.

    We don't tie into Django's auth.User here because your users live in a
    separate `users` table. This model stores a random token per user.
    """
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id')
    key = models.CharField(max_length=80, unique=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'user_tokens'

    def __str__(self):
        return f"Token for {self.user}: {self.key[:8]}..."
