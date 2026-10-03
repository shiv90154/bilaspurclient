import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/password.util.js';
import {
  PrismaClient,
  Role,
  StudentStatus,
  UserStatus,
} from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const env = (key: string, fallback: string) => process.env[key] || fallback;

async function upsertUser(data: {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: Role;
}) {
  const passwordHash = await hashPassword(data.password);
  return prisma.user.upsert({
    where: { phone: data.phone },
    update: { name: data.name, role: data.role, status: UserStatus.ACTIVE },
    create: {
      name: data.name,
      phone: data.phone,
      email: data.email?.toLowerCase(),
      passwordHash,
      role: data.role,
    },
  });
}

async function main() {
  const admin = await upsertUser({
    name: env('SEED_ADMIN_NAME', 'Admin'),
    phone: env('SEED_ADMIN_PHONE', '9999999999'),
    email: env('SEED_ADMIN_EMAIL', 'admin@example.com'),
    password: env('SEED_ADMIN_PASSWORD', 'ChangeMe@123'),
    role: Role.ADMIN,
  });
  console.log(`Admin ready: ${admin.phone}`);

  if (env('SEED_DEMO', 'false') !== 'true') return;

  // Demo data for local testing and for the Play Store reviewer account.
  const course = await prisma.course.upsert({
    where: { name: 'Demo Course' },
    update: {},
    create: { name: 'Demo Course', description: 'Sample course for testing' },
  });
  const batch = await prisma.batch.upsert({
    where: { courseId_name: { courseId: course.id, name: 'Demo Batch 2026' } },
    update: {},
    create: { courseId: course.id, name: 'Demo Batch 2026' },
  });
  const subject = await prisma.subject.upsert({
    where: { courseId_name: { courseId: course.id, name: 'Mathematics' } },
    update: {},
    create: { courseId: course.id, name: 'Mathematics' },
  });
  await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: subject.id, name: 'Algebra' } },
    update: {},
    create: { subjectId: subject.id, name: 'Algebra' },
  });

  const demoPassword = env('SEED_DEMO_PASSWORD', 'Demo@12345');

  const facultyUser = await upsertUser({
    name: 'Demo Faculty',
    phone: '9999999998',
    password: demoPassword,
    role: Role.FACULTY,
  });
  const faculty = await prisma.faculty.upsert({
    where: { userId: facultyUser.id },
    update: {},
    create: { userId: facultyUser.id, qualification: 'M.Sc. Mathematics' },
  });
  await prisma.facultySubject.upsert({
    where: {
      facultyId_subjectId: { facultyId: faculty.id, subjectId: subject.id },
    },
    update: {},
    create: { facultyId: faculty.id, subjectId: subject.id },
  });
  await prisma.facultyBatch.upsert({
    where: { facultyId_batchId: { facultyId: faculty.id, batchId: batch.id } },
    update: {},
    create: { facultyId: faculty.id, batchId: batch.id },
  });

  const studentUser = await upsertUser({
    name: 'Demo Student',
    phone: '9999999997',
    password: demoPassword,
    role: Role.STUDENT,
  });
  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: { status: StudentStatus.ACTIVE },
    create: {
      userId: studentUser.id,
      admissionNo: 'DEMO-0001',
      status: StudentStatus.ACTIVE,
    },
  });
  await prisma.studentBatch.upsert({
    where: { studentId_batchId: { studentId: student.id, batchId: batch.id } },
    update: {},
    create: { studentId: student.id, batchId: batch.id },
  });

  console.log('Demo data ready: faculty 9999999998, student 9999999997');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
