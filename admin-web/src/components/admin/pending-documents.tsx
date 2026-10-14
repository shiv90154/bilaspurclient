"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileClock } from "lucide-react";
import Link from "next/link";
import { api, type PendingDocument } from "@/lib/api";

const TYPE: Record<string, string> = { ID_PROOF: "ID proof", MARKSHEET: "Marksheet", PHOTO: "Photo", OTHER: "Other" };

/** Students' uploads waiting for the admin. Hidden when there are none. */
export function PendingDocuments() {
  const { data } = useQuery({
    queryKey: ["pending-documents"],
    queryFn: () => api<PendingDocument[]>("/students/documents/pending"),
  });
  if (!data?.length) return null;

  return (
    <section className="rounded-2xl border border-line bg-accent-tint p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        <FileClock size={17} className="text-accent-ink" aria-hidden="true" />
        Documents to review ({data.length})
      </h2>
      <p className="mt-1 text-[12px] text-sub">Students uploaded these from the app. Open the student to check, approve or reject.</p>
      <ul className="mt-3 divide-y divide-line text-[13px]">
        {data.slice(0, 8).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="min-w-0">
              <span className="font-semibold">{d.student.user.name}</span>
              <span className="text-sub">
                {" "}· {TYPE[d.type] ?? d.type} · {d.fileName} · {format(new Date(d.createdAt), "d MMM")}
              </span>
            </span>
            <Link href={`/students/${d.student.id}?tab=documents`} className="text-[12.5px] font-semibold text-primary">
              Review →
            </Link>
          </li>
        ))}
      </ul>
      {data.length > 8 && <p className="mt-2 text-[12px] text-sub">And {data.length - 8} more.</p>}
    </section>
  );
}
