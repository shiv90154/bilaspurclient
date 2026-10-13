"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DEVICE_ID_STORAGE_KEY, ROLE_HOME } from "@/lib/constants";
import type { ApiErrorBody, AuthProfile } from "@/lib/types";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your phone number or email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormValues = z.infer<typeof schema>;

export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Wrong phone/email or password.",
  ACCOUNT_LOCKED: "Too many failed attempts. Please try again in a few minutes.",
  ACCOUNT_DISABLED: "This account is disabled. Please contact the institute.",
  STUDENT_NOT_ACTIVE: "Your account is not active. Please contact the institute.",
  DEVICE_LIMIT_REACHED: "Device change limit reached. Please contact the institute.",
  DEVICE_BLOCKED: "This device is blocked. Please contact the institute.",
  BACKEND_UNREACHABLE: "The server is not reachable. Please try again shortly.",
};

/** These carry their own clear message from the server (wrong code, wait a minute ...). */
const SERVER_MESSAGE_CODES = new Set(["OTP_INVALID", "OTP_TOO_SOON", "EMAIL_NOT_CONFIGURED", "EMAIL_FAILED"]);

/** One stable id per browser, so the backend's one-device rule works on the web too. */
function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = `web-${crypto.randomUUID()}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `web-${crypto.randomUUID()}`;
  }
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Two-step login: after the password, the server emails a code and we ask for it here.
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          deviceId: getDeviceId(),
          deviceName: navigator.userAgent.slice(0, 100),
          ...(otpSentTo && { otp }),
        }),
      });
    } catch {
      setError(ERROR_MESSAGES.BACKEND_UNREACHABLE);
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
      if (body.code === "OTP_REQUIRED") {
        setOtpSentTo(body.email ?? "your email");
        setOtp("");
        return;
      }
      const serverMessage = body.code && SERVER_MESSAGE_CODES.has(body.code) && typeof body.message === "string" ? body.message : null;
      setError(
        serverMessage ??
          (res.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : (body.code && ERROR_MESSAGES[body.code]) || "Could not log in. Please try again."),
      );
      return;
    }

    const { user } = (await res.json()) as { user: AuthProfile };
    router.replace((user.role === "STUDENT" && next?.startsWith("/learn") ? next : undefined) ?? ROLE_HOME[user.role]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-lg bg-danger-tint px-3.5 py-2.5 text-[13px] font-semibold text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifier" className="text-[13px] font-semibold">
          Phone number or email
        </label>
        <input
          id="identifier"
          type="text"
          autoComplete="username"
          inputMode="email"
          aria-invalid={!!errors.identifier}
          aria-describedby={errors.identifier ? "identifier-error" : undefined}
          className="h-11 rounded-[10px] border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-primary"
          {...register("identifier")}
        />
        {errors.identifier && (
          <p id="identifier-error" className="text-[12px] font-semibold text-danger">
            {errors.identifier.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-semibold">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          className="h-11 rounded-[10px] border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-primary"
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-[12px] font-semibold text-danger">
            {errors.password.message}
          </p>
        )}
      </div>

      {otpSentTo && (
        <div className="flex flex-col gap-1.5 rounded-[12px] border border-primary/40 bg-primary-tint p-3.5">
          <label htmlFor="otp" className="text-[13px] font-semibold">
            Code from your email
          </label>
          <p className="text-[12px] text-sub">Two-step login is on. We sent a 6-digit code to {otpSentTo}. It works for 10 minutes.</p>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="h-11 rounded-[10px] border border-line bg-surface px-3.5 text-[18px] tracking-[0.3em] outline-none focus:border-primary"
          />
          <button
            type="button"
            className="self-start text-[12px] font-semibold text-primary underline"
            onClick={() => {
              setOtpSentTo(null);
              setOtp("");
              void handleSubmit(onSubmit)();
            }}
          >
            Send a new code
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 h-11 rounded-[10px] bg-primary text-[14px] font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {isSubmitting ? "Logging in…" : otpSentTo ? "Verify and log in" : "Log in"}
      </button>
    </form>
  );
}
