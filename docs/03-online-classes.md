# 3. Online Classes

**Phase:** 3 · **Depends on:** [01-student-management](01-student-management.md)

## Requirement
Virtual classes/meetings Zoom ya BigBlueButton se. BigBlueButton live sessions, recording, screen sharing aur attendance de sakta hai.

## Do raaste
| | Zoom / Meet link | BigBlueButton (BBB) |
|---|---|---|
| Setup | Aasaan, bas link | Alag server chahiye |
| Cost | Zoom plan ya free limit | Server (8GB+ RAM, public IP, ports) |
| In-app experience | Zoom app khulega | WebView/in-app (FLAG_SECURE lag sakta hai) |
| Attendance/recording | Zoom API se | BBB API se |
| Screen record block | ❌ Zoom app ke bahar | ✅ App WebView mein possible |

**Plan (client decision):** teeno types support honge:
1. `zoom` – Zoom/Meet link wali class.
2. `own_live` – hamara apna live system (in-app, FLAG_SECURE ke saath).
3. `premiere` – recorded video ko live ki tarah chalana ([11-recorded-lectures](11-recorded-lectures.md)).

**V1 = Zoom/Meet link + premiere.** `own_live` (BBB/LiveKit) **optional** hai, V1 mein skip. Client ko Zoom ka kharcha ya in-app live chahiye lage to baad mein jodenge. Backend mein `type` field pehle se hai, to baad mein jodna aasaan rahega.

### Apna live system – options
| Option | Pros | Cons |
|---|---|---|
| **BigBlueButton** | Requirement mein likha hai; whiteboard, recording, attendance, breakout built-in | Heavy server (8GB+ RAM, public IP), UI WebView mein, customize kam |
| **LiveKit** (open-source WebRTC) | Flutter SDK, native in-app UI, FLAG_SECURE aasaan, scalable | Whiteboard/attendance/recording khud banana padega (egress), dev time zyada |
| Jitsi | Aasaan setup | Classroom features kam, zyada viewers par heavy |

Recommendation: **pehle BBB** (kam dev time, features ready). Agar custom UI aur bahut zyada students chahiye to LiveKit. Decision client ke concurrent-viewers number par.

### Zoom jaisa kya milega (BBB self-hosted)
Video/audio, screen share, whiteboard, chat, polls, raise hand, breakout rooms, recording, attendance. **Scheduling hamara apna** (BBB mein nahi): `live_classes` + calendar + reminders + recurring classes.

### Scheduling features (hamare backend mein)
- One-time aur **recurring** class (roz/weekly, batch-wise timetable).
- Reschedule / cancel → students ko push notification.
- Reminder (30 min / 10 min pehle), "Live now" status.
- Faculty clash check (same time do class nahi).
- Join sirf class time ke aas-paas, sirf apne batch ko.
- Auto attendance (join/leave) + recording auto-attach.

### Live ke dauran doubts
- BBB chat + polls (in-class).
- "Raise doubt" button → [05-student-doubts](05-student-doubts.md) mein doubt, class + timestamp ke saath link.

### Risks
- BBB Android mein WebView se chalega; mic/camera permission aur FLAG_SECURE **pehle hi prototype karke test karo**.
- BBB server sizing concurrent users par depend karta hai; backend wale server par mat chalao.

## Scope V1 (link-based)
- Faculty/admin class schedule karta hai: title, batch, date-time, link.
- Students ko batch ke hisaab se upcoming/live classes dikhti hain, "Join" button.
- Reminder notification (FCM) class se pehle.

## Scope V2 (BBB)
- Backend BBB API se meeting create, join URL (role: moderator/viewer).
- Recording list, attendance (join/leave times).
- Android mein BBB in-app WebView + FLAG_SECURE.

## Database tables
- `live_classes` (id, batch_id, faculty_id, title, provider, start_at, end_at, join_url, meeting_id, status)
- `class_attendance` (class_id, student_id, joined_at, left_at, duration)
- `class_recordings` (class_id, url, duration, created_at)

## API endpoints
- `CRUD /classes`, `GET /classes/upcoming`, `GET /classes/live`
- `POST /classes/:id/join` (BBB join URL banata hai)
- `GET /classes/:id/attendance`, `GET /classes/:id/recordings`
- BBB webhook: `POST /bbb/events` (attendance)

## Screens
- **Admin web:** class scheduler, attendance report.
- **Android:** upcoming classes list, Join, recordings.
- **Student web:** class list + Join (browser).

## Kaise banana hai (steps)
1. Tables + class CRUD (link-based).
2. FCM push reminders (cron job: 10 min pehle).
3. Flutter class list + join (url_launcher).
4. BBB server setup (Ubuntu 22, `bbb-install`), SSL, firewall ports.
5. Backend BBB client: `create`, `join`, `getRecordings`, webhooks.
6. Flutter WebView for BBB + FLAG_SECURE.
7. Attendance report in admin web.

## Progress
- [x] Live classes CRUD
- [x] Batch-wise visibility
- [x] FCM reminders (code ready; needs Firebase keys on the server)
- [x] Android: classes list + join
- [x] Admin web: scheduler
- [ ] BBB server setup
- [ ] BBB API integration
- [x] Attendance capture (join from the app is recorded)
- [ ] Recordings list
- [ ] Android: BBB in-app + FLAG_SECURE
- [x] Attendance report (Reports → Attendance, class-wise and student-wise, CSV)

## Notes
- Zoom link wali class ko screen-record se bacha nahi sakte. Client ko batao.
- BBB server ka cost aur maintenance alag.
