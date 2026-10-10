# DHĪ — Aapke karne wale kaam (checklist)

Jo code ka kaam tha wo ho chuka (push notifications, naam, icons). Neeche wo hai jo **aapko khud** karna hai, is order mein.
Har step ke baad tick karo. Kuch atke to mujhe error ka text bhej do.

---

## A. Android SDK ek baar theek karo (15 min) — app chalane ke liye zaroori

Aapke PC par SDK hai (`C:\Users\shiva\AppData\Local\Android\Sdk`), sirf **cmdline-tools** missing hai.

- [ ] Android Studio kholo → **More Actions → SDK Manager** (ya Settings → Languages & Frameworks → Android SDK).
- [ ] **SDK Tools** tab → "**Android SDK Command-line Tools (latest)**" par tick → Apply → Ok.
- [ ] PowerShell mein licenses accept karo (sab par `y`):
  ```powershell
  C:\src\flutter\bin\flutter.bat doctor --android-licenses
  ```
- [ ] Check: `C:\src\flutter\bin\flutter.bat doctor` — "Android toolchain" par tick aana chahiye.

## B. Phone ya emulator par app chalao (push test)

Push **emulator par bhi** chalta hai agar emulator "Google Play" wala ho. Asli phone sabse aasan.

**Asli phone:**
- [ ] Phone: Settings → About phone → Build number 7 baar tap → Developer options → **USB debugging ON**.
- [ ] USB se PC se jodo, phone par "Allow" dabao.
- [ ] PC aur phone **same WiFi** par hon. PC ka IP nikalo: `ipconfig` → "IPv4 Address" (jaise `192.168.1.10`).
- [ ] Backend chalu karo (alag terminal):
  ```powershell
  cd C:\Users\shiva\OneDrive\Desktop\Bilaspur
  docker compose up -d db
  cd backend; npm run start:dev
  ```
  Log mein `FCM enabled` dikhna chahiye.
- [ ] Windows Firewall port 3000 ko allow kare (pehli baar popup aaye to "Allow"). Phone ke browser mein `http://<PC-IP>:3000/api/health` khol kar check karo.
- [ ] App chalao:
  ```powershell
  cd C:\Users\shiva\OneDrive\Desktop\Bilaspur\student-app
  C:\src\flutter\bin\flutter.bat run --dart-define=API_URL=http://192.168.1.10:3000/api
  ```
  (IP apna daalo.)

**Emulator:** Android Studio → Device Manager → "Google Play" wala device banao, phir `flutter run` (bina `--dart-define` ke chalega).

## C. Push ko test karo

- [ ] App mein student se login karo: phone `9999999997`, password `Demo@12345`. Notification permission aaye to **Allow**.
- [ ] Admin web (`http://localhost:3001`) par admin login: `9999999999` / `ChangeMe@123`.
- [ ] Classes mein demo batch ki class banao jo **8–9 minute baad** shuru ho → ~1 min mein phone par **"Class starting soon"** aana chahiye (app band/background mein rakho).
- [ ] Us class ka time badlo → **"Class rescheduled"**; cancel karo → **"Class cancelled"**.
- [ ] Student se ek doubt pucho, admin/faculty se reply karo → **"Your doubt has an answer"**; notification tap karo → thread khulna chahiye.
- [ ] Nahi aaya? Backend log dekho (`WARN ... pushes failed`) aur mujhe bhejo.

> Test ke baad demo class delete/cancel kar do.

## D. Code ko GitHub par daalo

Abhi bahut saare badlav **commit nahi hue** (naam DHĪ, icons, FCM, Docker/deploy files).

- [ ] Check karo ki ye files git mein **nahi** ja rahi (`git status` mein dikhni nahi chahiye):
  `backend/firebase-service-account.json`, `student-app/android/app/google-services.json`, `backend/.env`
- [ ] Mujhe bolo "commit kar do" — main commit bana dunga, push aap karo ya mujhse bolo.

## E. Server (VPS) par chalao

Server par git, docker + compose v2, openssl, nginx, certbot hone chahiye. Poori guide: [deploy/README.md](deploy/README.md).

- [ ] DNS: `admin.<aapka-domain>` aur `api.<aapka-domain>` ke **A record** server ke IP par.
- [ ] Server par:
  ```bash
  git clone <repo> && cd <repo>
  ./deploy/deploy.sh init --admin-domain admin.DOMAIN --api-domain api.DOMAIN --admin-phone 98XXXXXXXX --admin-email you@DOMAIN
  ```
  Admin ka password **ek hi baar** dikhega — save kar lo.
- [ ] **Firebase key server par lagao** (push ke liye). Apne PC par (project folder mein) ye chalao:
  ```powershell
  node -e "console.log(\"FIREBASE_SERVICE_ACCOUNT_JSON='\"+JSON.stringify(require('./backend/firebase-service-account.json'))+\"'\")"
  ```
  Jo ek lambi line aaye use server ki `deploy/production.env` file ke neeche paste karo (file ka permission 600 hi rahe). Ye line kisi ko bhejna/commit mat karna.
- [ ] `./deploy/deploy.sh up`
- [ ] `sudo ./deploy/deploy.sh nginx` (HTTPS ke saath) — phir `https://admin.DOMAIN` kholo, admin se login karo.
- [ ] `./deploy/deploy.sh logs backend` mein `FCM enabled` dekho.
- [ ] Backup cron lagao (deploy/README mein line di hai) aur `deploy/backups/` ko kahin aur copy karo.

## F. Play Store / release se pehle (important)

- [x] **Package id final:** `com.dhiayurved.app` (2026-10-10). Firebase mein naya Android app + nayi `google-services.json` chahiye: [play-store/RELEASE.md](play-store/RELEASE.md).
- [ ] **Release signing key banao** (gradle ready hai, steps: [play-store/RELEASE.md](play-store/RELEASE.md)). Abhi release build debug key se sign hota hai — Play Store ye nahi lega. `keytool` se keystore banao aur uska **backup aur password surakshit rakho** (kho gaya to app update nahi kar paoge). Mujhe bolo, main gradle mein signing set kar dunga.
- [ ] Production API ke saath release APK:
  ```powershell
  cd student-app
  C:\src\flutter\bin\flutter.bat build apk --release --dart-define=API_URL=https://api.DOMAIN/api
  ```
  APK `student-app\build\app\outputs\flutter-apk\app-release.apk` mein banega → admin web ke **Mobile App** page par upload karo.
- [ ] Demo passwords (`ChangeMe@123`, `Demo@12345`) server par kabhi nahi — `SEED_DEMO=false` hi rakho (deploy.sh ka default yahi hai).
- [ ] Play Store ki list: [docs/13-play-store-compliance.md](docs/13-play-store-compliance.md) (privacy policy URL, data safety form, screenshots, 512×512 icon).

## G. Baad ke kaam (jab aap bolo tab main karunga)

- Videos (upload + HLS), Fees/Razorpay, admin web ke baaki screens (videos, classes, fees, roles).
- App mein **Classes screen** (taki class reminder tap karne par seedha class khule) aur app khuli ho tab bhi notification dikhana.
- Android adaptive icon (bina cream background ke), favicon ka final design.
- CI (automatic test/build).

---

**Dhyan rakho:** `firebase-service-account.json` ek password jaisa hai. Chat/GitHub/email par mat bhejna. Leak ho jaye to Firebase console → Service accounts → us key ko delete karke nayi banao.
