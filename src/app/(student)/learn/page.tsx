import type { Metadata } from "next";
import Link from "next/link";
import { FileText, MessageCircleQuestion, UserCircle, Video } from "lucide-react";
import { AndroidOnlyNotice } from "@/components/student/student-notice";

export const metadata: Metadata = { title: "Home" };

const TILES = [
  { href: "/learn/classes", label: "Classes", icon: Video },
  { href: "/learn/notes", label: "Notes", icon: FileText },
  { href: "/learn/doubts", label: "Doubts", icon: MessageCircleQuestion },
  { href: "/learn/profile", label: "Profile", icon: UserCircle },
];

export default function LearnHome() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-2.5">
        {TILES.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-[14px] border border-line bg-surface px-1 py-3"
          >
            <Icon size={20} className="text-primary" aria-hidden="true" />
            <span className="text-[10.5px] font-semibold">{label}</span>
          </Link>
        ))}
      </div>
      <AndroidOnlyNotice what="Notes, tests and recorded lectures" />
    </div>
  );
}
