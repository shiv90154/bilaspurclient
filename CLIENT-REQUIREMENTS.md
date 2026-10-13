# DHĪ App & Website: Information Needed from You

**Date:** 7 October 2026

The DHĪ system is built and running on a test address. To make it live under your name, we need the details below from you.

Please tick each item as you send it. Items marked **Required** hold up the launch. The rest can follow later.

---

## What is already done

- Web panel for Super Admin, Faculty and Students
- Android student app: tests, notes, live classes, doubts, profile
- Question bank, tests with negative marking, results and ranks
- Screenshot block, watermark, one phone at a time per login
- Secure HTTPS and daily backups

---

## 1. Business and contact details

These go on the website footer, the legal pages and the Play Store listing. Google rejects apps that have no real address and contact.

- [ ] **Required:** Registered name of the institute, exactly as on the GST or registration certificate
- [ ] **Required:** Full address with PIN code
- [ ] **Required:** Support phone number and support email shown to students
- [ ] **Required:** Owner or director name, for the developer account and agreements
- [ ] GST number, if you have one (needed for invoices and paid courses)
- [ ] Grievance officer name and email (Indian IT Rules ask for this on the website)
- [ ] Support hours, for example Mon–Sat, 10 am–6 pm
- [ ] Social media links: YouTube, Instagram, Facebook, Telegram, WhatsApp channel
- [ ] Google Maps link of the centre

---

## 2. Branding and content

We have your logo and name. For a sharp app icon and store listing we need the original files and some content.

| Item | Format | Needed |
| --- | --- | --- |
| Logo, original file | SVG, AI, PDF, or PNG of at least 1024 × 1024 px with a transparent background | **Required** |
| Brand colours | Hex codes, for example `#1A3C8B` | **Required** |
| About the institute, 3–5 lines | Text | **Required** |
| Courses offered, with fees if shown publicly | List | **Required** |
| Logo for dark backgrounds (white version) | PNG or SVG | Good to have |
| Tagline, one line | Text | Good to have |
| Faculty names, photos, subjects | JPG + text | Good to have |
| Photos of the centre, classes, results | JPG, landscape | Good to have |
| Toppers and results for the home page | Name, photo, rank, year | Good to have |
| Demo or intro videos | YouTube links | Good to have |

Please also confirm how the name is written: **"DHĪ"** (with the line over the I) or plain **"DHI"**.

---

## 3. Domain, server, email and SMS

The system runs on a temporary address now. It must move to your own domain before launch, because that address is built into the app.

- [ ] **Required:** Domain name, for example `dhiacademy.in`. Buy it in your own name, or ask us to buy it for you. We will use `admin.<domain>` for the panel and `api.<domain>` for the app.
- [ ] **Required:** Access to the domain's DNS settings, or add the 2 records we send you
- [ ] **Required:** Choose the server: keep the current VPS or take a new one in your name. Who pays the renewal?
- [ ] **Required:** Official email for sending OTPs and alerts, for example `noreply@<domain>` (Google Workspace or Zoho Mail). A temporary Gmail is used today.
- [ ] Phone SMS OTP (optional): a DLT-registered sender ID and an SMS provider account (MSG91, Fast2SMS, etc.). TRAI requires this, and it takes 3–7 days.
- [ ] The Zoom or Google Meet account faculty will use for live classes
- [ ] WhatsApp Business number, if you want enquiry or reminder messages later

---

## 4. Play Store and App Store

Today students install the app from a download link (APK). The app belongs to you, so the Play Store account must be in your name.

### Google Play (Android)

- [ ] **Required:** Google Play Console developer account, a one-time fee of USD 25. Choose an **Organisation** account if you have a D-U-N-S number, otherwise **Personal**.
- [ ] **Required:** Add our email as a user with release access, so we can upload the app
- [ ] For Personal accounts only: Google requires 12 testers to use the app for 14 days before public release. Please arrange 12 students or staff with Gmail IDs.
- [ ] Short description (up to 80 characters) and full description (up to 4000 characters). We can draft these for your approval.
- [ ] Feature graphic, 1024 × 500 px. We can make it from your logo.
- [ ] Category and contact email for the listing

### Apple App Store (iPhone), only if you want an iPhone app

- [ ] Apple Developer account, USD 99 per year, in your name
- [ ] Building it needs a Mac and extra development time. Today iPhone users use the web panel instead.

> **Signing key:** we will create the app's signing key and give you a copy. Keep it safe. Without it, no update can be published.

---

## 5. Decisions we need from you

These rules were not in the requirement list, so we used sensible defaults. Please confirm or change each one.

| Topic | Current setting | Your decision |
| --- | --- | --- |
| Student sign-up | Students register themselves with an email OTP, and the admin approves them | |
| Phones per student | 1 phone at a time, at most 3 different phones in 30 days | |
| Notes download | View only inside the app, no download | |
| Screenshots | Blocked in the app, with a watermark of the student's name | |
| Default negative marking | 0.25 marks per wrong answer | |
| Live classes | Zoom or Google Meet link (BigBlueButton needs its own server) | |
| Online fee payment | Not included | |
| iPhone app | Not included. iPhone users use the web panel. | |
| Public website (home, courses, contact) | Only the login panel and legal pages exist | |

Also send:

- [ ] **Required:** The real courses, batches and subjects to set up
- [ ] **Required:** Faculty list with name, phone and subjects, so we can create their logins
- [ ] Student list in Excel (name, phone, email, course, batch), if you want a bulk import
- [ ] Existing questions in Excel or Word, for the question bank

> Online payments, a public website and an iPhone app are outside the current scope. We can quote them separately.

---

## 6. Legal pages

Draft pages are already in the system. They need your name, your address and your approval, because the institute is legally responsible for them. The Play Store needs a public privacy policy link and a way to delete an account.

- [ ] **Required:** Privacy policy: read and approve our draft
- [ ] **Required:** Terms and conditions: read and approve
- [ ] **Required:** Account and data deletion: confirm who handles these requests
- [ ] Refund and cancellation policy, only if fees are taken online
- [ ] Parent consent wording, if students under 18 use the app

> We suggest your CA or lawyer checks these pages before launch. This is not legal advice.

---

## 7. Launch plan, support and sign-off

After the items above arrive, launch takes about **1–2 weeks**. Most of that time is the Play Store review and the 14-day testing rule.

1. You send the **Required** items from sections 1–6.
2. We connect your domain and email and build the final app.
3. You test with real courses and 5–10 students for 3–5 days and send feedback.
4. We fix the feedback and remove the demo accounts.
5. Play Store submission and go-live.
6. You sign off. We hand over the logins, the signing key and a short user guide.

Please agree on these points before launch:

- [ ] **Required:** Who owns the source code, and will a copy be handed over?
- [ ] **Required:** Support period after launch, for example 30 days of free bug fixes
- [ ] Yearly maintenance after that: server care, backups, app updates, Play Store policy changes
- [ ] Who pays the recurring costs: domain, server, email, SMS, developer accounts
- [ ] One contact person on your side who approves changes

---

## How to send

- **Files:** Google Drive or WhatsApp
- **Passwords:** only on a phone call or in person, never in a group chat
