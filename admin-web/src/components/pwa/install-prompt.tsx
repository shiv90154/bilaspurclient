"use client";
/* eslint-disable @next/next/no-img-element */

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { SITE } from "@/lib/site";

/** Chrome / Edge / Samsung Internet event for the browser's own install dialog. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * - Android visitors (not staff): the Play Store app first, the web version as a second choice.
 * - Computers and staff on Android (Chrome, Edge): install the website as an app.
 * - iPhone / iPad Safari: how to use Share → Add to Home Screen (Safari has no install dialog).
 */
type Mode = "play" | "web" | "ios";

const DISMISS_KEY = "dhi-install-dismissed";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000;

/** Admin and faculty panel pages: the Play Store app is for students, so staff only get the web version. */
const STAFF_PREFIXES = [
  "/classes", "/courses-batches", "/dashboard", "/deletion-requests", "/doubts", "/enquiries", "/fees", "/materials",
  "/question-bank", "/registrations", "/reports", "/roles", "/settings", "/students", "/tests", "/videos",
];
/** Pages where a popup would get in the way. */
const QUIET_PREFIXES = ["/receipt", "/verify", "/download", "/delete-account", "/privacy", "/terms"];

const startsWithAny = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function snoozed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/** Registers the service worker and shows the "install the app" card once per week at most. */
export function InstallPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode | null>(null);
  const [canInstallWeb, setCanInstallWeb] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    if (isInstalled()) return;

    const ua = navigator.userAgent;
    const android = /Android/i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // Only Safari can add to the home screen on older iOS; other iOS browsers would show wrong steps.
    const iosSafari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

    const pick = (): Mode | null => {
      const path = pathRef.current;
      if (startsWithAny(path, QUIET_PREFIXES) || snoozed() || isInstalled()) return null;
      const staff = startsWithAny(path, STAFF_PREFIXES);
      if (android && !staff) return "play";
      if (deferred.current) return "web";
      if (iosSafari) return "ios";
      return null;
    };

    const onPrompt = (e: Event) => {
      e.preventDefault(); // our card replaces Chrome's mini bar
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstallWeb(true);
      setMode((m) => m ?? pick());
    };
    const onInstalled = () => {
      deferred.current = null;
      setCanInstallWeb(false);
      setMode(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const timer = window.setTimeout(() => setMode((m) => m ?? pick()), SHOW_AFTER_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  // Moving to a quiet page (or a staff page while the Play card is up) hides the card.
  const hidden =
    !mode || startsWithAny(pathname, QUIET_PREFIXES) || (mode === "play" && startsWithAny(pathname, STAFF_PREFIXES));
  if (hidden) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setMode(null);
  };

  const installWeb = async () => {
    const e = deferred.current;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred.current = null;
    setCanInstallWeb(false);
    if (outcome === "accepted") setMode(null);
    else close();
  };

  const title = mode === "play" ? "Get the DHĪ app" : mode === "ios" ? "Add DHĪ to your Home Screen" : "Install DHĪ";
  const text =
    mode === "play"
      ? "Live classes, notes, tests and doubts in one app. Free on Google Play, with automatic updates."
      : mode === "ios"
        ? "Open DHĪ from your Home Screen like an app: full screen, one tap away."
        : "Open DHĪ in its own window, like an app. One click, no download from a store.";

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md animate-[install-in_.35s_ease-out] rounded-2xl border border-line bg-surface p-4 shadow-2xl shadow-primary-dark/20 sm:inset-x-auto sm:bottom-5 sm:right-5"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Not now"
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-sub hover:bg-primary-tint hover:text-primary"
      >
        <X size={18} />
      </button>
      <div className="flex gap-3.5 pr-8">
        <img src="/icons/icon-192.png" alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-2xl border border-line" />
        <div>
          <p id="install-title" className="text-[16px] font-bold text-primary-dark">{title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-sub">{text}</p>
        </div>
      </div>

      {mode === "ios" ? (
        <ol className="mt-4 space-y-2 rounded-xl bg-primary-tint/50 p-3 text-[13px] text-ink">
          <li className="flex items-center gap-2">
            <span className="font-bold">1.</span> Tap <Share size={16} className="text-primary" aria-label="Share" /> at the bottom of Safari
          </li>
          <li className="flex items-center gap-2">
            <span className="font-bold">2.</span> Choose <SquarePlus size={16} className="text-primary" aria-hidden="true" /> <b>Add to Home Screen</b>
          </li>
        </ol>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {mode === "play" ? (
            <a
              href={SITE.playStore}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[15px] font-semibold text-white hover:bg-black"
            >
              <PlayMark /> Get it on Google Play
            </a>
          ) : (
            <button
              type="button"
              onClick={installWeb}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-dark"
            >
              <Download size={18} /> Install app
            </button>
          )}
          {mode === "play" && canInstallWeb && (
            <button type="button" onClick={installWeb} className="h-9 text-[13px] font-semibold text-primary hover:underline">
              Or add the website to your Home Screen
            </button>
          )}
          <button type="button" onClick={close} className="h-9 text-[13px] font-medium text-sub hover:text-ink">
            Not now
          </button>
        </div>
      )}
    </div>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
      <path fill="#34A853" d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Z" />
      <path fill="#FBBC04" d="m17.2 15.4-3.4-3.4 3.4-3.4 3.9 2.2c1.1.6 1.1 1.8 0 2.4l-3.9 2.2Z" />
      <path fill="#EA4335" d="M17.2 15.4 13.8 12 3.6 22.2c.4.2.9.2 1.4-.1l12.2-6.7Z" />
      <path fill="#4285F4" d="M17.2 8.6 5 1.9c-.5-.3-1-.3-1.4-.1L13.8 12l3.4-3.4Z" />
    </svg>
  );
}
