# App access for Google's reviewers

The whole app is behind a login, so Google needs a working account. Without it, the app is rejected.

**This repo is public. Never write the reviewer's password in this folder.** Put it only in Play Console and in `ACCESS.private.md`, which git ignores.

## 1. Make the reviewer account (once, on the live panel)

1. Admin panel → Students → **Add student**
   - Name: `Google Play Review`
   - Phone: an unused number, for example `9000000009`
   - A strong password
2. Put the student in a batch that has at least one test, one note, one video and a class in the coming days, so the reviewer sees real screens.
3. Make the student **Active**.
4. Write the phone and password in `ACCESS.private.md`.

## 2. Before you send a version for review

Admin panel → **Settings → Student app → Play Store review mode: On**.

Why: Google tests the app on emulators, on phones with Developer options switched on, and from many different devices. Normally the app refuses those, and a student can add only 3 new phones in 30 days. Review mode lifts the emulator check, the Developer options check and the new-phone limit.

**Rooted phones and rooted emulator images are still blocked in review mode.** If Google rejects the app because "it did not open on our device", tell us and we will change that.

Switch review mode **off** once the version is approved.

## 3. Text for Play Console

Play Console → App content → **App access** → "All or some functionality is restricted" → **Add instructions**:

- Name: `Student login`
- Username: the reviewer's phone number
- Password: the reviewer's password
- Any other information:

```
This is the app of a coaching institute for Ayurveda students. Log in with the mobile number and password above.
After login you can open: Courses (the institute's course list; it only describes the courses, nothing is sold), Tests (take a test and see the result), Notes (PDF study material), Classes (scheduled live classes), Doubts (ask a question to the teacher) and Profile.
Screenshots are blocked inside the app to protect the institute's study material.
The app does not sell anything; courses are sold only on the institute's website.
```
