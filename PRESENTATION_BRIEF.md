# SAVR — Presentation Brief

Purpose
-------
This document is a concise presentation brief designed to help create a short (10-15 minute) PPT introducing the SAVR project to teammates. It covers the project overview, architecture, main components, payment flow, local run & testing steps, common troubleshooting points, and a suggested slide structure with speaker notes.

Keep each slide short (one idea per slide). Use screenshots (app UI, admin dashboard, logs) where helpful.

Project at-a-glance
-------------------
- Name: SAVR
- Type: Grocery price-optimizer + shopping/order management web app
- Tech stack:
  - Backend: Django + Django REST Framework
  - Frontend: React + TypeScript (Vite)
  - Payments: Razorpay (orders + verify + optional webhooks)
  - DB: MySQL (production) / Django ORM
  - Dev tools: Vite, ngrok (for webhook/local HTTPS testing)

High-level architecture (one-slide)
----------------------------------
- Browser (React SPA) —> Backend API (Django REST) —> Database
- Payment flow interaction: Browser opens Razorpay checkout UI (client), Razorpay calls return handler; frontend posts verify to backend; backend validates signature or webhook then finalizes Payment and creates Orders.
- Optional: Razorpay webhooks notify backend of payment.captured/payment.failed for resilience.

Main frontend components (one slide)
-----------------------------------
- `CheckoutFlow` / `OptimizedCart` — handles cart, create-order, loads Razorpay SDK, opens checkout, and posts verify.
- `AuthContext` — handles login/OTP flow and cookie-based authentication.
- `CookieDebug` — dev-only page to verify auth cookie behavior.
- Other user-facing pages: Index, ShoppingFlow, VerifyOTP, Profile, Addresses.

Main backend components (one slide)
----------------------------------
- `api.views` — endpoints for products, orders, payments (create-order, verify, webhook), auth endpoints (request/verify OTP).
- `api.models` — models for Payment, Order, User/Partner tokens, etc.
- `api.authentication.CustomTokenAuthentication` — supports Authorization: Token <token> and cookie fallback `auth_token`.
- `backend_project.settings` — config for CORS, CSRF, cookie SameSite/secure handling and env-driven `FRONTEND_ORIGIN`.

Payment flow (2 slides: happy path + failure handling)
--------------------------------------------------
Happy path (single slide)
- 1) Frontend calls POST /payments/razorpay/create-order/ → backend creates local Payment and Razorpay Order via Razorpay API.
- 2) Backend returns `key_id`, `razorpay_order_id`, `payment_id` (local id).
- 3) Frontend opens Razorpay checkout with `key_id` & `order_id`.
- 4) User completes payment in Razorpay popup → Razorpay returns `razorpay_payment_id` and `razorpay_signature` to frontend handler.
- 5) Frontend POSTs to /payments/razorpay/verify/ with signature & IDs (auth via cookie or token). Backend validates HMAC and updates Payment(provider_payment_id, status).

Failure handling (single slide)
- If frontend verify fails (CORS/CSRF/cookie issues or network), the Payment remains `pending` locally.
- Razorpay webhooks (payment.captured/payment.failed) provide a server-side authoritative notification — register a webhook and set `RAZORPAY_WEBHOOK_SECRET`.
- Common failure modes: wrong keys (test vs live), origin not whitelisted (Razorpay blocks), cookie SameSite/Secure mismatch, CSRF errors, signature mismatch.

Local dev & test checklist (one slide)
-------------------------------------
1. Use Razorpay test keys in `backend/.env` (start with `rzp_test_...`) for local dev.
2. Start backend: python manage.py runserver 0.0.0.0:8000 (use venv).
3. Start frontend: npm run dev in `frontend/savr-frontend` (Vite will proxy relative /api calls in dev).
4. Optional (recommended): use `ngrok http 8000` to expose HTTPS for Secure cookies and to test webhooks.
5. For webhook testing: add webhook in Razorpay (Developer → Webhooks) using the ngrok HTTPS URL + path `/api/v1/payments/razorpay/webhook/` and the secret; set same secret in `RAZORPAY_WEBHOOK_SECRET` in `.env` and restart backend.
6. Use test card 4111 1111 1111 1111 for card-based flows.

Key environment variables (one slide)
------------------------------------
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — live or test keys
- `RAZORPAY_WEBHOOK_SECRET` — webhook verification secret
- `FRONTEND_ORIGIN` — frontend origin to add to CORS/CSRF; when set the settings file enforces cookie `SameSite=None` and `Secure=True` (affects local testing)
- `DEBUG`, `ALLOWED_HOSTS`, DB_* connection vars

Important files to point out (one slide)
--------------------------------------
- `frontend/savr-frontend/src/components/CheckoutFlow.tsx` and `OptimizedCart.tsx` — checkout code and verify POST
- `backend/api/views.py` — create-order, verify, webhook handlers
- `backend/api/models.py` — Payment, Order models
- `backend/backend_project/settings.py` — CORS/CSRF/cookie config and `FRONTEND_ORIGIN` behavior
- `backend/check_razorpay_settings.py` and `backend/check_payment.py` — dev helpers

Troubleshooting quick reference (one slide)
-----------------------------------------
- If payments create but not finalize:
  - Check the frontend verify POST in DevTools Network tab.
  - Check backend logs for verify errors (auth/CSRF/signature).
  - Ensure the correct Razorpay key type is used (test vs live).
  - If using live keys on localhost, Razorpay may block the origin — use test keys for dev or test via HTTPS with ngrok.
- If cookies not sent cross-site: ensure `credentials: 'include'` on fetch, `CORS_ALLOW_CREDENTIALS = True`, origin in `CORS_ALLOWED_ORIGINS`, and cookies set with `SameSite=None` + `Secure` (HTTPS required).

Suggested slide deck outline and speaker notes (5–10 slides)
---------------------------------------------------------
Slide 1 — Title
- Project name, presenters, date

Slide 2 — One-line summary
- What the app does (grocery price optimizer + ordering + payments)

Slide 3 — Architecture diagram
- Show Browser → Backend → DB and Razorpay interactions

Slide 4 — Frontend & UX highlights
- Checkout, Optimize flow, login/OTP
- Mention important components (`CheckoutFlow`, `OptimizedCart`)

Slide 5 — Backend & data model
- API, Payment model, authentication approach

Slide 6 — Payment flow (happy path)
- Step-by-step flow with small diagram

Slide 7 — Testing & deployment notes
- Test keys, webhooks, ngrok, Vercel + backend envs to set

Slide 8 — Troubleshooting & lessons learned
- Common pitfalls and how to resolve quickly

Slide 9 — Demo checklist
- Items to demo (login, create order, popup, verify, backend DB updated)

Slide 10 — Next steps & Q/A
- Improvements, webhook reliability, production hardening, open issues

Speaker tips
------------
- Keep each slide to one main idea.
- For demo: rehearse the flow once with test keys and ngrok so you don't hit CORS/cookie mismatches.
- If showing a live payment, prefer test mode or be explicit when using live keys.

Appendix (useful copy-paste snippets)
-----------------------------------
- Quick check for runtime settings:
  - `python check_razorpay_settings.py`
- Query a payment by id (dev helper):
  - `python check_payment.py <payment_id>`

Files added for presentation support
----------------------------------
- `backend/PRESENTATION_BRIEF.md` — this file (use it as the basis for slides and speaker notes).

Contact & follow-up
--------------------
If you want, I can: generate a slide deck template (PowerPoint or Google Slides), create a one-page handout, or add the demo checklist as a small script to automate a local test run.

---
Generated on: 2025-10-28
