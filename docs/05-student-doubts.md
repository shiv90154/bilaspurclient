# 5. Student Doubts

**Phase:** 2 · **Depends on:** [01-student-management](01-student-management.md), [06-role-based-access](06-role-based-access.md)

## Requirement
Students app se doubts submit karte hain; faculty/admin receive karke respond karte hain; students status aur response track kar sakte hain.

## Scope V1
- Student doubt submit kare: subject/topic, text, optional image (photo of question).
- Doubt faculty ko assign (subject/batch ke hisaab se auto, ya admin manual).
- Faculty reply: text + image; ek doubt par back-and-forth thread.
- Status: `open → assigned → answered → resolved` (student "resolved" kar sake ya reopen).
- Student apni doubts ki list aur status dekhe.
- Push notification: reply aane par student ko, naya doubt aane par faculty ko.
- Admin ko overview: pending, avg response time.

## Database tables
- `doubts` (id, student_id, batch_id, subject_id, topic_id, title, status, assigned_to, created_at, resolved_at)
- `doubt_messages` (id, doubt_id, sender_id, sender_role, text, image_url, created_at)

## API endpoints
- `POST /doubts`, `GET /doubts/mine`, `GET /doubts?status=&assigned_to=` (faculty/admin)
- `GET /doubts/:id` (thread), `POST /doubts/:id/messages`
- `PATCH /doubts/:id/assign`, `PATCH /doubts/:id/status`

## Screens
- **Admin/Faculty web:** inbox with filters, thread view + reply, assign.
- **Android:** ask doubt (camera/gallery), my doubts, thread.
- **Student web:** same, basic.

## Kaise banana hai (steps)
1. Tables + migrations.
2. Doubt create with image upload.
3. Assignment rule: subject → faculty mapping; fallback admin queue.
4. Thread messages API (polling pehle, WebSocket baad mein).
5. FCM notifications.
6. Status transitions with validation.
7. Flutter UI (chat-style thread).
8. Admin web inbox.
9. Tests: student sirf apni doubt dekhe, faculty sirf assigned/apne batch ki.

## Progress
- [x] Doubts + messages tables
- [ ] Create doubt API (+ image)
- [ ] Assignment logic
- [ ] Reply thread API
- [ ] Status flow
- [ ] FCM notifications
- [ ] Android: ask + list + thread
- [ ] Faculty web: inbox + reply
- [ ] Student web: basic
- [ ] Response-time stats
- [ ] Tests

## Notes
- Doubt image par bhi FLAG_SECURE ki zarurat nahi, par uploads size-limit karo.
