import {
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  MessageCircleQuestion,
  ShieldCheck,
  Smartphone,
  UserCircle,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

/** Admin / faculty sidebar. Faculty only sees what they work with. */
export const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "FACULTY"] },
  { href: "/students", label: "Students", icon: Users, roles: ["ADMIN", "FACULTY"] },
  { href: "/enquiries", label: "Enquiries", icon: UserPlus, roles: ["ADMIN"] },
  { href: "/courses", label: "Courses & Batches", icon: GraduationCap, roles: ["ADMIN"] },
  { href: "/question-bank", label: "Question Bank", icon: BookOpenCheck, roles: ["ADMIN", "FACULTY"] },
  { href: "/tests", label: "Tests", icon: ClipboardCheck, roles: ["ADMIN", "FACULTY"] },
  { href: "/materials", label: "Study Material", icon: FileText, roles: ["ADMIN", "FACULTY"] },
  { href: "/classes", label: "Online Classes", icon: Video, roles: ["ADMIN", "FACULTY"] },
  { href: "/doubts", label: "Doubts", icon: MessageCircleQuestion, roles: ["ADMIN", "FACULTY"] },
  { href: "/mobile-app", label: "Mobile App", icon: Smartphone, roles: ["ADMIN"] },
  { href: "/roles", label: "Roles & Access", icon: ShieldCheck, roles: ["ADMIN"] },
];

/** Student web panel (for iOS users). Protected content stays in the Android app. */
export const STUDENT_NAV: Omit<NavItem, "roles">[] = [
  { href: "/learn", label: "Home", icon: Home },
  { href: "/learn/classes", label: "Classes", icon: Video },
  { href: "/learn/doubts", label: "Doubts", icon: MessageCircleQuestion },
  { href: "/learn/profile", label: "Profile", icon: UserCircle },
];
