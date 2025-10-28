from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.hashers import make_password
from api import models


class AdminAuthTests(TestCase):
    def setUp(self):
        self.client = Client()
        # create user
        self.admin_user = models.User.objects.create(username='admintest', email='admin@example.com', password_hash=make_password('pass1234'), is_staff=True, is_superuser=True)

    def test_admin_login(self):
        url = reverse('admin-auth-login')
        resp = self.client.post(url, data={'email': 'admin@example.com', 'password': 'pass1234'}, content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        j = resp.json()
        # credential check should succeed and instruct OTP
        self.assertIn('message', j)

        # request OTP (simulate what frontend does)
        r2 = self.client.post(reverse('auth-request-otp'), data={'destination': 'admin@example.com', 'purpose': 'login'}, content_type='application/json')
        self.assertEqual(r2.status_code, 200)

        # fetch the OTP from DB and verify
        otp = models.OTPCode.objects.filter(destination='admin@example.com', purpose='login').latest('created_at')
        v = self.client.post(reverse('auth-verify-otp'), data={'destination': 'admin@example.com', 'code': otp.code, 'purpose': 'login', 'role': 'admin'}, content_type='application/json')
        self.assertEqual(v.status_code, 200)
        self.assertIn('token', v.json())

    def test_update_stock(self):
        # create product
        mart = models.Admin.objects.create(username='madmin', password_hash='d')
        mart_obj = models.Mart.objects.create(name='TestMart', location_lat=17.0, location_long=83.0, admin=mart, approved=True)
        product = models.Product.objects.create(mart=mart_obj, name='TestProd', category='grocery', price=10.0, stock=5, unit_weight_kg=1.0)

        # login to get token
        url = reverse('admin-auth-login')
        resp = self.client.post(url, data={'email': 'admin@example.com', 'password': 'pass1234'}, content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        # request OTP and verify to obtain token
        self.client.post(reverse('auth-request-otp'), data={'destination': 'admin@example.com', 'purpose': 'login'}, content_type='application/json')
        otp = models.OTPCode.objects.filter(destination='admin@example.com', purpose='login').latest('created_at')
        v = self.client.post(reverse('auth-verify-otp'), data={'destination': 'admin@example.com', 'code': otp.code, 'purpose': 'login', 'role': 'admin'}, content_type='application/json')
        self.assertEqual(v.status_code, 200)
        token = v.json().get('token')

        upd_url = reverse('admin-update-stock')
        res2 = self.client.post(upd_url, data={'product_id': product.product_id, 'stock': 20}, content_type='application/json', HTTP_AUTHORIZATION=f'Token {token}')
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json().get('stock'), 20)
