/**
 * Absolute URL on the host the visitor actually used.
 *
 * Behind nginx, `request.url` carries the bind address of the Node server
 * (http://0.0.0.0:3001 in Docker), so redirects built from it send people to
 * an unreachable address. Use the forwarded headers instead.
 */
export function publicUrl(path: string, request: Request): URL {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host")?.split(",")[0].trim() || headers.get("host");
  if (host && !host.startsWith("0.0.0.0")) {
    const proto =
      headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      new URL(request.url).protocol.replace(":", "");
    return new URL(path, `${proto}://${host}`);
  }
  return new URL(path, process.env.PUBLIC_ORIGIN ?? request.url);
}
