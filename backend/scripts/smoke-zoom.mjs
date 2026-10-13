// Zoom recordings end-to-end against a fake Zoom on :3998: webhook check, download, the class's
// batch gets the video, student plays it with seeking, resend/fetch are idempotent, retries, trash.
// Needs the API on :3000 with the demo seed, started with:
//   ZOOM_ACCOUNT_ID=acc ZOOM_CLIENT_ID=cid ZOOM_CLIENT_SECRET=csecret ZOOM_WEBHOOK_SECRET=zwhsecret
//   ZOOM_TRASH_AFTER_IMPORT=true ZOOM_API_URL=http://localhost:3998/v2 ZOOM_OAUTH_URL=http://localhost:3998/oauth/token
// Usage: node scripts/smoke-zoom.mjs
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const B = 'http://localhost:3000/api';
const Z = 'http://localhost:3998';
const WEBHOOK_SECRET = 'zwhsecret';

// ── fake Zoom ──
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), randomBytes(2 * 1024 * 1024)]);
const recordings = new Map(); // uuid -> recording object
const instances = new Map(); // meeting id -> [{ uuid, start_time }]
const trashed = [];
let brokenDownloads = 0; // the next N downloads answer with an HTML error page
const fake = createServer((req, res) => {
  const url = new URL(req.url, Z);
  const json = (code, body) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  if (url.pathname === '/oauth/token') {
    const ok = req.headers.authorization === 'Basic ' + Buffer.from('cid:csecret').toString('base64') && url.searchParams.get('account_id') === 'acc';
    return ok ? json(200, { access_token: 'tok123', expires_in: 3600 }) : json(401, { reason: 'Invalid client' });
  }
  if (req.headers.authorization !== 'Bearer tok123') return json(401, { message: 'bad token' });
  if (url.pathname.startsWith('/download/')) {
    if (brokenDownloads > 0) {
      brokenDownloads--;
      return res.writeHead(200, { 'content-type': 'text/html' }).end('<html>expired</html>');
    }
    return res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': mp4.length }).end(mp4);
  }
  let m = url.pathname.match(/^\/v2\/past_meetings\/(\d+)\/instances$/);
  if (m) return json(200, { meetings: instances.get(m[1]) ?? [] });
  m = url.pathname.match(/^\/v2\/meetings\/([^/]+)\/recordings$/);
  if (m) {
    const id = decodeURIComponent(decodeURIComponent(m[1]));
    if (req.method === 'DELETE') {
      trashed.push(id);
      return res.writeHead(204).end();
    }
    const rec = recordings.get(id);
    return rec ? json(200, rec) : json(404, { code: 3301, message: 'no recording' });
  }
  json(404, { message: 'not found' });
});
await new Promise((r) => fake.listen(3998, r));

const call = async (tok, m, u, b, headers = {}) => {
  const r = await fetch(B + u, {
    method: m,
    headers: { ...(tok && { authorization: 'Bearer ' + tok }), ...(b && { 'content-type': 'application/json' }), ...headers },
    body: b ? (typeof b === 'string' ? b : JSON.stringify(b)) : undefined,
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const login = async (i, p) =>
  (await call(null, 'POST', '/auth/login', { identifier: i, password: p, deviceId: 'dev-' + i, deviceName: 't', platform: 'WEB' })).j.accessToken;
let fail = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x)?.slice(0, 400))); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const webhook = (body, { secret = WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000) } = {}) => {
  const raw = JSON.stringify(body);
  const sig = 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex');
  return call(null, 'POST', '/integrations/zoom/webhook', raw, { 'content-type': 'application/json', 'x-zm-request-timestamp': String(ts), 'x-zm-signature': sig });
};
const recording = (meetingId, start, n = 1) => {
  const uuid = randomBytes(12).toString('base64'); // like Zoom's: may hold "/" and "+"
  const rec = {
    uuid,
    id: Number(meetingId),
    topic: 'Zoom topic',
    start_time: new Date(start).toISOString(),
    duration: 60,
    recording_files: [
      { file_type: 'M4A', recording_type: 'audio_only', download_url: `${Z}/download/a-${n}`, status: 'completed' },
      {
        file_type: 'MP4',
        recording_type: 'shared_screen_with_speaker_view',
        download_url: `${Z}/download/v-${n}`,
        file_size: mp4.length,
        status: 'completed',
        recording_start: new Date(start).toISOString(),
        recording_end: new Date(start + 3_540_000).toISOString(),
      },
    ],
  };
  recordings.set(uuid, rec);
  return rec;
};
const completed = (rec) => webhook({ event: 'recording.completed', event_ts: Date.now(), payload: { account_id: 'acc', object: rec } });
const importOf = async (A, uuidOrId, want = ['DONE', 'FAILED', 'SKIPPED']) => {
  for (let i = 0; i < 60; i++) {
    const items = (await call(A, 'GET', '/integrations/zoom/imports?limit=100')).j.items;
    const row = items.find((r) => r.id === uuidOrId);
    if (row && want.includes(row.status)) return row;
    await sleep(250);
  }
  return null;
};

const A = await login('9999999999', 'ChangeMe@123');
const F = await login('9999999998', 'Demo@12345');
const S = await login('9999999997', 'Demo@12345');
const batch = (await call(A, 'GET', '/batches?limit=100')).j.items.find((b) => b.name === 'Demo Batch 2026');
const fac = (await call(A, 'GET', '/faculty')).j.items[0];

// ── status + webhook security ──
const st = await call(A, 'GET', '/integrations/zoom/status');
ok('status: api + webhook connected', st.s === 200 && st.j.apiConnected && st.j.webhookConnected && st.j.videoStore, st.j);
ok('student cannot see Zoom status', (await call(S, 'GET', '/integrations/zoom/status')).s === 403);
const v = await webhook({ event: 'endpoint.url_validation', payload: { plainToken: 'plain123' } });
ok('URL validation answered', v.s === 200 && v.j.encryptedToken === createHmac('sha256', WEBHOOK_SECRET).update('plain123').digest('hex'), v);
ok('wrong secret → 401', (await webhook({ event: 'endpoint.url_validation', payload: { plainToken: 'x' } }, { secret: 'nope' })).s === 401);
ok('old timestamp → 401', (await webhook({ event: 'x' }, { ts: Math.floor(Date.now() / 1000) - 3600 })).s === 401);
ok('unknown event ignored', (await webhook({ event: 'meeting.started' })).j.ignored === 'meeting.started');

// ── a past Zoom class (random day, so reruns never clash) ──
const meetingId = String(80_000_000_000 + Math.floor(Math.random() * 9_000_000_000));
const start = Date.now() - (20 + Math.floor(Math.random() * 3000)) * 3600_000 - 30 * 60_000;
const made = await call(A, 'POST', '/classes', {
  batchId: batch.id,
  title: 'Zoom smoke class',
  facultyId: fac.id,
  type: 'ZOOM',
  joinUrl: `https://us05web.zoom.us/j/${meetingId}?pwd=abc`,
  startAt: new Date(start).toISOString(),
  endAt: new Date(start + 3600_000).toISOString(),
});
ok('class created', made.s === 201, made);
const cls = made.j.items[0];

// ── webhook → download → video for the batch ──
const rec = recording(meetingId, start + 2 * 60_000);
const hook = await completed(rec);
ok('recording.completed accepted', hook.s === 200 && hook.j.importId, hook);
const done = await importOf(A, hook.j.importId);
ok('import DONE and matched to the class', done?.status === 'DONE' && done.class?.id === cls.id && done.video?.id, done);
const videoId = done?.video?.id;
ok('Zoom recording moved to trash', trashed.includes(rec.uuid), trashed);

const sv = (await call(S, 'GET', '/videos?limit=100')).j.items.find((x) => x.id === videoId);
ok('student sees it under Videos', sv && sv.source === 'file' && sv.durationSec === 3540 && sv.batches.some((b) => b.batch.id === batch.id), sv);
ok('storage key not exposed', sv && !('sourceKey' in sv), sv);
const clsNow = (await call(S, 'GET', `/classes/${cls.id}`)).j;
ok('class lists its recording', clsNow.recordings?.[0]?.videoId === videoId, clsNow);

const play = await call(S, 'GET', `/videos/${videoId}/play`);
ok('play gives a link', play.s === 200 && play.j.source === 'file' && play.j.url, play);
const fileUrl = play.j.url?.startsWith('http') ? play.j.url : 'http://localhost:3000' + play.j.url;
const full = await fetch(fileUrl);
const body = Buffer.from(await full.arrayBuffer());
ok('full file served as mp4', full.status === 200 && full.headers.get('content-type') === 'video/mp4' && body.equals(mp4), { s: full.status, n: body.length });
const part = await fetch(fileUrl, { headers: { range: 'bytes=100-199' } });
const pb = Buffer.from(await part.arrayBuffer());
ok('range request → 206 with the right bytes', part.status === 206 && pb.equals(mp4.subarray(100, 200)) && part.headers.get('content-range') === `bytes 100-199/${mp4.length}`, { s: part.status });
ok('range past the end → 416', (await fetch(fileUrl, { headers: { range: `bytes=${mp4.length}-` } })).status === 416);
// Our own signed links only (VIDEO_STORE=local); R2 checks its own signatures.
if (fileUrl.includes('/api/files/')) ok('tampered link → 401', (await fetch(fileUrl.replace(/sig=../, 'sig=00'))).status === 401);

// ── idempotent: resend + manual fetch do not duplicate ──
const again = await completed(rec);
ok('resent webhook → same import', again.j.importId === hook.j.importId, again.j);
instances.set(meetingId, [{ uuid: rec.uuid, start_time: rec.start_time }]);
const fetched = await call(F, 'POST', `/classes/${cls.id}/fetch-recording`);
ok('teacher "fetch recording" finds the same one', fetched.s === 200 && fetched.j.found === 1 && fetched.j.items[0].id === hook.j.importId, fetched.j);
const count = (await call(A, 'GET', '/videos?limit=100')).j.items.filter((x) => x.id === videoId || x.title === done?.video?.title).length;
ok('still one video', count === 1, count);

// ── second part of the same class (teacher restarted the meeting) via manual fetch ──
const rec2 = recording(meetingId, start + 20 * 60_000, 2);
instances.set(meetingId, [{ uuid: rec.uuid, start_time: rec.start_time }, { uuid: rec2.uuid, start_time: rec2.start_time }]);
const f2 = await call(A, 'POST', `/classes/${cls.id}/fetch-recording`);
const newId = f2.j.items?.find((i) => i.id !== hook.j.importId)?.id;
const d2 = newId && (await importOf(A, newId));
ok('manual fetch imports the 2nd part', d2?.status === 'DONE' && d2.class?.id === cls.id && / \(part 2\)$/.test(d2.video?.title ?? ''), d2);

// ── no matching class: video without batch, students see nothing ──
const lone = recording('89999999999', Date.now() - 3600_000, 3);
const h3 = await completed(lone);
const d3 = await importOf(A, h3.j.importId);
ok('unmatched recording → video with no class', d3?.status === 'DONE' && !d3.class && d3.video, d3);
ok('student cannot see the unmatched video', !(await call(S, 'GET', '/videos?limit=100')).j.items.some((x) => x.id === d3?.video?.id));
ok('student cannot play it', (await call(S, 'GET', `/videos/${d3?.video?.id}/play`)).s === 404);

// ── broken download → FAILED, then retry works ──
brokenDownloads = 1;
const bad = recording('89999999998', Date.now() - 7200_000, 4);
const h4 = await completed(bad);
const d4 = await importOf(A, h4.j.importId);
ok('error page instead of video → FAILED', d4?.status === 'FAILED' && /instead of the video/.test(d4.error ?? ''), d4);
const r4 = await call(A, 'POST', `/integrations/zoom/imports/${h4.j.importId}/retry`);
ok('retry accepted', r4.s === 200, r4);
const d4b = await importOf(A, h4.j.importId, ['DONE']);
ok('retry → DONE', d4b?.status === 'DONE', d4b);
ok('retry of a DONE import refused', (await call(A, 'POST', `/integrations/zoom/imports/${h4.j.importId}/retry`)).s === 400);

// ── audio-only recording → SKIPPED ──
const audio = recording('89999999997', Date.now() - 3600_000, 5);
audio.recording_files = audio.recording_files.filter((f) => f.file_type !== 'MP4');
const h5 = await completed(audio);
ok('audio-only → SKIPPED', (await importOf(A, h5.j.importId))?.status === 'SKIPPED');

// ── delete cleans up ──
for (const id of [d3?.video?.id, d4b?.video?.id].filter(Boolean)) await call(A, 'DELETE', `/videos/${id}`);
const del = await call(A, 'DELETE', `/videos/${videoId}`);
ok('admin deletes the video', del.s === 200, del);
ok('old play link stops working', (await fetch(fileUrl)).status === 404);
await call(A, 'DELETE', `/videos/${d2?.video?.id}`);

fake.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
