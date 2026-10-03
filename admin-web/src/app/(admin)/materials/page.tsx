import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Study Material" };

export default function Page() {
  return <ModulePage module="materials" />;
}
