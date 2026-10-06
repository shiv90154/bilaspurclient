import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircleQuestion, UserCircle, Video } from "lucide-react";
import { NextClasses } from "@/components/student/student-classes";
import { AndroidOnlyNotice } from "@/components/student/student-notice";

export const metadata: Metadata = { title: "Home" };

const TILES = [
  { href: "/learn/classes", label: "Classes", icon: Video },
  { href: "/learn/doubts", label: "Doubts", icon: MessageCircleQuestion },
  { href: "/learn/profile", label: "Profile", icon: UserCircle },
];

export default function LearnHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2.5">
        {TILES.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[14px] border border-line bg-surface px-1 py-3 transition-colors hover:border-primary"
          >
            <Icon size={22} className="text-primary" aria-hidden="true" />
            <span className="text-[12px] font-semibold">{label}</span>
          </Link>
        ))}
      </div>
      <NextClasses />
      <AndroidOnlyNotice what="Study notes and tests" />
    </div>
  );
}
