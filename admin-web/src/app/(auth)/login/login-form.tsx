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

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
        }),
      });
    } catch {
      setError(ERROR_MESSAGES.BACKEND_UNREACHABLE);
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
      setError(
        res.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : (body.code && ERROR_MESSAGES[body.code]) || "Could not log in. Please try again.",
      );
      return;
    }

    const { user } = (await res.json()) as { user: AuthProfile };
    router.replace(ROLE_HOME[user.role]);
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 h-11 rounded-[10px] bg-primary text-[14px] font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {isSubmitting ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
