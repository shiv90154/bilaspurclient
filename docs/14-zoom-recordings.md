# 14. Zoom recordings → app (automatic)

**Depends on:** [03-online-classes](03-online-classes.md), [11-recorded-lectures](11-recorded-lectures.md)

## Kya hota hai
1. Teacher Zoom par class leta hai. Recording **cloud** mein hoti hai (Zoom Pro).
2. Class khatam → Zoom recording process karta hai → hamare server ko webhook `recording.completed` aata hai.
3. Server MP4 download karta hai (best view: screen + speaker) → **local disk ya Cloudflare R2** par save karta hai.
4. Zoom meeting number + time se **class match** hoti hai → us class ke **batch** ke liye Video ban jaati hai.
5. Batch ke students ko push aata hai: "Class recording ready". App → Videos mein **app ke andar** chalti hai (screenshot/screen recording block, naam+phone watermark).
6. Optional: copy ke baad Zoom se recording **trash** (30 din wahan rehti hai), taaki 5GB cloud kabhi na bhare.

Sab kuch idempotent hai: same recording dobara aaye to dobara video nahi banti.

### Safety nets
- **Retry:** download fail → har 10 min cron, back-off (10/20/40/80 min), 5 attempts. Admin panel se "Retry" bhi.
- **Missed webhook:** har ghante cron pichhle 48 ghante ki ended Zoom classes ke liye Zoom API se recording maangta hai.
- **Manual:** Admin/teacher → Online classes → Past → **Fetch recording**.
- **Koi class match nahi hui** (galat link/doosra meeting): video banti hai lekin **kisi batch ko nahi dikhti**. Admin → Recorded videos → **Batches** se assign karo.
- Server restart beech mein → 4 ghante baad "stuck" import khud retry.

## Class kaise banani hai (zaroori)
- Class ka **Join link** Zoom ka hona chahiye jisme meeting number ho: `https://us05web.zoom.us/j/81234567890?pwd=...`
  (Personal link `zoom.us/my/naam` se meeting number nahi milta; tab bhi hourly sweep nahi chalega. Normal meeting link use karo.)
- Meeting **usi Zoom Pro account** se host honi chahiye jiske keys server par hain.
- Weekly class ek hi recurring meeting link se chal sakti hai: har instance ka time alag hota hai, us se sahi class match hoti hai.
- Ek class mein meeting 2 baar start hui → 2 videos: "… (part 2)".

## Setup (ek baar, ~15 min)

### 1. Zoom settings (client ke Zoom Pro account mein)
- zoom.us → Settings → **Recording** → **Cloud recording** ON.
- **Automatic recording** ON → "Record in the cloud" (teacher bhool jaye tab bhi record ho).
- Cloud recording ke andar "Record active speaker with shared screen" ON (yahi best view hai).

### 2. Zoom app (Server-to-Server OAuth)
- marketplace.zoom.us → **Develop → Build App → Server-to-Server OAuth App** → naam: "DHI recordings".
- **App Credentials:** Account ID, Client ID, Client Secret copy karo.
- **Information:** naam, email bhar do.
- **Scopes** (Add Scopes, search karke):
  - recording ki files list/padhna (*View a meeting's recordings / list recording files*)
  - past meeting instances (*List past meeting instances*)
  - recording delete (sirf agar `ZOOM_TRASH_AFTER_IMPORT=true`)
- **Feature → Event Subscriptions** ON → Add:
  - URL: `https://<api-domain>/api/integrations/zoom/webhook`
  - Event: **Recording → All Recordings have completed**
  - **Secret Token** copy karo.
  - *Validate* tab dabana jab server par keys lag chuki hon (server khud challenge ka jawab deta hai).
- **Activate** the app.

### 3. Server (`deploy/production.env`)
```
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_WEBHOOK_SECRET=...        # Secret Token
ZOOM_TRASH_AFTER_IMPORT=true   # optional, recommended once everything works
VIDEO_STORE=local              # ya r2
```
Phir backend restart (`deploy.sh` jaisa normally). Admin → Recorded videos ke top par **Zoom recordings: Auto on · Zoom API on** dikhna chahiye.

### 4. Storage: local ya R2
| | local (default) | Cloudflare R2 |
|---|---|---|
| Cost | ₹0, server disk use | 10 GB free, phir ~$0.015/GB/mahina, **bandwidth free** |
| Kab | Shuru mein, kam classes | Disk bharne lage / zyada students |
| Setup | Kuch nahi | Cloudflare → R2 → private bucket → Manage API tokens → "Object Read & Write" |

R2 ke liye:
```
VIDEO_STORE=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=dhi-videos
```
Switch karne par purani videos jahan thi wahin se chalti rahti hain (har video apna store yaad rakhti hai).

Andaza: 1 ghante ki class ≈ 0.5–1 GB.

## Testing
- Unit: `npm test` (webhook signature, meeting number, range, best MP4).
- End-to-end with a fake Zoom: backend ko `scripts/smoke-zoom.mjs` ke header wale env ke saath chalao, phir `npm run smoke:zoom`.
- Real test: ek 2-min Zoom meeting (cloud record) ek class ke link se → khatam → 5–15 min mein Recorded videos mein.

## Code
- `backend/src/modules/zoom/`: `zoom-api.service.ts` (token, API, signature), `recording-import.service.ts` (queue, match, download, crons), `zoom.controller.ts`.
- `backend/src/modules/storage/video-store.service.ts`: local / R2; `files.controller.ts` mein Range (seek) support.
- Table `recording_imports` (queue + idempotency), `class_recordings.videoId`, `videos.sourceStore`.
- API: `POST /integrations/zoom/webhook` (public, signed), `GET /integrations/zoom/status|imports`, `POST /integrations/zoom/imports/:id/retry`, `POST /classes/:id/fetch-recording`, `GET /videos/:id/play`.
- App: `student-app/lib/features/videos/video_player_screen.dart` (video_player; speed, ±10s, full screen).
