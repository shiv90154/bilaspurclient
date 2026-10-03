import type { Metadata } from "next";
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const state = await getSessionUser();
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);

  const { reason } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-7 shadow-sm">
        <Brand />
        <h1 className="mt-6 text-[22px] font-bold">Log in</h1>
        <p className="mt-1 text-[13px] text-sub">Admin, faculty and students sign in here.</p>

        {notice && (
          <p role="status" className="mt-4 rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] font-semibold text-accent-ink">
            {notice}
          </p>
        )}

        <div className="mt-5">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
