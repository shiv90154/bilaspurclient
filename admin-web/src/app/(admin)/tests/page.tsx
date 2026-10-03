import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Tests" };

export default function Page() {
  return <ModulePage module="tests" />;
}
