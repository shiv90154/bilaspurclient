// Watermark switch, student profile (photo, documents, records, CSV), reports, passwords.
// Needs the API on :3000 and the demo seed users (npm run db:seed). Leaves the passwords as seeded.
const B = 'http://localhost:3000';
const call = async (tok, m, u, b) => {
  const isForm = b instanceof FormData;
  const r = await fetch(B + '/api' + u, {
    method: m,
    headers: { authorization: 'Bearer ' + tok, ...(b && !isForm ? { 'content-type': 'application/json' } : {}) },
    body: isForm ? b : b ? JSON.stringify(b) : undefined,
  });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { j = text; }
  return { s: r.status, j, h: r.headers };
};
const login = async (i, p) => {
  const r = await fetch(B + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform: 'WEB' }),
  });
  return { s: r.status, j: await r.json() };
};
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (c ? '' : ' ' + JSON.stringify(x)?.slice(0, 400))); if (!c) fail++; };

const A = (await login('9999999999', 'ChangeMe@123')).j.accessToken;
const F = (await login('9999999998', 'Demo@12345')).j.accessToken;
let S = (await login('9999999997', 'Demo@12345')).j.accessToken;

// ── watermark switch ──
const s0 = await call(A, 'GET', '/settings');
ok('settings readable by admin', s0.s === 200 && typeof s0.j.watermarkEnabled === 'boolean', s0);
await call(A, 'PATCH', '/settings', { watermarkEnabled: false });
let me = await call(S, 'GET', '/auth/me');
ok('watermark off -> me.watermark.enabled false', me.j.watermark?.enabled === false, me.j);
const on = await call(A, 'PATCH', '/settings', { watermarkEnabled: true });
ok('admin turns watermark on', on.s === 200 && on.j.watermarkEnabled === true, on);
me = await call(S, 'GET', '/auth/me');
ok('student sees watermark on', me.j.watermark?.enabled === true && me.j.watermark.name, me.j);
ok('student cannot change settings', (await call(S, 'PATCH', '/settings', { watermarkEnabled: false })).s === 403);
ok('faculty cannot read settings', (await call(F, 'GET', '/settings')).s === 403);
ok('unknown setting rejected', (await call(A, 'PATCH', '/settings', { foo: 1 })).s === 400);
ok('non-boolean rejected', (await call(A, 'PATCH', '/settings', { watermarkEnabled: 'yes' })).s === 400);
await call(A, 'PATCH', '/settings', { watermarkEnabled: s0.j.watermarkEnabled });

// ── student profile ──
const my = await call(S, 'GET', '/students/me');
ok('student /students/me', my.s === 200 && my.j.user?.phone === '9999999997' && my.j.stats && !('photoKey' in my.j) && !('notes' in my.j), my);
ok('staff cannot use /students/me', (await call(A, 'GET', '/students/me')).s === 403);
const sid = my.j.id;

const csv = await call(A, 'GET', '/students/export');
ok('CSV export', csv.s === 200 && csv.h.get('content-type').startsWith('text/csv') && csv.j.includes('9999999997') && csv.j.startsWith('Admission no'), csv.s);
const raw = Buffer.from(await (await fetch(B + '/api/students/export', { headers: { authorization: 'Bearer ' + A } })).arrayBuffer());
ok('CSV starts with a UTF-8 BOM (Excel)', raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf, raw.subarray(0, 3));
ok('CSV download header', /attachment; filename="students-\d{4}-\d{2}-\d{2}\.csv"/.test(csv.h.get('content-disposition')), csv.h.get('content-disposition'));
const csvF = await call(A, 'GET', '/students/export?status=DROPPED&search=zzzz-nobody');
ok('CSV export honours filters', csvF.s === 200 && csvF.j.split('\r\n').filter(Boolean).length === 1, csvF.j);
ok('student cannot export', (await call(S, 'GET', '/students/export')).s === 403);
ok('bad filter rejected', (await call(A, 'GET', '/students/export?status=NOPE')).s === 400);

const rec = await call(A, 'GET', `/students/${sid}/records`);
ok('records', rec.s === 200 && Array.isArray(rec.j.tests) && Array.isArray(rec.j.attendance) && Array.isArray(rec.j.doubts) && 'attendancePercentage' in rec.j.summary, rec);
ok('student cannot read records route', (await call(S, 'GET', `/students/${sid}/records`)).s === 403);

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const form = (o, bytes, name) => { const fd = new FormData(); for (const k in o) fd.append(k, o[k]); if (bytes) fd.append('file', new Blob([bytes]), name); return fd; };
const ph = await call(A, 'POST', `/students/${sid}/photo`, form({}, png, 'me.png'));
ok('photo upload', ph.s === 201 && ph.j.photoUrl?.startsWith('/api/files/'), ph);
const phBad = await call(A, 'POST', `/students/${sid}/photo`, form({}, Buffer.from('%PDF-1.4 x'), 'x.png'));
ok('photo must be an image', phBad.s === 415, phBad);
const got = await call(A, 'GET', `/students/${sid}`);
ok('detail has photoUrl, no key', got.j.photoUrl && !('photoKey' in got.j), got.j);
const img = await fetch(B + got.j.photoUrl);
ok('photo link serves png', img.status === 200 && img.headers.get('content-type') === 'image/png', img.status);
ok('faculty cannot upload photo', (await call(F, 'POST', `/students/${sid}/photo`, form({}, png, 'a.png'))).s === 403);

const pdf = Buffer.from('%PDF-1.4\nAadhaar test\n%%EOF');
const d1 = await call(A, 'POST', `/students/${sid}/documents`, form({ type: 'ID_PROOF', label: 'Aadhaar card' }, pdf, 'scan.pdf'));
ok('document upload', d1.s === 201 && d1.j.fileName === 'Aadhaar card.pdf' && !('fileKey' in d1.j), d1);
const dBad = await call(A, 'POST', `/students/${sid}/documents`, form({ type: 'ID_PROOF' }, Buffer.from('MZ evil exe'), 'a.pdf'));
ok('document type checked by bytes', dBad.s === 415, dBad);
const dType = await call(A, 'POST', `/students/${sid}/documents`, form({ type: 'PASSPORT' }, pdf, 'a.pdf'));
ok('unknown document type rejected', dType.s === 400, dType);
const dl = await call(A, 'GET', `/students/${sid}/documents`);
ok('document list', dl.s === 200 && dl.j.some((d) => d.id === d1.j.id), dl);
ok('faculty cannot list documents', (await call(F, 'GET', `/students/${sid}/documents`)).s === 403);
const du = await call(A, 'GET', `/students/${sid}/documents/${d1.j.id}/url`);
const served = await fetch(B + du.j.url);
ok('document opens via signed link', served.status === 200 && (await served.text()).includes('Aadhaar test'), du);
const del = await call(A, 'DELETE', `/students/${sid}/documents/${d1.j.id}`);
ok('document delete', del.s === 200, del);
ok('deleted document gone', (await call(A, 'GET', `/students/${sid}/documents/${d1.j.id}/url`)).s === 404);
ok('photo remove', (await call(A, 'DELETE', `/students/${sid}/photo`)).j.photoUrl === null);

// ── reports ──
const batches = (await call(A, 'GET', '/batches')).j.items;
const att = await call(A, 'GET', '/reports/attendance');
ok('attendance report', att.s === 200 && Array.isArray(att.j.rows), att);
ok('attendance CSV', (await call(A, 'GET', '/reports/attendance/csv')).h.get('content-type').startsWith('text/csv'));
const sa = await call(A, 'GET', `/reports/attendance/students?batchId=${batches[0].id}`);
ok('student-wise attendance', sa.s === 200 && Array.isArray(sa.j.rows), sa);
ok('student-wise needs batch', (await call(A, 'GET', '/reports/attendance/students')).s === 400);
const enq = await call(A, 'GET', '/reports/enquiries?from=2020-01-01&to=2030-12-31');
ok('enquiry report', enq.s === 200 && enq.j.byStatus.length === 5 && 'conversion' in enq.j.summary, enq);
ok('faculty cannot see enquiry report', (await call(F, 'GET', '/reports/enquiries')).s === 403);
const mat = await call(F, 'GET', '/reports/materials');
ok('materials report (faculty)', mat.s === 200 && Array.isArray(mat.j.rows), mat);
ok('student cannot see reports', (await call(S, 'GET', '/reports/materials')).s === 403);
const tests = (await call(A, 'GET', '/tests')).j.items;
if (tests.length) {
  const tr = await call(A, 'GET', `/reports/tests/${tests[0].id}/csv`);
  ok('test results CSV', tr.s === 200 && tr.j.includes('Rank,Name,Phone'), tr.s);
}
const dash = await call(A, 'GET', '/dashboard/summary');
ok('dashboard has new counts', ['materials', 'questions', 'liveNow', 'activeToday', 'activeWeek'].every((k) => typeof dash.j.counts[k] === 'number'), dash.j.counts);

// ── passwords ──
const weak = await call(S, 'POST', '/auth/change-password', { currentPassword: 'Demo@12345', newPassword: 'short' });
ok('weak new password rejected', weak.s === 400, weak);
const wrong = await call(S, 'POST', '/auth/change-password', { currentPassword: 'nope-nope1', newPassword: 'NewPass123' });
ok('wrong current password rejected (400, keeps session)', wrong.s === 400 && wrong.j.code === 'WRONG_PASSWORD', wrong);
const same = await call(S, 'POST', '/auth/change-password', { currentPassword: 'Demo@12345', newPassword: 'Demo@12345' });
ok('same password rejected', same.s === 400 && same.j.code === 'PASSWORD_UNCHANGED', same);
const ch = await call(S, 'POST', '/auth/change-password', { currentPassword: 'Demo@12345', newPassword: 'NewPass123' });
ok('student changes own password', ch.s === 204, ch);
ok('current session still works', (await call(S, 'GET', '/auth/me')).s === 200);
ok('old password no longer works', (await login('9999999997', 'Demo@12345')).s === 401);
const re = await login('9999999997', 'NewPass123');
ok('new password works', re.s === 200, re);
S = re.j.accessToken;

const userId = (await call(A, 'GET', `/students/${sid}`)).j.user.id;
const reset = await call(A, 'POST', `/users/${userId}/reset-password`, {});
ok('admin reset gives a one-time password', reset.s === 200 && typeof reset.j.temporaryPassword === 'string', reset);
ok('reset logs the student out', (await call(S, 'GET', '/auth/me')).s === 401);
const tmp = await login('9999999997', reset.j.temporaryPassword);
ok('temporary password works', tmp.s === 200, tmp);
const back = await call(A, 'POST', `/users/${userId}/reset-password`, { password: 'Demo@12345' });
ok('admin sets a chosen password', back.s === 200 && !('temporaryPassword' in back.j), back);
ok('faculty cannot reset passwords', (await call(F, 'POST', `/users/${userId}/reset-password`, {})).s === 403);
const adminId = (await call(A, 'GET', '/auth/me')).j.id;
ok('admin cannot reset own password here', (await call(A, 'POST', `/users/${adminId}/reset-password`, {})).s === 400);
ok('seed password restored', (await login('9999999997', 'Demo@12345')).s === 200);

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
