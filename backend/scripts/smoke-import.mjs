// Bulk student import (rows from the admin's Excel/CSV). Server running + demo seed:
// Usage: node scripts/smoke-import.mjs
const B = 'http://localhost:3000/api';
const call = async (tok, m, u, b) => {
  const r = await fetch(B + u, {
    method: m,
    headers: { 'content-type': 'application/json', ...(tok && { authorization: 'Bearer ' + tok }) },
    body: b ? JSON.stringify(b) : undefined,
  });
  let j;
  try { j = await r.json(); } catch { /* empty */ }
  return { s: r.status, j };
};
const login = async (i, p) => (await call(null, 'POST', '/auth/login', { identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform: 'WEB' })).j;
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x)?.slice(0, 500))); if (!c) fail++; };

const A = (await login('9999999999', 'ChangeMe@123')).accessToken;
const S = (await login('9999999997', 'Demo@12345')).accessToken;
const batch = (await call(A, 'GET', '/batches?limit=100')).j.items[0];
const n = String(Date.now()).slice(-7);
const p1 = `7${n}11`, p2 = `7${n}22`, p3 = `7${n}33`;

ok('student cannot import', (await call(S, 'POST', '/students/import', { rows: [{ name: 'x', phone: p1 }] })).s === 403);
ok('empty list refused', (await call(A, 'POST', '/students/import', { rows: [] })).s === 400);

const res = await call(A, 'POST', '/students/import', {
  rows: [
    { name: 'Import One', phone: p1, email: `imp1-${n}@example.com`, batchIds: [batch.id], guardianName: 'G One', city: 'Bilaspur' },
    { name: 'Import Two', phone: p2, password: 'Strong123pass' },
    { name: 'Dup Of Demo', phone: '9999999997' },
    { name: 'Bad Phone', phone: '12345' },
    { name: 'Hacker', phone: p3, role: 'ADMIN' },
  ],
});
ok('import answers per row', res.s === 200 && res.j.results?.length === 5, res);
const r = res.j.results ?? [];
ok('row 1 created with a temporary password', r[0]?.status === 'created' && r[0].temporaryPassword?.length >= 8, r[0]);
ok('row 2 created with its own password (none returned)', r[1]?.status === 'created' && !r[1].temporaryPassword, r[1]);
ok('existing phone → skipped', r[2]?.status === 'skipped' && /already exists/.test(r[2].message), r[2]);
ok('bad phone → error, others still saved', r[3]?.status === 'error' && /10 digit/.test(r[3].message), r[3]);
ok('unknown field (role) refused', r[4]?.status === 'error' && /role/.test(r[4].message), r[4]);
ok('counts add up', res.j.created === 2 && res.j.skipped === 1 && res.j.errors === 2, res.j);

const one = await login(p1, r[0]?.temporaryPassword);
ok('imported student logs in with the temporary password', !!one?.accessToken && one.user.role === 'STUDENT', one);
const two = await login(p2, 'Strong123pass');
ok('second student logs in with the sheet password', !!two?.accessToken, two);
const list = (await call(A, 'GET', `/students?search=${p1}`)).j.items;
ok('student is in the batch from the sheet', list?.[0]?.batches?.some((b) => (b.batch?.id ?? b.batchId) === batch.id) === true, list?.[0]);

// clean up
for (const s of (await call(A, 'GET', `/students?search=7${n}`)).j.items ?? []) await call(A, 'DELETE', `/students/${s.id}`);

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
