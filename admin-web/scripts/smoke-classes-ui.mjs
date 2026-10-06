// Classes screens + removal of unfinished pages, through the real web proxy.
// Needs backend (:3000) + web (:3001) with the demo seed:  node scripts/smoke-classes-ui.mjs
const WEB = process.env.WEB_URL ?? "http://localhost:3001";
let fail = 0;
const ok = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + x)); if (!c) fail++; };

class Browser {
  jar = new Map();
  async fetch(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("cookie", [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "));
    if (init.method && init.method !== "GET") headers.set("origin", WEB);
    const res = await fetch(WEB + path, { ...init, headers, redirect: "manual" });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";"); const i = pair.indexOf("=");
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  }
  async api(method, path, body) {
    const r = await this.fetch("/api/backend" + path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    let j; try { j = await r.json(); } catch { /* empty */ }
    return { s: r.status, j };
  }
  async login(id, pw) {
    const r = await this.fetch("/api/session/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw, deviceId: "p2-" + id }) });
    return r.status === 200;
  }
}
const location = (r) => r.headers.get("location") ?? "";

const admin = new Browser();
const student = new Browser();
ok("admin login", await admin.login("9999999999", "ChangeMe@123"));
ok("student login", await student.login("9999999997", "Demo@12345"));

// 1. nothing unfinished is offered
let r = await admin.fetch("/classes");
const html = await r.text();
ok("/classes renders for admin", r.status === 200);
ok("no 'not built yet' text on the classes page", !/not built yet|coming soon|planned scope/i.test(html));
for (const p of ["/fees", "/videos"]) {
  r = await admin.fetch(p);
  ok(`${p} redirects to the dashboard instead of a placeholder`, r.status >= 300 && r.status < 400 && location(r).endsWith("/dashboard"), `${r.status} ${location(r)}`);
}
r = await admin.fetch("/dashboard");
const dash = await r.text();
ok("sidebar has no Fees / Recorded Lectures links", !/href="\/fees"|href="\/videos"/.test(dash));
r = await student.fetch("/learn/notes");
ok("student web /learn/notes redirects home", r.status >= 300 && r.status < 400 && location(r).endsWith("/learn"), `${r.status} ${location(r)}`);
r = await student.fetch("/learn/classes");
const sh = await r.text();
ok("student /learn/classes renders", r.status === 200 && !/not built yet/i.test(sh), r.status);

// 2. schedule through the proxy, student sees it, join window is enforced
const batches = (await admin.api("GET", "/batches?limit=100&active=true")).j.items;
const demo = batches.find((b) => b.name === "Demo Batch 2026");
const H = 3600_000, D = 24 * H;
const iso = (ms) => new Date(ms).toISOString();
const far = Date.now() + (60 + Math.floor(Math.random() * 200)) * D;
const made = [];
const mk = (extra) => admin.api("POST", "/classes", { batchId: demo.id, title: "UI smoke class", type: "ZOOM", joinUrl: "https://meet.google.com/abc-defg-hij", ...extra });

let c = await mk({ startAt: iso(far), endAt: iso(far + H) });
ok("admin schedules a class", c.s === 201 && c.j.created === 1, JSON.stringify(c));
const farId = c.j.items[0].id; made.push(farId);

const past = await admin.api("GET", `/classes?limit=5&to=${encodeURIComponent(iso(far + 5 * H))}&order=desc`);
ok("list supports newest-first (order=desc)", past.s === 200 && past.j.items[0].id === farId, JSON.stringify(past).slice(0, 200));
const bad = await admin.api("GET", "/classes?order=sideways");
ok("bad order value is rejected", bad.s === 400, bad.s);

c = await mk({ title: "Starts in 5 min", startAt: iso(Date.now() + 5 * 60_000), endAt: iso(Date.now() + 65 * 60_000) });
ok("admin schedules a class starting soon", c.s === 201, JSON.stringify(c));
if (c.s === 201) {
  const id = c.j.items[0].id; made.push(id);
  const up = await student.api("GET", "/classes/upcoming");
  const row = up.j.find((x) => x.id === id);
  ok("student sees it in upcoming, without the link", row && !("joinUrl" in row), JSON.stringify(row));
  const j = await student.api("POST", `/classes/${id}/join`);
  ok("student joins and gets the Meet link", j.s === 201 && j.j.joinUrl.startsWith("https://meet.google.com/"), JSON.stringify(j));
  const att = await admin.api("GET", `/classes/${id}/attendance`);
  ok("attendance shows the student as present", att.j.present.some((p) => p.phone === "9999999997"), JSON.stringify(att).slice(0, 200));
}
const nj = await student.api("POST", `/classes/${farId}/join`);
ok("joining a class days away is refused (CLASS_NOT_OPEN)", nj.s === 409 && nj.j.code === "CLASS_NOT_OPEN", JSON.stringify(nj));

for (const id of made) await admin.api("DELETE", `/classes/${id}`);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
