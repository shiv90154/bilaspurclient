# Building the app for the Play Store

The package name is final: **`com.dhiayurved.app`** (changed from the placeholder `com.edumanage.student_app` on 2026-10-10). Play never lets it change after the first upload.

## 1. Firebase (once, needed because the package name changed)

Push notifications only work with a `google-services.json` that names the new package.

1. https://console.firebase.google.com → the DHĪ project → Project settings → **Add app → Android**
2. Package name: `com.dhiayurved.app`, nickname `DHĪ`
3. Download `google-services.json` and replace `student-app/android/app/google-services.json` (git ignores it)
4. Copy the same file into the build worktree (`C:\Users\shiva\dhi-apk-build\student-app\android\app\`)

**Until you do this, the build fails** with "No matching client found for package name 'com.dhiayurved.app'". The server needs no change: it sends push through the same Firebase project.

## 2. Upload key (once)

Play signs the app for users with its own key (Play App Signing). We only need an **upload key**. If it is lost, Google can reset it, but that takes days, so keep a backup.

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
  -keystore "$env:USERPROFILE\dhi-upload.jks" -alias upload `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=DHI Ayurveda Classroom, O=DHI, L=Himachal Pradesh, C=IN"
```

Then create `student-app/android/key.properties` (git ignores it):

```properties
storeFile=C:/Users/shiva/dhi-upload.jks
storePassword=<the password you typed>
keyAlias=upload
keyPassword=<the same password>
```

- Keep a copy of `dhi-upload.jks` and the password with the client (a USB drive or their Google Drive), and write the password in `ACCESS.private.md`.
- Without `key.properties`, release builds are signed with the debug key, as before. That is fine for the APK link on the website, but Play refuses those builds.

## 3. Build the bundle

From the clean worktree (see the APK release notes), with the next build number:

```powershell
C:\src\flutter\bin\flutter.bat build appbundle --release --no-tree-shake-icons `
  --build-name=1.6.0 --build-number=11 `
  --dart-define=API_URL=https://api.dhiayurved.com/api
```

The file is `student-app/build/app/outputs/bundle/release/app-release.aab`.
`--no-tree-shake-icons` is needed on this PC because Windows Application Control blocks `font-subset.exe`.

## 4. Upload

1. Play Console → **Test and release → Testing → Internal testing** → Create release → upload the `.aab`.
2. Accept **Play App Signing** when asked.
3. Finish every section in [app-content.md](app-content.md), [data-safety.md](data-safety.md) and [listing.md](listing.md).
4. Personal developer account: a **closed test with 12 testers for 14 days** comes before production. Organisation account: you can go to production straight away.
5. Before sending for review, switch on **Settings → Play Store review mode** on the admin panel ([app-access.md](app-access.md)). Switch it off after approval.

## Students who installed the APK from the website

The old APK has the old package name, so the Play Store app installs **next to it** as a separate app; it cannot update it. Tell students: "Install DHĪ from the Play Store, log in, then uninstall the old DHĪ app." Their account and progress are on the server, so nothing is lost. One phone, one login still applies: logging in on the new app signs out the old one.

The APK link on the admin panel's Mobile App page keeps working for students who cannot use the Play Store. Build that APK with the same command, using `apk` in place of `appbundle`.
