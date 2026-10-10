# 12. Fees & Payments (Website only)

**Phase:** Web (parallel / baad mein) · **Depends on:** [01-student-management](01-student-management.md), [06-role-based-access](06-role-based-access.md)

## Decision (client se confirm hua)
- Fees / payment **Android app scope mein nahi**.
- Sab website (Next.js) par hoga.
- **Admin approval** offline ke liye; online payment hote hi access khul jaata hai (2026-10-08 decision).
- **Razorpay** website par.
- **2026-10-10:** client ko Razorpay mehenga laga. Website ka **Buy now** ab WhatsApp kholta hai (course naam + fee + link pehle se likha), login ki zaroorat nahi. Admin payment milne par **Record payment** (offline) karta hai → batch khulta hai. Student panel Fees pe bhi Razorpay keys na hon to "Buy on WhatsApp" dikhta hai. Razorpay code hata nahi, keys daalne par student Fees pe wapas chalu.

## Scope
- Fee structure: course/batch ke hisaab se total fee, installments, due dates, discount.
- Student fee ledger: kitna bhara, kitna baaki.
- **Online payment:** Razorpay checkout (UPI/card/netbanking), webhook se confirm.
- **Offline payment entry:** admin cash/cheque/UPI-direct payment record kare (+ receipt).
- **Admin approval:** pending payment/enrollment approve ya reject; approve hone par student `active` aur batch access milta hai.
- Receipt / invoice PDF, payment history.
- Reports: collection, pending dues, mode-wise.

## Flow
```
Enquiry → Student fee plan assign → (Razorpay payment  ya  offline entry)
        → Admin approval → student status = active → app access chalu
```
Dues/expiry: fee na bhare to admin student ko `inactive` kar sakta hai → app login/content band.

## Database tables
- `fee_plans` (id, course_id, batch_id, total, installments_json)
- `student_fees` (id, student_id, plan_id, total, discount, status)
- `payments` (id, student_fee_id, amount, mode `razorpay|cash|upi|cheque`, razorpay_order_id, razorpay_payment_id, status `pending|paid|failed|refunded`, approved_by, approved_at, receipt_no, created_at)
- `payment_events` (raw webhook log)

## API endpoints
- `CRUD /fee-plans`, `POST /students/:id/fees`
- `POST /payments/razorpay/order`, `POST /payments/razorpay/verify`, `POST /payments/razorpay/webhook`
- `POST /payments/offline`, `PATCH /payments/:id/approve`, `PATCH /payments/:id/reject`
- `GET /students/:id/fees`, `GET /payments/:id/receipt`
- `GET /reports/fees`

## Screens (sirf web)
- **Admin web:** fee plans, student ledger, record payment, approvals queue, reports.
- **Student web:** my fees, pay now (Razorpay), receipts.
- **Android:** ❌ koi payment/price/pay-link nahi (Play policy: [13-play-store-compliance](13-play-store-compliance.md)). Sirf "account active/inactive" ka effect.

## Kaise banana hai (steps)
1. Razorpay account + test keys.
2. Tables + fee plan/ledger logic (installments).
3. Razorpay order create → checkout (web) → **server-side signature verify** + webhook (idempotent).
4. Offline entry + approval queue + receipt PDF.
5. Status hook: payment approved → student `active`; dues overdue → `inactive` (admin choice).
6. Reports.
7. Tests: duplicate webhook, failed payment, partial payment, refund.

## Kya bana (2026-10-08)
- **Course fee (fee plan):** admin ek batch ke liye price rakhta hai (Fees & Payments → Course fee). "On website" wale plan home page ke **Courses** section mein dikhte hain.
- **Online:** student web pe login → **Fees** → Pay → Razorpay checkout → `verify` (signature check) → payment PAID, receipt no., student batch mein + `ACTIVE` (admin approval ki zaroorat nahi). Webhook (`payment.captured` / `order.paid`) backup hai agar student tab band kar de. Dono idempotent.
- **Offline:** admin "Record payment" (cash/UPI/cheque/bank). Part payment pe "batch abhi kholo" ka option; poora bharne pe batch apne-aap khulta hai.
- **Receipt:** `/receipt/<id>` printable page (admin sab, student sirf apni). Email bhi jaata hai (SMTP on ho to).
- **Keys:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in `production.env`. Khaali = online band, offline chalta hai.
- **Webhook URL:** `https://api.dhiayurved.com/api/payments/razorpay/webhook`, events `payment.captured` + `order.paid`.
- **Test:** `npm run smoke:payments` (nakli Razorpay :3999 ke saath; API kin env ke saath chalani hai wo script ke header mein likha hai).

## Progress
- [x] Fee plan + ledger tables
- [x] Fee plan CRUD (create, price change, show/hide)
- [x] Razorpay order + verify
- [x] Razorpay webhook (idempotent)
- [x] Offline payment entry (part payment ke saath)
- [x] Receipt (printable page, PDF = browser print)
- [x] Status sync with student access (paid → batch + ACTIVE)
- [x] Student web: my fees + pay
- [x] Website: Courses section with price + Join now
- [x] Tests (smoke-payments: forged signature, idempotent verify, double pay, webhook amount/duplicate, part payment, access)
- [ ] Installments / due dates
- [ ] Admin web: fee reports (abhi list + collected total hai)
- [ ] Refund flow (abhi Razorpay dashboard se; hamare yahan status nahi badalta)

## Notes
- Razorpay secret kabhi client mein nahi. Amount server se tay ho.
- Payment data (card) khud store nahi karna — Razorpay handle karta hai.
- GST/invoice requirements client ke CA se confirm karo.
