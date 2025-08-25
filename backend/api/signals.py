from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Product
from .utils import fetch_product_image

@receiver(pre_save, sender=Product)
def add_image_to_product(sender, instance, **kwargs):
    """
    Auto-fetch product image if none is provided.
    """
    if not instance.image_url:
        query = f"{instance.name} {instance.category or ''}".strip()
        instance.image_url = fetch_product_image(query)
