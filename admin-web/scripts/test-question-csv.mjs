// Unit checks for the bulk-import CSV parser:  node scripts/test-question-csv.mjs
import { parseCsv, parseQuestions, TEMPLATE } from "../src/lib/question-csv.ts";

let fail = 0;
const ok = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + JSON.stringify(x))); if (!c) fail++; };
const subjects = [
  { id: "s1", name: "Physics", topics: [{ id: "t1", subjectId: "s1", name: "Kinematics" }] },
  { id: "s2", name: "Chemistry", topics: [] },
];
const run = (csv) => parseQuestions(parseCsv(csv), subjects);

// parser basics
ok("quoted commas and doubled quotes", JSON.stringify(parseCsv('a,"b,c","say ""hi"""\n1,2,3')) === JSON.stringify([["a", "b,c", 'say "hi"'], ["1", "2", "3"]]));
ok("line break inside quotes stays in the cell", parseCsv('a,"x\ny"\nb,c')[0][1] === "x\ny");
ok("CRLF and a BOM are handled", JSON.stringify(parseCsv("﻿a,b\r\n1,2\r\n")) === JSON.stringify([["a", "b"], ["1", "2"]]));
ok("blank lines are ignored", parseCsv("a,b\n\n\n1,2\n").length === 2);

// the shipped template must itself import cleanly
const t = run(TEMPLATE);
ok("the downloadable template has no errors", t.errors.length === 0 && t.questions.length === 2, t.errors);
ok("template: single answer B", t.questions[0].type === "SINGLE" && t.questions[0].options.filter((o) => o.isCorrect).map((o) => o.text).join() === "4 m/s²", t.questions[0]);
ok('template: "A,C" makes it a multiple-answer question', t.questions[1].type === "MULTIPLE" && t.questions[1].options.filter((o) => o.isCorrect).length === 2, t.questions[1]);
ok("template: unknown topic is allowed (it is created on import)", t.questions[1].topic === "Atomic Structure");

const head = "subject,topic,question,option_a,option_b,option_c,option_d,correct,difficulty,explanation\n";
// validation
let r = run(head + "Maths,Algebra,Q,1,2,3,4,A,,");
ok("unknown subject is reported with its row", r.errors.length === 1 && /Maths/.test(r.errors[0].message) && r.errors[0].line === 2, r.errors);
r = run(head + "Physics,Kinematics,Q,only one,,,,A,,");
ok("fewer than two options is an error", /at least two/.test(r.errors[0]?.message ?? ""), r.errors);
r = run(head + "Physics,Kinematics,Q,1,2,,,C,,");
ok("a correct letter pointing at an empty option is an error", /does not match/.test(r.errors[0]?.message ?? ""), r.errors);
r = run(head + "Physics,Kinematics,Q,1,2,3,4,,,");
ok("empty correct column is an error", /correct column is empty/.test(r.errors[0]?.message ?? ""), r.errors);
r = run(head + "Physics,Kinematics,Q,1,2,3,4,A,impossible,");
ok("bad difficulty is an error", /Difficulty/.test(r.errors[0]?.message ?? ""), r.errors);
r = run(head + ",Kinematics,Q,1,2,3,4,A,,");
ok("missing subject is an error", /required/.test(r.errors[0]?.message ?? ""), r.errors);

// leniency that real spreadsheets need
r = run(head + "physics,Kinematics,Q,1,2,3,4,b,EASY,");
ok("subject and letters are case-insensitive; difficulty parsed", r.errors.length === 0 && r.questions[0].subject === "Physics" && r.questions[0].difficulty === "EASY" && r.questions[0].options[1].isCorrect, r);
r = run(head + "Physics,Kinematics,Q,1,,3,4,C,,");
ok("a blank middle option keeps the letters aligned (C is still the third)", r.questions[0].options.map((o) => o.text).join() === "1,3,4" && r.questions[0].options[1].isCorrect, r);
r = run(head + "Physics,Kinematics,Q,1,2,3,4, a ; c ,,");
ok("A;C and spaces work for several answers", r.questions[0]?.type === "MULTIPLE", r);

// structure
r = run("subject,topic,question\nPhysics,Kinematics,Q");
ok("missing option/correct columns gives one clear message", r.errors.length === 1 && /option_a/.test(r.errors[0].message), r.errors);
r = parseQuestions([], subjects);
ok("empty file is an error", r.errors.length === 1, r);
const many = head + Array.from({ length: 2001 }, () => "Physics,Kinematics,Q,1,2,3,4,A,,").join("\n");
r = run(many);
ok("more than 2000 rows is refused", r.errors.length === 1 && /Too many/.test(r.errors[0].message), r.errors[0]);
r = run(head + "Physics,Kinematics,Good,1,2,3,4,A,,\nPhysics,Kinematics,Bad,1,,,,A,,\nPhysics,Kinematics,Good2,1,2,3,4,B,,");
ok("good rows survive next to a bad one", r.questions.length === 2 && r.errors.length === 1 && r.errors[0].line === 3, r);

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
