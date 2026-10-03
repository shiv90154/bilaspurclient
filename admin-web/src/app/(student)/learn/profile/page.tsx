import type { Metadata } from "next";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser(["STUDENT"]);
  const rows = [
    ["Name", user.name],
    ["Phone", user.phone],
    ["Email", user.email ?? "—"],
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h1 className="text-[18px] font-bold">Profile</h1>
      <dl className="mt-4 flex flex-col divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3 text-[13.5px]">
            <dt className="text-sub">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
