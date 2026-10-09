"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** "Offer ends in 2d 04h 10m 05s", ticking; a plain date when the end is more than a week away. */
export function OfferCountdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  // Before hydration (and on the server) show the date, so the markup matches.
  const left = now === null ? null : end - now;
  if (left === null || left > 7 * 86_400_000) {
    return (
      <span>
        Offer ends {new Date(end).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
      </span>
    );
  }
  if (left <= 0) return <span>Offer ended</span>;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (
    <span className="tabular-nums" aria-live="off">
      Offer ends in {d > 0 ? `${d}d ` : ""}
      {pad(h)}h {pad(m)}m {pad(s % 60)}s
    </span>
  );
}
