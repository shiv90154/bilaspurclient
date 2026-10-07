import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/site/landing";
import { ROLE_HOME } from "@/lib/constants";
import { getSessionUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: { absolute: "DHĪ · Ayurveda Classroom by Dr. Pardeuman Singh" },
  alternates: { canonical: "/" },
};

/** Public website for visitors; signed-in users go straight to their home. */
export default async function RootPage() {
  const state = await getSessionUser();
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);
  if (state.status === "needs-refresh") redirect("/api/session/refresh?next=/");
  return <Landing />;
}
