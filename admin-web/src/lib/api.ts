/** Browser-side API client. Calls go through the same-origin proxy (/api/backend/*). */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401 && typeof window !== "undefined") {
    // Full reload on purpose: it also drops every cached query of the dead session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : (body.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, body.code, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Builds "?a=1&b=2" skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ───────────── response shapes (mirror the backend) ─────────────

export interface Course {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  _count?: { batches: number };
}

export interface Batch {
  id: string;
  courseId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  course?: { id: string; name: string };
  _count?: { students: number };
}

export type StudentStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "COMPLETED" | "DROPPED";

export interface StudentRow {
  id: string;
  admissionNo: string | null;
  status: StudentStatus;
  city: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string; email: string | null };
  batches: { status: string; batch: { id: string; name: string; course: { id: string; name: string } } }[];
}

export type EnquiryStatus = "NEW" | "CONTACTED" | "FOLLOW_UP" | "CONVERTED" | "LOST";

export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  status: EnquiryStatus;
  followUpDate: string | null;
  notes: string | null;
  convertedStudentId: string | null;
  courseInterest: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
}

export interface DashboardSummary {
  role: "ADMIN" | "FACULTY";
  counts: Record<string, number>;
  recentActivity?: {
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actor: { id: string; name: string } | null;
  }[];
}
