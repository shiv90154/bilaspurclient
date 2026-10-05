import type { Metadata } from "next";
import { TestBuilder } from "@/components/admin/test-builder";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Test" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, requireUser(["ADMIN", "FACULTY"])]);
  return <TestBuilder id={id} />;
}
