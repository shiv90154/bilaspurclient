// APK release upload/download through the real web proxy. Needs backend (:3000) + web (:3001), demo seed.
//   node scripts/smoke-apk.mjs [sizeMB]
const WEB = process.env.WEB_URL ?? "http://localhost:3001";
const SIZE_MB = Number(process.argv[2] ?? 60);
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

const admin = new Browser();
const student = new Browser();
ok("admin login", await admin.login("9999999999", "ChangeMe@123"));
ok("student login", await student.login("9999999997", "Demo@12345"));

const page = await admin.fetch("/mobile-app");
ok("/mobile-app renders for admin", page.status === 200, page.status);
const sp = await student.fetch("/mobile-app");
ok("student cannot open /mobile-app", sp.status >= 300 && sp.status < 400, sp.status);

const fakeApk = (mb) => {
  const buf = Buffer.alloc(mb * 1024 * 1024, 7);
  Buffer.from([0x50, 0x4b, 0x03, 0x04]).copy(buf); // zip signature, like a real APK
  return buf;
};
const version = `9.${Math.floor(Math.random() * 900) + 100}.0`;
const form = (file, name, v) => {
  const fd = new FormData();
  fd.append("file", new Blob([file]), name);
  fd.append("version", v);
  fd.append("notes", "smoke build");
  return fd;
};

let r = await admin.api("POST", "/app-releases", form(Buffer.from("MZ not an apk"), "evil.apk", version));
ok("non-zip content rejected (415)", r.s === 415, JSON.stringify(r));
r = await admin.api("POST", "/app-releases", form(fakeApk(1), "notapk.txt", version));
ok("wrong extension rejected (415)", r.s === 415, JSON.stringify(r));
r = await admin.api("POST", "/app-releases", form(fakeApk(1), "a.apk", "banana"));
ok("bad version rejected (400)", r.s === 400, JSON.stringify(r));
r = await student.api("POST", "/app-releases", form(fakeApk(1), "a.apk", version));
ok("student cannot upload (403)", r.s === 403, JSON.stringify(r));

const apk = fakeApk(SIZE_MB);
const t0 = Date.now();
r = await admin.api("POST", "/app-releases", form(apk, "app-release.apk", version));
ok(`upload ${SIZE_MB} MB via proxy (${((Date.now() - t0) / 1000).toFixed(1)}s)`, r.s === 201 && r.j.version === version, JSON.stringify(r));
const id = r.j?.id;
ok("storage key not leaked", !JSON.stringify(r.j).includes("fileKey"));

r = await admin.api("POST", "/app-releases", form(fakeApk(1), "a.apk", version));
ok("duplicate version -> 409", r.s === 409, JSON.stringify(r));
const failedUploadLeftovers = (await admin.api("GET", "/app-releases")).j.filter((x) => x.version === version).length;
ok("duplicate left only one row", failedUploadLeftovers === 1, failedUploadLeftovers);

r = await student.api("GET", `/app-releases/${id}/download-url`);
ok("student cannot get a download link (403)", r.s === 403, JSON.stringify(r));

r = await admin.api("GET", `/app-releases/${id}/download-url`);
ok("admin gets signed link", r.s === 200 && r.j.url.startsWith("/api/files/") && r.j.fileName === `DHI-${version}.apk`, JSON.stringify(r));
const res = await admin.fetch(r.j.url.replace(/^\/api\//, "/api/backend/"));
const got = Buffer.from(await res.arrayBuffer());
ok("download through proxy: 200, right size, byte-identical", res.status === 200 && got.length === apk.length && got.equals(apk), `${res.status} ${got.length}`);
ok("content-type is the Android package type", res.headers.get("content-type") === "application/vnd.android.package-archive", res.headers.get("content-type"));
ok("served as attachment with proper name", (res.headers.get("content-disposition") ?? "").includes(`attachment; filename="DHI-${version}.apk"`), res.headers.get("content-disposition"));

r = await admin.api("DELETE", `/app-releases/${id}`);
ok("delete", r.s === 200, JSON.stringify(r));
const after = await admin.fetch(r.j ? "/api/backend/app-releases" : "/");
ok("gone from the list", !(await after.json()).some((x) => x.id === id));

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
