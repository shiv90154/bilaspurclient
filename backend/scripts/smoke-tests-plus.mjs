// Test series, question images, safe edits after answers, and the student's result analysis.
// Server running + demo seed:  npm run smoke:tests-plus   (wait a minute after other smoke runs: login rate limit)
const B = 'http://localhost:3000';
const call = async (tok, m, u, b) => {
  const isForm = b instanceof FormData;
  const r = await fetch(B + '/api' + u, {
    method: m,
    headers: { authorization: 'Bearer ' + tok, ...(b && !isForm ? { 'content-type': 'application/json' } : {}) },
    body: isForm ? b : b ? JSON.stringify(b) : undefined,
  });
  let j;
  try { j = await r.json(); } catch { /* empty body */ }
  return { s: r.status, j };
};
const login = async (i, p) =>
  (await (await fetch(B + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform: 'WEB' }),
  })).json()).accessToken;
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x))); if (!c) fail++; };

const A = await login('9999999999', 'ChangeMe@123');
const F = await login('9999999998', 'Demo@12345');
const S = await login('9999999997', 'Demo@12345');
const stamp = Date.now();

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const form = (buf, name) => { const fd = new FormData(); fd.append('file', new Blob([buf]), name); return fd; };

// ── series ──
let r = await call(F, 'POST', '/test-series', { name: 'Mock Series ' + stamp, description: 'Smoke' });
ok('create a test series', r.s === 201, r);
const series = r.j;
r = await call(F, 'POST', '/test-series', { name: series.name });
ok('duplicate series name -> 409', r.s === 409, r);
r = await call(F, 'GET', '/test-series');
ok('series list shows it with a test count', r.j.some((x) => x.id === series.id && x._count.tests === 0), r);
r = await call(S, 'GET', '/test-series');
ok('student cannot manage series (403)', r.s === 403, r);

// ── two subjects so the breakdown has something to split ──
const courseId = (await call(A, 'GET', '/courses')).j.items[0].id;
const mkSubject = async (name) => (await call(A, 'POST', '/subjects', { courseId, name: name + stamp })).j;
const phys = await mkSubject('Physics'); const chem = await mkSubject('Chemistry');
const topicP = (await call(A, 'POST', '/topics', { subjectId: phys.id, name: 'Motion' })).j;
const topicC = (await call(A, 'POST', '/topics', { subjectId: chem.id, name: 'Atoms' })).j;
const q = async (topicId, text, correctIdx) => (await call(F, 'POST', '/questions', {
  topicId, text, options: [0, 1, 2, 3].map((i) => ({ text: 'opt' + i, isCorrect: i === correctIdx })),
})).j;
const q1 = await q(topicP.id, 'Physics Q1', 0);
const q2 = await q(topicP.id, 'Physics Q2', 1);
const q3 = await q(topicC.id, 'Chemistry Q3', 2);
ok('3 questions in 2 subjects', [q1, q2, q3].every((x) => x.id), [q1, q2, q3]);

// ── images ──
r = await call(F, 'POST', `/questions/${q1.id}/image`, form(PNG, 'fig.png'));
ok('upload a question image', r.s === 201 && r.j.imageUrl?.startsWith('/api/files/') && !('imageKey' in r.j), r);
const img = await fetch(B + r.j.imageUrl);
ok('image link serves image/png without a login', img.status === 200 && img.headers.get('content-type') === 'image/png', [img.status, img.headers.get('content-type')]);
r = await call(F, 'POST', `/questions/${q2.id}/image`, form(Buffer.from('not an image'), 'evil.png'));
ok('non-image bytes renamed .png -> 415', r.s === 415, r);
r = await call(F, 'POST', `/questions/${q2.id}/image`, form(Buffer.concat([PNG, Buffer.alloc(3.2 * 1024 * 1024)]), 'big.png'));
ok('image over 3 MB -> 413', r.s === 413, r);
r = await call(S, 'POST', `/questions/${q2.id}/image`, form(PNG, 'x.png'));
ok('student cannot upload images (403)', r.s === 403, r);
r = await call(F, 'GET', `/questions/${q1.id}`);
ok('question detail carries imageUrl', !!r.j.imageUrl, r);

// ── a test inside the series ──
const batches = (await call(A, 'GET', '/batches?limit=100')).j.items;
const demo = batches.find((b) => b.name === 'Demo Batch 2026');
r = await call(F, 'POST', '/tests', { title: 'Series test ' + stamp, durationMin: 30, negativeMark: 1, seriesId: series.id });
ok('create a test inside the series', r.s === 201 && r.j.seriesId === series.id, r);
const tid = r.j.id;
r = await call(F, 'POST', '/tests', { title: 'x', durationMin: 5, seriesId: '00000000-0000-4000-8000-000000000000' });
ok('unknown series rejected (400)', r.s === 400, r);
await call(F, 'PUT', `/tests/${tid}/questions`, { questions: [{ questionId: q1.id, marks: 4 }, { questionId: q2.id, marks: 4 }, { questionId: q3.id, marks: 4 }] });
await call(F, 'PUT', `/tests/${tid}/batches`, { batchIds: [demo.id] });
r = await call(F, 'POST', `/tests/${tid}/publish`);
ok('publish', r.s === 200 || r.s === 201, r);
r = await call(F, 'GET', `/tests?seriesId=${series.id}`);
ok('tests can be filtered by series', r.j.items.length === 1 && r.j.items[0].series.name === series.name, r);
const mine = (await call(S, 'GET', '/my/tests')).j.find((t) => t.id === tid);
ok('student sees the test with its series name', mine?.series?.name === series.name, mine);

// ── student takes it: Physics Q1 right, Physics Q2 wrong, Chemistry skipped ──
const st = await call(S, 'POST', `/my/tests/${tid}/start`);
ok('start', st.s === 201, st);
const paper = st.j;
const pq = (id) => paper.questions.find((x) => x.id === id);
ok('paper carries the image link for the picture question', pq(q1.id).imageUrl?.startsWith('/api/files/') && pq(q2.id).imageUrl === null, pq(q1.id));
const pimg = await fetch(B + pq(q1.id).imageUrl);
ok('student can load the picture during the test', pimg.status === 200, pimg.status);
const opt = (qid, text) => pq(qid).options.find((o) => o.text === text).id;
await call(S, 'PUT', `/attempts/${paper.attemptId}/answers`, { answers: [
  { questionId: q1.id, selectedOptionIds: [opt(q1.id, 'opt0')] },
  { questionId: q2.id, selectedOptionIds: [opt(q2.id, 'opt0')] },
] });
const sub = await call(S, 'POST', `/attempts/${paper.attemptId}/submit`);
ok('submit: 4 - 1 = 3', sub.s === 201 && sub.j.score === 3, sub.j);
ok('result has rank/participants/average/highest', sub.j.rank === 1 && sub.j.participants >= 1 && typeof sub.j.average === 'number' && sub.j.highest >= 3, sub.j);
const phy = sub.j.subjects.find((s) => s.name === 'Physics' + stamp);
const che = sub.j.subjects.find((s) => s.name === 'Chemistry' + stamp);
ok('Physics: 1 right, 1 wrong, 3 marks of 8', phy && phy.correct === 1 && phy.incorrect === 1 && phy.score === 3 && phy.total === 8, phy);
ok('Chemistry: skipped, 0 of 4', che && che.skipped === 1 && che.score === 0 && che.total === 4, che);
ok('the breakdown does not leak any answer', !JSON.stringify(sub.j.subjects).includes('isCorrect') && sub.j.review === null, sub.j);

// ── editing a question students already answered ──
const detail = (await call(F, 'GET', `/questions/${q2.id}`)).j;
const sameOpts = (fn) => detail.options.map((o, i) => ({ text: fn(o, i), isCorrect: o.isCorrect }));
r = await call(F, 'PATCH', `/questions/${q2.id}`, { text: 'Physics Q2 (typo fixed)', options: sameOpts((o) => o.text + ' fixed') });
ok('typo fix after answers is allowed', r.s === 200 && r.j.text.includes('typo fixed') && r.j.options.every((o) => o.text.endsWith('fixed')), r);
ok('option ids are unchanged, so old answers still score', r.j.options.map((o) => o.id).join() === detail.options.map((o) => o.id).join(), r.j.options);
r = await call(F, 'PATCH', `/questions/${q2.id}`, { options: detail.options.map((o, i) => ({ text: o.text, isCorrect: i === 3 })) });
ok('changing the correct option after answers -> 409', r.s === 409, r);
r = await call(F, 'PATCH', `/questions/${q2.id}`, { options: detail.options.slice(0, 3).map((o) => ({ text: o.text, isCorrect: o.isCorrect })) });
ok('removing an option after answers -> 409', r.s === 409, r);
const again = await call(S, 'GET', `/attempts/${paper.attemptId}/result`);
ok('the finished score did not change', again.j.score === 3, again.j);
r = await call(F, 'DELETE', `/questions/${q1.id}/image`);
ok('remove an image', r.s === 200 && r.j.imageUrl === null, r);
// an unanswered question can still be rewritten freely
const fresh = await q(topicP.id, 'Fresh', 0);
r = await call(F, 'PATCH', `/questions/${fresh.id}`, { options: [0, 1].map((i) => ({ text: 'new' + i, isCorrect: i === 1 })) });
ok('a question nobody answered can be fully rewritten', r.s === 200 && r.j.options.length === 2, r);

// ── series: move a test out ──
r = await call(F, 'PATCH', `/tests/${tid}`, { seriesId: null });
ok('a test can leave its series even after attempts', r.s === 200 && r.j.seriesId === null, r);
r = await call(F, 'PATCH', `/test-series/${series.id}`, { active: false });
ok('archive the series', r.s === 200 && r.j.active === false, r);
r = await call(F, 'GET', '/test-series');
ok('archived series is hidden from the list', !r.j.some((x) => x.id === series.id), r);

await call(F, 'POST', `/tests/${tid}/close`);
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
