# DHĪ — Progress (2026-10-07)

Plan: [PLAN.md](PLAN.md) · Module docs: [docs/](docs/) · Requirement: [requrment.md](requrment.md)

Is file mein sirf wahi hai jo **abhi tak bana aur chala kar check hua**. Jo nahi bana wo "Baaki hai" mein hai.

## Naya (2026-10-07)

| Kya | Kahan |
|---|---|
| **Watermark on/off** (default **off**) | Admin web → Settings. App `/auth/me` ke `watermark.enabled` se chalti hai; app khulne / wapas aane par naya setting le leti hai. Naya APK chahiye (purane APK hamesha watermark dikhate hain). |
| **Student profile poora** | Admin web student page: tabs (Profile, Tests & attendance, Documents, Batches & devices), photo, documents (ID proof / marksheet; sirf admin, har open log), reset password. App + student web: apna profile, batches, stats, change password. |
| **CSV export** | Students list → Export CSV (filters ke saath). `GET /students/export` |
| **Reports** | Admin web → Reports: attendance (class-wise + student-wise), test results, student list, enquiry funnel, material views. Har report CSV mein. Faculty ko sirf apne batches. `/reports/*` |
| **Dashboard** | Naye counts: live now, study material, question bank, active today / 7 din |
| **Passwords** | `POST /auth/change-password` (sabke liye), `POST /users/:id/reset-password` (admin; student + faculty) |
| **Security** | Web par HSTS + security headers; encrypted backups (`BACKUP_PASSPHRASE`) + `deploy.sh restore-test` |
| **Legal / Play Store** | Public pages `/privacy`, `/terms`, `/delete-account` (bina login). Pehli login par terms + privacy consent (18 se kam ho to guardian ka naam + consent), record `consents` table mein. App Profile → Delete my account; admin web → Deletion Requests (personal data mitata hai, anonymous scores rehte hain). Institute naam/email/phone/address: Settings → Institute details. |
| **Self-registration + demo** | App/web: "Create account" (naam, phone, email, course, password) → email par 6 digit OTP → account bana, student **PENDING = demo**. Demo student ko sirf "Free demo" notes/tests (admin materials/test par tick karta hai); doubts/classes band. Admin web → **Registrations**: batch choose karke Approve (full access + email) ya Reject. |
| **Forgot password** | App + web: phone/email → account ke email par OTP → naya password (saare devices logout). |
| **Email (SMTP)** | `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` (production.env). Bina SMTP: dev mein OTP backend log mein, production mein "email not set up". |
| **App security** | Admin/faculty app mein login nahi kar sakte (`STAFF_USE_WEB`). Screenshot/recording block (FLAG_SECURE, pehle se). Developer options ya USB debugging on → app nahi chalegi, "Check again" screen. Doosre apps ke overlay windows chhupe (Android 12+). |
| **Recorded videos (link)** | Admin web → Recorded Videos: YouTube (unlisted)/Drive link, batch-wise ya "Free demo". App Home → Videos. Apna upload + encrypted HLS abhi baaki. |
| **App Home** | Quick icons grid (Notes, Tests, Live classes, Videos, Doubts, Profile) + "Live now" banner. |
| **Dev options switch** | Admin web → Settings → "Block Developer options" (default on). |

Tests: `npm run smoke:profile` (56 checks), `npm run smoke:privacy`, `BACKEND_LOG=<log file> npm run smoke:register`.

## Ek nazar mein

| Part | Status | Kaise check hua |
|---|---|---|
| Folder structure + docs | ✅ done | — |
| Local Postgres 18 (Docker) | ✅ chal raha | `docker compose ps` healthy |
| Database schema (saare modules, 39 tables) | ✅ migrate + seed ho gaya | `prisma migrate dev`, `db:seed` |
| Backend: auth, roles, device rule, health | ✅ chal raha | unit tests 8/8, `smoke:auth` 27/27, `npm run build` |
| Backend Phase 1: courses, batches, students, enquiries, faculty, dashboard | ✅ DB par run + check hua (2026-10-05) | endpoints 200; documents upload + CSV export baaki |
| Backend Phase 2: subjects/topics, **doubts**, **questions**, **tests + attempts**, **materials + storage** | ✅ chal rahe | `smoke:tests` 26/26, `smoke:materials` 23/23 + doubt flow manual check |
| Backend Phase 3: **classes** (Zoom link + premiere, weekly series, clash check, join window, attendance) | ✅ `smoke:classes` 27/27 | join link student ko sirf `join` se, class se 15 min pehle se |
| Backend: notifications (FCM) — class reminder (10 min pehle), reschedule/cancel, doubt reply, `PUT /notifications/token` | 🟨 code ready, build + `smoke:classes` pass; **Firebase keys lagne ke baad hi push jayega** | token endpoint manual check; asli push abhi test nahi hua |
| Backend: baaki stubs (videos, fees) | ⬜ khali | sirf `@Module({})` |
| Admin/Faculty web panel (Next.js) | 🟨 asli UI: dashboard, students, courses+batches, enquiries, **question bank (+subjects/topics), tests (builder + results), study material (upload/replace/view), doubts (thread/assign/resolve)**. Baaki placeholder: videos, classes, fees, roles | build/lint/tsc pass; `node scripts/smoke-phase2.mjs` 13/13 (proxy ke through) |
| Student web panel (iOS ke liye) | 🟨 login + shell + basic pages + **doubts (ask/thread/resolve)** | smoke pass; notes/tests jaan-boojh kar Android-only |
| Android app (Flutter) | 🟨 login, token refresh, watermark (har screen par), **notes list + PDF viewer (memory-only), tests (timer, autosave, background report, result/review), doubts (ask/thread/resolve)** | `flutter analyze` clean. **`flutter test` Application Control policy se block (dartaotruntime.exe); app device/emulator par run nahi hua** |
| CI, VPS deploy, Play Store | ⬜ | — |

## Phase 2 backend (2026-10-05)

| Module | Endpoints | Rules |
|---|---|---|
| Subjects/topics | `/subjects`, `/topics` (admin; faculty topics bana sakta hai) | course → subject → topic |
| Doubts | `/doubts` list/get/create (student), `:id/messages`, `:id/assign` (admin), `:id/resolve`, `:id/reopen` | student sirf apne; faculty: assigned ya apne batch ke unassigned; reply par status auto-badalta hai |
| Questions | `/questions` CRUD + `/questions/bulk` (200 tak) | sirf staff; SINGLE = exactly 1 correct; jis question par student answers hain uske options edit nahi (409) |
| Tests | `/tests` builder, `:id/questions`, `:id/batches`, `publish`, `close`, `results` | attempt shuru hone ke baad edit band; faculty sirf apne tests |
| Attempts (student) | `/my/tests`, `/my/tests/:id/start`, `/attempts/:id` (paper), `PUT /attempts/:id/answers` (autosave), `background`, `submit`, `result` | server-side timer; ek attempt per student; paper mein `isCorrect` kabhi nahi; negative marking; cron har minute expired attempts auto-submit; answers ka review test close / window khatam hone ke baad hi |
| Materials | `/materials` upload (multipart PDF, 25 MB), `:id/replace`, `view-url`, `download-url`, `:id/views` | PDF magic-bytes check; batch-wise access; download flag; version history; archive (hard delete nahi) |
| Files | `GET /api/files/:key?exp&d&n&sig` | HMAC-signed 3 min link; tamper/expiry/path traversal reject; files `backend/storage/` mein (git-ignored, `STORAGE_DIR`) |

Tests: `npm run smoke:tests` (26 checks), `npm run smoke:materials` (23 checks) — server chalu ho, demo seed users use hote hain.

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
Next.js 16 (App Router) + Tailwind 4, design DHĪ artifact ke tokens se (Sora + Plus Jakarta Sans, primary `#3949AB`).

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

1. **Play Store se pehle:** final package id `com.dhiayurved.app` (done; Firebase app pending), release signing key + AAB, apna domain, Settings mein institute ka email/phone/address, privacy policy lawyer se ek baar check, Data safety form + listing ([docs/13](docs/13-play-store-compliance.md)).
2. **Server:** naya code deploy + naya APK; production.env mein `BACKUP_PASSPHRASE` daalo, phir `deploy.sh backup` + `deploy.sh restore-test`. Firewall/SSH hardening owner ke saath (shared VPS).
3. **Jaan-boojh kar baad mein:** recorded lectures (video upload + HLS), fees/Razorpay, apna live system (BBB/LiveKit), OTP/email se khud password reset.
4. Infra: CI, Sentry/uptime alerts.

## Dhyan dene wali baatein

- **`admin-web/.git` nested repo hai.** `create-next-app` ne bana diya (sirf "Initial commit from Create Next App"). Poore project ke liye ek hi repo chahiye, to root par `git init` se pehle isse hatao: `Remove-Item -Recurse -Force admin-web\.git`. Maine delete nahi kiya (auto-mode ne roka).
- **Flutter PATH mein nahi hai.** Use karne ke liye `C:\src\flutter\bin\flutter.bat` ya PATH mein `C:\src\flutter\bin` jodo.
- **Android build abhi nahi chalega:** `flutter doctor` ke hisaab se Android SDK mein *cmdline-tools* nahi hai aur licenses accept nahi hain. Android Studio → SDK Manager → "Android SDK Command-line Tools" install karo, phir `flutter doctor --android-licenses`. (Licenses aapko khud accept karne hain.)
- **`applicationId` = `com.dhiayurved.app`** (final, 2026-10-10). Play Store ka saara material: [play-store/](play-store/README.md).
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

## FCM setup (push notifications)

Code taiyar hai; sirf Firebase ki do files chahiye (dono git-ignored):
1. Firebase console → project → Android app add karo (package id wahi jo `applicationId` hai) → `google-services.json` ko `student-app/android/app/` mein rakho.
2. Project settings → Service accounts → *Generate new private key* → JSON `backend/firebase-service-account.json` mein rakho aur `backend/.env` mein `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` do (Docker mein `FIREBASE_SERVICE_ACCOUNT_JSON`).
3. Backend restart; log mein `FCM enabled` dikhna chahiye. App ko dobara build karo.

Kaun sa push kab: class se 10 min pehle (batch ke students + teacher), class reschedule/cancel, doubt par jawab (student ko) / student ka follow-up (assigned faculty ko). Package id badalna ho to **pehle badlo**, phir Firebase app banao.
