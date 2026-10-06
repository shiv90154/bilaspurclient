// Question edit/images/import and test series through the real web proxy.
// Needs backend (:3000) + web (:3001), demo seed:  node scripts/smoke-tests-ui.mjs
import { parseCsv, parseQuestions, TEMPLATE } from "../src/lib/question-csv.ts";

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

const admin = new Browser();
ok("admin login", await admin.login("9999999999", "ChangeMe@123"));
for (const p of ["/question-bank", "/tests"]) {
  const r = await admin.fetch(p);
  ok(`${p} renders`, r.status === 200, r.status);
}

const stamp = Date.now();
const courseId = (await admin.api("GET", "/courses")).j.items[0].id;
const subj = (await admin.api("POST", "/subjects", { courseId, name: "ImportSubj" + stamp })).j;
const subjects = (await admin.api("GET", "/subjects")).j;

// Bulk import exactly like the browser does it: parse the CSV, create the topic, post the questions.
const csv = [
  "subject,topic,question,option_a,option_b,option_c,option_d,correct,difficulty,explanation",
  `ImportSubj${stamp},Waves,"What is, a wave?",A,B,C,D,B,easy,because`,
  `ImportSubj${stamp},Waves,Pick two,w,x,y,z,"A,C",hard,`,
].join("\n");
const parsed = parseQuestions(parseCsv(csv), subjects);
ok("CSV parses cleanly (quoted comma kept)", parsed.errors.length === 0 && parsed.questions.length === 2 && parsed.questions[0].text === "What is, a wave?", JSON.stringify(parsed.errors));
const topic = (await admin.api("POST", "/topics", { subjectId: subj.id, name: "Waves" })).j;
const imp = await admin.api("POST", "/questions/bulk", { questions: parsed.questions.map((q) => ({ topicId: topic.id, text: q.text, type: q.type, difficulty: q.difficulty, explanation: q.explanation, options: q.options })) });
ok("bulk import through the proxy", imp.s === 201 && imp.j.created === 2, JSON.stringify(imp));
const list = await admin.api("GET", `/questions?topicId=${topic.id}&limit=10`);
ok("imported questions are in the bank with the right answers", list.j.items.length === 2 && list.j.items.some((q) => q.type === "MULTIPLE" && q.options.filter((o) => o.isCorrect).length === 2), JSON.stringify(list.j).slice(0, 200));

// Edit + picture through the proxy (multipart must survive the BFF)
const q = list.j.items.find((x) => x.type === "SINGLE");
const edit = await admin.api("PATCH", `/questions/${q.id}`, { text: "What is a wave? (edited)", difficulty: "HARD", options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) });
ok("edit a question", edit.s === 200 && edit.j.text.includes("edited") && edit.j.difficulty === "HARD", JSON.stringify(edit));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const fd = new FormData(); fd.append("file", new Blob([PNG], { type: "image/png" }), "figure.png");
const up = await admin.api("POST", `/questions/${q.id}/image`, fd);
ok("upload a picture through the proxy", up.s === 201 && up.j.imageUrl, JSON.stringify(up));
const img = await admin.fetch(up.j.imageUrl.replace(/^\/api\//, "/api/backend/"));
ok("the picture loads in the browser path", img.status === 200 && img.headers.get("content-type") === "image/png", `${img.status} ${img.headers.get("content-type")}`);
const noImg = new FormData(); noImg.append("file", new Blob([Buffer.from("hello")], { type: "image/png" }), "x.png");
const bad = await admin.api("POST", `/questions/${q.id}/image`, noImg);
ok("a fake image is refused", bad.s === 415, JSON.stringify(bad));
const rm = await admin.api("DELETE", `/questions/${q.id}/image`);
ok("remove the picture", rm.s === 200 && rm.j.imageUrl === null, JSON.stringify(rm));

// Series through the proxy
const s1 = await admin.api("POST", "/test-series", { name: "UI series " + stamp });
ok("create a series", s1.s === 201, JSON.stringify(s1));
const t = await admin.api("POST", "/tests", { title: "UI series test", durationMin: 20, seriesId: s1.j.id });
ok("create a test in the series", t.s === 201 && t.j.seriesId === s1.j.id, JSON.stringify(t));
const got = await admin.api("GET", `/tests/${t.j.id}`);
ok("test detail returns the series name", got.j.series?.name === s1.j.name, JSON.stringify(got.j.series));
const mv = await admin.api("PATCH", `/tests/${t.j.id}`, { seriesId: null });
ok("move the test out of the series", mv.s === 200 && mv.j.seriesId === null, JSON.stringify(mv));
await admin.api("DELETE", `/tests/${t.j.id}`);
await admin.api("PATCH", `/test-series/${s1.j.id}`, { active: false });

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
