// Smoke test for the web BFF. Needs backend (:3000) and admin-web (:3001) running
// with the demo seed:  node scripts/smoke-web.mjs
const WEB = process.env.WEB_URL ?? "http://localhost:3001";
const API = process.env.API_URL ?? "http://localhost:3000/api";
let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log("  PASS", name);
  } else {
    fail++;
    console.log("  FAIL", name, extra);
  }
}

/** Tiny cookie jar: keeps the latest value of every cookie the server sets. */
class Browser {
  jar = new Map();
  async fetch(path, init = {}) {
    const headers = new Headers(init.headers);
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.set("cookie", cookie);
    if (init.method && init.method !== "GET" && !headers.has("origin")) {
      headers.set("origin", WEB);
    }
    const res = await fetch(WEB + path, { ...init, headers, redirect: "manual" });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [name, value] = pair.split("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (expired || value === "") this.jar.delete(name.trim());
      else this.jar.set(name.trim(), value);
    }
    return res;
  }
}

const json = (obj) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj),
});
const location = (res) => res.headers.get("location") ?? "";

console.log("1. unauthenticated visitor");
{
  const b = new Browser();
  let r = await b.fetch("/dashboard");
  check("/dashboard -> redirect to /login", r.status >= 300 && r.status < 400 && location(r).includes("/login"), `${r.status} ${location(r)}`);
  r = await b.fetch("/api/backend/auth/me");
  check("/api/backend/auth/me without cookie -> 401", r.status === 401, String(r.status));
  r = await b.fetch("/login");
  check("/login renders", r.status === 200);
}

console.log("2. admin login");
const admin = new Browser();
{
  let r = await admin.fetch("/api/session/login", json({ identifier: "9999999999", password: "wrong-password" }));
  check("wrong password -> 401 INVALID_CREDENTIALS", r.status === 401 && (await r.json()).code === "INVALID_CREDENTIALS");

  r = await admin.fetch("/api/session/login", { ...json({ identifier: "9999999999", password: "ChangeMe@123", deviceId: "web-test-admin" }), headers: { "content-type": "application/json", origin: "https://evil.example" } });
  check("login from foreign Origin -> 403 (CSRF)", r.status === 403 && !admin.jar.has("em_access"), String(r.status));

  r = await admin.fetch("/api/session/login", json({ identifier: "9999999999", password: "ChangeMe@123", deviceId: "web-test-admin" }));
  const body = await r.json();
  check("correct login -> 200 with user, no tokens in body", r.status === 200 && body.user?.role === "ADMIN" && !("accessToken" in body), JSON.stringify(body));
  check("httpOnly cookies set", admin.jar.has("em_access") && admin.jar.has("em_refresh"));

  r = await admin.fetch("/");
  check("/ -> redirect to /dashboard", location(r).endsWith("/dashboard"), `${r.status} ${location(r)}`);
  r = await admin.fetch("/dashboard");
  let html = await r.text();
  check("/dashboard renders for admin", r.status === 200 && html.includes("Dashboard") && html.includes("Question Bank"));
  r = await admin.fetch("/fees");
  check("/fees allowed for admin", r.status === 200);
  r = await admin.fetch("/learn");
  check("admin on student area -> redirect to /dashboard", location(r).endsWith("/dashboard"), `${r.status} ${location(r)}`);
  r = await admin.fetch("/login");
  check("logged-in user on /login -> redirect away", r.status >= 300 && location(r).endsWith("/dashboard"), `${r.status} ${location(r)}`);

  r = await admin.fetch("/api/backend/auth/me");
  check("proxy /auth/me -> 200 as ADMIN", r.status === 200 && (await r.json()).role === "ADMIN");
  r = await admin.fetch("/api/backend/health");
  check("proxy /health -> 200", r.status === 200 && (await r.json()).db === "up");
  r = await admin.fetch("/api/backend/..%2Fetc");
  check("path traversal attempt rejected", r.status === 400 || r.status === 404, String(r.status));
  r = await admin.fetch("/api/backend/auth/logout", { method: "POST", headers: { origin: "https://evil.example" } });
  check("proxy POST from foreign Origin -> 403", r.status === 403, String(r.status));
}

console.log("3. access token expiry -> transparent refresh");
{
  admin.jar.delete("em_access"); // simulate an expired access cookie
  const before = admin.jar.get("em_refresh");
  // fire several requests in parallel: must share ONE refresh (no theft detection)
  const results = await Promise.all([1, 2, 3, 4].map(() => admin.fetch("/api/backend/auth/me")));
  check("4 parallel requests all -> 200", results.every((r) => r.status === 200), results.map((r) => r.status).join(","));
  check("refresh token rotated", admin.jar.get("em_refresh") && admin.jar.get("em_refresh") !== before);
  const r = await admin.fetch("/api/backend/auth/me");
  check("session still valid afterwards", r.status === 200);

  admin.jar.delete("em_access");
  const page = await admin.fetch("/dashboard");
  check("server component with expired access -> redirect to refresh route", location(page).includes("/api/session/refresh"), `${page.status} ${location(page)}`);
  const refreshed = await admin.fetch(location(page).replace(WEB, ""));
  check("refresh route -> redirects back to /dashboard", location(refreshed).endsWith("/dashboard"), `${refreshed.status} ${location(refreshed)}`);
  const again = await admin.fetch("/dashboard");
  check("/dashboard renders after refresh", again.status === 200);
}

console.log("4. student: role routing + one-device rule across web and API");
const student = new Browser();
{
  let r = await student.fetch("/api/session/login", json({ identifier: "9999999997", password: "Demo@12345", deviceId: "web-test-student" }));
  check("student web login -> 200", r.status === 200 && (await r.json()).user.role === "STUDENT");
  r = await student.fetch("/");
  check("/ -> redirect to /learn", location(r).endsWith("/learn"), `${r.status} ${location(r)}`);
  r = await student.fetch("/learn");
  const html = await r.text();
  check("/learn renders with Android-only notice", r.status === 200 && html.includes("Android app"));
  r = await student.fetch("/dashboard");
  check("student on admin area -> redirect to /learn", location(r).endsWith("/learn"), `${r.status} ${location(r)}`);
  r = await student.fetch("/api/backend/users/x/devices");
  check("student calling admin API -> 403", r.status === 403, String(r.status));

  // student logs in on a phone through the API directly -> web session is replaced
  const phone = await fetch(`${API}/auth/login`, json({ identifier: "9999999997", password: "Demo@12345", deviceId: "android-test", platform: "ANDROID" }));
  check("same student logs in on Android -> 200", phone.status === 200, String(phone.status));
  r = await student.fetch("/api/backend/auth/me");
  const body = await r.json();
  check("web session now -> 401 SESSION_REPLACED", r.status === 401 && body.code === "SESSION_REPLACED", JSON.stringify(body));
  check("cookies cleared after session loss", !student.jar.has("em_access"));
  r = await student.fetch("/learn");
  check("web page now -> redirect to /login", location(r).includes("/login"), `${r.status} ${location(r)}`);
}

console.log("5. logout");
{
  let r = await admin.fetch("/api/session/logout", { method: "POST" });
  check("logout -> 204", r.status === 204, String(r.status));
  check("cookies cleared", !admin.jar.has("em_access") && !admin.jar.has("em_refresh"));
  r = await admin.fetch("/dashboard");
  check("/dashboard after logout -> /login", location(r).includes("/login"), `${r.status} ${location(r)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
