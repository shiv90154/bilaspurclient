import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/site/landing";
import { ROLE_HOME } from "@/lib/constants";
import { getSessionUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: { absolute: "DHĪ · Ayurveda Classroom by Dr. Pardeuman Singh" },
  description:
    "Learn Ayurveda with Dr. Pardeuman Singh: live classes, PDF notes, test series and doubt solving in the DHĪ app.",
  openGraph: {
    title: "DHĪ · Ayurveda Classroom",
    description: "Live classes, notes, test series and doubt solving with Dr. Pardeuman Singh.",
    images: ["/founder-portrait.jpg"],
  },
};

/** Public website for visitors; signed-in users go straight to their home. */
export default async function RootPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const state = await getSessionUser();
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);
  if (state.status === "needs-refresh") redirect("/api/session/refresh?next=/");
  const { app } = await searchParams;
  return <Landing appSoon={app === "soon"} />;
}
