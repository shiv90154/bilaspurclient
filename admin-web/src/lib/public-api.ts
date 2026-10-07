/** Browser calls to the public sign-up / forgot-password routes (/api/public/account/*). */
export async function publicApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/public/account/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] } & T;
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    throw new Error(res.status === 429 && !msg ? "Too many tries. Wait a minute and try again." : (msg ?? `Request failed (${res.status})`));
  }
  return data;
}

/** Same rule as the backend: 8+ characters with a letter and a number. */
export const PASSWORD_PATTERN = "(?=.*[A-Za-z])(?=.*\\d).{8,128}";
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";
