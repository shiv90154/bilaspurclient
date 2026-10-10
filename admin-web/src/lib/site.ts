/** Public website content. Contact details come from the institute owner. */
export const SITE = {
  name: "DHĪ",
  tagline: "Intelligence / Understanding",
  founder: "Dr. Pardeuman Singh",
  phone: "+91 80913 34667",
  phoneHref: "tel:+918091334667",
  whatsappHref: "https://wa.me/918091334667",
  email: "dr.pardeuman@gmail.com",
  location: "Himachal Pradesh, India",
  playStore: "https://play.google.com/store/apps/details?id=com.dhiayurved.app",
  youtube: "https://youtube.com/@ayurveda-classroom",
  facebook: "https://www.facebook.com/share/1AoyiXEE2W/",
  instagram: "https://www.instagram.com/pardeumansingh",
} as const;

/** Website address, for links put inside WhatsApp messages. */
const SITE_URL = process.env.PUBLIC_ORIGIN ?? "https://dhiayurved.com";

/**
 * WhatsApp chat with the institute, with "I want to buy this course" already typed.
 * Replaces Razorpay checkout (its fees were too high for the client): the institute shares
 * payment details in the chat and records the payment, which opens the course in the app.
 */
export function whatsappBuyHref(plan: { id: string; name: string; course: { name: string } }, price?: string) {
  const lines = [
    "Hello, I want to buy this course:",
    `${plan.course.name} · ${plan.name}`,
    price ? `Fee: ${price}` : null,
    `${SITE_URL}/courses/${plan.id}`,
  ];
  return `${SITE.whatsappHref}?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
}

/** Founder profile (from Dr. Pardeuman Singh, Oct 2026). */
export const FOUNDER = {
  degrees: "BAMS, MS (Shalya Tantra)",
  role: "Associate Professor, Shalya Tantra",
  stats: [
    { value: "15+", label: "Years of teaching" },
    { value: "400+", label: "Students selected in AIAPGET & AMO" },
    { value: "6", label: "AMO exams cleared (5 State + 1 Central)" },
    { value: "15+", label: "Years in clinical surgery" },
  ],
  education: [
    { degree: "MS, Shalya Tantra (Surgery)", place: "Rajiv Gandhi Ayurvedic Medical College & Hospital, Paprola (H.P.)" },
    { degree: "BAMS", year: "2011", place: "Guru Nanak Ayurvedic Medical College & Hospital, Gopalpur, Ludhiana (Punjab)" },
  ],
  achievements: [
    "Cleared the State AMO exam all five times he appeared",
    "Cleared a central-level AMO exam",
    "Prepared students for AIAPGET (PG entrance) and AMO exams for 15 years",
    "About 400 students selected in AIAPGET and AMO exams",
  ],
  clinical:
    "For 15 years he has served in the Shalya Tantra (surgery) department, conducting a wide range of surgeries and giving patients relief. That daily clinical work is why his classes connect every concept to real patients.",
} as const;

