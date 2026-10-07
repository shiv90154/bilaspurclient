"use client";

import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

export const inputCls =
  "h-10 w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 text-base outline-none focus:border-primary sm:text-[13.5px]";
export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-[13px] font-bold text-white hover:bg-primary-dark disabled:opacity-60";
export const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-[13px] font-semibold hover:bg-bg disabled:opacity-60";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="break-words text-[20px] font-bold sm:text-[23px]">{title}</h1>
        {subtitle && <p className="mt-1 break-words text-[13px] text-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold text-sub">
        {label}
      </label>
      {children(id)}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Stop the page behind the dialog from scrolling (matters most on phones).
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-ink/40 p-3 sm:p-10">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-surface p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-[17px] font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-1 shrink-0 rounded-lg p-1.5 hover:bg-bg">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const TONES = {
  green: "bg-success-tint text-success",
  amber: "bg-accent-tint text-accent-ink",
  red: "bg-danger-tint text-danger",
  blue: "bg-info-tint text-info",
  gray: "bg-bg text-sub",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-sub">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <button className={btnGhost + " !h-8 !px-3"} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </button>
        <span>
          {page} / {pages}
        </span>
        <button className={btnGhost + " !h-8 !px-3"} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return (
    <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-[12.5px] text-danger">
      {msg}
    </p>
  );
}

/** What a list shows when there is nothing in it yet: says what the screen is for and what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-5 py-10 text-center sm:px-6 sm:py-12">
      <span className="rounded-2xl bg-primary-tint p-3.5 text-primary">
        <Icon size={24} aria-hidden="true" />
      </span>
      <div>
        <p className="text-[15px] font-bold">{title}</p>
        {text && <p className="mx-auto mt-1 max-w-sm text-[13px] text-sub">{text}</p>}
      </div>
      {action}
    </div>
  );
}

/** Grey placeholder cards while a list loads, so the page does not jump when the data arrives. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-[76px] animate-pulse rounded-2xl border border-line bg-surface" />
      ))}
    </div>
  );
}
