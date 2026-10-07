/** Browser-side API client. Calls go through the same-origin proxy (/api/backend/*). */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401 && typeof window !== "undefined") {
    // Full reload on purpose: it also drops every cached query of the dead session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : (body.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, body.code, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Builds "?a=1&b=2" skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ───────────── response shapes (mirror the backend) ─────────────

export interface Course {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  _count?: { batches: number };
}

export interface Batch {
  id: string;
  courseId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  course?: { id: string; name: string };
  _count?: { students: number };
}

export type StudentStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "COMPLETED" | "DROPPED";

export interface StudentRow {
  id: string;
  admissionNo: string | null;
  status: StudentStatus;
  city: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string; email: string | null };
  batches: { status: string; batch: { id: string; name: string; course: { id: string; name: string } } }[];
}

export type EnquiryStatus = "NEW" | "CONTACTED" | "FOLLOW_UP" | "CONVERTED" | "LOST";

export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  status: EnquiryStatus;
  followUpDate: string | null;
  notes: string | null;
  convertedStudentId: string | null;
  courseInterest: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
}

export interface DashboardSummary {
  role: "ADMIN" | "FACULTY";
  counts: Record<string, number>;
  recentActivity?: {
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actor: { id: string; name: string } | null;
  }[];
}

/** Multipart upload (files). The browser sets the boundary; do not set content-type. */
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api/backend${path}`, { method: "POST", body: form });
  if (res.status === 401 && typeof window !== "undefined") {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : (body.message ?? `Upload failed (${res.status})`);
    throw new ApiError(res.status, undefined, message);
  }
  return (await res.json()) as T;
}

/** Signed file links come back as /api/files/...; browsers reach them through the proxy. */
export const fileHref = (url: string) => url.replace(/^\/api\//, "/api/backend/");

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
}
export interface Subject {
  id: string;
  courseId: string;
  name: string;
  course?: { id: string; name: string };
  topics: Topic[];
}

export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionType = "SINGLE" | "MULTIPLE";
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  explanation: string | null;
  active: boolean;
  /** Signed link to the question's picture (valid for an hour), or null. */
  imageUrl: string | null;
  topic: { id: string; name: string; subject: { id: string; name: string } };
  options: { id: string; text: string; isCorrect: boolean; position: number }[];
}

export type TestStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export interface TestRow {
  id: string;
  title: string;
  durationMin: number;
  totalMarks: string | number;
  negativeMark: string | number;
  startAt: string | null;
  endAt: string | null;
  status: TestStatus;
  isDemo?: boolean;
  course: { id: string; name: string } | null;
  series?: { id: string; name: string } | null;
  _count: { questions: number; attempts: number; batches: number };
}
export interface TestSeries {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  _count?: { tests: number };
}
export interface TestDetail extends Omit<TestRow, "_count"> {
  _count: { attempts: number };
  batches: { batch: { id: string; name: string } }[];
  questions: {
    questionId: string;
    marks: string | number;
    position: number;
    question: { id: string; text: string; type: QuestionType; difficulty: Difficulty; topic: { id: string; name: string } };
  }[];
}
export interface TestResults {
  test: { id: string; title: string; totalMarks: number };
  summary: { attempts: number; average: number; highest: number; lowest: number };
  rows: {
    rank: number;
    attemptId: string;
    name: string;
    phone: string;
    score: number;
    percentage: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    backgroundHits: number;
    status: string;
    timeTakenSec: number | null;
  }[];
}

export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export interface Material {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  size: number;
  allowDownload: boolean;
  isDemo: boolean;
  version: number;
  status: ContentStatus;
  updatedAt: string;
  subject: { id: string; name: string } | null;
  topic: { id: string; name: string } | null;
  batches: { batch: { id: string; name: string } }[];
}

export type DoubtStatus = "OPEN" | "ASSIGNED" | "ANSWERED" | "RESOLVED";
export interface DoubtRow {
  id: string;
  title: string;
  status: DoubtStatus;
  updatedAt: string;
  classTimestamp: number | null;
  student: { id: string; user: { name: string; phone: string } };
  subject: { id: string; name: string } | null;
  topic: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  _count: { messages: number };
}
export interface DoubtDetail extends DoubtRow {
  messages: { id: string; text: string | null; createdAt: string; sender: { id: string; name: string; role: string } }[];
}
export interface FacultyRow {
  id: string;
  userId: string;
  user: { name: string; phone: string };
}

export type ClassStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
export interface ClassRow {
  id: string;
  batchId: string;
  title: string;
  type: "ZOOM" | "OWN_LIVE" | "PREMIERE";
  startAt: string;
  endAt: string;
  status: ClassStatus;
  seriesId: string | null;
  /** Only present for staff. Students get it from /classes/:id/join. */
  joinUrl?: string | null;
  batch: { id: string; name: string };
  faculty: { id: string; user: { name: string } } | null;
}
export interface ClassAttendance {
  expected: number;
  attended: number;
  present: { studentId: string; name: string; phone: string; joinedAt: string; durationSec: number }[];
  absent: { studentId: string; name: string; phone: string }[];
}

/** Institute-wide switches (admin only). */
export interface AppSettings {
  watermarkEnabled: boolean;
  blockDeveloperOptions: boolean;
  instituteName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

export type DeletionRequestStatus = "PENDING" | "COMPLETED" | "REJECTED";
export interface DeletionRequestRow {
  id: string;
  name: string;
  phone: string;
  reason: string | null;
  source: "APP" | "WEB";
  status: DeletionRequestStatus;
  note: string | null;
  createdAt: string;
  handledAt: string | null;
  user: { id: string; role: string; student: { id: string; admissionNo: string | null } | null } | null;
}

export type DocumentType = "PHOTO" | "ID_PROOF" | "MARKSHEET" | "OTHER";
export interface StudentDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface StudentRecords {
  summary: {
    testsTaken: number;
    averagePercentage: number | null;
    classesHeld: number;
    classesAttended: number;
    attendancePercentage: number | null;
    doubtsAsked: number;
    doubtsOpen: number;
    materialsOpened: number;
    materialViews: number;
  };
  tests: {
    attemptId: string;
    testId: string;
    title: string;
    status: string;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    totalMarks: number;
    percentage: number | null;
    correct: number;
    incorrect: number;
    unanswered: number;
  }[];
  attendance: { classId: string; title: string; batch: string; startAt: string; present: boolean; joinedAt: string | null }[];
  doubts: { id: string; title: string; status: DoubtStatus; subject: string | null; messages: number; createdAt: string; resolvedAt: string | null }[];
}

/** A plain link to a CSV route through the proxy; the browser downloads it with the session cookie. */
export const csvHref = (path: string, params: Record<string, string | number | boolean | undefined | null> = {}) =>
  `/api/backend${path}${qs(params)}`;
