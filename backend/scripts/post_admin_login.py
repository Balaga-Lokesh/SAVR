import requests
url='http://127.0.0.1:8000/api/v1/admin/auth/login/'
payload={'email':'balaga23bcs141@iiitkottayam.ac.in','password':'Admin@141'}
print('Posting to', url)
r=requests.post(url,json=payload)
print('status', r.status_code)
try:
    print(r.json())
except Exception:
    print(r.text)
