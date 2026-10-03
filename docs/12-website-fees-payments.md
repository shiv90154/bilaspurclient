# 12. Fees & Payments (Website only)

**Phase:** Web (parallel / baad mein) · **Depends on:** [01-student-management](01-student-management.md), [06-role-based-access](06-role-based-access.md)

## Decision (client se confirm hua)
- Fees / payment **Android app scope mein nahi**.
- Sab website (Next.js) par hoga.
- **Admin approval** rahega (manual/offline payment ya approval flow).
- **Razorpay** website par.

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

## Progress
- [x] Fee plan + ledger tables
- [ ] Fee plan CRUD
- [ ] Razorpay order + verify
- [ ] Razorpay webhook (idempotent)
- [ ] Offline payment entry
- [ ] Admin approval queue
- [ ] Receipt PDF
- [ ] Status sync with student access
- [ ] Student web: my fees + pay
- [ ] Admin web: fee reports
- [ ] Refund flow
- [ ] Tests

## Notes
- Razorpay secret kabhi client mein nahi. Amount server se tay ho.
- Payment data (card) khud store nahi karna — Razorpay handle karta hai.
- GST/invoice requirements client ke CA se confirm karo.
