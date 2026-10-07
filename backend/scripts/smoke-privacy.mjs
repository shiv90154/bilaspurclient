// Consent + account deletion. Needs the API on :3000 and the demo seed users.
// Creates a throwaway student and deletes it; the demo users are only asked for consent.
const B = 'http://localhost:3000';
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
const login = async (i, p) => {
  const r = await call(null, 'POST', '/auth/login', { identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform: 'WEB' });
  return r;
};
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (c ? '' : ' ' + JSON.stringify(x)?.slice(0, 400))); if (!c) fail++; };

const A = (await login('9999999999', 'ChangeMe@123')).j.accessToken;

// public info
const info = await call(null, 'GET', '/privacy/info');
ok('public info without login', info.s === 200 && info.j.termsVersion && 'instituteName' in info.j && !('watermarkEnabled' in info.j), info);
const set = await call(A, 'PATCH', '/settings', { contactEmail: 'office@example.com' });
ok('admin sets contact email', set.s === 200 && set.j.contactEmail === 'office@example.com', set);
ok('bad email rejected', (await call(A, 'PATCH', '/settings', { contactEmail: 'nope' })).s === 400);
ok('empty email allowed (clears it)', (await call(A, 'PATCH', '/settings', { contactEmail: '' })).s === 200);

// throwaway student
const phone = '6' + String(Date.now()).slice(-9);
const created = await call(A, 'POST', '/students', { name: 'Privacy Test', phone, password: 'Privacy123', guardianName: 'Parent', address: 'Somewhere' });
ok('throwaway student created', created.s === 201, created);
const sid = created.j.id;
let S = (await login(phone, 'Privacy123')).j.accessToken;

const me = await call(S, 'GET', '/auth/me');
ok('new student must give consent', me.j.consentRequired === true, me.j);
ok('admin never asked for consent', (await call(A, 'GET', '/auth/me')).j.consentRequired === false);
ok('consent needs accepted=true', (await call(S, 'POST', '/privacy/consent', { version: info.j.termsVersion, accepted: false })).s === 400);
ok('old terms version refused', (await call(S, 'POST', '/privacy/consent', { version: '2000-01-01', accepted: true })).s === 409);
const c = await call(S, 'POST', '/privacy/consent', { version: info.j.termsVersion, accepted: true, guardianAgree: true, guardianName: 'Parent' });
ok('consent saved', c.s === 201 && c.j.version === info.j.termsVersion, c);
ok('consent no longer required', (await call(S, 'GET', '/auth/me')).j.consentRequired === false);
ok('consent is idempotent', (await call(S, 'POST', '/privacy/consent', { version: info.j.termsVersion, accepted: true })).s === 201);
ok('staff cannot post consent', (await call(A, 'POST', '/privacy/consent', { version: info.j.termsVersion, accepted: true })).s === 403);

// deletion from the app
ok('no pending request yet', (await call(S, 'GET', '/privacy/deletion-request')).j === '');
const r1 = await call(S, 'POST', '/privacy/deletion-request', { reason: 'Course finished' });
ok('student requests deletion in app', r1.s === 201 && r1.j.status === 'PENDING', r1);
const r2 = await call(S, 'POST', '/privacy/deletion-request', {});
ok('repeat request does not duplicate', r2.j.id === r1.j.id, r2);
ok('app shows pending request', (await call(S, 'GET', '/privacy/deletion-request')).j.id === r1.j.id);

// deletion from the public web page
const w = await call(null, 'POST', '/privacy/deletion-request/public', { name: 'Someone', phone: '6000000001' });
ok('public request accepted without login', w.s === 200 && w.j.received === true, w);
ok('public request validates phone', (await call(null, 'POST', '/privacy/deletion-request/public', { name: 'x', phone: '123' })).s === 400);

const list = await call(A, 'GET', '/privacy/deletion-requests?status=PENDING');
const unknown = list.j.items.find((x) => x.phone === '6000000001');
ok('admin lists requests', list.s === 200 && list.j.items.some((x) => x.id === r1.j.id) && unknown && unknown.user === null, list.j.items?.length);
ok('student cannot list requests', (await call(S, 'GET', '/privacy/deletion-requests')).s === 403);
ok('cannot complete a request with no account', (await call(A, 'POST', `/privacy/deletion-requests/${unknown.id}/complete`, {})).s === 400);
const rej = await call(A, 'POST', `/privacy/deletion-requests/${unknown.id}/reject`, { note: 'No such student' });
ok('admin rejects unknown request', rej.s === 200 && rej.j.status === 'REJECTED', rej);
ok('handled request cannot be handled again', (await call(A, 'POST', `/privacy/deletion-requests/${unknown.id}/reject`, {})).s === 409);

const done = await call(A, 'POST', `/privacy/deletion-requests/${r1.j.id}/complete`, {});
ok('admin completes deletion', done.s === 200 && done.j.status === 'COMPLETED', done);
ok('deleted student is logged out', (await call(S, 'GET', '/auth/me')).s === 401);
ok('deleted student cannot log in', (await login(phone, 'Privacy123')).s === 401);
const gone = await call(A, 'GET', `/students/${sid}`);
ok('student record hidden from lists', gone.s === 404, gone.s);
const csv = await call(A, 'GET', '/students/export');
ok('phone gone from exports', !String(csv.j).includes(phone));
const after = await call(A, 'GET', '/privacy/deletion-requests');
ok('request no longer holds the phone', !JSON.stringify(after.j).includes(phone));

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
