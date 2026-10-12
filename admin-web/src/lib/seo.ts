import { FOUNDER, SITE } from "@/lib/site";

/** Public address, for absolute URLs in structured data. */
export const SITE_URL = process.env.PUBLIC_ORIGIN ?? "https://dhiayurved.com";

/** Names people type into Google: the macron in "DHĪ" is often left out. */
const ALT_NAMES = ["DHI Ayurveda Classroom", "DHI Ayurved", "Dhi Ayurveda", "DHĪ"];

const ORG_ID = `${SITE_URL}/#organization`;
const FOUNDER_ID = `${SITE_URL}/about#founder`;

/** Schema.org data for the institute, its founder and the website (home page). */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": ORG_ID,
        name: "DHĪ Ayurveda Classroom",
        alternateName: ALT_NAMES,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        image: `${SITE_URL}/founder-portrait.jpg`,
        description:
          "Online Ayurveda coaching for AIAPGET, AMO and BAMS exams by Dr. Pardeuman Singh: live classes, PDF notes, test series and doubt solving.",
        email: SITE.email,
        telephone: SITE.phone,
        address: { "@type": "PostalAddress", addressRegion: "Himachal Pradesh", addressCountry: "IN" },
        areaServed: "IN",
        founder: { "@id": FOUNDER_ID },
        sameAs: [SITE.youtube, SITE.instagram, SITE.facebook],
        knowsAbout: ["Ayurveda", "AIAPGET", "AMO exam", "BAMS", "Shalya Tantra"],
      },
      {
        "@type": "Person",
        "@id": FOUNDER_ID,
        name: SITE.founder,
        honorificSuffix: FOUNDER.degrees,
        jobTitle: FOUNDER.role,
        image: `${SITE_URL}/founder-portrait.jpg`,
        url: `${SITE_URL}/about`,
        worksFor: { "@id": ORG_ID },
        alumniOf: FOUNDER.education.map((e) => ({ "@type": "CollegeOrUniversity", name: e.place.split(",")[0] })),
        sameAs: [SITE.youtube, SITE.founderInstagram],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "DHĪ Ayurveda Classroom",
        alternateName: ALT_NAMES,
        url: SITE_URL,
        inLanguage: "en-IN",
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/** Schema.org Course for one course page. */
export function courseJsonLd(c: {
  id: string;
  name: string;
  total: string;
  course: { name: string; description: string | null; tagline: string | null; language: string | null };
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.course.name,
    description: c.course.description ?? c.course.tagline ?? `${c.course.name} with ${SITE.founder}.`,
    url: `${SITE_URL}/courses/${c.id}`,
    inLanguage: c.course.language ?? "en-IN",
    provider: { "@type": "EducationalOrganization", "@id": ORG_ID, name: "DHĪ Ayurveda Classroom", url: SITE_URL },
    instructor: { "@type": "Person", name: SITE.founder },
    offers: { "@type": "Offer", category: "Paid", price: c.total, priceCurrency: "INR", url: `${SITE_URL}/courses/${c.id}` },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", name: c.name },
  };
}
