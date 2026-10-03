# 8. Mobile + Admin System

**Phase:** 0 → 3 (infra pehle, app/portal saath-saath)

## Requirement
Android/iOS student app + web-based admin/faculty portal + backend/API + centralized database + cloud/VPS hosting.

## Decision (change from original)
- **Android:** Flutter app, full features.
- **iOS:** native app **nahi**; iOS users student web panel (Next.js) use karenge — kuch features skip.
- **Admin/Faculty:** Next.js web portal.
- **Backend:** Node.js (NestJS) + PostgreSQL, ek hi API sab ke liye.

## Architecture
```
Android (Flutter) ─┐
Student web (Next) ─┼──► HTTPS ──► Node.js API ──► PostgreSQL
Admin web (Next) ──┘                    │
                                        ├──► File storage (private, signed URLs)
                                        ├──► FCM (push)
                                        └──► BBB / Zoom (Phase 3)
```

## Student web (iOS) – kya hoga / nahi
| Feature | Web |
|---|---|
| Login, profile, batch | ✅ |
| Doubts, announcements | ✅ |
| Classes list + Join | ✅ |
| Notes / Tests | ⚠️ Limited ya skip (screenshot rok nahi sakte) |
| Push notifications | ⚠️ iOS 16.4+ aur Home Screen par add karne par |
| Offline | ❌ |

## Server plan (Hostinger VPS) — numbers confirm hone par final
| Server | Kaam | Size (starting point) |
|---|---|---|
| **A: App server** (e.g. KVM 2: 2 vCPU / 8GB / NVMe) | Node API, PostgreSQL, Next.js, Redis | KVM 2 kaafi |
| **B: Live server** (BBB) — *optional, V1 mein nahi* | Sirf BigBlueButton | min 4 vCPU / 8GB, better 8 vCPU / 16GB, clean Ubuntu 22.04, public IPv4 |
| **C: Video storage + CDN** | Recorded lectures | VPS disk nahi; **Cloudflare R2 / Backblaze B2 / Bunny** (VPS bandwidth video ke liye kam padegi) |
| Transcoding | ffmpeg HLS | CPU heavy → raat ko queue se, ya Bunny/Cloudflare Stream ka transcoding |

Spec/price Hostinger site par verify karo; plans badalte rehte hain.
Ek hi KVM 2 par API + DB + BBB + video transcoding **mat** chalao — live class mein lag aayega.

## Infra
- 1 VPS (4GB RAM start), Ubuntu, Nginx reverse proxy, PM2/Docker.
- PostgreSQL daily backup (off-server copy).
- Environments: `dev` (local), `staging` (VPS), `prod`.
- Domain + SSL (Let's Encrypt).
- BBB ke liye alag VPS (Phase 3).
- Play Store: developer account ($25 one-time), signed AAB, privacy policy.

## Kaise banana hai (steps)
1. Repo: `backend/`, `admin-web/`, `student-app/`.
2. Backend scaffold (NestJS), Prisma/TypeORM, env config, Swagger docs.
3. Docker compose (Postgres + API) local dev ke liye.
4. Next.js scaffold: auth, layout, API client; `/admin` aur `/student` route groups.
5. Flutter scaffold: theme (EduManage design), routing, API client, secure storage.
6. CI: lint + test on push.
7. VPS setup, Nginx, SSL, deploy script.
8. Backups + monitoring (uptime, logs).
9. Play Store build, internal testing track, release.

## Progress
- [x] Repo structure
- [x] Backend scaffold + Swagger
- [x] Docker compose (local)
- [x] Admin web scaffold
- [x] Student web scaffold (login, shell, basic pages)
- [ ] Flutter scaffold + theme (empty project created with `flutter create`; packages, theme and app code still to do)
- [ ] CI pipeline
- [ ] VPS + Nginx + SSL
- [ ] Staging deploy
- [ ] DB backups
- [ ] Monitoring / logs
- [ ] FCM setup
- [ ] Play Store account + internal test
- [ ] Production release

## Notes
- Design reference: https://claude.ai/artifact/Pm2ky7esoshwBEiS1UYAPU
