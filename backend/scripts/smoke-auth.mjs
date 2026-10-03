const BASE = 'http://localhost:3000/api';
let pass = 0, fail = 0;

async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
}

const student = { identifier: '9999999997', password: 'Demo@12345' };
const admin = { identifier: '9999999999', password: 'ChangeMe@123' };

console.log('1. validation + one-device rule');
let r = await call('POST', '/auth/login', { body: student });
check('student login without deviceId -> 400 DEVICE_ID_REQUIRED', r.status === 400 && r.json.code === 'DEVICE_ID_REQUIRED', JSON.stringify(r));

const a = await call('POST', '/auth/login', { body: { ...student, deviceId: 'dev-A', deviceName: 'Phone A', platform: 'ANDROID' } });
check('login on device A -> 200', a.status === 200 && a.json.accessToken, JSON.stringify(a));
check('profile has watermark', a.json?.user?.watermark?.phone === '9999999997');

r = await call('GET', '/auth/me', { token: a.json.accessToken });
check('/auth/me with A token -> 200', r.status === 200 && r.json.role === 'STUDENT', JSON.stringify(r));

const b = await call('POST', '/auth/login', { body: { ...student, deviceId: 'dev-B', deviceName: 'Phone B', platform: 'ANDROID' } });
check('login on device B -> 200', b.status === 200, JSON.stringify(b));

r = await call('GET', '/auth/me', { token: a.json.accessToken });
check('device A now -> 401 SESSION_REPLACED', r.status === 401 && r.json.code === 'SESSION_REPLACED', JSON.stringify(r));

r = await call('POST', '/auth/refresh', { body: { refreshToken: a.json.refreshToken } });
check('device A refresh -> 401 SESSION_REPLACED', r.status === 401 && r.json.code === 'SESSION_REPLACED', JSON.stringify(r));

console.log('2. refresh rotation + reuse detection');
const rf = await call('POST', '/auth/refresh', { body: { refreshToken: b.json.refreshToken } });
check('refresh with B -> 200 new tokens', rf.status === 200 && rf.json.refreshToken !== b.json.refreshToken, JSON.stringify(rf));
r = await call('GET', '/auth/me', { token: rf.json.accessToken });
check('new access token works', r.status === 200);
r = await call('POST', '/auth/refresh', { body: { refreshToken: b.json.refreshToken } });
check('reusing old refresh token -> 401', r.status === 401 && r.json.code === 'INVALID_REFRESH_TOKEN', JSON.stringify(r));
r = await call('GET', '/auth/me', { token: rf.json.accessToken });
check('session revoked after reuse -> 401 SESSION_REVOKED', r.status === 401 && r.json.code === 'SESSION_REVOKED', JSON.stringify(r));

console.log('3. device change limit (3 new devices / 30 days)');
const c = await call('POST', '/auth/login', { body: { ...student, deviceId: 'dev-C', platform: 'ANDROID' } });
check('3rd device allowed -> 200', c.status === 200, JSON.stringify(c));
const d = await call('POST', '/auth/login', { body: { ...student, deviceId: 'dev-D', platform: 'ANDROID' } });
check('4th device -> 403 DEVICE_LIMIT_REACHED', d.status === 403 && d.json.code === 'DEVICE_LIMIT_REACHED', JSON.stringify(d));
r = await call('GET', '/auth/me', { token: c.json.accessToken });
check('device C still logged in after rejected D', r.status === 200, JSON.stringify(r));

console.log('4. roles + admin reset');
r = await call('GET', '/users/x/devices');
check('no token -> 401', r.status === 401, JSON.stringify(r));
const adm = await call('POST', '/auth/login', { body: admin });
check('admin login (no deviceId needed) -> 200', adm.status === 200 && adm.json.user.role === 'ADMIN', JSON.stringify(adm));
const studentUserId = c.json.user.id;
r = await call('GET', `/users/${studentUserId}/devices`, { token: c.json.accessToken });
check('student calling admin route -> 403 FORBIDDEN_ROLE', r.status === 403 && r.json.code === 'FORBIDDEN_ROLE', JSON.stringify(r));
r = await call('GET', `/users/${studentUserId}/devices`, { token: adm.json.accessToken });
check('admin lists devices -> 200', r.status === 200 && r.json.length >= 3, JSON.stringify(r));
r = await call('POST', `/users/${studentUserId}/reset-device`, { token: adm.json.accessToken });
check('admin reset-device -> 200', r.status === 200 && r.json.devicesRemoved >= 3, JSON.stringify(r));
r = await call('GET', '/auth/me', { token: c.json.accessToken });
check('student session ended by admin reset -> 401', r.status === 401 && r.json.code === 'SESSION_REVOKED', JSON.stringify(r));
const e = await call('POST', '/auth/login', { body: { ...student, deviceId: 'dev-D', platform: 'ANDROID' } });
check('after reset, new device logs in -> 200', e.status === 200, JSON.stringify(e));

console.log('5. logout');
r = await call('POST', '/auth/logout', { token: e.json.accessToken });
check('logout -> 204', r.status === 204, JSON.stringify(r));
r = await call('GET', '/auth/me', { token: e.json.accessToken });
check('token after logout -> 401', r.status === 401, JSON.stringify(r));

console.log('(waiting 62s so the login rate limit window resets)');
await new Promise((res) => setTimeout(res, 62000));
console.log('6. wrong password + lockout');
let last;
for (let i = 1; i <= 5; i++) {
  last = await call('POST', '/auth/login', { body: { identifier: '9999999998', password: 'wrong-pass' } });
}
check('wrong password -> 401 INVALID_CREDENTIALS', last.status === 401 && last.json.code === 'INVALID_CREDENTIALS', JSON.stringify(last));
r = await call('POST', '/auth/login', { body: { identifier: '9999999998', password: 'Demo@12345' } });
check('after 5 failures correct password still locked -> 403 ACCOUNT_LOCKED', r.status === 403 && r.json.code === 'ACCOUNT_LOCKED', JSON.stringify(r));
r = await call('POST', '/auth/login', { body: { identifier: 'nobody@example.com', password: 'whatever1' } });
check('unknown user -> 401 (same error)', r.status === 401 && r.json.code === 'INVALID_CREDENTIALS', JSON.stringify(r));
r = await call('POST', '/auth/login', { body: { identifier: '9999999997', password: 'Demo@12345', extra: 'x' } });
check('unknown body field rejected -> 400', r.status === 400, JSON.stringify(r));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
