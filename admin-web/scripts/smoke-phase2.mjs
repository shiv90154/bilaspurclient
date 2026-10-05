// Phase 2 admin screens through the real web proxy. Needs backend (:3000) + web (:3001), demo seed.
//   node scripts/smoke-phase2.mjs
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
    const isForm = body instanceof FormData;
    const r = await this.fetch("/api/backend" + path, { method, headers: body && !isForm ? { "content-type": "application/json" } : {}, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    let j; try { j = await r.json(); } catch { /* empty */ }
    return { s: r.status, j };
  }
  async login(id, pw) {
    const r = await this.fetch("/api/session/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw, deviceId: "p2-" + id }) });
    return r.status === 200;
  }
}

const admin = new Browser(); const student = new Browser();
ok("admin login", await admin.login("9999999999", "ChangeMe@123"));
ok("student login", await student.login("9999999997", "Demo@12345"));

for (const p of ["/question-bank", "/tests", "/materials", "/doubts"]) {
  const r = await admin.fetch(p); ok(`page ${p} renders for admin`, r.status === 200, r.status);
}
const sr = await student.fetch("/tests"); ok("student cannot open /tests", sr.status >= 300 && sr.status < 400, sr.status);

// upload through the proxy (multipart must survive the BFF)
const subs = (await admin.api("GET", "/subjects")).j;
const fd = new FormData();
fd.append("title", "Proxy upload " + Date.now());
fd.append("allowDownload", "false");
const batches = (await admin.api("GET", "/batches?limit=100")).j.items;
const demo = batches.find((b) => b.name === "Demo Batch 2026");
fd.append("batchIds", JSON.stringify([demo.id]));
fd.append("subjectId", subs[0].id);
fd.append("file", new Blob([Buffer.from("%PDF-1.4\nproxy-body\n%%EOF")], { type: "application/pdf" }), "x.pdf");
const up = await admin.api("POST", "/materials", fd);
ok("multipart upload via proxy", up.s === 201, JSON.stringify(up));

const vu = await student.api("GET", `/materials/${up.j.id}/view-url`);
ok("student view-url", vu.s === 200, JSON.stringify(vu));
const href = vu.j.url.replace(/^\/api\//, "/api/backend/");
const file = await student.fetch(href);
const txt = await file.text();
ok("signed file opens through proxy as PDF", file.status === 200 && txt.includes("proxy-body") && file.headers.get("content-type") === "application/pdf", `${file.status} ${file.headers.get("content-type")}`);

// batches filter used by the pickers
const act = await admin.api("GET", "/batches?limit=100&active=true");
ok("batches?active=true", act.s === 200 && act.j.items.every((b) => b.active), JSON.stringify(act).slice(0, 200));

// doubts: student asks, admin sees it
const d = await student.api("POST", "/doubts", { title: "Proxy doubt", text: "hello" });
ok("student creates doubt", d.s === 201, JSON.stringify(d));
const seen = await admin.api("GET", "/doubts?status=OPEN");
ok("admin sees it", seen.j.items.some((x) => x.id === d.j.id));

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
