"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/session/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      aria-label="Log out"
      title="Log out"
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-sub transition-colors hover:bg-danger-tint hover:text-danger disabled:opacity-60 ${className}`}
    >
      <LogOut size={16} aria-hidden="true" />
      <span>{busy ? "Logging out…" : "Log out"}</span>
    </button>
  );
}
