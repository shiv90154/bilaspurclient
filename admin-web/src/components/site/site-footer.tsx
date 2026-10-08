import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { SITE } from "@/lib/site";
import { SOCIALS } from "./site-ui";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/about", label: "About" },
      { href: "/courses", label: "Courses" },
      { href: "/features", label: "What you get" },
      { href: "/app", label: "Get the app" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Students",
    links: [
      { href: "/register", label: "Register" },
      { href: "/login", label: "Log in" },
      { href: "/learn/fees", label: "Pay fees" },
      { href: "/forgot-password", label: "Forgot password" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms and refunds" },
      { href: "/delete-account", label: "Delete my account" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-surface px-4 pt-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr]">
        <div className="max-w-xs">
          <Link href="/" className="flex items-center gap-2.5" aria-label="DHĪ home">
            <BrandMark size={40} />
            <span className="leading-tight">
              <span className="block text-[18px] font-bold text-primary">DHĪ</span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-sub">Ayurveda Classroom</span>
            </span>
          </Link>
          <p className="mt-4 text-[13.5px] leading-relaxed text-sub">
            Learn Ayurveda with {SITE.founder}. Concepts first, so they stay with you.
          </p>
          <div className="mt-5 flex gap-2">
            {SOCIALS.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-sub hover:border-primary hover:text-primary"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-ink">{col.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-sub">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-primary">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-ink">Contact</h2>
          <ul className="mt-4 flex flex-col gap-3 text-[14px] text-sub">
            <li>
              <a href={SITE.phoneHref} className="flex items-center gap-2 hover:text-primary"><Phone size={15} /> {SITE.phone}</a>
            </li>
            <li>
              <a href={SITE.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary">
                <MessageCircle size={15} /> WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-2 break-all hover:text-primary"><Mail size={15} className="shrink-0" /> {SITE.email}</a>
            </li>
            <li className="flex items-center gap-2"><MapPin size={15} /> {SITE.location}</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-line py-6 text-[12.5px] text-sub sm:flex-row sm:justify-between">
        <p>© {year} DHĪ Ayurveda Classroom. All rights reserved.</p>
        <p>Payments secured by Razorpay · Made in India</p>
      </div>
    </footer>
  );
}
