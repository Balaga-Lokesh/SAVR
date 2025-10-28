import urllib.request, json
url='http://127.0.0.1:8000/api/v1/auth/request-otp/'
data=json.dumps({"destination":"luckylokesh1425@gmail.com","purpose":"login"}).encode('utf-8')
req=urllib.request.Request(url, data=data, headers={'Content-Type':'application/json'})
print('Posting...')
resp=urllib.request.urlopen(req)
print('Status', resp.getcode())
print(resp.read().decode())
