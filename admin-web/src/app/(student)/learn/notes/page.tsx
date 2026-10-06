import { redirect } from "next/navigation";

// Notes are protected content and live in the Android app; the web panel does not offer this page.
export default function Page() {
  redirect("/learn");
}
