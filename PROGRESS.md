# EduManage — Progress (2026-10-02)

Plan: [PLAN.md](PLAN.md) · Module docs: [docs/](docs/) · Requirement: [requrment.md](requrment.md)

Is file mein sirf wahi hai jo **abhi tak bana aur chala kar check hua**. Jo nahi bana wo "Baaki hai" mein hai.

## Ek nazar mein

| Part | Status | Kaise check hua |
|---|---|---|
| Folder structure + docs | ✅ done | — |
| Local Postgres 18 (Docker) | ✅ chal raha | `docker compose ps` healthy |
| Database schema (saare modules, 39 tables) | ✅ migrate + seed ho gaya | `prisma migrate dev`, `db:seed` |
| Backend: auth, roles, device rule, health | ✅ chal raha | unit tests 8/8, `smoke:auth` 27/27, `npm run build` |
| Backend Phase 1: courses, batches, students, enquiries, faculty, dashboard | 🟨 likha, build + lint pass | **DB par run nahi hua** (Docker band tha); documents upload + CSV export baaki |
| Backend: baaki 9 modules (questions, tests, materials, videos, doubts, classes, fees, storage, notifications) | ⬜ khali stubs | sirf `@Module({})` + TODO |
| Admin/Faculty web panel (Next.js) | 🟨 login + shell; **asli UI:** dashboard, students (list/filter/add), courses+batches, enquiries (+convert). Baaki pages placeholder | `npm run build`, `lint`, `tsc` pass; **browser/API se run nahi hua** |
| Student web panel (iOS ke liye) | 🟨 login + shell + basic pages | same smoke test |
| Android app (Flutter) | 🟨 sirf `flutter create` hua | **kuch run / analyze nahi hua**, app code abhi nahi likha |
| CI, VPS deploy, Play Store | ⬜ | — |

## Kya bana hai

### Backend — [backend/](backend/)
NestJS 12 (ESM) + Prisma 7.10 + PostgreSQL 18. API: `http://localhost:3000/api`, Swagger: `/api/docs`.

| Endpoint | Kaun | Kaam |
|---|---|---|
| `POST /auth/login` | public | phone/email + password; students ke liye `deviceId` zaroori |
| `POST /auth/refresh` | public | refresh token rotate hota hai |
| `POST /auth/logout` | login | session khatam |
| `GET /auth/me` | login | profile + watermark data (naam, phone) |
| `GET /users/:id/devices` | ADMIN | student ke devices |
| `POST /users/:id/reset-device` | ADMIN | saare sessions + devices hata do |
| `GET /health` | public | API + DB check |

Rules jo lagu hain:
- **Ek student = ek active session.** Naye device par login karte hi purana device turant logout (`SESSION_REPLACED`). Web aur Android dono isi rule mein aate hain.
- **Device limit:** 30 din mein max 3 naye devices (`DEVICE_CHANGE_LIMIT_30D`). Admin reset se counter saaf.
- **Refresh token:** rotate hota hai; purana token dubara use hua to poora session revoke (`REFRESH_REUSE`). DB mein sirf sha256 hash.
- **Access token:** 15 min, aur har request par session DB mein check hota hai (isiliye logout turant kaam karta hai).
- **Lockout:** 5 galat passwords par 15 min lock. Login par rate limit 10/min, refresh 30/min, baaki 120/min.
- **Password:** argon2id. Unknown user par bhi same time + same error (user enumeration nahi).
- **Student `ACTIVE` nahi to** login aur API dono band (`STUDENT_NOT_ACTIVE`) — fees pending hone par admin status badal kar access rok sakta hai.
- Helmet, CORS allow-list, global validation (unknown fields reject), `trust proxy` (Nginx ke peeche).
- Error body hamesha `{ statusCode, code, message }`; clients `code` par switch karte hain.

Error codes: `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_DISABLED`, `STUDENT_NOT_ACTIVE`, `DEVICE_ID_REQUIRED`, `DEVICE_BLOCKED`, `DEVICE_LIMIT_REACHED`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `SESSION_REPLACED`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `INVALID_REFRESH_TOKEN`, `FORBIDDEN_ROLE`.

### Database — [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
Docs ke saare modules ke tables ek schema mein: users/devices/sessions, students/batches/enquiries, questions/tests/attempts, materials, videos, live classes, doubts, fees/payments, activity log. Migration: `backend/prisma/migrations/*_init`.

Seed (`npm run db:seed`) — **sirf local/testing ke liye**:

| Role | Phone | Password |
|---|---|---|
| Admin | 9999999999 | ChangeMe@123 |
| Faculty | 9999999998 | Demo@12345 |
| Student | 9999999997 | Demo@12345 |

### Admin/Faculty + Student web — [admin-web/](admin-web/)
Next.js 16 (App Router) + Tailwind 4, design EduManage artifact ke tokens se (Sora + Plus Jakarta Sans, primary `#3949AB`).

- **Login:** browser kabhi token nahi dekhta. Next server cookies (`httpOnly`) set karta hai aur har API call `/api/backend/*` se jaati hai (same-origin proxy jo bearer lagata hai). XSS se token chori nahi ho sakta.
- **Auto refresh:** access token expire hone par proxy khud refresh karta hai. Parallel requests **ek hi refresh share** karti hain (warna backend ise token chori samajh kar session maar deta).
- **CSRF:** POST par `Origin` check.
- **Role routing:** admin/faculty → `/dashboard`, student → `/learn`. Galat area mein gaye to apne area par redirect. Faculty ko sidebar mein sirf apne modules.
- **Pages:** `/dashboard` (live "System status" card), `/students`, `/enquiries`, `/courses`, `/question-bank`, `/tests`, `/materials`, `/videos`, `/classes`, `/doubts`, `/fees`, `/roles` (sab abhi placeholder, planned scope dikhate hain). Student: `/learn`, `/learn/classes`, `/learn/notes`, `/learn/doubts`, `/learn/profile`. Student web par notes/tests/videos jaan-boojh kar nahi (Android-only notice).
- Web par login par device id browser mein save hota hai (`em_device_id`).

### Infra
- [docker-compose.yml](docker-compose.yml): Postgres 18 **host port 5433** (5432 par aapka `school_erp_pg` container pehle se hai, usko haath nahi lagaya). Redis abhi commented (video queue ke time).

## Kaise chalana hai

```powershell
# 1. Database
cd C:\Users\shiva\OneDrive\Desktop\Bilaspur
docker compose up -d db

# 2. Backend  (http://localhost:3000/api , Swagger: /api/docs)
cd backend
npm install
copy .env.example .env        # phir JWT_ACCESS_SECRET badlo (neeche dekho)
npx prisma migrate deploy
npm run db:seed
npm run start:dev

# 3. Web  (http://localhost:3001)
cd ..\admin-web
npm install
copy .env.example .env.local
npm run dev
```

JWT secret banane ke liye: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Tests:
```powershell
cd backend;   npm test                 # 8 unit tests
cd backend;   npm run smoke:auth       # server chalu ho; ~70 sec (rate-limit window ka wait)
cd admin-web; node scripts/smoke-web.mjs   # backend + web dono chalu ho
```
Smoke tests demo seed ke users use karte hain aur sessions/devices ki rows banate hain; dobara chalane se pehle `DELETE FROM sessions; DELETE FROM devices;` (limit 3 devices ki wajah se).

## Versions (2026-10-02 ko latest stable)

| | Version | Note |
|---|---|---|
| Node / npm | 24.16 / 11.17 | npm 11 ka `allowScripts`: backend ke liye argon2, prisma, @prisma/engines, esbuild approve kiye (`backend/package.json`) |
| NestJS | 12.x | ESM, vitest + oxlint, TypeScript 6 |
| Prisma | **7.10.0** | `prisma@latest` abhi 8.0 **RC** hai, isliye stable 7.10 pin |
| Next.js / React | 16.3.8 / 19.3.0 | `middleware` ab `proxy.ts` hai |
| Tailwind / TypeScript | 4.3.3 / 6.0.3 | TypeScript 7 (native) abhi Next/Nest ke saath nahi liya |
| ESLint (admin-web) | **9.x** | 10 par `eslint-config-next` ke plugins crash karte hain |
| vitest | 5.0.3 | |
| Postgres | 18 (alpine) | volume mount `/var/lib/postgresql` (18 ka naya layout) |
| Flutter / Dart | 3.47.6 / 3.13.5 | `C:\src\flutter` mein install kiya |
| `@types/node` | 24 | Node 24 runtime ke hisaab se (26 types jaan-boojh kar nahi) |

## Baaki hai (is order mein)

1. **Android app code** — `student-app/` mein sirf khali Flutter project hai (`com.edumanage.student_app`). Abhi tak koi package add nahi hua. Plan: dio, flutter_riverpod, go_router, flutter_secure_storage, device_info_plus, screen_protector (FLAG_SECURE), safe_device (root/emulator), google_fonts; login screen, token refresh (single-flight), SESSION_REPLACED handling, watermark widget. Details: [docs/10-android-protection.md](docs/10-android-protection.md).
2. **Phase 1 backend modules** — students, courses, batches, enquiries, faculty CRUD (+ ownership checks), dashboard summary, activity log events. Phir admin-web ke placeholder pages asli UI se badlo. Admin web mein **device history + reset screen** (API ready hai).
3. Phase 2/3 modules (docs ke hisaab se): notes, tests, doubts, videos, classes, fees/Razorpay.
4. Infra: CI, VPS + Nginx + HTTPS, backups, Play Store ([docs/13-play-store-compliance.md](docs/13-play-store-compliance.md)).

## Dhyan dene wali baatein

- **`admin-web/.git` nested repo hai.** `create-next-app` ne bana diya (sirf "Initial commit from Create Next App"). Poore project ke liye ek hi repo chahiye, to root par `git init` se pehle isse hatao: `Remove-Item -Recurse -Force admin-web\.git`. Maine delete nahi kiya (auto-mode ne roka).
- **Flutter PATH mein nahi hai.** Use karne ke liye `C:\src\flutter\bin\flutter.bat` ya PATH mein `C:\src\flutter\bin` jodo.
- **Android build abhi nahi chalega:** `flutter doctor` ke hisaab se Android SDK mein *cmdline-tools* nahi hai aur licenses accept nahi hain. Android Studio → SDK Manager → "Android SDK Command-line Tools" install karo, phir `flutter doctor --android-licenses`. (Licenses aapko khud accept karne hain.)
- **`applicationId` = `com.edumanage.student_app`** abhi sirf placeholder hai. Play Store par publish hone ke baad badal nahi sakta — institute ke naam se final karke hi release karo.
- **Demo passwords** (`ChangeMe@123`, `Demo@12345`) kisi bhi server par mat chalao; `SEED_ADMIN_*` env se alag do ya seed ke baad badlo. `SEED_DEMO=false` rakho production mein.
- `backend/.env` mein local random JWT secret hai; `.env*` git mein nahi jaane chahiye (root [.gitignore](.gitignore) bana diya hai).
- Web proxy `x-forwarded-for` aage bhejta hai; Nginx ke peeche isse overwrite karna (client ka bheja hua mat maanna), warna IP rate-limit bypass ho sakta hai. Account lockout phir bhi kaam karta hai.
- Production mein cookies `secure` hongi → HTTPS zaroori. `BACKEND_URL` aur `CORS_ORIGINS` set karo.

## Folder structure

```
Bilaspur/
├── PLAN.md  PROGRESS.md  requrment.md  docker-compose.yml  .gitignore
├── docs/                      13 module docs + checklists
├── backend/
│   ├── prisma/                schema.prisma, migrations/, seed.ts
│   ├── scripts/smoke-auth.mjs
│   └── src/
│       ├── config/            env validation (zod)
│       ├── common/            guards, decorators, errors, dto
│       ├── prisma/            PrismaService
│       └── modules/           auth, users, health, activity  (+ 15 stub modules)
├── admin-web/
│   ├── scripts/smoke-web.mjs
│   └── src/
│       ├── proxy.ts           session gate
│       ├── app/(auth)  (admin)  (student)  api/
│       ├── components/
│       └── lib/               session (server), nav, modules, types
└── student-app/               Flutter (khali project)
```
