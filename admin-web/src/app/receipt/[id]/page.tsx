import type { Metadata } from "next";
import { ReceiptView } from "@/components/receipt-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Receipt" };

/** Printable fee receipt: the admin sees any, a student only their own (checked by the backend). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, requireUser(["ADMIN", "STUDENT"])]);
  return <ReceiptView id={id} />;
}
