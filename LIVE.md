# DHĪ: Live deployment

Last updated: 2026-10-12. Project status: [PROGRESS.md](PROGRESS.md). Deploy guide for a fresh server: [deploy/README.md](deploy/README.md).

On 2026-10-12 DHĪ moved to its own new server and started again with an empty database: no demo or old data, only the Super Admin.

## Addresses

| What | URL |
|---|---|
| Public website + admin / faculty / student web panel | https://dhiayurved.com |
| API (the Android app talks to this) | https://api.dhiayurved.com/api |
| API health check | https://api.dhiayurved.com/api/health |
| Android app (newest APK, no login) | https://dhiayurved.com/download |

- `https://api.dhiayurved.com/` (without `/api`) shows "Cannot GET /". That is normal: every endpoint lives under `/api`.
- The domain is registered at GoDaddy. GoDaddy DNS: `A @` and `A api` point to `147.93.29.9`, and `www` is a CNAME to the root (Nginx redirects it to the root).
- `theaadhyaayurved.com` (and `www`) are in the Nginx redirect block, but the domain has no A record yet. To use it: add `A @ -> 147.93.29.9` at GoDaddy, then expand the certificate (see below).
- Admin login: email `dhiayurved@gmail.com` or phone `9999999999`. The password is in `/opt/dhi/deploy/production.env` (`SEED_ADMIN_PASSWORD`) on the server and in the developer's private file. It is **not** kept in this repository.
- Swagger docs (`/api/docs`) are switched off in production on purpose.

## What runs where

Server: VPS, Ubuntu 26.04, 2 vCPU, 8 GB RAM + 2 GB swap, IP `147.93.29.9`. Only DHĪ runs on it.

```
Internet -> host Nginx (80/443) -+-> 127.0.0.1:18480  web      (Next.js)
                                 +-> 127.0.0.1:18481  backend  (NestJS API)
                                                        |
                             private Docker network ->  db   (Postgres 18, no host port)
```

| Item | Value |
|---|---|
| Code and stack folder | `/opt/dhi` (git clone of this repository, branch `main`) |
| Docker Compose project | `edumanage-prod` (containers `edumanage-prod-web-1`, `-backend-1`, `-db-1`) |
| Settings and secrets | `/opt/dhi/deploy/production.env` (mode 600, never commit) |
| Nginx site file | `/etc/nginx/sites-available/dhi-dhiayurved` (linked in `sites-enabled`) |
| Nginx backups | `/root/nginx-backups` |
| Uploaded files (PDF notes, APKs) | Docker volume `edumanage-prod_storage` |
| Database | Docker volume `edumanage-prod_pgdata` |
| Restart | `restart: unless-stopped`, Docker starts on boot, so the stack returns after a reboot |
| Backup | cron, every day at 03:00, into `/opt/dhi/deploy/backups` (encrypted, 14 days kept) |
| HTTPS | Let's Encrypt certificate `dhiayurved.com` (root, `www`, `api`), renewed by the certbot timer |
| Firewall | `ufw` on: only SSH (22) and Nginx (80, 443) are open |

## Everyday commands (run on the server, in `/opt/dhi`)

```bash
cd /opt/dhi
./deploy/deploy.sh status            # are the 3 containers healthy?
./deploy/deploy.sh logs backend      # logs (also: web, db)
./deploy/deploy.sh backup            # backup now
./deploy/deploy.sh update            # git pull, rebuild, restart (migrations run automatically)
./deploy/deploy.sh down              # stop (data is kept)
```

Do **not** run `deploy.sh nginx`: the site file `dhi-dhiayurved` also holds the `www` and `theaadhyaayurved.com` redirects, which that command does not write.

To add more names to the certificate (for example once `theaadhyaayurved.com` points here):

```bash
certbot --nginx --cert-name dhiayurved.com --expand -d dhiayurved.com -d www.dhiayurved.com -d api.dhiayurved.com -d theaadhyaayurved.com -d www.theaadhyaayurved.com
```

## Still to set in production.env

- `SMTP_HOST=smtp.gmail.com` and `SMTP_PASS` (a Gmail **app password** of dhiayurved@gmail.com). Until then, email OTP (registration, forgot password) does not work.
- Razorpay keys stay empty: fees are bought through WhatsApp.

After a change: `./deploy/deploy.sh up`.

## Android app

Build against the live API, then upload the APK in the admin panel under **Mobile App**:

```bash
flutter build apk --release --no-tree-shake-icons --build-name=1.0.1 --build-number=13 --dart-define=API_URL=https://api.dhiayurved.com/api
```

Versions started again at 1.0.0 (build 12) on the new server. The build number must keep going up (the last app on the old server was build 11), or Android refuses the update.

## Security notes

- HTTPS is required: login cookies are `Secure`.
- Change the server's root password if it was ever shared in a chat or message.
- Copy `/opt/dhi/deploy/backups/` off the server regularly. A failed disk would take the backups with it.
- `SEED_DEMO=false` in production: no demo accounts with well-known passwords exist.

## Quick health check

```bash
curl https://api.dhiayurved.com/api/health
# {"status":"ok","db":"up","uptimeSeconds":...}
```
