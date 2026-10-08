import type { Metadata } from "next";
import { StudentFees } from "@/components/student/student-fees";

export const metadata: Metadata = { title: "Fees" };

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return <StudentFees highlight={plan} />;
}
