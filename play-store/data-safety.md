# Data safety form (answers)

Play Console → **Policy and programs → App content → Data safety**.
These answers match the privacy policy (https://dhiayurved.com/privacy) and the code as of 2026-10-10. If the app starts collecting something new, update both.

## Overview questions

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | **Yes**: in the app (Profile → Delete my account) and on the web: `https://dhiayurved.com/delete-account` |

## Data types

For every type below: **Collected = Yes, Shared = No**. The server host, Firebase Cloud Messaging and Zoom/Meet are service providers, which Google does not count as "sharing".
"Processed ephemerally" = **No** for all. None of it is used for ads or marketing.

| Category → type | Required or optional | Purposes to tick |
| --- | --- | --- |
| Personal info → Name | Required | App functionality, Account management |
| Personal info → Email address | Required | App functionality, Account management |
| Personal info → Phone number | Required | App functionality, Account management |
| Personal info → User IDs | Required | App functionality, Account management |
| Personal info → Address | Optional | Account management |
| Personal info → Other info (date of birth, gender, guardian name and phone, education details) | Optional | Account management |
| Photos and videos → Photos (doubt photos, profile photo) | Optional | App functionality |
| Files and docs (admission documents uploaded by the institute) | Optional | Account management |
| Messages → Other in-app messages (doubts and replies) | Optional | App functionality |
| App activity → App interactions (notes opened, classes joined, test attempts) | Required | App functionality, Analytics* |
| App activity → Other user-generated content (test answers) | Required | App functionality |
| Device or other IDs (device identifier, notification token) | Required | App functionality, Fraud prevention, security, and compliance |

\* "Analytics" here means the institute's own reports (attendance, which notes are opened). No third-party analytics SDK is in the app. If you prefer, tick only App functionality; both are true.

## Not collected

Location, contacts, calendar, call logs, SMS, audio, health and fitness, financial info (no payment happens in the app), web browsing history, installed apps, crash logs (no Crashlytics).
