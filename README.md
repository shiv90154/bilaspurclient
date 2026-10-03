# admin-web — EduManage web panels

Next.js 16 (App Router) · React 19 · Tailwind 4. One app serves the **admin/faculty panel** and the **student web panel** (for iOS users; protected content stays in the Android app). Status of the whole project: [../PROGRESS.md](../PROGRESS.md).

> This Next.js version has breaking changes (e.g. `middleware` is now `proxy.ts`). Read `node_modules/next/dist/docs/` before changing framework-level code.

## Run

```powershell
npm install
copy .env.example .env.local     # BACKEND_URL=http://localhost:3000/api
npm run dev                      # http://localhost:3001  (backend must be running)
```

Scripts: `dev`, `build`, `start` (all on port 3001), `lint`. Smoke test: `node scripts/smoke-web.mjs` (needs backend + web running with the demo seed).

## Routes

| Area | Routes | Roles |
|---|---|---|
| Public | `/login` | — |
| Admin / faculty | `/dashboard`, `/students`, `/enquiries`*, `/courses`*, `/question-bank`, `/tests`, `/materials`, `/videos`, `/classes`, `/doubts`, `/fees`*, `/roles`* | ADMIN, FACULTY (* admin only) |
| Student web | `/learn`, `/learn/classes`, `/learn/notes`, `/learn/doubts`, `/learn/profile` | STUDENT |
| Session API | `/api/session/login`, `/logout`, `/refresh` | — |
| API proxy | `/api/backend/*` → `{BACKEND_URL}/*` | any logged-in user |

Most admin pages are placeholders that show the planned scope from `src/lib/modules.ts`; the plan for each is in `../docs/`.

## How auth works

- Tokens live only in `httpOnly` cookies (`em_access`, `em_refresh`). The browser never sees them.
- The browser calls `/api/backend/...`; the route handler adds `Authorization: Bearer` and forwards to the Node API. On `TOKEN_EXPIRED` it refreshes and retries once. Parallel requests share one refresh (`refreshTokens` in `src/lib/server/session.ts`) because the backend treats a replayed refresh token as theft.
- Server components use `requireUser([...roles])` (layouts). If the access token is expired it redirects through `/api/session/refresh?next=...`, because server components cannot set cookies.
- `src/proxy.ts` only does the cheap check (no session cookie → `/login`) and exposes `x-pathname`. Real authorization is in the layouts and, above all, in the backend.
- State-changing requests are rejected when `Origin` does not match (CSRF).
- If the session is gone (logged in on another device, revoked), cookies are cleared and the login page shows why.

## Calling the API from a page

```tsx
// client component
const { data } = useQuery({
  queryKey: ["students"],
  queryFn: async () => {
    const res = await fetch("/api/backend/students");
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  },
});
```

## Layout

```
src/proxy.ts                     session gate
src/app/(auth)/login             login page + form
src/app/(admin)/…                admin/faculty pages (layout = requireUser ADMIN|FACULTY)
src/app/(student)/learn/…        student web pages (layout = requireUser STUDENT)
src/app/api/session|backend      cookie session + proxy route handlers
src/components/                  AdminShell, StudentShell, ModulePage, …
src/lib/server/session.ts        server-only session helpers
src/lib/{nav,modules,types,constants}.ts
```

Design tokens (colors, Sora + Plus Jakarta Sans) are in `src/app/globals.css`, taken from the EduManage design.

## Notes

- ESLint is pinned to 9: `eslint-config-next`'s React plugin crashes on ESLint 10.
- Production: cookies are `secure`, so serve over HTTPS; set `BACKEND_URL`; make Nginx overwrite `X-Forwarded-For`.
- The browser device id is stored in `localStorage` (`em_device_id`); students count web and Android as devices under the one-device rule.
