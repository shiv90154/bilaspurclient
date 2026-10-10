import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ROLE_HOME } from "@/lib/constants";
import { getSessionUser } from "@/lib/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

const REASONS: Record<string, string> = {
  SESSION_REPLACED: "You were logged out because your account was used on another device.",
  SESSION_REVOKED: "Your session has ended. Please log in again.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  INVALID_REFRESH_TOKEN: "Your session has ended. Please log in again.",
  BACKEND_UNREACHABLE: "The server is not reachable right now.",
};

/** Where to go after login: an internal page the visitor was sent away from (e.g. /learn/fees?plan=…). */
function safeNext(next?: string | null): string | undefined {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/api") ? next : undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const [state, { reason, next: rawNext }] = await Promise.all([getSessionUser(), searchParams]);
  const next = safeNext(rawNext);
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);
  // Expired access token but a refresh token: renew it and come back here, which then opens the dashboard.
  if (state.status === "needs-refresh") {
    redirect(`/api/session/refresh?next=${encodeURIComponent(next ? `/login?next=${encodeURIComponent(next)}` : "/login")}`);
  }

  const notice = reason ? REASONS[reason] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <Brand />
        <h1 className="mt-6 text-[22px] font-bold">Log in</h1>
        <p className="mt-1 text-[13px] text-sub">Admin, faculty and students sign in here.</p>

        {notice && (
          <p role="status" className="mt-4 rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] font-semibold text-accent-ink">
            {notice}
          </p>
        )}

        <div className="mt-5">
          <LoginForm next={next} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">Forgot password?</Link>
          <Link href="/register" className="font-semibold text-primary hover:underline">New student? Register</Link>
        </div>
        <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-sub">
          <Link href="/privacy" className="hover:text-primary">Privacy policy</Link>
          <Link href="/terms" className="hover:text-primary">Terms</Link>
          <Link href="/delete-account" className="hover:text-primary">Delete my account</Link>
        </p>
      </div>
    </main>
  );
}
