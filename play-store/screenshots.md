# Phone screenshots

Play needs at least 2 (best 4 to 8) phone screenshots: PNG or JPG, 9:16 portrait, for example 1080 × 1920.

The release app blocks screenshots (FLAG_SECURE), so take them from a **debug build**. A debug build skips the block and the device checks.

## How

1. Start the local backend with demo data (`docker compose up -d`, then `npm run start:dev` in `backend/`).
   Never point a debug build at the live server.
2. Build and install the debug app on a phone or emulator:
   `C:\src\flutter\bin\flutter.bat run --debug --dart-define=API_URL=http://10.0.2.2:3000/api`
   On a real phone, use the PC's IP in place of `10.0.2.2`.
3. Log in as the local demo student and take a screenshot of each screen below (power + volume down).
4. Save them in `play-store/graphics/screenshots/` as `01-home.png`, `02-tests.png` and so on.

## Which screens (in this order)

1. Home: next class and the latest notes
2. Tests list with a test series
3. Test result with rank and score
4. Notes: a PDF open in the reader
5. Classes: the schedule with a "Join" button
6. Doubts: a doubt with the teacher's reply
7. About: Dr. Pardeuman Singh's profile

No screen may show a price or a "buy" button. The app has none, so this only matters if you edit a screenshot.
