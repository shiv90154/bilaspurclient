"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  api,
  csvHref,
  qs,
  type Batch,
  type Paginated,
  type StudentStatus,
  type TestResults,
  type TestRow,
} from "@/lib/api";
import { Badge, btnGhost, ErrorNote, Field, inputCls, PageHeader } from "@/components/ui";

type Tab = "attendance" | "tests" | "students" | "enquiries" | "materials";

interface AttendanceReport {
  summary: { classes: number; averagePercentage: number };
  rows: { classId: string; title: string; startAt: string; batch: string; teacher: string | null; expected: number; attended: number; percentage: number }[];
}
interface StudentAttendanceReport {
  batch: { id: string; name: string };
  classes: number;
  rows: { studentId: string; admissionNo: string | null; name: string; phone: string; held: number; attended: number; percentage: number }[];
}
interface EnquiryReport {
  summary: { total: number; converted: number; conversion: number };
  byStatus: { status: string; count: number }[];
  bySource: { name: string; total: number; converted: number; conversion: number }[];
  byCourse: { name: string; total: number; converted: number; conversion: number }[];
}
interface MaterialReport {
  summary: { materials: number; views: number };
  rows: { materialId: string; title: string; subject: string | null; batches: string; views: number; students: number; lastViewedAt: string | null }[];
}

const STATUSES: StudentStatus[] = ["PENDING", "ACTIVE", "INACTIVE", "COMPLETED", "DROPPED"];
const when = (d: string | null) => (d ? format(new Date(d), "d MMM yyyy, h:mm a") : "—");
const tone = (p: number) => (p >= 75 ? "green" : p >= 50 ? "amber" : "red");

export function ReportsView({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>("attendance");
  const tabs: { id: Tab; label: string }[] = [
    { id: "attendance", label: "Attendance" },
    { id: "tests", label: "Test results" },
    { id: "students", label: "Student list" },
    ...(isAdmin ? [{ id: "enquiries" as const, label: "Enquiries" }] : []),
    { id: "materials", label: "Study material" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Reports" subtitle="Numbers you can check here or download as CSV (opens in Excel)" />
      <div role="tablist" aria-label="Reports" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold sm:px-4 ${
              tab === t.id ? "border-primary text-primary-dark" : "border-transparent text-sub hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "attendance" && <AttendanceReportPanel />}
        {tab === "tests" && <TestReportPanel />}
        {tab === "students" && <StudentListPanel />}
        {tab === "enquiries" && isAdmin && <EnquiryReportPanel />}
        {tab === "materials" && <MaterialReportPanel />}
      </div>
    </div>
  );
}

function useBatches() {
  return useQuery({
    queryKey: ["batches", "all"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
  });
}

function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <>
      <Field label="From">{(i) => <input id={i} type="date" value={from} onChange={(e) => onFrom(e.target.value)} className={inputCls} />}</Field>
      <Field label="To">{(i) => <input id={i} type="date" value={to} onChange={(e) => onTo(e.target.value)} className={inputCls} />}</Field>
    </>
  );
}

function CsvButton({ href }: { href: string }) {
  return (
    <a className={btnGhost} href={href} download>
      <Download size={15} /> Download CSV
    </a>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="px-4 py-8 text-center text-sub">{text}</td></tr>;
}

const th = "px-4 py-2.5";
const td = "px-4 py-2.5";

function AttendanceReportPanel() {
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = { batchId, from, to };
  const classes = useQuery({
    queryKey: ["report-attendance", params],
    queryFn: () => api<AttendanceReport>(`/reports/attendance${qs(params)}`),
  });
  const students = useQuery({
    queryKey: ["report-attendance-students", params],
    queryFn: () => api<StudentAttendanceReport>(`/reports/attendance/students${qs(params)}`),
    enabled: !!batchId,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Batch">
          {(i) => (
            <select id={i} value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputCls}>
              <option value="">All batches</option>
              {batches.data?.items.map((b) => <option key={b.id} value={b.id}>{b.course?.name} · {b.name}</option>)}
            </select>
          )}
        </Field>
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      {batchId && (
        <Card
          title={`Student-wise${students.data ? ` · ${students.data.classes} classes` : ""}`}
          action={<CsvButton href={csvHref("/reports/attendance/students/csv", params)} />}
        >
          <ErrorNote error={students.error} />
          <div className="overflow-x-auto">
            <table className="rtable w-full min-w-[560px] text-left text-[13px]">
              <thead className="border-y border-line text-[11.5px] uppercase tracking-wide text-sub">
                <tr><th className={th}>Student</th><th className={th}>Phone</th><th className={th}>Held</th><th className={th}>Attended</th><th className={th}>Attendance</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.data?.rows.map((r) => (
                  <tr key={r.studentId}>
                    <td className={td + " font-semibold"}>{r.name}{r.admissionNo && <span className="block text-[12px] font-normal text-sub">{r.admissionNo}</span>}</td>
                    <td data-label="Phone" className={td}>{r.phone}</td>
                    <td data-label="Held" className={td}>{r.held}</td>
                    <td data-label="Attended" className={td}>{r.attended}</td>
                    <td data-label="Attendance" className={td}><Badge tone={r.held ? tone(r.percentage) : "gray"}>{r.held ? `${r.percentage}%` : "No classes"}</Badge></td>
                  </tr>
                ))}
                {students.data?.rows.length === 0 && <Empty cols={5} text="No students in this batch." />}
                {students.isPending && <Empty cols={5} text="Loading…" />}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title={`Class-wise${classes.data ? ` · ${classes.data.summary.classes} classes · average ${classes.data.summary.averagePercentage}%` : ""}`}
        action={<CsvButton href={csvHref("/reports/attendance/csv", params)} />}
      >
        <ErrorNote error={classes.error} />
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-y border-line text-[11.5px] uppercase tracking-wide text-sub">
              <tr><th className={th}>Class</th><th className={th}>When</th><th className={th}>Batch</th><th className={th}>Joined</th><th className={th}>Attendance</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {classes.data?.rows.map((r) => (
                <tr key={r.classId}>
                  <td className={td + " font-semibold"}>{r.title}{r.teacher && <span className="block text-[12px] font-normal text-sub">{r.teacher}</span>}</td>
                  <td data-label="When" className={td + " text-sub"}>{when(r.startAt)}</td>
                  <td data-label="Batch" className={td}>{r.batch}</td>
                  <td data-label="Joined" className={td}>{r.attended} / {r.expected}</td>
                  <td data-label="Attendance" className={td}><Badge tone={tone(r.percentage)}>{r.percentage}%</Badge></td>
                </tr>
              ))}
              {classes.data?.rows.length === 0 && <Empty cols={5} text="No classes held in this period." />}
              {classes.isPending && <Empty cols={5} text="Loading…" />}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TestReportPanel() {
  const [testId, setTestId] = useState("");
  const tests = useQuery({
    queryKey: ["tests", "report-picker"],
    queryFn: () => api<Paginated<TestRow>>(`/tests${qs({ limit: 100 })}`),
  });
  const result = useQuery({
    queryKey: ["report-test", testId],
    queryFn: () => api<TestResults>(`/reports/tests/${testId}`),
    enabled: !!testId,
  });
  const withAttempts = tests.data?.items.filter((t) => t._count.attempts > 0) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-md">
        <Field label="Test">
          {(i) => (
            <select id={i} value={testId} onChange={(e) => setTestId(e.target.value)} className={inputCls}>
              <option value="">Choose a test…</option>
              {withAttempts.map((t) => <option key={t.id} value={t.id}>{t.title} ({t._count.attempts} attempts)</option>)}
            </select>
          )}
        </Field>
        {tests.data && withAttempts.length === 0 && <p className="mt-2 text-[12.5px] text-sub">No test has been attempted yet.</p>}
      </div>
      <ErrorNote error={tests.error ?? result.error} />
      {result.data && (
        <Card
          title={`${result.data.test.title} · ${result.data.summary.attempts} students · average ${result.data.summary.average} / ${result.data.test.totalMarks}`}
          action={<CsvButton href={csvHref(`/reports/tests/${testId}/csv`)} />}
        >
          <div className="overflow-x-auto">
            <table className="rtable w-full min-w-[640px] text-left text-[13px]">
              <thead className="border-y border-line text-[11.5px] uppercase tracking-wide text-sub">
                <tr><th className={th}>Student</th><th className={th}>Rank</th><th className={th}>Score</th><th className={th}>%</th><th className={th}>Right / wrong / skipped</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.rows.map((r) => (
                  <tr key={r.attemptId}>
                    <td className={td + " font-semibold"}>{r.name}<span className="block text-[12px] font-normal text-sub">{r.phone}</span></td>
                    <td data-label="Rank" className={td}>#{r.rank}</td>
                    <td data-label="Score" className={td}>{r.score} / {result.data.test.totalMarks}</td>
                    <td data-label="%" className={td}><Badge tone={tone(r.percentage)}>{r.percentage}%</Badge></td>
                    <td data-label="Right / wrong / skipped" className={td + " text-sub"}>{r.correct} / {r.incorrect} / {r.unanswered}</td>
                  </tr>
                ))}
                {result.data.rows.length === 0 && <Empty cols={5} text="Nobody has submitted this test yet." />}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StudentListPanel() {
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState("");
  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div>
        <h2 className="text-[15px] font-bold">Student list</h2>
        <p className="mt-1 text-[12.5px] text-sub">
          Every student with contact, guardian, batches, academic details, registration date and last login.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Batch">
          {(i) => (
            <select id={i} value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputCls}>
              <option value="">All batches</option>
              {batches.data?.items.map((b) => <option key={b.id} value={b.id}>{b.course?.name} · {b.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Status">
          {(i) => (
            <select id={i} value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
        </Field>
      </div>
      <div><CsvButton href={csvHref("/students/export", { batchId, status })} /></div>
    </section>
  );
}

function EnquiryReportPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = { from, to };
  const r = useQuery({
    queryKey: ["report-enquiries", params],
    queryFn: () => api<EnquiryReport>(`/reports/enquiries${qs(params)}`),
  });
  const breakdown = (title: string, rows: EnquiryReport["bySource"]) => (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="rtable w-full text-left text-[13px]">
          <thead className="border-y border-line text-[11.5px] uppercase tracking-wide text-sub">
            <tr><th className={th}>Name</th><th className={th}>Enquiries</th><th className={th}>Joined</th><th className={th}>Conversion</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((x) => (
              <tr key={x.name}>
                <td className={td + " font-semibold"}>{x.name}</td>
                <td data-label="Enquiries" className={td}>{x.total}</td>
                <td data-label="Joined" className={td}>{x.converted}</td>
                <td data-label="Conversion" className={td}>{x.conversion}%</td>
              </tr>
            ))}
            {rows.length === 0 && <Empty cols={4} text="No enquiries in this period." />}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <div className="flex items-end"><CsvButton href={csvHref("/reports/enquiries/csv", params)} /></div>
      </div>
      <ErrorNote error={r.error} />
      {r.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      {r.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-[14px] border border-line bg-surface p-3.5 sm:p-4">
              <div className="text-[12px] font-semibold text-sub">Enquiries</div>
              <div className="mt-1.5 font-display text-[22px] font-extrabold">{r.data.summary.total}</div>
            </div>
            <div className="rounded-[14px] border border-line bg-surface p-3.5 sm:p-4">
              <div className="text-[12px] font-semibold text-sub">Joined</div>
              <div className="mt-1.5 font-display text-[22px] font-extrabold">{r.data.summary.converted}</div>
              <div className="mt-0.5 text-[11.5px] text-sub">{r.data.summary.conversion}% conversion</div>
            </div>
            {r.data.byStatus.filter((x) => x.status !== "CONVERTED").slice(0, 2).map((x) => (
              <div key={x.status} className="rounded-[14px] border border-line bg-surface p-3.5 sm:p-4">
                <div className="text-[12px] font-semibold capitalize text-sub">{x.status.replace("_", " ").toLowerCase()}</div>
                <div className="mt-1.5 font-display text-[22px] font-extrabold">{x.count}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {breakdown("By source", r.data.bySource)}
            {breakdown("By course", r.data.byCourse)}
          </div>
        </>
      )}
    </div>
  );
}

function MaterialReportPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = { from, to };
  const r = useQuery({
    queryKey: ["report-materials", params],
    queryFn: () => api<MaterialReport>(`/reports/materials${qs(params)}`),
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>
      <Card
        title={`Study material${r.data ? ` · ${r.data.summary.materials} files · ${r.data.summary.views} opens` : ""}`}
        action={<CsvButton href={csvHref("/reports/materials/csv", params)} />}
      >
        <ErrorNote error={r.error} />
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-y border-line text-[11.5px] uppercase tracking-wide text-sub">
              <tr><th className={th}>Title</th><th className={th}>Batches</th><th className={th}>Opens</th><th className={th}>Students</th><th className={th}>Last opened</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.data?.rows.map((x) => (
                <tr key={x.materialId}>
                  <td className={td + " font-semibold"}>{x.title}{x.subject && <span className="block text-[12px] font-normal text-sub">{x.subject}</span>}</td>
                  <td data-label="Batches" className={td + " text-sub"}>{x.batches || "—"}</td>
                  <td data-label="Opens" className={td}>{x.views}</td>
                  <td data-label="Students" className={td}>{x.students}</td>
                  <td data-label="Last opened" className={td + " text-sub"}>{when(x.lastViewedAt)}</td>
                </tr>
              ))}
              {r.data?.rows.length === 0 && <Empty cols={5} text="No study material yet." />}
              {r.isPending && <Empty cols={5} text="Loading…" />}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
