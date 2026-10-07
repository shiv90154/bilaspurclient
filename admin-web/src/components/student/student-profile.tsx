"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api, fileHref } from "@/lib/api";
import { ErrorNote } from "@/components/ui";
import { ChangePasswordForm } from "@/components/password";

interface MyProfile {
  admissionNo: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: string;
  photoUrl: string | null;
  createdAt: string;
  user: { name: string; phone: string; email: string | null };
  academic: { prevSchool: string | null; prevClass: string | null; targetExam: string | null } | null;
  batches: { joinedAt: string; batch: { id: string; name: string; course: { name: string } } }[];
  stats: {
    testsTaken: number;
    averagePercentage: number | null;
    classesHeld: number;
    classesAttended: number;
    attendancePercentage: number | null;
    doubtsAsked: number;
  };
}

export function StudentProfile() {
  const { data: p, error, isPending } = useQuery({ queryKey: ["my-profile"], queryFn: () => api<MyProfile>("/students/me") });
  if (error) return <ErrorNote error={error} />;
  if (isPending) return <p className="text-[13px] text-sub">Loading…</p>;

  const rows: [string, string | null][] = [
    ["Phone", p.user.phone],
    ["Email", p.user.email],
    ["Admission no", p.admissionNo],
    ["Date of birth", p.dob ? format(new Date(p.dob), "d MMM yyyy") : null],
    ["City", p.city],
    ["Address", p.address],
    ["Guardian", p.guardianName],
    ["Guardian phone", p.guardianPhone],
    ["Previous school", p.academic?.prevSchool ?? null],
    ["Target exam", p.academic?.targetExam ?? null],
  ];
  const stats: [string, string][] = [
    ["Tests taken", String(p.stats.testsTaken)],
    ["Average score", p.stats.averagePercentage != null ? `${p.stats.averagePercentage}%` : "—"],
    ["Attendance", p.stats.attendancePercentage != null ? `${p.stats.attendancePercentage}%` : "—"],
    ["Doubts asked", String(p.stats.doubtsAsked)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link
          <img src={fileHref(p.photoUrl)} alt="" className="size-16 rounded-full border border-line object-cover" />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-tint font-display text-[22px] font-bold text-primary">
            {p.user.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="break-words text-[18px] font-bold">{p.user.name}</h1>
          <p className="text-[12.5px] text-sub">Student since {format(new Date(p.createdAt), "MMMM yyyy")}</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-[14px] border border-line bg-surface p-3.5">
            <div className="text-[12px] font-semibold text-sub">{k}</div>
            <div className="mt-1 font-display text-[20px] font-extrabold">{v}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-[15px] font-bold">My batches</h2>
        <ul className="mt-2 divide-y divide-line text-[13.5px]">
          {p.batches.map((b) => (
            <li key={b.batch.id} className="flex flex-wrap justify-between gap-2 py-2.5">
              <span className="font-semibold">{b.batch.course.name} · {b.batch.name}</span>
              <span className="text-sub">joined {format(new Date(b.joinedAt), "d MMM yyyy")}</span>
            </li>
          ))}
          {p.batches.length === 0 && <li className="py-2.5 text-sub">Not in a batch yet. Please contact the institute.</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-[15px] font-bold">Details</h2>
        <dl className="mt-2 flex flex-col divide-y divide-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5 text-[13.5px]">
              <dt className="text-sub">{label}</dt>
              <dd className="break-words font-semibold">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12px] text-sub">Something wrong here? Ask the institute office to correct it.</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-[15px] font-bold">Change password</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
