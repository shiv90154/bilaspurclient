"use client";

import { useQuery } from "@tanstack/react-query";

interface Health {
  status: string;
  db: string;
}

/** Live check that the browser → Next proxy → Node API → database chain works. */
export function SystemStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<Health> => {
      const res = await fetch("/api/backend/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const ok = !isError && data?.status === "ok";
  const label = isPending ? "Checking…" : ok ? "All systems running" : "API or database is down";

  return (
    <section className="rounded-2xl border border-line bg-surface p-5" aria-live="polite">
      <h2 className="text-[15px] font-bold">System status</h2>
      <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold">
        <span
          className={`size-2.5 rounded-full ${
            isPending ? "bg-accent" : ok ? "bg-success" : "bg-danger"
          }`}
          aria-hidden="true"
        />
        {label}
      </p>
      {data && (
        <p className="mt-1 text-[12px] text-sub">
          API: {data.status} · Database: {data.db}
        </p>
      )}
    </section>
  );
}
