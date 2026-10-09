import { backendRequest } from "./session";

export interface PublicInfo {
  instituteName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  termsVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const FALLBACK: PublicInfo = { instituteName: "DHĪ", contactEmail: "", contactPhone: "", address: "", termsVersion: "", maintenanceMode: false, maintenanceMessage: "" };

/** Institute name + contact for the public legal pages (set by the admin in Settings). */
export async function getPublicInfo(): Promise<PublicInfo> {
  try {
    const res = await backendRequest("/privacy/info");
    return res.ok ? { ...FALLBACK, ...((await res.json()) as Partial<PublicInfo>) } : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
