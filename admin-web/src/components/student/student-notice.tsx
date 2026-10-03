import { Smartphone } from "lucide-react";

/** Protected content (notes, tests, videos) is intentionally Android-only. */
export function AndroidOnlyNotice({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface p-4">
      <Smartphone size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-[13px]">
        <span className="font-bold">{what}</span> are available in the EduManage Android app, where they are
        protected. This web version covers classes, doubts and your profile.
      </p>
    </div>
  );
}

export function StudentPlaceholder({
  title,
  phase,
  text,
}: {
  title: string;
  phase: string;
  text: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[18px] font-bold">{title}</h1>
        <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-bold text-accent-ink">
          {phase} · not built yet
        </span>
      </div>
      <p className="mt-2 text-[13px] text-sub">{text}</p>
    </section>
  );
}
