// Classes module end-to-end. Server running + demo seed:  npm run smoke:classes
const B = 'http://localhost:3000/api';
const call = async (tok, m, u, b) => {
  const r = await fetch(B + u, {
    method: m,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok },
    body: b ? JSON.stringify(b) : undefined,
  });
  let j;
  try { j = await r.json(); } catch { /* empty body */ }
  return { s: r.status, j };
};
const login = async (i, p) =>
  (await (await fetch(B + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform: 'WEB' }),
  })).json()).accessToken;
let fail = 0;
const ok = (n, c, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x)));
  if (!c) fail++;
};

const A = await login('9999999999', 'ChangeMe@123');
const F = await login('9999999998', 'Demo@12345');
const S = await login('9999999997', 'Demo@12345');
const batches = (await call(A, 'GET', '/batches?limit=100')).j.items;
const demo = batches.find((b) => b.name === 'Demo Batch 2026');
const otherBatch = batches.find((b) => b.id !== demo.id);
const fac = (await call(A, 'GET', '/faculty')).j.items[0];

const H = 3600_000;
const D = 24 * H;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
// Far future and random, so reruns never collide with classes from earlier runs.
const day = now + (40 + Math.floor(Math.random() * 300)) * D;
const base = { batchId: demo.id, title: 'Smoke class', type: 'ZOOM', joinUrl: 'https://zoom.us/j/123' };
const made = [];

let r = await call(A, 'POST', '/classes', { ...base, startAt: iso(day), endAt: iso(day + H), joinUrl: undefined });
ok('zoom without link rejected', r.s === 400, r);
r = await call(A, 'POST', '/classes', { ...base, startAt: iso(day), endAt: iso(day + H), joinUrl: 'javascript:alert(1)' });
ok('javascript: link rejected', r.s === 400, r);
r = await call(A, 'POST', '/classes', { ...base, startAt: iso(day), endAt: iso(day + H), joinUrl: 'http://zoom.us/j/1' });
ok('plain http link rejected', r.s === 400, r);
r = await call(A, 'POST', '/classes', { ...base, startAt: iso(day + H), endAt: iso(day) });
ok('end before start rejected', r.s === 400, r);
r = await call(A, 'POST', '/classes', { ...base, type: 'PREMIERE', startAt: iso(day), endAt: iso(day + H) });
ok('premiere without video rejected', r.s === 400, r);
r = await call(S, 'POST', '/classes', { ...base, startAt: iso(day), endAt: iso(day + H) });
ok('student cannot create', r.s === 403, r);

const future = await call(A, 'POST', '/classes', { ...base, facultyId: fac.id, startAt: iso(day), endAt: iso(day + H) });
ok('admin creates class', future.s === 201 && future.j.created === 1, future);
const fid = future.j.items[0].id;
made.push(fid);

r = await call(A, 'POST', '/classes', { ...base, startAt: iso(day + H / 2), endAt: iso(day + 1.5 * H) });
ok('batch clash -> 409 CLASS_CLASH', r.s === 409 && r.j.code === 'CLASS_CLASH', r);
r = await call(A, 'POST', '/classes', { ...base, batchId: otherBatch.id, facultyId: fac.id, startAt: iso(day + H / 2), endAt: iso(day + 1.5 * H) });
ok('teacher clash (other batch) -> 409', r.s === 409 && /teacher/i.test(r.j.message), r);
r = await call(A, 'POST', '/classes', { ...base, startAt: iso(day + 2 * H), endAt: iso(day + 3 * H) });
ok('back-to-back is allowed', r.s === 201, r);
if (r.s === 201) made.push(r.j.items[0].id);

const sl = await call(S, 'GET', '/classes?limit=100');
const seen = sl.j.items.find((c) => c.id === fid);
ok('student sees class but not the link', seen && !('joinUrl' in seen) && !('meetingId' in seen), seen);
const al = await call(A, 'GET', `/classes/${fid}`);
ok('staff sees the link', al.j.joinUrl === 'https://zoom.us/j/123', al);
r = await call(S, 'POST', `/classes/${fid}/join`);
ok('join before the window -> 409 CLASS_NOT_OPEN', r.s === 409 && r.j.code === 'CLASS_NOT_OPEN', r);

// A series whose week 2 collides must create nothing at all.
const sday = day + 20 * D;
const blocker = await call(A, 'POST', '/classes', { ...base, startAt: iso(sday + 7 * D), endAt: iso(sday + 7 * D + H) });
made.push(blocker.j.items[0].id);
const before = (await call(A, 'GET', '/classes?limit=100')).j.total;
r = await call(A, 'POST', '/classes', { ...base, startAt: iso(sday), endAt: iso(sday + H), repeatWeeklyUntil: iso(sday + 22 * D) });
ok('series hitting a clash -> 409', r.s === 409, r);
const after = (await call(A, 'GET', '/classes?limit=100')).j.total;
ok('...and creates nothing (atomic)', before === after, [before, after]);
const sday2 = sday + 40 * D;
r = await call(A, 'POST', '/classes', { ...base, startAt: iso(sday2), endAt: iso(sday2 + H), repeatWeeklyUntil: iso(sday2 + 15 * D) });
ok('weekly series creates 3 classes', r.s === 201 && r.j.created === 3 && new Set(r.j.items.map((c) => c.seriesId)).size === 1, r);
for (const c of r.j.items ?? []) made.push(c.id);

// Join window: a class starting in 5 minutes.
const soon = await call(A, 'POST', '/classes', { ...base, title: 'Starts soon', startAt: iso(now + 5 * 60_000), endAt: iso(now + 65 * 60_000) });
if (soon.s !== 201) {
  ok('create near-now class', false, soon);
} else {
  const sid = soon.j.items[0].id;
  made.push(sid);
  const up = await call(S, 'GET', '/classes/upcoming');
  ok('upcoming feed has it', up.j.some((c) => c.id === sid), up);
  const jn = await call(S, 'POST', `/classes/${sid}/join`);
  ok('join inside window returns the link', jn.s === 201 && jn.j.joinUrl === 'https://zoom.us/j/123', jn);
  const jn2 = await call(S, 'POST', `/classes/${sid}/join`);
  ok('rejoin is fine', jn2.s === 201, jn2);
  await call(S, 'POST', `/classes/${sid}/leave`);
  const att = await call(A, 'GET', `/classes/${sid}/attendance`);
  ok('attendance lists the student as present', att.s === 200 && att.j.attended === 1 && att.j.present[0].phone === '9999999997', att);
  ok('present + absent adds up to expected', att.j.expected === att.j.attended + att.j.absent.length, att.j);
  ok('attendance endpoint closed to students', (await call(S, 'GET', `/classes/${sid}/attendance`)).s === 403, null);
  const rs = await call(A, 'PATCH', `/classes/${sid}`, { startAt: iso(day), endAt: iso(day + H) });
  ok('reschedule into a clash -> 409', rs.s === 409, rs);
  const cn = await call(A, 'DELETE', `/classes/${sid}`);
  ok('cancel', cn.s === 200 && cn.j.status === 'CANCELLED', cn);
  const jn3 = await call(S, 'POST', `/classes/${sid}/join`);
  ok('join cancelled -> 409 CLASS_CANCELLED', jn3.s === 409 && jn3.j.code === 'CLASS_CANCELLED', jn3);
  const up2 = await call(S, 'GET', '/classes/upcoming');
  ok('cancelled class leaves the upcoming feed', !up2.j.some((c) => c.id === sid), up2);
}

const fr = await call(F, 'POST', '/classes', { ...base, startAt: iso(day + 30 * D), endAt: iso(day + 30 * D + H) });
ok('faculty create works for own batch, else is refused cleanly', fr.s === 201 || fr.s === 400, fr);
if (fr.s === 201) made.push(fr.j.items[0].id);

for (const id of made) await call(A, 'DELETE', `/classes/${id}`); // leave no future clutter
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
