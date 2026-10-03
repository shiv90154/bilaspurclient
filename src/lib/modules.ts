/** Placeholder content for panel pages that are not built yet. Source of truth: ../../../docs */

export interface ModuleInfo {
  title: string;
  phase: string;
  doc: string;
  summary: string;
  scope: string[];
}

export const MODULES = {
  students: {
    title: "Students",
    phase: "Phase 1",
    doc: "docs/01-student-management.md",
    summary: "Register students, manage profiles, batches, documents and status.",
    scope: [
      "Registration, profile, contact and academic details",
      "Course / batch assignment",
      "Status: pending, active, inactive, completed, dropped",
      "Documents upload",
      "Search and filter, student-wise records, CSV export",
    ],
  },
  enquiries: {
    title: "Enquiries",
    phase: "Phase 1",
    doc: "docs/01-student-management.md",
    summary: "Track enquiries and follow-ups, then convert them into students.",
    scope: ["Enquiry list with status", "Follow-up dates and reminders", "Convert enquiry to student"],
  },
  courses: {
    title: "Courses & Batches",
    phase: "Phase 1",
    doc: "docs/01-student-management.md",
    summary: "Courses, batches and which faculty and students belong to them.",
    scope: ["Course CRUD", "Batch CRUD with dates", "Assign students and faculty to batches"],
  },
  "question-bank": {
    title: "Question Bank",
    phase: "Phase 2",
    doc: "docs/02-question-bank.md",
    summary: "MCQs organised by course, subject and topic, with answer keys.",
    scope: [
      "Single and multiple-correct MCQs with images",
      "Subject / topic / difficulty",
      "Explanations and answer keys",
      "Bulk import from CSV",
    ],
  },
  tests: {
    title: "Tests",
    phase: "Phase 2",
    doc: "docs/02-question-bank.md",
    summary: "Build timed tests with negative marking and see results and analysis.",
    scope: [
      "Test builder: manual or topic-based random",
      "Duration, marks, negative marking, shuffle, schedule",
      "Auto evaluation and percentage",
      "Correct / incorrect / unanswered analysis and leaderboard",
    ],
  },
  materials: {
    title: "Study Material",
    phase: "Phase 2",
    doc: "docs/04-notes-study-material.md",
    summary: "Upload notes subject- and chapter-wise with batch access control.",
    scope: [
      "PDF upload with versions and replacement",
      "Batch-wise access, download permission control",
      "Viewed only inside the Android app (screen protected, watermarked)",
    ],
  },
  videos: {
    title: "Recorded Lectures",
    phase: "Phase 2–3",
    doc: "docs/11-recorded-lectures.md",
    summary: "Upload lectures, protect playback and run a recording as a scheduled live class.",
    scope: [
      "Upload with transcoding status",
      "Batch-wise access and progress tracking",
      "Premiere: play a recorded lecture as a live class",
    ],
  },
  classes: {
    title: "Online Classes",
    phase: "Phase 3",
    doc: "docs/03-online-classes.md",
    summary: "Schedule Zoom/Meet classes and premieres, with reminders and attendance.",
    scope: [
      "One-time and recurring classes",
      "Reschedule / cancel with notifications",
      "Faculty clash check and attendance",
    ],
  },
  doubts: {
    title: "Doubts",
    phase: "Phase 2",
    doc: "docs/05-student-doubts.md",
    summary: "Inbox of student doubts: assign, reply and track status.",
    scope: ["Inbox with filters", "Threaded replies with images", "Status: open, assigned, answered, resolved"],
  },
  fees: {
    title: "Fees",
    phase: "Website only",
    doc: "docs/12-website-fees-payments.md",
    summary: "Fee plans, ledger, Razorpay payments and admin approval. Not part of the Android app.",
    scope: [
      "Fee plans and installments",
      "Razorpay online payments and offline entries",
      "Approval queue, receipts and reports",
    ],
  },
  roles: {
    title: "Roles & Access",
    phase: "Phase 1",
    doc: "docs/06-role-based-access.md",
    summary: "Faculty accounts, permissions and student device management.",
    scope: [
      "Faculty CRUD and subject / batch scope",
      "Permission overview for admin, faculty and student",
      "Student devices: history and reset (one-device rule)",
    ],
  },
} satisfies Record<string, ModuleInfo>;

export type ModuleKey = keyof typeof MODULES;
