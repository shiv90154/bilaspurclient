// Self-registration (email OTP), demo access, approval, forgot password, staff blocked in the app.
// Needs the API on :3000 WITHOUT SMTP (codes are printed to the backend log) and the demo seed.
// Usage: BACKEND_LOG=path/to/backend.log node scripts/smoke-register.mjs
import { readFileSync } from 'node:fs';

const B = 'http://localhost:3000';
const LOG = process.env.BACKEND_LOG;
if (!LOG) throw new Error('Set BACKEND_LOG to the file the backend writes its log to');

const call = async (tok, m, u, b) => {
  const r = await fetch(B + '/api' + u, {
    method: m,
    headers: { ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(b ? { 'content-type': 'application/json' } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const login = (i, p, platform = 'ANDROID') =>
  call(null, 'POST', '/auth/login', { identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Newest code mailed to `email`, read from the backend log. */
const codeFor = async (email) => {
  await sleep(500);
  const log = readFileSync(LOG, 'utf8');
  const at = log.lastIndexOf(`to=${email} `);
  const m = at >= 0 ? /Code: (\d{6})/.exec(log.slice(at)) : null;
  return m?.[1];
};
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (c ? '' : ' ' + JSON.stringify(x)?.slice(0, 400))); if (!c) fail++; };

const A = (await login('9999999999', 'ChangeMe@123', 'WEB')).j.accessToken;

// staff cannot use the student app
const staffApp = await login('9999999998', 'Demo@12345', 'ANDROID');
ok('faculty blocked in the Android app', staffApp.s === 403 && staffApp.j.code === 'STAFF_USE_WEB', staffApp);

const courses = await call(null, 'GET', '/account/courses');
ok('public course list', courses.s === 200 && courses.j.length > 0 && !('batches' in courses.j[0]), courses);
const course = courses.j[0];

const stamp = String(Date.now()).slice(-8);
const phone = '7' + stamp + '1';
const email = `reg${stamp}@example.com`;
const form = { name: 'Reg Test', phone, email, password: 'Register123', courseId: course.id };

ok('weak password rejected', (await call(null, 'POST', '/account/register/start', { ...form, password: 'short' })).s === 400);
ok('taken phone rejected', (await call(null, 'POST', '/account/register/start', { ...form, phone: '9999999997' })).s === 409);
const st = await call(null, 'POST', '/account/register/start', { ...form, email: email.toUpperCase() });
ok('sign-up step 1 sends a code', st.s === 200 && st.j.sent && st.j.email.includes('*'), st);
ok('resend too soon refused', (await call(null, 'POST', '/account/register/resend', { email })).s === 429);
const wrong = await call(null, 'POST', '/account/register/verify', { email, code: '000000' });
ok('wrong code refused', wrong.s === 400 && wrong.j.code === 'OTP_INVALID', wrong);
ok('nothing created before the code', (await login(phone, 'Register123')).s === 401);
const code = await codeFor(email);
ok('code found in backend log', /^\d{6}$/.test(code ?? ''), code);
const v = await call(null, 'POST', '/account/register/verify', { email, code });
ok('right code creates the account', v.s === 200 && v.j.registered, v);
ok('code is single use', (await call(null, 'POST', '/account/register/verify', { email, code })).s === 400);

// demo student
const lg = await login(phone, 'Register123');
ok('registered student can log in', lg.s === 200, lg);
const S = lg.j.accessToken;
const me = await call(S, 'GET', '/auth/me');
ok('profile says demo + requested course', me.j.demo === true && me.j.requestedCourse?.id === course.id, me.j);
ok('demo student cannot ask doubts', (await call(S, 'POST', '/doubts', { title: 'x', text: 'y' })).j.code === 'DEMO_ACCOUNT');

// demo content: one material + one test marked free
const mats = (await call(A, 'GET', '/materials?limit=100')).j.items;
const tests = (await call(A, 'GET', '/tests?limit=100')).j.items;
const mat = mats[0];
const test = tests.find((t) => t.status === 'PUBLISHED');
if (mat) {
  const before = (await call(S, 'GET', '/materials')).j.items.length;
  await call(A, 'PATCH', `/materials/${mat.id}`, { isDemo: true });
  const after = (await call(S, 'GET', '/materials')).j.items;
  ok('demo student sees only demo material', before === 0 && after.length === 1 && after[0].id === mat.id, { before, after: after.length });
  await call(A, 'PATCH', `/materials/${mat.id}`, { isDemo: false });
}
if (test) {
  const d = await call(A, 'POST', `/tests/${test.id}/demo`, { isDemo: true });
  ok('admin marks a test as demo', d.s === 201 && d.j.isDemo === true, d);
  const mine = (await call(S, 'GET', '/my/tests')).j;
  ok('demo student sees the demo test only', mine.length === 1 && mine[0].id === test.id, mine.map?.((t) => t.title));
  await call(A, 'POST', `/tests/${test.id}/demo`, { isDemo: false });
  ok('demo test hidden again', (await call(S, 'GET', '/my/tests')).j.length === 0);
}

// admin approves
const regs = await call(A, 'GET', '/students/registrations');
const reg = regs.j.items.find((r) => r.user.phone === phone);
ok('registration listed for admin', reg && reg.requestedCourse.id === course.id && reg.user.emailVerifiedAt, regs.j.items?.length);
ok('student cannot list registrations', (await call(S, 'GET', '/students/registrations')).s === 403);
ok('approve needs a batch', (await call(A, 'POST', `/students/${reg.id}/approve`, { batchIds: [] })).s === 400);
const batches = (await call(A, 'GET', '/batches?limit=100&active=true')).j.items;
const ap = await call(A, 'POST', `/students/${reg.id}/approve`, { batchIds: [batches[0].id] });
ok('admin approves into a batch', ap.s === 201 && ap.j.status === 'ACTIVE', ap);
const me2 = await call(S, 'GET', '/auth/me');
ok('student is no longer demo', me2.j.demo === false && me2.j.requestedCourse === null, me2.j);

// forgot password
const fg = await call(null, 'POST', '/account/password/forgot', { identifier: phone });
ok('forgot answers generically', fg.s === 200 && fg.j.sent, fg);
const fgNone = await call(null, 'POST', '/account/password/forgot', { identifier: '6123450000' });
ok('unknown account gets the same answer', fgNone.s === 200 && fgNone.j.message === fg.j.message, fgNone);
const rcode = await codeFor(email);
ok('reset code found', /^\d{6}$/.test(rcode ?? ''), rcode);
ok('reset with wrong code fails', (await call(null, 'POST', '/account/password/reset', { identifier: phone, code: rcode === '111111' ? '222222' : '111111', newPassword: 'NewReset123' })).s === 400);
const rs = await call(null, 'POST', '/account/password/reset', { identifier: email, code: rcode, newPassword: 'NewReset123' });
ok('reset with code (by email) works', rs.s === 200 && rs.j.reset, rs);
ok('reset logs out every device', (await call(S, 'GET', '/auth/me')).s === 401);
ok('old password gone', (await login(phone, 'Register123')).s === 401);
ok('new password works', (await login(phone, 'NewReset123')).s === 200);

// reject flow: another sign-up
const phone2 = '8' + stamp + '2';
const email2 = `rej${stamp}@example.com`;
await call(null, 'POST', '/account/register/start', { ...form, phone: phone2, email: email2 });
await call(null, 'POST', '/account/register/verify', { email: email2, code: await codeFor(email2) });
const reg2 = (await call(A, 'GET', '/students/registrations')).j.items.find((r) => r.user.phone === phone2);
const rj = await call(A, 'POST', `/students/${reg2.id}/reject`, { note: 'Batch full' });
ok('admin rejects a registration', rj.s === 201 && rj.j.status === 'DROPPED', rj);
const blocked = await login(phone2, 'Register123');
ok('rejected student cannot log in', blocked.s === 403 && blocked.j.code === 'STUDENT_NOT_ACTIVE', blocked);

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
