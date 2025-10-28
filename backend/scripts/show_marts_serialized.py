import os, sys, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
import django
django.setup()
from api import models, serializers

marts = list(models.Mart.objects.all())
ser = serializers.MartSerializer(marts, many=True)
print(json.dumps(ser.data, indent=2, default=str))
