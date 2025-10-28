from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_deliveryagent_deliveryagenttoken"),
    ]

    operations = [
        migrations.AddField(
            model_name="deliveryagent",
            name="approved",
            field=models.BooleanField(default=False),
        ),
    ]
