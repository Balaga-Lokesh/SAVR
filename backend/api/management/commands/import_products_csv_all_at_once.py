# api/management/commands/import_products_csv.py
import csv
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from api.models import Mart, Product

def map_category(raw):
    # allowed: 'grocery','clothing','essential','other','dairy'
    if not raw:
        return "grocery"
    r = str(raw).strip().lower()
    if r in {"grocery","clothing","essential","other","dairy"}:
        return r
    if any(k in r for k in ["milk","dairy","curd","paneer","ghee"]):
        return "dairy"
    if any(k in r for k in ["soap","detergent","home","clean","wash","hygiene"]):
        return "essential"
    if any(k in r for k in ["cloth","apparel","tshirt","shirt","jeans"]):
        return "clothing"
    if any(k in r for k in ["snack","biscuit","noodle","maggi","bread","chips"]):
        return "grocery"
    if any(k in r for k in ["rice","atta","flour","wheat","dal","lentil","pulse","oil","sugar","salt","grain","cereal","spice"]):
        return "grocery"
    return "other"

def parse_decimal(x, default="0.00"):
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal(default)

def parse_int(x, default=0):
    try:
        return int(str(x).strip())
    except Exception:
        return int(default)

def chunked(iterable, size):
    buf = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf

class Command(BaseCommand):
    help = "Import products from CSV into the products table (bulk, single transaction)."

    def add_arguments(self, parser):
        parser.add_argument("--csv", required=True, help="Path to products.csv")
        parser.add_argument("--truncate", action="store_true", help="Empty products table before import")
        parser.add_argument("--use-csv-ids", action="store_true", help="Use product_id from CSV (danger of collisions)")
        parser.add_argument("--batch", type=int, default=1000, help="bulk_create batch size")

    def handle(self, *args, **opts):
        csv_path = opts["csv"]
        truncate = opts["truncate"]
        use_csv_ids = opts["use_csv_ids"]
        batch_size = opts["batch"]

        required = {"product_id","mart_id","name","category","price","stock","description","quality_score","created_at","updated_at","image_url"}
        rows_count = 0
        created_count = 0
        skipped = 0
        missing_marts = set()

        self.stdout.write(self.style.NOTICE(f"Importing from: {csv_path}"))

        with transaction.atomic():
            if truncate:
                Product.objects.all().delete()
                self.stdout.write(self.style.WARNING("Cleared products table."))

            products_to_create = []

            try:
                with open(csv_path, newline="", encoding="utf-8-sig") as f:  # <-- utf-8-sig strips BOM
                    reader = csv.DictReader(f)
                    raw_header = reader.fieldnames or []
                    # normalize headers: strip spaces and BOM on any header just in case
                    header_norm = [h.strip().lstrip("\ufeff") for h in raw_header]
                    reader.fieldnames = header_norm  # tell reader to use normalized headers
                    header = set(header_norm)

                    if not required.issubset(header):
                        raise CommandError(
                            "CSV headers mismatch.\n"
                            f"Expected at least: {sorted(required)}\n"
                            f"Found: {sorted(header)}"
                        )

                    for row in reader:
                        rows_count += 1
                        try:
                            name = (row.get("name") or "").strip()
                            if not name:
                                raise ValueError("blank name")

                            mart_id = parse_int(row.get("mart_id"))
                            mart = Mart.objects.filter(mart_id=mart_id).first()
                            if not mart:
                                missing_marts.add(mart_id)
                                raise ValueError(f"mart_id {mart_id} not found")

                            category = map_category(row.get("category",""))
                            price = parse_decimal(row.get("price", "0.00"))
                            stock = parse_int(row.get("stock", 0))
                            description = (row.get("description") or "").strip()
                            quality_score = parse_decimal(row.get("quality_score", "4.3"))
                            image_url = (row.get("image_url") or "").strip()

                            p = Product(
                                mart=mart,
                                name=name,
                                category=category,
                                price=price,
                                stock=stock,
                                description=description or "",
                                quality_score=quality_score,
                                unit_weight_kg=Decimal("1.00"),
                                image_url=image_url,
                            )

                            if use_csv_ids:
                                csv_id = parse_int(row.get("product_id"))
                                if csv_id:
                                    p.product_id = csv_id

                            products_to_create.append(p)

                        except Exception as e:
                            skipped += 1
                            self.stdout.write(self.style.WARNING(f"skip row {rows_count}: {e}"))

            except FileNotFoundError:
                raise CommandError(f"CSV not found: {csv_path}")

            # bulk insert in batches
            for batch in chunked(products_to_create, batch_size):
                Product.objects.bulk_create(batch, ignore_conflicts=False)
                created_count += len(batch)

        self.stdout.write(self.style.SUCCESS(
            f"✅ Import done. rows_read={rows_count}, created={created_count}, skipped={skipped}"
        ))
        if missing_marts:
            self.stdout.write(self.style.WARNING(
                f"⚠ missing mart_ids (not found in DB): {sorted(missing_marts)}"
            ))
