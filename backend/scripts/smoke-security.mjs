// Two-step login (email code) for staff, plus the admin's server health and test push.
// Needs the API on :3000 with the demo seed and WITHOUT SMTP_HOST (codes go to the log):
//   SMTP_HOST= node dist/main > backend.log
// Usage: BACKEND_LOG=backend.log node scripts/smoke-security.mjs
import { readFileSync } from 'node:fs';

const B = 'http://localhost:3000/api';
const LOG = process.env.BACKEND_LOG;
if (!LOG) throw new Error('Set BACKEND_LOG to the file the backend writes its log to');

const call = async (tok, m, u, b) => {
  const r = await fetch(B + u, {
    method: m,
    headers: { ...(tok && { authorization: 'Bearer ' + tok }), ...(b && { 'content-type': 'application/json' }) },
    body: b ? JSON.stringify(b) : undefined,
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const login = (i, p, otp) =>
  call(null, 'POST', '/auth/login', { identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform: 'WEB', ...(otp && { otp }) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Newest code mailed to `email`, read from the backend log. */
const codeFor = async (email) => {
  await sleep(500);
  const log = readFileSync(LOG, 'utf8');
  const at = log.lastIndexOf(`to=${email} `);
  const m = at >= 0 ? /Code: (\d{6})|\b(\d{6})\b/.exec(log.slice(at)) : null;
  return m?.[1] ?? m?.[2];
};
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x)?.slice(0, 400))); if (!c) fail++; };

const A = (await login('9999999999', 'ChangeMe@123')).j.accessToken;
const S = (await login('9999999997', 'Demo@12345')).j.accessToken;
const FAC = ['9999999999', 'ChangeMe@123']; // the admin has an email in the demo seed
const F = (await login('9999999998', 'Demo@12345')).j.accessToken;
const AF = A; // 2FA is exercised on the admin

// ── server health ──
const st = await call(A, 'GET', '/system/status');
ok('admin sees disk, push and email status', st.s === 200 && typeof st.j.disk?.usedPct === 'number' && ['ok', 'warn', 'critical'].includes(st.j.disk.level) && typeof st.j.push.enabled === 'boolean', st.j);
ok('teacher cannot see server status', (await call(F, 'GET', '/system/status')).s === 403);
ok('student cannot see server status', (await call(S, 'GET', '/system/status')).s === 403);
const tp = await call(A, 'POST', '/system/test-push', { identifier: '9999999997' });
ok('test push reports per user', tp.s === 200 && tp.j.user?.name && typeof tp.j.devices === 'number', tp.j);
ok('test push to unknown user → 404', (await call(A, 'POST', '/system/test-push', { identifier: '1234500000' })).s === 404);
ok('student cannot send test pushes', (await call(S, 'POST', '/system/test-push', {})).s === 403);

// ── two-step login ──
const me = (await call(AF, 'GET', '/auth/me')).j;
ok('admin has an email, 2FA off', me.email && me.twoFactorEnabled === false, me);
ok('student cannot turn 2FA on', (await call(S, 'POST', '/auth/two-factor/start', { password: 'Demo@12345' })).s === 403);
const wrongPw = await call(AF, 'POST', '/auth/two-factor/start', { password: 'nope-nope' });
ok('wrong password → 400 (not 401)', wrongPw.s === 400 && wrongPw.j.code === 'WRONG_PASSWORD', wrongPw);
const started = await call(AF, 'POST', '/auth/two-factor/start', { password: FAC[1] });
ok('start emails a code (masked address)', started.s === 200 && /\*/.test(started.j.email), started);
ok('wrong code does not turn it on', (await call(AF, 'POST', '/auth/two-factor/enable', { code: '000000' })).s === 400);
const enableCode = await codeFor(me.email);
const enabled = await call(AF, 'POST', '/auth/two-factor/enable', { code: enableCode });
ok('right code turns it on', enabled.s === 200 && enabled.j.twoFactorEnabled === true, { enableCode, enabled });

const step1 = await login(...FAC);
ok('password alone → 401 OTP_REQUIRED with masked email', step1.s === 401 && step1.j.code === 'OTP_REQUIRED' && /\*/.test(step1.j.email), step1);
ok('no tokens without the code', !step1.j.accessToken);
const badOtp = await login(...FAC, '000000');
ok('wrong code → 400 OTP_INVALID', badOtp.s === 400 && badOtp.j.code === 'OTP_INVALID', badOtp);
const wrongPwWithOtp = await login(FAC[0], 'wrong-password', '000000');
ok('wrong password still → 401 INVALID_CREDENTIALS', wrongPwWithOtp.s === 401 && wrongPwWithOtp.j.code === 'INVALID_CREDENTIALS', wrongPwWithOtp);
const loginCode = await codeFor(me.email);
const step2 = await login(...FAC, loginCode);
ok('password + code → logged in', step2.s === 200 && step2.j.accessToken && step2.j.user.twoFactorEnabled === true, step2);
ok('the code works only once', (await login(...FAC, loginCode)).s === 400);

const F2 = step2.j.accessToken;
ok('wrong password cannot turn it off', (await call(F2, 'POST', '/auth/two-factor/disable', { password: 'nope-nope' })).s === 400);
const off = await call(F2, 'POST', '/auth/two-factor/disable', { password: FAC[1] });
ok('turned off with the password', off.s === 200 && off.j.twoFactorEnabled === false, off);
ok('plain login works again', (await login(...FAC)).s === 200);
ok('students never get asked for a code', (await login('9999999997', 'Demo@12345')).s === 200);

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
