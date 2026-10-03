# EduManage – Coaching App: Master Plan

**Current status: [PROGRESS.md](PROGRESS.md)** (what is built, how to run it, what is left)

Original requirement: [requrment.md](requrment.md)
UI reference artifact: https://claude.ai/artifact/Pm2ky7esoshwBEiS1UYAPU

## Final decisions
| Part | Tech | Scope |
|---|---|---|
| Android student app | Flutter | **Full features** + screen security |
| Backend / API | Node.js (NestJS) + PostgreSQL | Sab clients ke liye ek |
| Admin / Faculty panel | Next.js | Full |
| Student web panel (iOS users) | Next.js | Basic only. Protected cheezein skip |
| iOS native app | — | Abhi nahi |
| Hosting | VPS + SSL (Let's Encrypt) | Phase 3 mein BBB ke liye alag server |

## Repo structure (planned)
```
Bilaspur/
├── PLAN.md
├── requrment.md
├── docs/            ← module-wise md files
├── backend/         Node.js + PostgreSQL
├── admin-web/       Next.js (admin/faculty + student web)
└── student-app/     Flutter (Android)
```

## Module files
| # | Module | File | Phase |
|---|---|---|---|
| 1 | Student Management | [docs/01-student-management.md](docs/01-student-management.md) | 1 |
| 6 | Role-Based Access | [docs/06-role-based-access.md](docs/06-role-based-access.md) | 1 |
| 9 | Security | [docs/09-security.md](docs/09-security.md) | 0–3 |
| 7 | Admin Dashboard | [docs/07-admin-dashboard.md](docs/07-admin-dashboard.md) | 1 → 3 |
| 4 | Notes & Study Material | [docs/04-notes-study-material.md](docs/04-notes-study-material.md) | 2 |
| 2 | Question Bank & Tests | [docs/02-question-bank.md](docs/02-question-bank.md) | 2 |
| 5 | Student Doubts | [docs/05-student-doubts.md](docs/05-student-doubts.md) | 2 |
| 3 | Online Classes | [docs/03-online-classes.md](docs/03-online-classes.md) | 3 |
| 8 | Mobile + Admin System | [docs/08-mobile-admin-system.md](docs/08-mobile-admin-system.md) | 0 → 3 |
| — | Android Content Protection | [docs/10-android-protection.md](docs/10-android-protection.md) | 1 → 3 |
| — | Recorded Lectures + Simulated Live | [docs/11-recorded-lectures.md](docs/11-recorded-lectures.md) | 2–3 |
| — | Fees & Payments (website only) | [docs/12-website-fees-payments.md](docs/12-website-fees-payments.md) | Web, parallel |
| — | Play Store Compliance | [docs/13-play-store-compliance.md](docs/13-play-store-compliance.md) | 3 |

## Phases
| Phase | Kaam | Time |
|---|---|---|
| 0 – Setup | Repo, DB schema, auth, roles, hosting, CI | 1 hafta |
| 1 – Core | Student mgmt, roles, dashboard v1, device binding | 3–4 hafte |
| 2 – Learning | Notes, Question bank + tests, Doubts, watermark viewer | 3–4 hafte |
| 3 – Live & polish | Online classes, reports, dashboard v2, hardening, Play Store | 2–3 hafte |
| Web (parallel) | Student web panel (basic) | +1–2 hafte |

Total andaza (pehle): 11–13 hafte. **Recorded video + apna live system + fees/Razorpay jodne se ab andaza ~16–20 hafte** (video pipeline aur live system sabse bade items hain).

## Overall progress
Status: ⬜ not started · 🟨 in progress · ✅ done

| Module | Backend | Admin Web | Android App | Student Web |
|---|---|---|---|---|
| Setup / Infra | 🟨 | 🟨 | 🟨 | 🟨 |
| 1 Student Management | ⬜ | ⬜ | ⬜ | ⬜ |
| 2 Question Bank | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 Online Classes | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 Notes & Material | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 Doubts | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 Role-Based Access | 🟨 | 🟨 | ⬜ | 🟨 |
| 7 Admin Dashboard | ⬜ | ⬜ | — | — |
| 8 Mobile + Admin System | 🟨 | 🟨 | 🟨 | 🟨 |
| 9 Security | 🟨 | 🟨 | ⬜ | 🟨 |
| 10 Android Protection | 🟨 | — | ⬜ | — |
| 11 Recorded Lectures + Premiere | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 Fees & Payments (web only) | ⬜ | ⬜ | — | ⬜ |
| 13 Play Store Compliance | — | — | ⬜ | — |

## Client decisions (confirmed)
| Sawal | Jawab |
|---|---|
| Naye phone par login | **Purana device auto-logout** (admin approval nahi) |
| Recorded lectures | **Haan, upload honge** → [11](docs/11-recorded-lectures.md) |
| Recorded ko live chalana | **Haan** (simulated live / premiere) → [11](docs/11-recorded-lectures.md) |
| Live class | **V1: Zoom/Meet link + premiere.** Apna live system (BBB/LiveKit) optional, baad mein → [03](docs/03-online-classes.md) |
| Fees / payment | **App mein nahi.** Website par, admin approval + Razorpay → [12](docs/12-website-fees-payments.md) |
| Play Store | **Haan**, compliance dekhni hai → [13](docs/13-play-store-compliance.md) |

## Abhi bhi open
1. Kitne students / concurrent test-takers / concurrent live viewers?
2. Kitne ghante ka video expected (storage + bandwidth cost)?
3. Play Console account kiske naam par (Organization recommended)?
4. Apna live system (BBB/LiveKit) baad mein chahiye? V1 mein skip hai ([03](docs/03-online-classes.md)).
5. Video DRM (Widevine) chahiye ya HLS+AES+FLAG_SECURE kaafi?
