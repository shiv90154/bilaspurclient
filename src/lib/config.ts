/** Server-side only: where the Node API lives. Never exposed to the browser. */
export const BACKEND_URL = (
  process.env.BACKEND_URL ?? "http://localhost:3000/api"
).replace(/\/$/, "");
