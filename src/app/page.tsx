import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/constants";
import { getSessionUser } from "@/lib/server/session";

export default async function RootPage() {
  const state = await getSessionUser();
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);
  if (state.status === "needs-refresh") redirect("/api/session/refresh?next=/");
  redirect("/login");
}
