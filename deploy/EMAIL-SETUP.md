# noreply@dhiayurved.com: free email (Google Workspace ke bina)

OTP aur alerts abhi ek temporary Gmail se jaate hain. Client Workspace nahi lega, isliye ye free tareeka hai. Code me koi change nahi chahiye: backend kisi bhi SMTP provider se mail bhej sakta hai.

## Recommended: Brevo (free, 300 emails/day)

300 mail roz ka matlab roz ~300 OTP/registration. Is institute ke liye kaafi hai. Inbox nahi milta, sirf bhejna hota hai, aur noreply ke liye wahi chahiye.

1. https://www.brevo.com pe free account banao (client ki email se).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain** → `dhiayurved.com`.
3. Brevo 3–4 DNS records dega (brevo-code TXT, DKIM, DMARC). GoDaddy → dhiayurved.com → **DNS → Add record** me bilkul wahi daalo.
   - Pehle se `v=spf1` wala TXT hai to naya mat banao. Usi me `include:spf.brevo.com` jod do.
   - Brevo me **Authenticate** dabao. 10 minute se kuch ghante lag sakte hain.
4. **Senders → Add a sender**: name `DHĪ Ayurveda`, email `noreply@dhiayurved.com`.
5. **SMTP & API → SMTP → Generate a new SMTP key**. Login (jaise `xxxx@smtp-brevo.com`) aur key copy kar lo.
6. Server pe `/opt/dhi/deploy/production.env` me:
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<Brevo SMTP login>
   SMTP_PASS=<SMTP key>
   MAIL_FROM=DHĪ Ayurveda <noreply@dhiayurved.com>
   ```
   Purani Gmail wali lines hata do. Pehle env ka backup: `cp production.env /root/production.env.bak-$(date +%F)`.
7. `cd /opt/dhi && ./deploy/deploy.sh up`
8. Test: website pe "Forgot password" ya naya register karo. OTP `noreply@dhiayurved.com` se aana chahiye, spam me nahi.

## Doosre free options

| Provider | Free limit | Note |
| --- | --- | --- |
| Brevo | 300/day | Sabse aasan, India me theek chalta hai |
| Resend (`smtp.resend.com`, port 587, user `resend`, pass = API key) | 3,000/month, 100/day | Setup aasan, daily limit kam |
| Zoho Mail free | 5 mailbox, inbox bhi milta hai | Free plan me SMTP band hai, isliye OTP ke kaam ka nahi |

## Mail receive karna (optional, free)

Agar `support@dhiayurved.com` pe aane wali mail client ki Gmail me chahiye: **ImprovMX** (free) ya GoDaddy ka email forwarding. Ye sirf MX records lagata hai, Brevo ke records se nahi takrata. Students ko jo support email dikhta hai, woh admin panel → Settings → Institute details me hai.
