import { Smartphone } from "lucide-react";
import { SITE } from "@/lib/site";

/** Protected content (notes, tests, videos) is intentionally Android-only. */
export function AndroidOnlyNotice({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface p-4">
      <Smartphone size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-[13px]">
        <span className="font-bold">{what}</span> are available in the DHĪ Android app, where they are
        protected. This web version covers classes, doubts and your profile.
{" "}
        <a href={SITE.playStore} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">
          Get the app on Google Play
        </a>
      </p>
    </div>
  );
}

