import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
PORT = int(os.getenv('EMAIL_PORT', '587'))
USER = os.getenv('EMAIL_USER')
PASSWORD = os.getenv('EMAIL_PASSWORD')
USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('1', 'true', 'yes')

print('SMTP test using: host=', HOST, 'port=', PORT, 'user=', USER)

try:
    if USE_TLS:
        server = smtplib.SMTP(HOST, PORT, timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
    else:
        server = smtplib.SMTP_SSL(HOST, PORT, timeout=10)

    server.login(USER, PASSWORD)
    msg = EmailMessage()
    msg['From'] = USER
    msg['To'] = USER
    msg['Subject'] = 'SAVR SMTP test'
    msg.set_content('This is a test message from smtp_test.py')
    server.send_message(msg)
    server.quit()
    print('SMTP send: success')
except Exception as e:
    print('SMTP send: failed', e)
    import traceback
    traceback.print_exc()
