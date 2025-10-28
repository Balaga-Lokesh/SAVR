Production deployment checklist — Razorpay + cross-origin cookies
===============================================================

This document lists the minimal environment and configuration changes you should apply on your production backend so the Vercel-hosted frontend (or any other external origin) can complete Razorpay payments when the app uses cookie-based auth.

Why this is needed
-------------------
- The frontend initiates a Razorpay order on the backend, then opens the Razorpay checkout UI in the browser. After the user completes payment, the frontend must call the backend verify endpoint to finalize the payment and create orders.
- The app currently uses an httpOnly auth token (cookie) for authentication. Browsers only send cookies for cross-site requests when the backend sets them with SameSite=None and Secure and the frontend origin is allowed in CORS and CSRF settings.

Minimum environment variables to set on the production backend
------------------------------------------------------------
Set these vars in your hosting provider (Heroku, Render, DigitalOcean App Platform, etc.). Replace the example values with your real ones.

- FRONTEND_ORIGIN=https://savr-frontend-weld.vercel.app
- SESSION_COOKIE_SAMESITE=None
- CSRF_COOKIE_SAMESITE=None

Also ensure these production secrets are set (already required by the project):

- RAZORPAY_KEY_ID (your Razorpay key id)
- RAZORPAY_KEY_SECRET (your Razorpay secret)
- RAZORPAY_WEBHOOK_SECRET (optional, if using webhooks)

Why each is needed
-------------------
- FRONTEND_ORIGIN: the Django settings in this repo will append this origin to CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS so the browser is allowed to call the API from that origin.
- SESSION_COOKIE_SAMESITE / CSRF_COOKIE_SAMESITE: for cross-site requests the cookies must be set with SameSite=None. The settings file in this repo will apply these values when FRONTEND_ORIGIN is present. Cookies must also be Secure (served only over HTTPS) in production — the settings already set SESSION_COOKIE_SECURE=True when not in DEBUG.

Other important production checks
---------------------------------
- Ensure CORS_ALLOW_CREDENTIALS is True (the repository defaults this for dev and the settings file forces it when FRONTEND_ORIGIN is set).
- Ensure your backend is served over HTTPS and SESSION_COOKIE_SECURE=True (production default in settings.py when DEBUG=False).
- If you rely on webhooks instead of client-side verify, make sure RAZORPAY_WEBHOOK_SECRET is set and the webhook URL on Razorpay points to /api/v1/payments/razorpay/webhook/ on your deployed backend.

How to verify after deployment
------------------------------
1. Deploy backend with the environment variables above set.
2. Deploy the frontend to Vercel (or ensure the current Vercel deployment is built from the latest frontend commit).
3. In a private/incognito browser session do the following:
   - Open the frontend and complete the login/OTP flow so the backend sets the httpOnly auth cookie.
   - Visit the Cookie Debug page at /cookie-debug (this app includes a CookieDebug page). The page performs a request to /api/v1/debug/cookies/ with credentials included and will show whether the httpOnly auth cookie is being sent by the browser.
   - Alternatively, from the backend server run check_razorpay_settings.py to confirm the FRONTEND_ORIGIN is present in the runtime settings:

       python check_razorpay_settings.py

     The output should list your frontend origin in CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS and show CORS_ALLOW_CREDENTIALS=true.

4. Try a real checkout from the Vercel-hosted frontend and watch the backend logs for the verify endpoint being called and for the Payment row being updated (provider_payment_id filled and status changed to success/captured). If verify still fails, capture the browser Network tab for the verify POST and the backend logs for any authentication / CSRF errors.

Troubleshooting
---------------
- If the browser refuses to send cookies cross-site, check these in order:
  1) Are cookies set with SameSite=None and Secure? (backend must be HTTPS and SESSION_COOKIE_SECURE=True)
  2) Is the frontend origin present in CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS? (settings will add FRONTEND_ORIGIN automatically if set)
  3) Is the frontend request using fetch(..., credentials: 'include')? (the frontend already does this)

- If you cannot set these env vars in production, consider switching the app to token-header auth for the specific verify endpoint (Authorization: Token <token>). That requires a small change to the authentication flow so the frontend can obtain a token accessible to JavaScript (or return a non-httpOnly token), which is more invasive and less secure unless done carefully.

Next steps I can help with
--------------------------
- I can prepare a small PR to add an admin-check endpoint or more debugging pages (already included: CookieDebug) to help verify cookie behavior.
- I can also modify the frontend to optionally send Authorization headers if you prefer token-based cross-origin calls — but this requires exposing a token to the client (changes to login/verify flow) and is more intrusive.

If you'd like, tell me where your backend is hosted (Heroku/Render/DigitalOcean/other) and I can give the exact provider-specific steps to set these environment variables.
