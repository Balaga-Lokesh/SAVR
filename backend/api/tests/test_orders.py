from django.test import TestCase, Client
from api import models
from decimal import Decimal
from unittest.mock import patch


class TestCreateFromPlan(TestCase):
    def setUp(self):
        # create user
        self.user = models.User.objects.create(
            username='testuser', email='test@example.com', password_hash='x', contact_number='9999999999'
        )
        # create token
        self.token = models.UserToken.objects.create(user=self.user, token_key='testtoken')
        # create mart admin and mart
        admin = models.Admin.objects.create(username='adm', email='adm@example.com', password_hash='x')
        self.mart = models.Mart.objects.create(
            name='Test Mart', location_lat=17.7, location_long=83.2, admin=admin, approved=True
        )
        # create products
        self.p1 = models.Product.objects.create(
            mart=self.mart, name='Rice 5kg Bag', category='grocery', price=12.13, stock=10, unit_weight_kg=5
        )
        self.p2 = models.Product.objects.create(
            mart=self.mart, name='Wheat Flour 2kg', category='grocery', price=4.07, stock=10, unit_weight_kg=2
        )
        # create address
        self.addr = models.Address.objects.create(
            user=self.user,
            line1='Test Addr',
            city='Visakhapatnam',
            state='Andhra Pradesh',
            pincode='530029',
            location_lat=17.6868,
            location_long=83.2185,
            is_default=True,
        )
        self.client = Client(HTTP_AUTHORIZATION='Token testtoken')

    def test_create_from_plan(self):
        url = '/api/v1/orders/create-from-plan/'
        plan = {
            'marts': [
                {
                    'mart_id': self.mart.mart_id,
                    'items': [
                        {'product_id': self.p1.product_id, 'qty': 1},
                        {'product_id': self.p2.product_id, 'qty': 1},
                    ],
                }
            ]
        }
        resp = self.client.post(
            url,
            {'plan': plan, 'address_id': self.addr.address_id, 'contact_number': '9999999999'},
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('orders', data)
        self.assertTrue(len(data['orders']) >= 1)

    def test_create_from_plan_missing_coords_uses_geocoding(self):
        """If the saved address has no coords, the server should geocode and still create orders."""
        # create an address without coords
        addr2 = models.Address.objects.create(
            user=self.user,
            line1='NoCoords Addr',
            city='Visakhapatnam',
            state='Andhra Pradesh',
            pincode='530029',
            is_default=False,
        )

        url = '/api/v1/orders/create-from-plan/'
        plan = {
            'marts': [
                {
                    'mart_id': self.mart.mart_id,
                    'items': [
                        {'product_id': self.p1.product_id, 'qty': 1},
                    ],
                }
            ]
        }

        # Patch the geocoding helper to return deterministic coords without hitting network
        with patch('api.views.get_lat_long_from_address', return_value=(Decimal('17.6868'), Decimal('83.2185'))):
            resp = self.client.post(
                url,
                {'plan': plan, 'address_id': addr2.address_id, 'contact_number': '9999999999'},
                content_type='application/json',
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('orders', data)
        self.assertTrue(len(data['orders']) >= 1)

        # refresh address from db - coords should be set
        addr2.refresh_from_db()
        self.assertIsNotNone(addr2.location_lat)
        self.assertIsNotNone(addr2.location_long)

    def test_create_from_plan_malformed_plan_returns_400(self):
        url = '/api/v1/orders/create-from-plan/'
        # missing 'marts' key
        bad_plan = {'not_marts': []}
        resp = self.client.post(
            url,
            {'plan': bad_plan, 'address_id': self.addr.address_id, 'contact_number': '9999999999'},
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('error', data)

    def test_create_from_plan_with_out_of_stock_item_skips_but_creates_order(self):
        """If a product in the plan is out of stock, the endpoint should skip it but still create orders for available items."""
        # mark p2 out of stock
        self.p2.stock = 0
        self.p2.save(update_fields=['stock'])

        url = '/api/v1/orders/create-from-plan/'
        plan = {
            'marts': [
                {
                    'mart_id': self.mart.mart_id,
                    'items': [
                        {'product_id': self.p1.product_id, 'qty': 1},
                        {'product_id': self.p2.product_id, 'qty': 1},
                    ],
                }
            ]
        }
        resp = self.client.post(
            url,
            {'plan': plan, 'address_id': self.addr.address_id, 'contact_number': '9999999999'},
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('orders', data)
        # order should be created, but items may be fewer than requested
        self.assertTrue(len(data['orders']) >= 1)

    def test_create_from_plan_with_missing_product_skips(self):
        """If a product id in the plan doesn't exist, it should be skipped without failing the whole plan."""
        url = '/api/v1/orders/create-from-plan/'
        plan = {
            'marts': [
                {
                    'mart_id': self.mart.mart_id,
                    'items': [
                        {'product_id': 9999999, 'qty': 1},
                    ],
                }
            ]
        }
        resp = self.client.post(
            url,
            {'plan': plan, 'address_id': self.addr.address_id, 'contact_number': '9999999999'},
            content_type='application/json',
        )
        # If no valid items exist, endpoint returns 400 (no orders created)
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('error', data)
