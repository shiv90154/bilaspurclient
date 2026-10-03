# 11. Recorded Lectures (Video) + Simulated Live

**Phase:** 2–3 · **Depends on:** [04-notes](04-notes-study-material.md), [10-android-protection](10-android-protection.md) · Related: [03-online-classes](03-online-classes.md)

## Requirement (client se confirm hua)
- Recorded lectures bhi upload honge.
- Recorded lecture ko **"live" ki tarah chalaya ja sakta hai** (scheduled premiere): admin/faculty ek recorded video ko kisi time par live class jaisa chala de.

## Scope V1
- Faculty/admin video upload (title, subject, chapter, batches, thumbnail).
- Server par transcode → **HLS** (multiple qualities: 360p/480p/720p).
- Batch-wise access, same as notes.
- Android player: quality switch, speed, resume from last position.
- **Protection:** HLS AES-128 encryption + short-lived signed URLs + FLAG_SECURE + watermark overlay (naam + phone).
- Progress tracking (kitna dekha) — admin report.

## Simulated live (premiere)
- Admin ek video ko `live_classes` entry se attach karta hai: `type = premiere`, `start_at`.
- Server time se **live position** nikalta hai: `position = now - start_at`.
- Student jab join kare to us position se play hota hai (late joiner beech se). **Seek forward/back band** (live ki tarah), pause optional off.
- Live badge, viewers count, optional chat/doubt box.
- Video khatam hone par class `ended`; baad mein normal recorded lecture ban jaye (admin choice).

## Video protection – options
| Option | Protection | Cost / effort |
|---|---|---|
| HLS + AES-128 + signed URLs | Medium (key leak possible) | Low – self-host ya storage + ffmpeg |
| + FLAG_SECURE + watermark | Medium+ (screen record block) | Low |
| **Widevine DRM (L1/L3)** | High | Third-party provider chahiye (VdoCipher, Bunny Stream, Mux, Cloudflare Stream etc.) – monthly cost |

Plan: V1 = HLS+AES+FLAG_SECURE+watermark. DRM provider baad mein, agar client piracy ko lekar serious hai.

## Database tables
- `videos` (id, title, subject_id, topic_id, duration, status, hls_key, thumbnail_url, uploaded_by, created_at)
- `video_batches` (video_id, batch_id)
- `video_progress` (video_id, student_id, last_position, watched_pct, updated_at)
- `live_classes` (extra columns) `type` = `zoom | own_live | premiere`, `video_id`

## API endpoints
- `POST /videos` (upload init / tus / multipart), `GET /videos?subject=&topic=`, `PATCH/DELETE /videos/:id`
- `GET /videos/:id/playback` → signed HLS manifest URL + key endpoint
- `PUT /videos/:id/progress`
- `POST /classes` with `type=premiere&video_id=` ; `GET /classes/:id/live-position`

## Screens
- **Admin web:** upload (progress bar), transcoding status, assign batches, schedule premiere.
- **Android:** subject → chapter → video list, player, "Live now" section.
- **Student web:** playback basic ya skip (screen record rok nahi sakte).

## Kaise banana hai (steps)
1. Storage (VPS disk ya S3-compatible) + CDN baad mein.
2. Upload → queue (BullMQ/Redis) → **ffmpeg** worker HLS + AES key.
3. Playback API: access check (batch), signed URL, key delivery endpoint (auth required).
4. Flutter player (ExoPlayer via `media_kit`/`better_player`), FLAG_SECURE on, watermark overlay.
5. Progress sync.
6. Premiere: live-position API + locked-seek player mode.
7. Admin web upload + schedule UI.
8. Load test: concurrent viewers vs bandwidth (video bandwidth hi sabse bada kharcha hoga).

## Progress
- [ ] Upload API + storage
- [ ] ffmpeg HLS worker (queue)
- [ ] AES key + signed URL playback
- [ ] Batch access check
- [ ] Android player + quality/speed
- [ ] FLAG_SECURE + watermark on player
- [ ] Resume / progress tracking
- [ ] Admin web: upload + status
- [ ] Premiere (simulated live) API
- [ ] Android: premiere player (locked seek, join at live position)
- [ ] Viewers count / chat (optional)
- [ ] Bandwidth/load test
- [ ] (Later) DRM provider decision

## Notes
- **Storage + bandwidth cost** video ke saath tezi se badhta hai. Client se expected hours of video aur concurrent viewers poochho.
- Copyrighted content upload na ho — faculty ki apni lectures hi.
