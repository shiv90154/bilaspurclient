"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand";

export const SITE_NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/courses", label: "Courses" },
  { href: "/features", label: "What you get" },
  { href: "/app", label: "App" },
  { href: "/contact", label: "Contact" },
];

/** `signedIn`: a session cookie is present; "My dashboard" goes via /login, which sends a signed-in user to their own home. */
export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  // The phone menu remembers the page it was opened on, so it closes by itself after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="DHĪ home">
          <BrandMark size={38} />
          <span className="leading-tight">
            <span className="block text-[18px] font-bold text-primary">DHĪ</span>
            <span className="hidden text-[10px] uppercase tracking-[0.16em] text-sub sm:block">Ayurveda Classroom</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-[14px] font-medium lg:flex" aria-label="Main">
          {SITE_NAV.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 transition ${active ? "bg-primary-tint text-primary" : "text-sub hover:text-primary"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-dark">
              <LayoutDashboard size={16} /> My dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="hidden h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-primary hover:bg-primary-tint sm:inline-flex"
              >
                Register
              </Link>
              <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-dark">
                <LogIn size={16} /> Log in
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpenOn(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="site-menu" aria-label="Main" className="border-t border-line bg-surface px-4 pb-4 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {SITE_NAV.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center rounded-lg px-3 text-[15px] font-medium ${active ? "bg-primary-tint text-primary" : "text-ink"}`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            {!signedIn && (
              <li className="mt-2 border-t border-line pt-3">
                <Link href="/register" className="flex min-h-12 items-center rounded-lg px-3 text-[15px] font-semibold text-primary">
                  New student? Register
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
