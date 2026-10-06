// Creates a ready-to-take "Himachal Pradesh GK" practice test (25 questions) and what it needs to be visible:
// course, batch, subject/topic, a test series and one test student. Safe to run again: nothing is duplicated.
//
//   API_BASE=https://api.example.com ADMIN_PHONE=98.. ADMIN_PW=... [STUDENT_PW=...] node scripts/seed-hp-gk.mjs
const API = (process.env.API_BASE ?? 'http://localhost:3000').replace(/\/$/, '') + '/api';
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '9999999999';
const ADMIN_PW = process.env.ADMIN_PW ?? 'ChangeMe@123';
const STUDENT_PHONE = process.env.STUDENT_PHONE ?? '9000000001';
const STUDENT_PW = process.env.STUDENT_PW; // printed if generated

const NAMES = {
  course: 'Competitive Exams',
  batch: 'General Batch',
  subject: 'General Knowledge',
  topic: 'Himachal Pradesh',
  series: 'Himachal Pradesh GK Series',
  test: 'Himachal Pradesh GK: Practice Test 1',
};

// [question, [options], index of the correct one, difficulty, explanation]
const QUESTIONS = [
  ['What is the capital of Himachal Pradesh?', ['Dharamshala', 'Shimla', 'Solan', 'Mandi'], 1, 'EASY', 'Shimla is the capital. Dharamshala is the second (winter) capital.'],
  ['How many districts does Himachal Pradesh have?', ['10', '11', '12', '13'], 2, 'EASY', 'Himachal Pradesh has 12 districts.'],
  ['On which date did Himachal Pradesh become a full-fledged state of India?', ['15 April 1948', '26 January 1950', '1 November 1956', '25 January 1971'], 3, 'MEDIUM', 'It became the 18th state on 25 January 1971. 15 April 1948 is celebrated as Himachal Day.'],
  ['Who was the first Chief Minister of Himachal Pradesh?', ['Thakur Ram Lal', 'Dr. Yashwant Singh Parmar', 'Shanta Kumar', 'Virbhadra Singh'], 1, 'MEDIUM', 'Dr. Y. S. Parmar became the first Chief Minister in 1952 and is called the architect of Himachal Pradesh.'],
  ['Which is the largest district of Himachal Pradesh by area?', ['Chamba', 'Kinnaur', 'Lahaul and Spiti', 'Kangra'], 2, 'EASY', 'Lahaul and Spiti is the largest district by area.'],
  ['Which is the smallest district of Himachal Pradesh by area?', ['Hamirpur', 'Una', 'Bilaspur', 'Solan'], 0, 'MEDIUM', 'Hamirpur is the smallest district by area.'],
  ['Which is the longest river flowing through Himachal Pradesh?', ['Beas', 'Ravi', 'Satluj', 'Chenab'], 2, 'MEDIUM', 'The Satluj flows about 320 km inside Himachal Pradesh, more than any other river of the state.'],
  ['In which district is Gobind Sagar, the reservoir of the Bhakra Dam, mainly located?', ['Una', 'Bilaspur', 'Mandi', 'Solan'], 1, 'EASY', 'Gobind Sagar lies mainly in Bilaspur district, on the Satluj.'],
  ['The Pong Dam (Maharana Pratap Sagar) is built on which river?', ['Satluj', 'Ravi', 'Chenab', 'Beas'], 3, 'MEDIUM', 'Pong Dam is on the Beas, in Kangra district.'],
  ['From where does the river Beas originate?', ['Beas Kund', 'Lake Mansarovar', 'Baralacha La', 'Chandra Tal'], 0, 'HARD', 'The Beas rises at Beas Kund, near the Rohtang Pass.'],
  ['Through which pass does the Satluj enter Himachal Pradesh?', ['Rohtang Pass', 'Baralacha La', 'Shipki La', 'Kunzum Pass'], 2, 'HARD', 'The Satluj enters Himachal from Tibet at Shipki La, in Kinnaur.'],
  ['The Rohtang Pass connects the Kullu valley with which region?', ['Kinnaur', 'Lahaul and Spiti', 'Chamba', 'Kangra'], 1, 'EASY', 'Rohtang Pass links the Kullu valley with Lahaul and Spiti.'],
  ['What is the highest peak of Himachal Pradesh?', ['Reo Purgyil', 'Kinner Kailash', 'Manimahesh Kailash', 'Shrikhand Mahadev'], 0, 'HARD', 'Reo Purgyil in Kinnaur, about 6,816 m, is the highest peak of the state.'],
  ['Which is the state bird of Himachal Pradesh?', ['Himalayan Monal', 'Western Tragopan (Jujurana)', 'Indian Peafowl', 'Himalayan Griffon'], 1, 'MEDIUM', 'The Western Tragopan, locally called Jujurana, is the state bird. The Himalayan Monal is the state bird of Uttarakhand.'],
  ['Which is the state animal of Himachal Pradesh?', ['Snow Leopard', 'Musk Deer', 'Himalayan Tahr', 'Himalayan Black Bear'], 0, 'EASY', 'The Snow Leopard is the state animal.'],
  ['Where is the famous Kullu Dussehra celebrated?', ['Dhalpur Maidan', 'The Ridge', 'Paddal Ground', 'Gandhi Chowk'], 0, 'MEDIUM', 'Kullu Dussehra is held at Dhalpur Maidan and begins on Vijayadashami, lasting a week.'],
  ['Hadimba Devi Temple is located in which town?', ['Shimla', 'Kullu', 'Manali', 'Dalhousie'], 2, 'EASY', 'Hadimba Devi Temple is in Manali, in a cedar forest.'],
  ['In which district is the Jwalamukhi temple located?', ['Mandi', 'Kangra', 'Una', 'Hamirpur'], 1, 'EASY', 'Jwalamukhi temple is in Kangra district.'],
  ['Chail, home to one of the highest cricket grounds in the world, is in which district?', ['Shimla', 'Solan', 'Sirmaur', 'Kullu'], 1, 'MEDIUM', 'Chail is in Solan district; its ground is at about 2,444 m.'],
  ['Renuka Lake, the largest natural lake of Himachal Pradesh, is in which district?', ['Sirmaur', 'Chamba', 'Kullu', 'Lahaul and Spiti'], 0, 'MEDIUM', 'Renuka Lake is in Sirmaur district.'],
  ['The hot springs of Manikaran are located in which district?', ['Kinnaur', 'Chamba', 'Kullu', 'Shimla'], 2, 'MEDIUM', 'Manikaran lies in the Parvati valley of Kullu district.'],
  ['Tabo Monastery, founded in 996 AD, is located in which district?', ['Kinnaur', 'Lahaul and Spiti', 'Chamba', 'Kullu'], 1, 'MEDIUM', 'Tabo is in the Spiti valley of Lahaul and Spiti district.'],
  ['The Minjar fair is celebrated in which district?', ['Chamba', 'Kangra', 'Mandi', 'Sirmaur'], 0, 'MEDIUM', 'The Minjar fair is Chamba\'s best-known festival.'],
  ['In which year was the Kalka–Shimla Railway declared a UNESCO World Heritage Site?', ['1999', '2003', '2008', '2012'], 2, 'MEDIUM', 'In 2008, as part of the Mountain Railways of India.'],
  ['Who introduced apple cultivation to Himachal Pradesh, at Kotgarh?', ['Satyanand Stokes', 'Lord Curzon', 'William Moorcroft', 'Maharaja Ranjit Singh'], 0, 'MEDIUM', 'Satyanand Stokes (Samuel Evans Stokes) planted apples at Kotgarh, Shimla, around 1916.'],
];

let token = '';
async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}
const say = (m) => console.log('•', m);

// every answer position must be valid and exactly one option correct (the API also enforces it)
for (const [i, [, opts, correct]] of QUESTIONS.entries()) {
  if (!(correct >= 0 && correct < opts.length)) throw new Error(`question ${i + 1}: bad correct index`);
  if (new Set(opts).size !== opts.length) throw new Error(`question ${i + 1}: duplicate options`);
}
if (QUESTIONS.length !== 25) throw new Error('expected 25 questions');

const login = await call('POST', '/auth/login', { identifier: ADMIN_PHONE, password: ADMIN_PW, deviceId: 'seed-script', deviceName: 'seed', platform: 'WEB' });
token = login.accessToken;

// course + batch
const courses = await call('GET', '/courses?limit=100');
const course = courses.items.find((c) => c.name === NAMES.course) ?? (await call('POST', '/courses', { name: NAMES.course, description: 'Government and state competitive exam preparation' }));
const batches = await call('GET', '/batches?limit=100');
const batch = batches.items.find((b) => b.name === NAMES.batch && b.courseId === course.id)
  ?? (await call('POST', '/batches', { courseId: course.id, name: NAMES.batch, startDate: new Date().toISOString().slice(0, 10) }));
say(`course "${course.name}", batch "${batch.name}"`);

// subject + topic
const subjects = await call('GET', `/subjects?courseId=${course.id}`);
const subject = subjects.find((s) => s.name === NAMES.subject) ?? (await call('POST', '/subjects', { courseId: course.id, name: NAMES.subject }));
const topic = subject.topics?.find((t) => t.name === NAMES.topic) ?? (await call('POST', '/topics', { subjectId: subject.id, name: NAMES.topic }));

// questions: only the ones that are not in the bank yet
const existing = await call('GET', `/questions?topicId=${topic.id}&limit=100`);
const have = new Map(existing.items.map((q) => [q.text, q.id]));
const missing = QUESTIONS.filter(([text]) => !have.has(text));
if (missing.length) {
  await call('POST', '/questions/bulk', {
    questions: missing.map(([text, opts, correct, difficulty, explanation]) => ({
      topicId: topic.id,
      text,
      type: 'SINGLE',
      difficulty,
      explanation,
      options: opts.map((o, i) => ({ text: o, isCorrect: i === correct })),
    })),
  });
}
const bank = await call('GET', `/questions?topicId=${topic.id}&limit=100`);
const idOf = new Map(bank.items.map((q) => [q.text, q.id]));
say(`${missing.length} new questions added (${QUESTIONS.length} in the bank for this topic)`);

// series + test
const allSeries = await call('GET', '/test-series');
const series = allSeries.find((s) => s.name === NAMES.series) ?? (await call('POST', '/test-series', { name: NAMES.series, description: 'Practice tests on the history, geography, culture and polity of Himachal Pradesh', courseId: course.id }));
const tests = await call('GET', '/tests?limit=100');
let test = tests.items.find((t) => t.title === NAMES.test);
if (!test) {
  test = await call('POST', '/tests', { title: NAMES.test, courseId: course.id, seriesId: series.id, durationMin: 25, negativeMark: 0.25, shuffleOptions: true });
  await call('PUT', `/tests/${test.id}/questions`, { questions: QUESTIONS.map(([text]) => ({ questionId: idOf.get(text), marks: 1 })) });
  await call('PUT', `/tests/${test.id}/batches`, { batchIds: [batch.id] });
  test = await call('POST', `/tests/${test.id}/publish`);
  say(`test "${NAMES.test}" created and published (25 questions, 25 marks, 25 minutes, -0.25 per wrong answer)`);
} else {
  say(`test "${NAMES.test}" already exists (${test.status}), left as it is`);
}

// a student to try it with
const students = await call('GET', `/students?search=${STUDENT_PHONE}&limit=5`);
let studentLine = `student ${STUDENT_PHONE} already exists`;
if (!students.items.some((s) => s.user.phone === STUDENT_PHONE)) {
  const password = STUDENT_PW ?? `Dhi${Math.random().toString(36).slice(2, 8)}${Math.floor(1000 + Math.random() * 9000)}!`;
  await call('POST', '/students', { name: 'Test Student', phone: STUDENT_PHONE, password, status: 'ACTIVE', batchIds: [batch.id] });
  studentLine = `student created: phone ${STUDENT_PHONE}  password ${password}`;
}
say(studentLine);
console.log('\nDone.');
