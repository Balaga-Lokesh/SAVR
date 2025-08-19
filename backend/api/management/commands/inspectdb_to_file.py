from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Run inspectdb and save output to api/models_from_db.py'

    def handle(self, *args, **options):
        out_path = 'api/models_from_db.py'
        with open(out_path, 'w', encoding='utf-8') as f:
            call_command('inspectdb', stdout=f)
        self.stdout.write(self.style.SUCCESS(f'Wrote models to {out_path}'))
