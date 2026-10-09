"use client";

import { Menu, Wrench, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { ADMIN_NAV } from "@/lib/nav";
import type { Role } from "@/lib/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Menu links, user card and logout: the desktop sidebar and the phone drawer show the same thing. */
function SidebarContent({
  user,
  items,
  pathname,
}: {
  user: { name: string; role: Role };
  items: typeof ADMIN_NAV;
  pathname: string;
}) {
  return (
    <>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-[11px] rounded-[10px] px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors ${
                active
                  ? "bg-primary-tint font-bold text-primary-dark"
                  : "text-sub hover:bg-bg hover:text-ink"
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-2 border-t border-line pt-3">
        <div className="flex items-center gap-2.5 px-2.5 pb-2">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary font-display text-[13px] font-bold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-bold">{user.name}</span>
            <span className="block text-[11px] capitalize text-sub">{user.role.toLowerCase()}</span>
          </span>
        </div>
        <LogoutButton className="w-full" />
      </div>
    </>
  );
}

export function AdminShell({
  user,
  maintenance = false,
  children,
}: {
  user: { name: string; role: Role };
  /** Maintenance mode is on: a reminder bar on every page, so it is not left on by mistake. */
  maintenance?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => item.roles.includes(user.role));
  const current = items.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  // The phone menu remembers the page it was opened on, so navigating anywhere closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col border-r border-line bg-surface px-3.5 py-5 lg:flex">
        <div className="px-2.5 pb-6 pt-1.5">
          <Brand />
        </div>
        <SidebarContent user={user} items={items} pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone / tablet: top bar with a menu button that opens the sidebar as a drawer */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-2 py-2 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="rounded-[10px] p-2.5 text-ink hover:bg-bg"
          >
            <Menu size={20} />
          </button>
          <Brand />
          {current && (
            <span className="ml-auto truncate pr-2 text-[12.5px] font-semibold text-sub">{current.label}</span>
          )}
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              className="absolute inset-0 bg-ink/40"
              onClick={() => setMenuOpen(false)}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="relative flex h-full w-[260px] max-w-[85vw] flex-col bg-surface px-3.5 py-4 shadow-xl"
            >
              <div className="flex items-center justify-between px-1 pb-4">
                <Brand />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[10px] p-2 hover:bg-bg"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent user={user} items={items} pathname={pathname} />
            </aside>
          </div>
        )}

        {maintenance && (
          <div role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-danger px-4 py-2 text-[13px] font-semibold text-white sm:px-6 lg:px-9">
            <Wrench size={15} aria-hidden="true" />
            Maintenance mode is on: students see the &quot;back soon&quot; screen.
            {user.role === "ADMIN" && (
              <Link href="/settings" className="underline underline-offset-2">
                Turn it off in Settings
              </Link>
            )}
          </div>
        )}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-9 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
