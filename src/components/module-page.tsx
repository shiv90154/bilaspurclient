import { CheckCircle2 } from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/modules";

/** Temporary page body for modules whose UI is not built yet. */
export function ModulePage({ module }: { module: ModuleKey }) {
  const info = MODULES[module];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[23px] font-bold">{info.title}</h1>
        <p className="mt-1 text-[13px] text-sub">{info.summary}</p>
      </div>

      <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold">Planned scope</h2>
          <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[11px] font-bold text-accent-ink">
            {info.phase} · not built yet
          </span>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {info.scope.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13.5px]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sub" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-line pt-4 text-[12px] text-sub">
          Plan and checklist: <span className="font-semibold text-ink">{info.doc}</span>
        </p>
      </section>
    </div>
  );
}
