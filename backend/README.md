# backend — EduManage API

NestJS 12 (ESM) · Prisma 7 · PostgreSQL 18. Status of the whole project: [../PROGRESS.md](../PROGRESS.md).

## Run

```powershell
docker compose up -d db          # from the repo root (Postgres on host port 5433)
npm install
copy .env.example .env           # set JWT_ACCESS_SECRET (>= 32 chars)
npx prisma migrate deploy
npm run db:seed                  # admin (+ demo faculty/student when SEED_DEMO=true)
npm run start:dev                # http://localhost:3000/api   Swagger: /api/docs
```

## Scripts

| Script | What |
|---|---|
| `start:dev` / `start:prod` | watch mode / `node dist/main` |
| `build` | `prisma generate` then `nest build` |
| `test` | vitest unit tests |
| `smoke:auth` | end-to-end auth checks against a running server (~70 s) |
| `lint` | oxlint (type-aware) |
| `db:migrate` / `db:deploy` / `db:reset` | create+apply / apply / wipe+reseed migrations |
| `db:seed` / `db:studio` | seed / Prisma Studio |

## Environment

See [.env.example](.env.example). Validated at startup by `src/config/env.ts` (the app refuses to boot on bad config).

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | — | Postgres URL |
| `JWT_ACCESS_SECRET` | — | HS256 secret, >= 32 chars |
| `JWT_ACCESS_TTL_SECONDS` | 900 | access token lifetime |
| `REFRESH_TTL_DAYS` | 30 | sliding refresh lifetime |
| `CORS_ORIGINS` | `http://localhost:3001` | comma separated |
| `DEVICE_CHANGE_LIMIT_30D` | 3 | new devices a student may add per 30 days |
| `LOGIN_MAX_FAILURES` / `LOGIN_LOCK_MINUTES` | 5 / 15 | account lockout |
| `SWAGGER_ENABLED` | false | `/api/docs` |

## Layout

```
prisma/            schema.prisma (all modules), migrations/, seed.ts
src/config/        env validation
src/common/        JwtAuthGuard, RolesGuard, decorators (@Public, @Roles, @CurrentUser), errors, pagination dto
src/prisma/        PrismaService (driver adapter: @prisma/adapter-pg)
src/modules/       auth, users, health, activity   +   stub modules (see docs/)
src/generated/     Prisma client (generated, not committed)
```

Conventions: ESM — relative imports end in `.js`. Errors are `{ statusCode, code, message }` (`src/common/errors.ts`). Role checks are in guards (`@Roles`), ownership checks (faculty only sees their batches, student only their data) go in services.

## Auth in one paragraph

Login returns a 15-minute access JWT (`sub`, `role`, `sid`) and a rotating refresh token (`<sessionId>.<secret>`, only its sha256 is stored). `JwtAuthGuard` also loads the session on every request, so ending a session takes effect immediately. A student has exactly one active session: logging in elsewhere revokes the others (`SESSION_REPLACED`), limited to `DEVICE_CHANGE_LIMIT_30D` new devices per 30 days; `POST /users/:id/reset-device` (admin) clears it. A replayed refresh token revokes the session.

## Adding a feature module

1. Replace the stub in `src/modules/<name>/` with controller + service (inject `PrismaService`).
2. Protect with `@Roles(...)`; add ownership checks in the service.
3. Log important actions with `ActivityService.log(...)`.
4. Tick the checklist in the matching `docs/*.md`.
