/**
 * Demo data for showing the system to the client: 4 Ayurveda courses with batches, subjects, a question
 * bank, tests with results, live classes with attendance, notes (real PDFs), videos, doubts, fees with
 * receipts, enquiries and pending registrations.
 *
 *   npx tsx prisma/demo-data.ts seed     # adds it (refuses if it is already there)
 *   npx tsx prisma/demo-data.ts remove   # removes exactly what `seed` added; real data is never touched
 *
 * Everything created is listed in app_settings["demoData"], and `remove` deletes by that list. Demo
 * people are easy to spot: phones start with 70000 / 70001 / 70002, emails end in @demo.dhiayurved.com,
 * and nobody can log in as them (random passwords that are thrown away).
 */
import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/password.util.js';
import {
  AttemptStatus,
  ClassStatus,
  ClassType,
  ContentStatus,
  Difficulty,
  DoubtStatus,
  EnquiryStatus,
  FeeStatus,
  Gender,
  PaymentMode,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
  StudentStatus,
  TestStatus,
  VideoStatus,
} from '../src/generated/prisma/client.js';
import { CITIES, COURSES, DOUBTS, FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES, NOTES, QUESTIONS } from './demo/content.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const MANIFEST_KEY = 'demoData';
const EMAIL_DOMAIN = 'demo.dhiayurved.com';
const STORAGE_DIR = resolve(process.env.STORAGE_DIR ?? './storage');

interface Manifest {
  seededAt: string;
  courseIds: string[];
  userIds: string[];
  enquiryIds: string[];
  seriesIds: string[];
  activityIds: string[];
  storageKeys: string[];
}

// ───────────── small helpers ─────────────

/** Seeded random numbers, so every run produces the same data. */
let seed = 20261009;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)];
const chance = (p: number) => rnd() < p;
function shuffled<T>(list: readonly T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DAY = 86_400_000;
const NOW = new Date();
/** A time in India: `days` from today at hh:mm IST. */
function ist(days: number, hh: number, mm = 0) {
  const todayIst = new Date(NOW.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const base = new Date(`${todayIst}T00:00:00+05:30`).getTime();
  return new Date(base + days * DAY + (hh * 60 + mm) * 60_000);
}
const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

/** Same format as the API's receipts: DHI-YYYYMMDD-XXXXXXXX. */
function receiptNo(at: Date, paymentId: string) {
  const day = new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10).replace(/-/g, '');
  return `DHI-${day}-${paymentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** A plain text PDF (Helvetica, A4), enough for the in-app note viewer. */
function pdf(title: string, subtitle: string, paragraphs: string[]): Buffer {
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1');
  const wrap = (s: string, width: number) => {
    const out: string[] = [];
    let line = '';
    for (const word of s.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > width) {
        out.push(line);
        line = word;
      } else line = (line + ' ' + word).trim();
    }
    if (line) out.push(line);
    return out;
  };
  const pages: string[][] = [[]];
  let y = 760;
  const add = (cmd: string, height: number) => {
    if (y - height < 60) {
      pages.push([]);
      y = 780;
    }
    pages[pages.length - 1].push(cmd.replace('{Y}', String(y)));
    y -= height;
  };
  add(`BT /F2 20 Tf 0.12 0.30 0.17 rg 56 {Y} Td (${esc(title)}) Tj ET`, 26);
  add(`BT /F1 10 Tf 0.4 0.4 0.4 rg 56 {Y} Td (${esc(subtitle)}) Tj ET`, 30);
  for (const p of paragraphs) {
    for (const l of wrap(p, 92)) add(`BT /F1 11.5 Tf 0.1 0.1 0.1 rg 56 {Y} Td (${esc(l)}) Tj ET`, 17);
    y -= 9;
  }
  pages.forEach((p, i) => p.push(`BT /F1 9 Tf 0.5 0.5 0.5 rg 56 36 Td (DHI Ayurveda Classroom  |  dhiayurved.com  |  Page ${i + 1} of ${pages.length}) Tj ET`));

  const objs: string[] = [];
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((p, i) => {
    const stream = p.join('\n');
    objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objs[6 + i * 2] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let n = 1; n < objs.length; n++) {
    offsets[n] = Buffer.byteLength(out);
    out += `${n} 0 obj\n${objs[n]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objs.length; n++) out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ───────────── seed ─────────────

async function seedDemo() {
  if (await prisma.appSetting.findUnique({ where: { key: MANIFEST_KEY } })) {
    throw new Error('Demo data is already there. Run "remove" first if you want to seed it again.');
  }
  const taken = await prisma.course.findMany({ where: { name: { in: COURSES.map((c) => c.name) } }, select: { name: true } });
  if (taken.length) throw new Error(`These course names already exist: ${taken.map((c) => c.name).join(', ')}`);
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('No admin user found');

  const m: Manifest = { seededAt: NOW.toISOString(), courseIds: [], userIds: [], enquiryIds: [], seriesIds: [], activityIds: [], storageKeys: [] };
  // Save the list as we go: if anything fails half way, `remove` can still clean up.
  const saveManifest = () =>
    prisma.appSetting.upsert({
      where: { key: MANIFEST_KEY },
      create: { key: MANIFEST_KEY, value: m as unknown as Prisma.InputJsonValue, updatedById: admin.id },
      update: { value: m as unknown as Prisma.InputJsonValue },
    });
  await saveManifest();

  try {
    await build(m, admin.id);
  } finally {
    await saveManifest();
  }
}

async function build(m: Manifest, adminId: string) {
  const passwordHash = await hashPassword(randomBytes(24).toString('base64url')); // nobody knows it

  // ── faculty ──
  const FACULTY = [
    { name: 'Dr. Neha Sharma', qualification: 'MD (Kriya Sharir)', bio: 'Teaches Kriya Sharir, Rachana Sharir, Padartha Vigyan, Dravyaguna, Rasa Shastra and Samhita.', subjects: ['Kriya Sharir', 'Rachana Sharir', 'Padartha Vigyan', 'Dravyaguna', 'Rasa Shastra', 'Samhita'] },
    { name: 'Dr. Rahul Thakur', qualification: 'MD (Kayachikitsa)', bio: 'Teaches Kayachikitsa, Panchakarma, Shalya Tantra and Swasthavritta.', subjects: ['Kayachikitsa', 'Panchakarma', 'Shalya Tantra', 'Swasthavritta'] },
    { name: 'Dr. Anjali Verma', qualification: 'MS (Prasuti Tantra)', bio: 'Teaches Prasuti Tantra, Stri Roga and Kaumarbhritya.', subjects: ['Prasuti Tantra', 'Kaumarbhritya'] },
  ];
  const faculty: { id: string; userId: string; name: string; subjects: string[] }[] = [];
  for (const [i, f] of FACULTY.entries()) {
    const user = await prisma.user.create({
      data: {
        name: f.name,
        phone: `70001000${String(i + 1).padStart(2, '0')}`,
        email: `${f.name.toLowerCase().replace(/^dr\. /, '').replace(/\s+/g, '.')}@${EMAIL_DOMAIN}`,
        passwordHash,
        role: Role.FACULTY,
        createdAt: new Date(NOW.getTime() - 80 * DAY),
        faculty: { create: { qualification: f.qualification, bio: f.bio } },
      },
      include: { faculty: true },
    });
    m.userIds.push(user.id);
    faculty.push({ id: user.faculty!.id, userId: user.id, name: f.name, subjects: f.subjects });
  }
  const teacherOf = (subject: string) => faculty.find((f) => f.subjects.includes(subject)) ?? faculty[0];

  // ── courses, batches, subjects, topics, questions, fee plans ──
  interface CourseRow {
    key: string;
    id: string;
    name: string;
    batches: { id: string; name: string; start: Date }[];
    subjects: Map<string, { id: string; topics: Map<string, string> }>;
    questions: { id: string; subject: string; difficulty: Difficulty; options: { id: string; isCorrect: boolean }[] }[];
    planId: string;
    planTotal: number;
  }
  const courses: CourseRow[] = [];
  for (const c of COURSES) {
    const course = await prisma.course.create({
      data: {
        name: c.name,
        description: c.description,
        tagline: c.tagline,
        language: c.language,
        duration: c.duration,
        highlights: [...c.highlights],
        includes: [...c.includes],
        audience: [...c.audience],
        faqs: c.faqs.length ? (c.faqs as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        createdAt: new Date(NOW.getTime() - 90 * DAY),
      },
    });
    m.courseIds.push(course.id);
    const row: CourseRow = { key: c.key, id: course.id, name: c.name, batches: [], subjects: new Map(), questions: [], planId: '', planTotal: c.plan.total };

    for (const b of c.batches) {
      const batch = await prisma.batch.create({
        data: { courseId: course.id, name: b.name, startDate: new Date(b.start), endDate: new Date(b.end) },
      });
      row.batches.push({ id: batch.id, name: b.name, start: new Date(`${b.start}T00:00:00+05:30`) });
      const teachers = faculty.filter((f) => f.subjects.some((s) => (c.subjects as readonly string[]).includes(s)));
      await prisma.facultyBatch.createMany({ data: teachers.map((f) => ({ facultyId: f.id, batchId: batch.id })) });
    }

    for (const s of c.subjects) {
      const topicNames = new Set<string>([
        ...(QUESTIONS[s] ?? []).map((q) => q[0]),
        ...NOTES.filter((n) => n[0] === s).map((n) => n[1]),
      ]);
      const subject = await prisma.subject.create({
        data: { courseId: course.id, name: s, topics: { create: [...topicNames].map((name) => ({ name })) } },
        include: { topics: true },
      });
      row.subjects.set(s, { id: subject.id, topics: new Map(subject.topics.map((t) => [t.name, t.id])) });
      const teacher = teacherOf(s);
      await prisma.facultySubject.upsert({
        where: { facultyId_subjectId: { facultyId: teacher.id, subjectId: subject.id } },
        create: { facultyId: teacher.id, subjectId: subject.id },
        update: {},
      });

      for (const [topic, text, options, correct, difficulty, explanation] of QUESTIONS[s] ?? []) {
        const q = await prisma.question.create({
          data: {
            topicId: subject.topics.find((t) => t.name === topic)!.id,
            text,
            difficulty: difficulty as Difficulty,
            explanation,
            createdById: teacher.userId,
            createdAt: new Date(NOW.getTime() - int(30, 80) * DAY),
            options: { create: options.map((o, i) => ({ text: o, isCorrect: i === correct, position: i })) },
          },
          include: { options: { orderBy: { position: 'asc' } } },
        });
        row.questions.push({ id: q.id, subject: s, difficulty: q.difficulty, options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })) });
      }
    }

    const offer = 'offer' in c.plan ? c.plan.offer : null;
    const plan = await prisma.feePlan.create({
      data: {
        name: c.plan.name,
        courseId: course.id,
        batchId: row.batches[0].id,
        total: c.plan.total,
        mrp: 'mrp' in c.plan ? c.plan.mrp : null,
        offerPrice: offer?.price ?? null,
        offerLabel: offer?.label ?? null,
        offerEndsAt: offer ? new Date(offer.ends) : null,
        createdAt: new Date(NOW.getTime() - 85 * DAY),
      },
    });
    row.planId = plan.id;
    courses.push(row);
    console.log(`Course: ${c.name} (${row.questions.length} questions)`);
  }

  // ── students ──
  const SPLIT: [string, number, number][] = [
    ['aiapget', 0, 13],
    ['aiapget', 1, 7],
    ['amo', 0, 10],
    ['bams1', 0, 6],
    ['bamsfinal', 0, 4],
  ];
  interface StudentRow {
    id: string;
    userId: string;
    name: string;
    course: CourseRow;
    batchId: string;
    joinedAt: Date;
    ability: number; // 0..1, drives test scores and attendance
  }
  const students: StudentRow[] = [];
  const usedNames = new Set<string>();
  const personName = (female: boolean) => {
    for (;;) {
      const n = `${pick(female ? FIRST_NAMES_F : FIRST_NAMES_M)} ${pick(LAST_NAMES)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };
  let n = 0;
  for (const [key, batchIndex, count] of SPLIT) {
    const course = courses.find((c) => c.key === key)!;
    const batch = course.batches[batchIndex];
    for (let i = 0; i < count; i++) {
      n++;
      const female = chance(0.55);
      const name = personName(female);
      const joinedAt = new Date(Math.max(batch.start.getTime(), NOW.getTime() - int(20, 65) * DAY) + int(9, 19) * 3_600_000);
      const user = await prisma.user.create({
        data: {
          name,
          phone: `70000000${String(n).padStart(2, '0')}`,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}${n}@${EMAIL_DOMAIN}`,
          passwordHash,
          role: Role.STUDENT,
          createdAt: joinedAt,
          lastLoginAt: new Date(NOW.getTime() - int(1, 72) * 3_600_000),
          student: {
            create: {
              admissionNo: `DHI26-${String(100 + n)}`,
              gender: female ? Gender.FEMALE : Gender.MALE,
              dob: new Date(Date.UTC(int(1997, 2004), int(0, 11), int(1, 28))),
              city: pick(CITIES),
              address: `Ward ${int(1, 12)}, ${pick(CITIES)}, Himachal Pradesh`,
              guardianName: `${pick(FIRST_NAMES_M)} ${name.split(' ')[1]}`,
              guardianPhone: `70003000${String(n).padStart(2, '0')}`,
              status: StudentStatus.ACTIVE,
              createdAt: joinedAt,
              academic: {
                create: {
                  prevSchool: pick(['RGGPG Ayurvedic College, Paprola', 'Govt. Ayurvedic College, Patiala', 'Guru Nanak Ayurvedic College, Ludhiana', 'Shiva Ayurvedic College, Bilaspur', 'Himachal Ayurvedic College, Solan']),
                  prevClass: key === 'bams1' ? '12th (Medical)' : 'BAMS',
                  prevMarks: int(62, 88),
                  targetExam: key === 'aiapget' ? 'AIAPGET 2027' : key === 'amo' ? 'HPPSC AMO' : 'BAMS University Exam',
                },
              },
              batches: { create: { batchId: batch.id, joinedAt } },
            },
          },
        },
        include: { student: true },
      });
      m.userIds.push(user.id);
      students.push({ id: user.student!.id, userId: user.id, name, course, batchId: batch.id, joinedAt, ability: 0.35 + rnd() * 0.55 });
    }
  }
  console.log(`Students: ${students.length} active`);

  // Self-registered, waiting for approval (Registrations page).
  for (let i = 0; i < 5; i++) {
    n++;
    const female = chance(0.5);
    const name = personName(female);
    const course = courses[i % courses.length];
    const at = new Date(NOW.getTime() - int(2, 100) * 3_600_000);
    const user = await prisma.user.create({
      data: {
        name,
        phone: `70000000${String(n).padStart(2, '0')}`,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}${n}@${EMAIL_DOMAIN}`,
        passwordHash,
        role: Role.STUDENT,
        emailVerifiedAt: at,
        createdAt: at,
        student: {
          create: {
            gender: female ? Gender.FEMALE : Gender.MALE,
            city: pick(CITIES),
            status: StudentStatus.PENDING,
            registeredVia: i % 2 ? 'WEB' : 'APP',
            requestedCourseId: course.id,
            createdAt: at,
          },
        },
      },
    });
    m.userIds.push(user.id);
  }

  // ── fees and payments ──
  let paidCount = 0;
  for (const [i, s] of students.entries()) {
    const roll = i % 20;
    const offerJoin = s.course.key === 'aiapget' && i % 5 === 0; // joined during the Diwali offer
    const discount = offerJoin ? 3000 : 0;
    const due = s.course.planTotal - discount;
    const status = roll < 12 ? FeeStatus.PAID : roll < 17 ? FeeStatus.PARTIAL : FeeStatus.PENDING;
    const feeAt = minutes(s.joinedAt, int(5, 60 * 48));
    const fee = await prisma.studentFee.create({
      data: { studentId: s.id, planId: s.course.planId, total: s.course.planTotal, discount, status, createdAt: feeAt },
    });
    const amounts = status === FeeStatus.PAID ? (chance(0.35) ? [Math.round(due / 2), due - Math.round(due / 2)] : [due]) : status === FeeStatus.PARTIAL ? [Math.round(due / 2)] : [];
    for (const [k, amount] of amounts.entries()) {
      const at = new Date(Math.min(NOW.getTime() - 3_600_000, feeAt.getTime() + k * int(15, 30) * DAY));
      const mode = pick([PaymentMode.UPI, PaymentMode.UPI, PaymentMode.CASH, PaymentMode.RAZORPAY, PaymentMode.BANK_TRANSFER]);
      const id = randomUUID();
      const online = mode === PaymentMode.RAZORPAY;
      await prisma.payment.create({
        data: {
          id,
          studentFeeId: fee.id,
          amount,
          mode,
          status: PaymentStatus.PAID,
          receiptNo: receiptNo(at, id),
          razorpayOrderId: online ? `order_demo${id.slice(0, 8)}` : null,
          razorpayPaymentId: online ? `pay_demo${id.slice(0, 8)}` : null,
          notes: online ? null : mode === PaymentMode.CASH ? 'Paid at the institute' : mode === PaymentMode.UPI ? `UPI ref ${int(100000, 999999)}${int(100000, 999999)}` : 'NEFT',
          approvedById: online ? null : adminId,
          approvedAt: at,
          createdAt: at,
        },
      });
      paidCount++;
    }
  }
  console.log(`Payments: ${paidCount}`);

  // ── test series and tests with results ──
  interface TestPlan {
    course: string;
    title: string;
    count: number;
    marks: number;
    negative: number;
    duration: number;
    window: [number, number] | null; // days from today: start, end (null = always open)
    status: TestStatus;
    takers: number; // share of students who attempted
    subjects?: string[];
    isDemo?: boolean;
  }
  const TESTS: TestPlan[] = [
    { course: 'aiapget', title: 'AIAPGET Mock Test 1: Full Syllabus', count: 40, marks: 4, negative: 1, duration: 60, window: [-24, -22], status: TestStatus.CLOSED, takers: 0.9 },
    { course: 'aiapget', title: 'AIAPGET Mock Test 2: Full Syllabus', count: 40, marks: 4, negative: 1, duration: 60, window: [-10, -8], status: TestStatus.CLOSED, takers: 0.85 },
    { course: 'aiapget', title: 'Weekly Test: Kriya and Rachana Sharir', count: 25, marks: 4, negative: 1, duration: 30, window: [-1, 2], status: TestStatus.PUBLISHED, takers: 0.45, subjects: ['Kriya Sharir', 'Rachana Sharir'] },
    { course: 'aiapget', title: 'AIAPGET Mock Test 3: Full Syllabus', count: 40, marks: 4, negative: 1, duration: 60, window: [5, 7], status: TestStatus.PUBLISHED, takers: 0 },
    { course: 'amo', title: 'AMO Practice Test 1', count: 30, marks: 1, negative: 0.25, duration: 40, window: [-15, -13], status: TestStatus.CLOSED, takers: 0.9 },
    { course: 'amo', title: 'AMO Grand Test', count: 40, marks: 1, negative: 0.25, duration: 50, window: [7, 8], status: TestStatus.PUBLISHED, takers: 0 },
    { course: 'bams1', title: 'Unit Test: Padartha Vigyan and Kriya Sharir', count: 20, marks: 1, negative: 0, duration: 25, window: [-8, -6], status: TestStatus.CLOSED, takers: 1, subjects: ['Padartha Vigyan', 'Kriya Sharir'] },
    { course: 'bams1', title: 'Free Demo Test: Ayurveda Basics', count: 10, marks: 1, negative: 0, duration: 15, window: null, status: TestStatus.PUBLISHED, takers: 0.5, isDemo: true },
    { course: 'bamsfinal', title: 'Unit Test: Shalya Tantra', count: 13, marks: 1, negative: 0, duration: 20, window: [-6, -4], status: TestStatus.CLOSED, takers: 1, subjects: ['Shalya Tantra'] },
  ];
  const seriesByCourse = new Map<string, string>();
  let attemptCount = 0;
  for (const t of TESTS) {
    const course = courses.find((c) => c.key === t.course)!;
    let seriesId = seriesByCourse.get(course.key);
    if (!seriesId) {
      const series = await prisma.testSeries.create({ data: { name: `${course.name}: Test Series`, description: 'Mock and unit tests for this course.', courseId: course.id } });
      seriesId = series.id;
      seriesByCourse.set(course.key, seriesId);
      m.seriesIds.push(seriesId);
    }
    const pool = shuffled(course.questions.filter((q) => !t.subjects || t.subjects.includes(q.subject)));
    const qs = pool.slice(0, Math.min(t.count, pool.length));
    const startAt = t.window ? ist(t.window[0], 9) : null;
    const endAt = t.window ? ist(t.window[1], 21) : null;
    const test = await prisma.test.create({
      data: {
        title: t.title,
        courseId: course.id,
        seriesId,
        durationMin: t.duration,
        totalMarks: qs.length * t.marks,
        negativeMark: t.negative,
        shuffleQuestions: true,
        shuffleOptions: true,
        isDemo: t.isDemo ?? false,
        startAt,
        endAt,
        status: t.status,
        createdById: teacherOf(qs[0]?.subject ?? '').userId,
        createdAt: new Date((startAt ?? NOW).getTime() - 5 * DAY),
        questions: { create: qs.map((q, i) => ({ questionId: q.id, marks: t.marks, position: i })) },
        batches: { create: course.batches.map((b) => ({ batchId: b.id })) },
      },
    });

    // Results: abler students answer more and get more right.
    const takers = students.filter((s) => s.course === course && chance(t.takers));
    for (const s of takers) {
      const begin = startAt && endAt
        ? new Date(startAt.getTime() + rnd() * Math.max(0, Math.min(endAt.getTime(), NOW.getTime()) - startAt.getTime() - t.duration * 60_000))
        : new Date(s.joinedAt.getTime() + int(1, 5) * DAY);
      let score = 0;
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;
      const answers: Prisma.AttemptAnswerCreateManyInput[] = [];
      const attemptId = randomUUID();
      for (const [i, q] of qs.entries()) {
        const bump = q.difficulty === Difficulty.EASY ? 0.12 : q.difficulty === Difficulty.HARD ? -0.15 : 0;
        if (!chance(0.55 + s.ability * 0.45)) {
          unanswered++;
          continue;
        }
        const right = chance(Math.min(0.97, Math.max(0.1, s.ability + bump)));
        const option = right ? q.options.find((o) => o.isCorrect)! : pick(q.options.filter((o) => !o.isCorrect));
        if (right) {
          correct++;
          score += t.marks;
        } else {
          incorrect++;
          score -= t.negative;
        }
        answers.push({ attemptId, questionId: q.id, selectedOptionIds: [option.id], answeredAt: minutes(begin, Math.round(((i + 1) / qs.length) * t.duration * 0.85)) });
      }
      const total = qs.length * t.marks;
      await prisma.attempt.create({
        data: {
          id: attemptId,
          testId: test.id,
          studentId: s.id,
          status: AttemptStatus.SUBMITTED,
          startedAt: begin,
          submittedAt: minutes(begin, Math.round(t.duration * (0.6 + rnd() * 0.38))),
          score: +score.toFixed(2),
          percentage: +Math.max(0, (score / total) * 100).toFixed(2),
          correct,
          incorrect,
          unanswered,
        },
      });
      await prisma.attemptAnswer.createMany({ data: answers });
      attemptCount++;
    }
  }
  console.log(`Tests: ${TESTS.length}, attempts: ${attemptCount}`);

  // ── live classes with attendance ──
  let classCount = 0;
  for (const course of courses) {
    const subjects = [...course.subjects.keys()];
    for (const [bi, batch] of course.batches.entries()) {
      const weekend = batch.name.includes('Weekend');
      const [hh, mm] = course.key === 'aiapget' && !weekend ? [7, 30] : weekend ? [10, 0] : [17, 0];
      const members = students.filter((s) => s.batchId === batch.id);
      // Days with a class: the last 4 weeks and the next 2 (weekdays, or Sat/Sun for the weekend batch).
      const days: number[] = [];
      for (let d = -28; d <= 14; d++) {
        const weekday = ist(d, 12).getUTCDay(); // 0 = Sunday
        const ok = weekend ? weekday === 0 || weekday === 6 : course.key === 'aiapget' ? weekday >= 1 && weekday <= 5 : [1, 3, 5].includes(weekday);
        if (ok && ist(d, hh, mm) >= new Date(batch.start.getTime())) days.push(d);
      }
      for (const [k, d] of days.entries()) {
        const subject = subjects[(k + bi) % subjects.length];
        const topics = [...course.subjects.get(subject)!.topics.keys()];
        const topic = topics[k % topics.length];
        const startAt = ist(d, hh, mm);
        const endAt = minutes(startAt, 90);
        const past = endAt < NOW;
        const cancelled = past && k % 13 === 7;
        const cls = await prisma.liveClass.create({
          data: {
            batchId: batch.id,
            facultyId: teacherOf(subject).id,
            title: `${subject}: ${topic}`,
            type: ClassType.ZOOM,
            startAt,
            endAt,
            joinUrl: `https://meet.google.com/${['dhi', 'ayr', 'cls'][k % 3]}-${String(1000 + k).slice(-4)}-${course.key.slice(0, 3)}`,
            status: cancelled ? ClassStatus.CANCELLED : past ? ClassStatus.ENDED : ClassStatus.SCHEDULED,
            reminderSentAt: past ? minutes(startAt, -10) : null,
            createdById: teacherOf(subject).userId,
            createdAt: minutes(startAt, -3 * 24 * 60),
          },
        });
        classCount++;
        if (past && !cancelled) {
          const present = members.filter((s) => s.joinedAt < startAt && chance(0.55 + s.ability * 0.4));
          await prisma.classAttendance.createMany({
            data: present.map((s) => {
              const joined = minutes(startAt, int(0, 12));
              const stay = int(45, 90);
              return { classId: cls.id, studentId: s.id, joinedAt: joined, leftAt: minutes(joined, stay), durationSec: stay * 60 };
            }),
          });
        }
      }
    }
  }
  console.log(`Live classes: ${classCount}`);

  // ── notes (real PDFs) and recorded lectures ──
  await mkdir(STORAGE_DIR, { recursive: true });
  let noteCount = 0;
  for (const course of courses) {
    const batchIds = course.batches.map((b) => b.id);
    const members = students.filter((s) => s.course === course);
    for (const [subject, topic, title, paragraphs] of NOTES) {
      const sub = course.subjects.get(subject);
      if (!sub) continue;
      const bytes = pdf(title, `${subject}  |  ${course.name}  |  Prepared by ${teacherOf(subject).name}`, paragraphs);
      const key = `${randomUUID()}.pdf`;
      await writeFile(resolve(STORAGE_DIR, key), bytes, { flag: 'wx' });
      m.storageKeys.push(key);
      const createdAt = new Date(NOW.getTime() - int(3, 40) * DAY);
      const material = await prisma.material.create({
        data: {
          title,
          description: `Short notes on ${topic} for quick revision.`,
          subjectId: sub.id,
          topicId: sub.topics.get(topic) ?? null,
          fileKey: key,
          fileName: `${title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`,
          fileType: 'application/pdf',
          size: bytes.length,
          isDemo: course.key === 'bams1' && subject === 'Padartha Vigyan',
          status: ContentStatus.PUBLISHED,
          uploadedById: teacherOf(subject).userId,
          createdAt,
          versions: { create: { version: 1, fileKey: key, size: bytes.length, createdAt } },
          batches: { create: batchIds.map((batchId) => ({ batchId })) },
        },
      });
      const views: Prisma.MaterialViewCreateManyInput[] = [];
      for (const s of members) {
        for (let v = 0; v < (chance(0.3 + s.ability * 0.5) ? int(1, 4) : 0); v++) {
          views.push({ materialId: material.id, studentId: s.id, viewedAt: new Date(createdAt.getTime() + rnd() * (NOW.getTime() - createdAt.getTime())) });
        }
      }
      await prisma.materialView.createMany({ data: views });
      noteCount++;
    }

    const VIDEOS = [...course.subjects.keys()].slice(0, 3).map((subject, i) => ({
      subject,
      title: `${subject}: Revision lecture ${i + 1}`,
      durationSec: int(35, 80) * 60,
    }));
    for (const v of VIDEOS) {
      const sub = course.subjects.get(v.subject)!;
      const video = await prisma.video.create({
        data: {
          title: v.title,
          description: 'Recorded lecture from the Ayurveda Classroom YouTube channel.',
          subjectId: sub.id,
          durationSec: v.durationSec,
          status: VideoStatus.READY,
          externalUrl: 'https://youtube.com/@ayurveda-classroom',
          uploadedById: teacherOf(v.subject).userId,
          createdAt: new Date(NOW.getTime() - int(5, 30) * DAY),
          batches: { create: batchIds.map((batchId) => ({ batchId })) },
        },
      });
      await prisma.videoProgress.createMany({
        data: members
          .filter(() => chance(0.6))
          .map((s) => {
            const pct = int(10, 100);
            return { videoId: video.id, studentId: s.id, watchedPct: pct, lastPositionSec: Math.round((v.durationSec * pct) / 100) };
          }),
      });
    }
  }
  console.log(`Notes: ${noteCount}`);

  // ── doubts ──
  for (const [i, [subject, title, question, reply, resolved]] of DOUBTS.entries()) {
    const course = courses.find((c) => c.subjects.has(subject) && c.key !== 'aiapget' && i % 3 === 0) ?? courses.find((c) => c.subjects.has(subject))!;
    const asker = pick(students.filter((s) => s.course === course));
    const teacher = teacherOf(subject);
    const askedAt = new Date(NOW.getTime() - int(4, 240) * 3_600_000);
    const repliedAt = minutes(askedAt, int(30, 600));
    const status = !reply ? (i % 2 ? DoubtStatus.ASSIGNED : DoubtStatus.OPEN) : resolved ? DoubtStatus.RESOLVED : DoubtStatus.ANSWERED;
    const messages: Prisma.DoubtMessageCreateWithoutDoubtInput[] = [{ sender: { connect: { id: asker.userId } }, text: question, createdAt: askedAt }];
    if (reply) messages.push({ sender: { connect: { id: teacher.userId } }, text: reply, createdAt: repliedAt });
    if (reply && resolved) messages.push({ sender: { connect: { id: asker.userId } }, text: 'Thank you sir, clear now.', createdAt: minutes(repliedAt, int(10, 120)) });
    await prisma.doubt.create({
      data: {
        studentId: asker.id,
        batchId: asker.batchId,
        subjectId: course.subjects.get(subject)!.id,
        title,
        status,
        assignedToId: status === DoubtStatus.OPEN ? null : teacher.userId,
        createdAt: askedAt,
        resolvedAt: status === DoubtStatus.RESOLVED ? minutes(repliedAt, 120) : null,
        messages: { create: messages },
      },
    });
  }
  console.log(`Doubts: ${DOUBTS.length}`);

  // ── enquiries ──
  const SOURCES = ['Website', 'Instagram', 'YouTube', 'WhatsApp', 'Walk-in', 'Reference'];
  const ENQUIRY_STATUS: [EnquiryStatus, number | null, string][] = [
    [EnquiryStatus.NEW, null, 'Asked about the batch timings.'],
    [EnquiryStatus.NEW, null, 'Wants to know if the classes are recorded.'],
    [EnquiryStatus.NEW, null, 'Enquired from the website form.'],
    [EnquiryStatus.NEW, null, 'Asked about the fee and the Diwali offer.'],
    [EnquiryStatus.CONTACTED, 2, 'Called, sent the course details on WhatsApp.'],
    [EnquiryStatus.CONTACTED, 3, 'Called, will discuss with parents.'],
    [EnquiryStatus.CONTACTED, 5, 'Sent the demo test link.'],
    [EnquiryStatus.FOLLOW_UP, 0, 'Call back today evening about joining.'],
    [EnquiryStatus.FOLLOW_UP, -1, 'Interested in the weekend batch; follow up.'],
    [EnquiryStatus.FOLLOW_UP, 1, 'Will pay after the result of the 4th Prof exam.'],
    [EnquiryStatus.FOLLOW_UP, 4, 'Asked for an installment option.'],
    [EnquiryStatus.CONVERTED, null, 'Joined the course.'],
    [EnquiryStatus.CONVERTED, null, 'Joined after the demo class.'],
    [EnquiryStatus.LOST, null, 'Joined another institute.'],
    [EnquiryStatus.LOST, null, 'Not reachable after three calls.'],
  ];
  const converted = shuffled(students).slice(0, 2);
  for (const [i, [status, followUp, notes]] of ENQUIRY_STATUS.entries()) {
    const female = chance(0.5);
    const isConverted = status === EnquiryStatus.CONVERTED;
    const student = isConverted ? converted[i % 2] : null;
    const name = student?.name ?? personName(female);
    const createdAt = student ? minutes(student.joinedAt, -int(2, 6) * 24 * 60) : new Date(NOW.getTime() - int(1, 30) * DAY);
    const e = await prisma.enquiry.create({
      data: {
        name,
        phone: `70002000${String(i + 1).padStart(2, '0')}`,
        email: chance(0.6) ? `${name.toLowerCase().replace(/\s+/g, '.')}.enq@${EMAIL_DOMAIN}` : null,
        courseInterestId: (student?.course ?? pick(courses)).id,
        source: pick(SOURCES),
        status,
        followUpDate: followUp === null ? null : ist(followUp, 0),
        notes,
        assignedToId: status === EnquiryStatus.NEW ? null : adminId,
        convertedStudentId: student?.id ?? null,
        createdAt,
      },
    });
    m.enquiryIds.push(e.id);
  }

  // ── recent activity on the dashboard ──
  const ACTIVITY: [string, string, string | null][] = [
    ['class.create', 'live-class', faculty[0].userId],
    ['material.create', 'material', faculty[0].userId],
    ['doubt.resolve', 'doubt', faculty[1].userId],
    ['test.publish', 'test', faculty[0].userId],
    ['payment.offline', 'payment', adminId],
    ['question.create', 'question', faculty[1].userId],
    ['class.create', 'live-class', faculty[1].userId],
    ['payment.online', 'payment', null],
    ['material.create', 'material', faculty[2].userId],
    ['doubt.resolve', 'doubt', faculty[0].userId],
    ['enquiry.update', 'enquiry', adminId],
    ['test.create', 'test', faculty[1].userId],
  ];
  for (const [i, [action, entity, actorId]] of ACTIVITY.entries()) {
    const a = await prisma.activityLog.create({
      data: { action, entity, actorId, meta: { demo: true }, createdAt: new Date(NOW.getTime() - (i * 3 + int(0, 2)) * 3_600_000) },
    });
    m.activityIds.push(a.id);
  }
  console.log('Done.');
}

// ───────────── remove ─────────────

async function removeDemo(force: boolean) {
  const row = await prisma.appSetting.findUnique({ where: { key: MANIFEST_KEY } });
  if (!row) {
    console.log('No demo data found (nothing to remove).');
    return;
  }
  const m = row.value as unknown as Manifest;
  const courseIds = m.courseIds;
  const userIds = m.userIds;
  const batches = await prisma.batch.findMany({ where: { courseId: { in: courseIds } }, select: { id: true } });
  const batchIds = batches.map((b) => b.id);
  const tests = await prisma.test.findMany({ where: { OR: [{ courseId: { in: courseIds } }, { seriesId: { in: m.seriesIds } }] }, select: { id: true } });
  const testIds = tests.map((t) => t.id);
  const demoStudents = await prisma.student.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const studentIds = demoStudents.map((s) => s.id);

  // Safety: real students or real tests tied to demo courses would lose data. Stop and say what.
  const realStudent = { studentId: { notIn: studentIds } };
  const [enrolled, fees, attempts, doubts, realTestsWithDemoQs] = await Promise.all([
    prisma.studentBatch.count({ where: { batchId: { in: batchIds }, ...realStudent } }),
    prisma.studentFee.count({ where: { plan: { courseId: { in: courseIds } }, ...realStudent } }),
    prisma.attempt.count({ where: { testId: { in: testIds }, ...realStudent } }),
    prisma.doubt.count({ where: { batchId: { in: batchIds }, ...realStudent } }),
    prisma.testQuestion.count({ where: { question: { topic: { subject: { courseId: { in: courseIds } } } }, testId: { notIn: testIds } } }),
  ]);
  const problems = [
    enrolled && `${enrolled} real student(s) are in demo batches`,
    fees && `${fees} real fee record(s) are on demo course fees`,
    attempts && `${attempts} real test attempt(s) are on demo tests`,
    doubts && `${doubts} real doubt(s) are in demo batches`,
    realTestsWithDemoQs && `${realTestsWithDemoQs} question(s) from the demo bank are used in other tests`,
  ].filter(Boolean);
  if (problems.length && !force) {
    throw new Error(`Not removing, real data is linked to the demo courses:\n- ${problems.join('\n- ')}\nMove that data first, or run "remove --force" to delete it too.`);
  }

  const del = async (label: string, p: Promise<{ count: number }>) => console.log(`${label}: ${(await p).count}`);
  const feeWhere = { OR: [{ plan: { courseId: { in: courseIds } } }, { studentId: { in: studentIds } }] };
  await del('activity', prisma.activityLog.deleteMany({ where: { OR: [{ id: { in: m.activityIds } }, { actorId: { in: userIds } }] } }));
  await del('payments', prisma.payment.deleteMany({ where: { studentFee: feeWhere } }));
  await del('student fees', prisma.studentFee.deleteMany({ where: feeWhere }));
  await del('fee plans', prisma.feePlan.deleteMany({ where: { courseId: { in: courseIds } } }));
  await del('attempts', prisma.attempt.deleteMany({ where: { OR: [{ testId: { in: testIds } }, { studentId: { in: studentIds } }] } }));
  await del('test questions', prisma.testQuestion.deleteMany({ where: { question: { topic: { subject: { courseId: { in: courseIds } } } } } }));
  await del('tests', prisma.test.deleteMany({ where: { id: { in: testIds } } }));
  await del('test series', prisma.testSeries.deleteMany({ where: { id: { in: m.seriesIds } } }));
  await del('doubt messages by demo people', prisma.doubtMessage.deleteMany({ where: { senderId: { in: userIds } } }));
  await del('doubts', prisma.doubt.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { batchId: { in: batchIds } }] } }));
  await del('live classes', prisma.liveClass.deleteMany({ where: { batchId: { in: batchIds } } }));

  const materials = await prisma.material.findMany({
    where: { subject: { courseId: { in: courseIds } } },
    select: { fileKey: true, versions: { select: { fileKey: true } } },
  });
  await del('notes', prisma.material.deleteMany({ where: { subject: { courseId: { in: courseIds } } } }));
  await del('videos', prisma.video.deleteMany({ where: { subject: { courseId: { in: courseIds } } } }));
  await del('questions', prisma.question.deleteMany({ where: { topic: { subject: { courseId: { in: courseIds } } } } }));
  await del('enquiries', prisma.enquiry.deleteMany({ where: { id: { in: m.enquiryIds } } }));
  await del('people (students, faculty)', prisma.user.deleteMany({ where: { id: { in: userIds } } }));
  await del('batches', prisma.batch.deleteMany({ where: { id: { in: batchIds } } }));
  await del('subjects', prisma.subject.deleteMany({ where: { courseId: { in: courseIds } } }));
  await del('courses', prisma.course.deleteMany({ where: { id: { in: courseIds } } }));

  const keys = new Set([...m.storageKeys, ...materials.flatMap((x) => [x.fileKey, ...x.versions.map((v) => v.fileKey)])]);
  for (const key of keys) {
    if (/^[0-9a-f-]{36}\.pdf$/.test(key)) await rm(resolve(STORAGE_DIR, key), { force: true });
  }
  console.log(`files: ${keys.size}`);
  await prisma.appSetting.delete({ where: { key: MANIFEST_KEY } });
  console.log('Demo data removed.');
}

const [cmd, flag] = process.argv.slice(2);
const run = cmd === 'seed' ? seedDemo() : cmd === 'remove' ? removeDemo(flag === '--force') : Promise.reject(new Error('Usage: demo-data.ts seed | remove [--force]'));
run
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
