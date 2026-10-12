# DHĪ: links, app download and roles

Last updated: 12 October 2026. Android app version: 1.0.0.

On 12 October 2026 the system moved to a new server and started empty: no courses, students, faculty, tests or notes. Add everything from the Super Admin panel.

This repository is public, so **no login IDs or passwords are stored here**. They are kept in `ACCESS.private.md` on the developer's computer (git-ignored). The Super Admin password is also in `deploy/production.env` on the server. Ask the developer for the private file.

## Open the system

| What | Link |
|---|---|
| Website and web panel (Super Admin, Faculty and Students) | https://dhiayurved.com |
| Android app download (no login) | https://dhiayurved.com/download |
| System check (should say "ok") | https://api.dhiayurved.com/api/health |

The download link always gives the newest app. The website's **Download for Android** buttons use it too.

## Login

| Role | Use it on | Login ID and password |
|---|---|---|
| Super Admin | Web panel | In the private file |

Faculty logins are made in **Roles & Access**. Students register themselves (or the admin adds them). Type the email or 10 digit phone number in the **Phone or email** box.

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

## Install the Android app

1. Open https://dhiayurved.com/download on the phone (or in the panel: **Mobile app** → **Download APK**).
2. Send the file to the phone: WhatsApp, Google Drive or a USB cable all work.
3. On the phone, tap the file. If Android asks, allow **Install unknown apps** for the app you opened it from, then press **Install**.
4. Open **DHĪ** and register, or sign in with a student login.

## Good to know

- **Android only.** iPhone users sign in on the web panel and get Classes, Doubts and Profile. Notes and tests stay in the Android app on purpose, to protect them.
- **One phone at a time.** Signing in on a second phone signs the first one out. A student can use up to 3 different phones in 30 days. When a student gets a new phone, the Super Admin opens **Students**, selects the student and presses **Reset devices**.
- **Protected screens.** The app blocks screenshots and screen recording, and every screen shows the student's name and number as a faint watermark.
- **Rooted phones and emulators** are not allowed. The app will not open on them.
- **Old app.** Phones with the old app 1.6.0 need the new APK installed once by hand; it installs over the old one.
