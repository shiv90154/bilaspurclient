# 13. Play Store Compliance Checklist

**Phase:** 3 (par decisions Phase 0 se) · **Depends on:** [08-mobile-admin-system](08-mobile-admin-system.md), [09-security](09-security.md), [12-website-fees-payments](12-website-fees-payments.md)

Research date: 2026-10-02. Policies badalte rehte hain — release se pehle Play Console Help dobara check karo.

## 1. Developer account
| Type | Rule |
|---|---|
| **Organization** account | 12-tester closed-test rule **nahi** lagta. Business/D-U-N-S verification chahiye |
| **Personal** account (13 Nov 2023 ke baad bana) | Production se pehle **closed test: 12 testers, 14 din continuous** (testers genuinely app use karein) |
| Developer verification | 2026 se naye personal accounts ke liye identity verification mandatory |

**Recommendation:** client ke naam par **Organization account** (coaching institute) — aur app ka owner client rahe, hamara nahi. Registration fee $25 one-time.

## 2. Technical requirements
- **Target API level:** 31 Aug 2026 ke baad naye apps/updates **Android 16 (API 36)** target karein. Flutter `targetSdk` 36, latest Flutter stable use karo.
- **App Bundle (.aab)**, Play App Signing ON.
- 64-bit support (Flutter default).
- Android 13+ `POST_NOTIFICATIONS` runtime permission (FCM ke liye).
- Permissions minimum: internet, notifications, camera (doubt photo, via picker). Storage permission avoid, system photo picker use karo.

## 3. Policy requirements
1. **Privacy Policy URL** (public webpage) + app ke andar link. Data collection (phone, address, documents, device ID, photos) saaf likho.
2. **Data safety form** sahi bharo (data collected, shared, encrypted in transit, deletion).
3. **Account deletion:** agar app mein account ban sakta hai to in-app deletion option + **web par deletion request URL** zaroori. Temporary deactivate kaafi nahi. Agar accounts sirf admin banata hai tab bhi deletion-request page rakho (safe side). Legal retention (e.g. fee records) privacy policy mein likho.
4. **App access for review:** app login-gated hai → Play Console mein **demo student credentials** + instructions do, warna reject.
5. **Content rating** questionnaire (IARC) bharo.
6. **Target audience & content:** students minors (13–17) ho sakte hain. Audience 13+ declare karo, **13 se kam ko target mat karo** (warna Families Policy). Ads/analytics SDK kam rakho.
7. **Payments policy:** fees website par hai (decision). App mein **koi price, "buy", "pay on website" link ya course-selling UI nahi** — Play Billing rule: app ke andar digital access ke liye payment ho to Google Play Billing zaroori (India mein external-payment program nahi). App sirf already-enrolled students ka content access karaye. Release se pehle policy dobara verify karo.
8. **User-generated content:** doubts private student↔faculty hain (low risk); phir bhi report/abuse contact rakho.
9. **Security features OK:** `FLAG_SECURE`, root detection, Play Integrity allowed. Par app description mein deceptive claims nahi.
10. **Copyright:** lectures/notes ka content client ka ho, third-party copyrighted material upload na ho.
11. **Store listing:** title, short/long description, icon 512×512, feature graphic 1024×500, phone screenshots (min 2), contact email.

## 4. India-specific (client + legal se confirm)
- **DPDP Act (India)**: minors ka data = parental consent requirements; privacy policy aur consent flow ke liye legal salah lo.
- Fees ke liye GST/invoice norms (client ka CA).

## Release steps
1. Org account banao + verification.
2. Internal testing track → closed testing (agar personal account ho to 12 testers × 14 din).
3. Store listing, privacy policy page, deletion page, data safety, content rating, app access details.
4. Pre-launch report (Play auto-tests) dekho, crashes fix.
5. Staged rollout (10% → 50% → 100%).

## Progress
- [ ] Account type decide (Organization recommended)
- [ ] Developer verification complete
- [ ] targetSdk 36 + AAB + App Signing
- [ ] Permissions audit (minimal)
- [ ] Privacy policy page (public URL)
- [ ] Account deletion (in-app + web URL)
- [ ] Data safety form
- [ ] Content rating
- [ ] Target audience (13+) declared
- [ ] Reviewer demo credentials added
- [ ] No pricing/pay UI in app (payments policy check)
- [ ] Store listing assets
- [ ] Internal → closed testing
- [ ] Pre-launch report clean
- [ ] Staged production rollout

## Sources
- Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Closed testing rule: https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026
