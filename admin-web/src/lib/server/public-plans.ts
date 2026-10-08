import type { PublicPlan } from "@/components/site/site-ui";
import { backendRequest } from "./session";

/** Course fees open on the website; an empty list (never an error) if the API is down. */
export async function getOpenPlans(): Promise<PublicPlan[]> {
  try {
    const res = await backendRequest("/fee-plans/public");
    return res.ok ? ((await res.json()) as { plans: PublicPlan[] }).plans : [];
  } catch {
    return [];
  }
}
