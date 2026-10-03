"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { STUDENT_NAV } from "@/lib/nav";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Mobile-first shell for the student web panel (iOS users). */
export function StudentShell({
  user,
  children,
}: {
  user: { name: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="flex items-center justify-between px-5 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <div className="text-[12px] text-sub">Welcome</div>
            <div className="font-display text-[17px] font-bold leading-tight">{user.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-[14px] font-bold text-white"
            aria-hidden="true"
          >
            {initials(user.name)}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-5 pb-28 pt-2">{children}</main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
      >
        <ul className="mx-auto flex max-w-3xl">
          {STUDENT_NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/learn" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10.5px] ${
                    active ? "font-bold text-primary" : "font-semibold text-sub"
                  }`}
                >
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
