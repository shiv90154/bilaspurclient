# 10. Android Content Protection

**Phase:** 1 → 3 · **Applies to:** Flutter Android app · Related: [04-notes](04-notes-study-material.md), [02-question-bank](02-question-bank.md), [03-online-classes](03-online-classes.md)

## Goal
Notes, tests aur live class ka content copy/record/leak na ho sake (jitna Android par possible hai).

## Features
| # | Feature | Kaise | Phase |
|---|---|---|---|
| 1 | Screenshot + screen recording block | `FLAG_SECURE` (Flutter: `flutter_windowmanager_plus` / `screen_protector` ya MethodChannel) | 1 |
| 2 | Watermark (naam + phone) | PDF viewer aur test screen par halka overlay, tiled/diagonal | 2 |
| 3 | Root + emulator detection | `flutter_jailbreak_detection` / Play Integrity API; rooted ho to login block | 1 |
| 4 | Notes sirf in-app | Viewer, download off, encrypted storage, share/open-with nahi | 2 |
| 5 | Ek student, ek device | Device ID backend mein bind; **naye device par login = purana device auto-logout** (client ka decision) | 1 |
| 6 | Recorded video protection | HLS+AES + signed URLs + FLAG_SECURE + watermark ([11](11-recorded-lectures.md)); Widevine DRM optional baad mein | 2–3 |

## Extra hardening (optional)
- Play Integrity API (app genuine hai ya nahi).
- App background jaye to sensitive screen blur/blank.
- Developer options / USB debugging / overlay apps detect karke warn.
- Test ke dauran app switch log (cheating signal).

## Limitations (client ko batana)
- Doosre phone/camera se photo/video: **rok nahi sakte** — watermark deterrent hai.
- Rooted device par determined user bypass kar sakta hai.
- Website (iOS) par screenshot block **nahi** ho sakta → protected content web par nahi.
- Zoom app ki class record hone se nahi bachti; BBB in-app WebView mein possible hai.

## Backend support
- `devices` table (user_id, device_id, model, first_seen, status: active/pending/blocked)
- Login par device check; naya device login → purane device ke saare refresh tokens revoke (auto-logout), naya device `active`.
- Purana device agle API call par 401 `SESSION_REPLACED` pata kare aur login screen dikhaye.
- Abuse rokne ke liye: device change ki limit (e.g. 2 baar/mahina) + admin override `POST /users/:id/reset-device`.
- Watermark data (naam, phone) login response se.
- Signed URLs ([04](04-notes-study-material.md)).

## Kaise banana hai (steps)
1. Flutter: `FLAG_SECURE` ek global service mein (on/off per screen), test karo record/screenshot black aa raha hai.
2. Device ID: `device_info_plus` se stable ID + backend binding.
3. Root/emulator check app start aur login par; fail par message + block.
4. Watermark widget (reusable) — PDF page aur test screen par.
5. Secure PDF viewer (in-memory/encrypted), koi share nahi.
6. Admin web: device history + reset screen.
7. QA matrix: alag Android versions (10–15), Samsung/Xiaomi, screen recorder apps, Cast, emulator.

## Progress
- [ ] FLAG_SECURE service
- [ ] Screenshot/recording test (real devices)
- [x] Device binding (backend)
- [x] Auto-logout on new device (token revoke + SESSION_REPLACED)
- [x] Device change limit (3 / 30 days) + admin reset endpoint (backend)
- [ ] Admin web: device history + reset screen
- [ ] Root detection
- [ ] Emulator detection
- [ ] Play Integrity (optional)
- [ ] Watermark widget
- [ ] Watermark on PDF viewer
- [ ] Watermark on test screen
- [ ] Secure in-app PDF viewer
- [ ] Background blur/blank
- [ ] BBB in-app with FLAG_SECURE (Phase 3)
- [ ] QA across devices
