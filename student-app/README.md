# student-app — DHĪ Android app (Flutter)

**Status: empty Flutter project only.** `flutter create` was run (Flutter 3.47.6 / Dart 3.13.5, Android only, id `com.edumanage.student_app`); no packages added, no app code written, nothing has been analyzed or run yet. See [../PROGRESS.md](../PROGRESS.md).

## Set up this machine first

Flutter was installed to `C:\src\flutter` (not on PATH):

```powershell
# use it directly …
C:\src\flutter\bin\flutter.bat doctor
# … or add C:\src\flutter\bin to your user PATH
```

`flutter doctor` currently reports for Android:
- **cmdline-tools missing** → Android Studio → SDK Manager → SDK Tools → "Android SDK Command-line Tools (latest)".
- **licenses not accepted** → `flutter doctor --android-licenses` (you accept them).

Without these you can still `flutter analyze` and `flutter test`, but not build an APK.

## Run (once the app code exists)

```powershell
cd student-app
flutter pub get
# Android emulator reaches the host machine at 10.0.2.2
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
```

## Planned (see ../docs/10-android-protection.md, ../docs/09-security.md)

Packages (versions checked on 2026-10-02): `dio` 5.11, `flutter_riverpod` 3.4, `go_router` 18, `flutter_secure_storage` 11.2, `device_info_plus` 13.3, `screen_protector` 1.5 (FLAG_SECURE), `safe_device` 1.4 (root/emulator), `google_fonts` 9. Later: `pdfx`/`pdfrx` (secure notes viewer), `media_kit` (video), `firebase_messaging` (push, needs a Firebase project), `url_launcher` (Zoom join).

Must-haves for the first version:
1. Login against `POST /api/auth/login` with `platform: ANDROID` and a **stable device id** (random UUID saved in secure storage, plus model name).
2. Tokens in secure storage; Dio interceptor adds the bearer token and refreshes on `TOKEN_EXPIRED` with **one refresh at a time** (the backend revokes the session if a refresh token is replayed).
3. On `SESSION_REPLACED` / `SESSION_REVOKED` / `SESSION_EXPIRED`: clear tokens, go to login and say why ("logged in on another device").
4. `FLAG_SECURE` on (screenshots and screen recording blocked), release builds at least.
5. Root / emulator check at start and login — enforce in release builds only (developers use emulators).
6. Reusable watermark overlay (name + phone from the login response `watermark`) for notes, tests and video.
7. Theme from the design: Sora + Plus Jakarta Sans, primary `#3949AB`, background `#F6F5F2`.

Before any Play Store release: set the final `applicationId` (cannot change after publishing), target API 36, and follow [../docs/13-play-store-compliance.md](../docs/13-play-store-compliance.md).
