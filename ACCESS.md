# DHĪ: links, app download and roles

Last updated: 6 October 2026. Android app version: 1.4.1.

This repository is public, so **no login IDs or passwords are stored here**. They are kept in `ACCESS.private.md` on the developer's computer (git-ignored). The Super Admin password is also in `deploy/production.env` on the server. Ask the developer for the private file.

## Open the system

| What | Link |
|---|---|
| Website and web panel (Super Admin, Faculty and Students) | https://dhīayurveda.com |
| Android app download | https://dhīayurveda.com/mobile-app |
| System check (should say "ok") | https://api.dhīayurveda.com/api/health |

The app download page opens after you sign in as **Super Admin**. Press **Download APK** to get the newest version.

## Logins: one for each role

| Role | Use it on | Login ID and password |
|---|---|---|
| Super Admin | Web panel | In the private file |
| Faculty (demo) | Web panel | In the private file |
| Student (test) | Android app | In the private file |

Type the 10 digit phone number in the **Phone or email** box.

## What each login can do

**Super Admin** can do everything:

- **Dashboard**: numbers at a glance and shortcuts (add a student, create a test, schedule a class, upload notes, answer doubts).
- **Students**: add students, put them in batches, and press **Reset devices** when a student changes phone.
- **Enquiries**: follow up admission enquiries.
- **Courses & Batches**: courses, batches, subjects and topics.
- **Question Bank**: add questions one by one or import many from a CSV file. Pictures are supported.
- **Tests**: build tests and test series, choose the batches, and see results with ranks.
- **Study Material**: upload PDF notes for a batch.
- **Online Classes**: schedule Zoom or Google Meet classes. Students join from the app and attendance is marked.
- **Doubts**: answer students' doubts.
- **Mobile App**: upload and download the Android app.
- **Roles & Access**: create and manage Faculty logins.

**Faculty** sees Dashboard, Students, Question Bank, Tests, Study Material, Online Classes and Doubts. Faculty cannot open Mobile App or Roles & Access.

**Student** uses the Android app: Home, Study (PDF notes), Tests, Doubts, Profile, and Live classes from the Home screen.

## Try the sample test

A ready test, **Himachal Pradesh GK: Practice Test 1**, is already published for the batch "General Batch", which the test student belongs to. It has 25 questions, 25 minutes, 1 mark each and 0.25 marks off for a wrong answer.

Sign in to the app as the Student, open **Tests** and press **Start test**. After you submit, the app shows the result. In the web panel, open **Tests**, select the test and scroll to **Results** to see every student's marks and rank.

## Install the Android app

1. Sign in to the web panel as Super Admin and open **Mobile app**. Press **Download APK**. It always gives the newest version.
2. Send the file to the phone: WhatsApp, Google Drive or a USB cable all work.
3. On the phone, tap the file. If Android asks, allow **Install unknown apps** for the app you opened it from, then press **Install**.
4. Open **DHĪ** and sign in with the Student login.

## Good to know

- **Android only.** iPhone users sign in on the web panel and get Classes, Doubts and Profile. Notes and tests stay in the Android app on purpose, to protect them.
- **One phone at a time.** Signing in on a second phone signs the first one out. A student can use up to 3 different phones in 30 days. When a student gets a new phone, the Super Admin opens **Students**, selects the student and presses **Reset devices**.
- **Protected screens.** The app blocks screenshots and screen recording, and every screen shows the student's name and number as a faint watermark.
- **Rooted phones and emulators** are not allowed. The app will not open on them.
- **Demo logins.** "Demo Faculty" and "Test Student" are test accounts. Remove them (Roles & Access for faculty, Students for the student) before real students start.
- **Old addresses.** The earlier nip.io addresses still work and forward to dhīayurveda.com. Students should update to app version 1.5.1 or later, which uses the new domain.
