"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col border-r border-line bg-surface px-3.5 py-5 lg:flex">
        <div className="px-2.5 pb-6 pt-1.5">
          <Brand />
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
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
            <span className="flex size-[34px] items-center justify-center rounded-full bg-primary font-display text-[13px] font-bold text-white">
              {initials(user.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-bold">{user.name}</span>
              <span className="block text-[11px] capitalize text-sub">{user.role.toLowerCase()}</span>
            </span>
          </div>
          <LogoutButton className="w-full" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone / tablet: compact top bar with horizontal nav */}
        <header className="border-b border-line bg-surface lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <LogoutButton />
          </div>
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
            {items.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                    active ? "bg-primary-tint text-primary-dark" : "text-sub"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
