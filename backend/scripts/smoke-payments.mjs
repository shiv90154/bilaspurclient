// Fee plans, Razorpay order/verify/webhook (against a fake Razorpay on :3999), offline entries,
// receipts and access unlock. Needs the API on :3000 with the demo seed, started with:
//   RAZORPAY_KEY_ID=rzp_test_smoke RAZORPAY_KEY_SECRET=smokesecret RAZORPAY_WEBHOOK_SECRET=whsecret
//   RAZORPAY_API_URL=http://localhost:3999
// Usage: node scripts/smoke-payments.mjs
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const B = 'http://localhost:3000';
const KEY_SECRET = 'smokesecret';
const WEBHOOK_SECRET = 'whsecret';

// ── fake Razorpay: POST /orders ──
const orders = new Map();
const fake = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const auth = Buffer.from((req.headers.authorization ?? '').replace('Basic ', ''), 'base64').toString();
    if (req.method !== 'POST' || req.url !== '/orders' || auth !== `rzp_test_smoke:${KEY_SECRET}`) {
      res.writeHead(401).end('{"error":"bad auth"}');
      return;
    }
    const { amount, currency } = JSON.parse(body);
    const order = { id: 'order_' + randomBytes(7).toString('hex'), amount, currency, status: 'created' };
    orders.set(order.id, order);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(order));
  });
});
await new Promise((r) => fake.listen(3999, r));

const call = async (tok, m, u, b, headers = {}) => {
  const raw = typeof b === 'string';
  const r = await fetch(B + '/api' + u, {
    method: m,
    headers: { ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(b ? { 'content-type': 'application/json' } : {}), ...headers },
    body: b ? (raw ? b : JSON.stringify(b)) : undefined,
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const login = async (i, p, platform = 'ANDROID') =>
  (await call(null, 'POST', '/auth/login', { identifier: i, password: p, deviceId: 'pay-' + i, deviceName: 't', platform })).j.accessToken;
const sign = (orderId, payId) => createHmac('sha256', KEY_SECRET).update(`${orderId}|${payId}`).digest('hex');
const payId = () => 'pay_' + randomBytes(7).toString('hex');
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (c ? '' : ' ' + JSON.stringify(x)?.slice(0, 400))); if (!c) fail++; };

const A = await login('9999999999', 'ChangeMe@123', 'WEB');
const batches = (await call(A, 'GET', '/batches?limit=100&active=true')).j.items;
ok('have an active batch', batches.length > 0, batches);
const batch = batches[0];

// ── plans ──
const stamp = String(Date.now()).slice(-7);
const mkPlan = async (total) => (await call(A, 'POST', '/fee-plans', { name: `Smoke ${stamp} ₹${total}`, batchId: batch.id, total })).j;
const plan = await mkPlan(4999);
ok('admin creates a fee plan', plan.id && plan.total === '4999' && plan.course?.id === batch.courseId, plan);
ok('price must be positive', (await call(A, 'POST', '/fee-plans', { name: 'x', batchId: batch.id, total: 0 })).s === 400);
const pub = await call(null, 'GET', '/fee-plans/public');
ok('public plan list shows it, online on', pub.s === 200 && pub.j.onlinePayments === true && pub.j.plans.some((p) => p.id === plan.id), pub.j);

// ── a pending (demo) student ──
const phone = '6' + stamp + '42';
const created = await call(A, 'POST', '/students', { name: 'Pay Smoke', phone, password: 'PaySmoke123', status: 'PENDING' });
ok('admin creates a pending student', created.s === 201, created);
const studentId = created.j.id;
const S = await login(phone, 'PaySmoke123');
ok('student is demo before paying', (await call(S, 'GET', '/auth/me')).j.demo === true);
ok('student cannot see admin payments', (await call(S, 'GET', '/payments')).s === 403);
ok('student cannot create plans', (await call(S, 'POST', '/fee-plans', { name: 'x', batchId: batch.id, total: 1 })).s === 403);
ok('admin cannot open a checkout', (await call(A, 'POST', '/payments/razorpay/order', { planId: plan.id })).s === 403);

const mine = (await call(S, 'GET', '/fee-plans/mine')).j;
const mp = mine.plans.find((p) => p.id === plan.id);
ok('student sees price and full amount due', mp && mp.due === '4999.00' && mp.enrolled === false, mp);

// ── online: order + verify ──
const order = await call(S, 'POST', '/payments/razorpay/order', { planId: plan.id });
ok('order created for the server-side amount', order.s === 200 && order.j.amount === 499900 && order.j.keyId === 'rzp_test_smoke' && orders.has(order.j.orderId), order.j);
const pid = payId();
const bad = await call(S, 'POST', '/payments/razorpay/verify', { razorpay_order_id: order.j.orderId, razorpay_payment_id: pid, razorpay_signature: 'a'.repeat(64) });
ok('forged signature refused', bad.s === 400 && bad.j.code === 'PAYMENT_SIGNATURE_INVALID', bad);
ok('still demo after a forged signature', (await call(S, 'GET', '/auth/me')).j.demo === true);

const good = await call(S, 'POST', '/payments/razorpay/verify', { razorpay_order_id: order.j.orderId, razorpay_payment_id: pid, razorpay_signature: sign(order.j.orderId, pid) });
ok('valid payment settles with a receipt', good.s === 200 && good.j.status === 'PAID' && /^DHI-\d{8}-[0-9A-F]{8}$/.test(good.j.receiptNo) && good.j.institute, good.j);
const me = (await call(S, 'GET', '/auth/me')).j;
ok('student now active (not demo)', me.demo === false, me);
const st = (await call(A, 'GET', `/students/${studentId}`)).j;
ok('student joined the plan batch', st.status === 'ACTIVE' && st.batches.some((b) => b.batch.id === batch.id), st);
const again = await call(S, 'POST', '/payments/razorpay/verify', { razorpay_order_id: order.j.orderId, razorpay_payment_id: pid, razorpay_signature: sign(order.j.orderId, pid) });
ok('verify is idempotent', again.s === 200 && again.j.receiptNo === good.j.receiptNo, again.j);
ok('paying twice refused', (await call(S, 'POST', '/payments/razorpay/order', { planId: plan.id })).j.code === 'ALREADY_PAID');
const mine2 = (await call(S, 'GET', '/fee-plans/mine')).j.plans.find((p) => p.id === plan.id);
ok('plan shows joined, nothing due', mine2.enrolled === true && mine2.due === '0.00', mine2);
const myPays = (await call(S, 'GET', '/payments/mine')).j;
ok('student sees own payment', myPays.length === 1 && myPays[0].id === good.j.id, myPays);
ok('student reads own receipt', (await call(S, 'GET', `/payments/${good.j.id}`)).s === 200);

// ── webhook (student closed the tab before verify) ──
const plan2 = await mkPlan(1500);
const order2 = (await call(S, 'POST', '/payments/razorpay/order', { planId: plan2.id })).j;
const hook = (event, entity, secret = WEBHOOK_SECRET, id = 'evt_' + randomBytes(6).toString('hex')) => {
  const body = JSON.stringify({ event, payload: { payment: { entity } } });
  return call(null, 'POST', '/payments/razorpay/webhook', body, {
    'x-razorpay-signature': createHmac('sha256', secret).update(body).digest('hex'),
    'x-razorpay-event-id': id,
  });
};
const p2 = payId();
ok('webhook with wrong secret refused', (await hook('payment.captured', { id: p2, order_id: order2.orderId, amount: 150000, status: 'captured' }, 'nope')).s === 400);
const lowAmt = await hook('payment.captured', { id: p2, order_id: order2.orderId, amount: 100, status: 'captured' });
ok('webhook with wrong amount not settled', lowAmt.s === 200 && (await call(S, 'GET', '/fee-plans/mine')).j.plans.find((p) => p.id === plan2.id).due === '1500.00', lowAmt);
const evt = 'evt_' + randomBytes(6).toString('hex');
const wh = await hook('payment.captured', { id: p2, order_id: order2.orderId, amount: 150000, status: 'captured' }, WEBHOOK_SECRET, evt);
ok('webhook settles the payment', wh.s === 200 && (await call(S, 'GET', '/fee-plans/mine')).j.plans.find((p) => p.id === plan2.id).due === '0.00', wh);
const dup = await hook('payment.captured', { id: p2, order_id: order2.orderId, amount: 150000, status: 'captured' }, WEBHOOK_SECRET, evt);
ok('duplicate webhook ignored', dup.s === 200 && dup.j.duplicate === true, dup);
const late = await call(S, 'POST', '/payments/razorpay/verify', { razorpay_order_id: order2.orderId, razorpay_payment_id: p2, razorpay_signature: sign(order2.orderId, p2) });
ok('late verify after webhook is fine', late.s === 200 && late.j.status === 'PAID', late.j);

// ── offline: part payment without access, then the rest ──
const plan3 = await mkPlan(3000);
const phone2 = '6' + stamp + '43';
const s2 = (await call(A, 'POST', '/students', { name: 'Cash Smoke', phone: phone2, password: 'PaySmoke123', status: 'PENDING' })).j;
const part = await call(A, 'POST', '/payments/offline', { studentId: s2.id, planId: plan3.id, amount: 1000, mode: 'CASH', notes: 'smoke', grantAccess: false });
ok('part payment recorded', part.s === 201 && part.j.status === 'PAID' && part.j.studentFee.status === 'PARTIAL' && part.j.approvedBy, part.j);
ok('part payment keeps student pending', (await call(A, 'GET', `/students/${s2.id}`)).j.status === 'PENDING');
ok('overpayment refused', (await call(A, 'POST', '/payments/offline', { studentId: s2.id, planId: plan3.id, amount: 2500, mode: 'UPI' })).s === 400);
const rest = await call(A, 'POST', '/payments/offline', { studentId: s2.id, planId: plan3.id, amount: 2000, mode: 'UPI', notes: 'UPI ref 123' });
ok('balance paid: fee PAID', rest.s === 201 && rest.j.studentFee.status === 'PAID', rest.j);
const s2d = (await call(A, 'GET', `/students/${s2.id}`)).j;
ok('balance paid: student active in batch', s2d.status === 'ACTIVE' && s2d.batches.some((b) => b.batch.id === batch.id), s2d);
ok('other student cannot read this receipt', (await call(S, 'GET', `/payments/${rest.j.id}`)).s === 404);

const list = (await call(A, 'GET', `/payments?status=PAID&search=${phone2}`)).j;
ok('admin list + collected total', list.total === 2 && Number(list.paidTotal) === 3000, list);
const hidden = await call(A, 'PATCH', `/fee-plans/${plan3.id}`, { active: false });
ok('hiding a plan removes it from the website', hidden.s === 200 && !(await call(null, 'GET', '/fee-plans/public')).j.plans.some((p) => p.id === plan3.id));

// tidy: hide the smoke plans so the website stays clean
for (const p of [plan, plan2]) await call(A, 'PATCH', `/fee-plans/${p.id}`, { active: false });
fake.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
