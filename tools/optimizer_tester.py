# Simple optimizer + order flow tester
# Usage: edit TOKEN and ADDRESS_ID if needed, then run: python tools\optimizer_tester.py

import json
import urllib.request
import urllib.error

BASE = 'http://127.0.0.1:8000'
TOKEN = '6d4d3dce4e0ecdc59c07781fa6d612befdac545d32778507097393fb16e4e203'
ADDRESS_ID = 1

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Token {TOKEN}'
}

def post(path, payload):
    url = BASE + path
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        body = resp.read().decode('utf-8')
        return resp.getcode(), json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'_raw': 'no-json-body'}
    except Exception as ex:
        return None, {'error': str(ex)}

if __name__ == '__main__':
    print('Testing optimizer endpoint...')
    items = [{'product_id': 1, 'quantity': 1}, {'product_id': 2, 'quantity': 1}]
    payload = {'items': items, 'address_id': ADDRESS_ID}
    status, body = post('/api/v1/basket/optimize/', payload)
    print('OPTIMIZE status:', status)
    print(json.dumps(body, indent=2))

    if status and 200 <= status < 300 and isinstance(body, dict) and 'result' in body:
        plan = body['result']
        print('\nPosting plan to create-from-plan endpoint...')
        status2, body2 = post('/api/v1/orders/create-from-plan/', {'plan': plan, 'address_id': ADDRESS_ID, 'contact_number': '9999999999'})
        print('CREATE-FROM-PLAN status:', status2)
        print(json.dumps(body2, indent=2))
    else:
        print('\nSkipping plan-based order creation because optimizer did not return a plan.')

    print('\nPosting single-order create endpoint (fallback test)...')
    status3, body3 = post('/api/v1/orders/create/', {'items': items, 'address_id': ADDRESS_ID, 'contact_number': '9999999999'})
    print('CREATE-ORDER status:', status3)
    print(json.dumps(body3, indent=2))
