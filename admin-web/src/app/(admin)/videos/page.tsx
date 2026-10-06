import { redirect } from "next/navigation";

// Recorded lectures are not part of this release, so the page is not offered. A saved link lands on the dashboard.
export default function Page() {
  redirect("/dashboard");
}
