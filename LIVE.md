# DHĪ: Live deployment

Last updated: 2026-10-06. Project status: [PROGRESS.md](PROGRESS.md). Deploy guide for a fresh server: [deploy/README.md](deploy/README.md).

## Addresses

| What | URL |
|---|---|
| Admin / faculty / student web panel | https://admin.187-127-159-220.nip.io |
| API (the Android app talks to this) | https://api.187-127-159-220.nip.io/api |
| API health check | https://api.187-127-159-220.nip.io/api/health |

- `https://api.187-127-159-220.nip.io/` (without `/api`) shows "Cannot GET /". That is normal: every endpoint lives under `/api`.
- The `nip.io` names are temporary. They resolve to the server IP and have real Let's Encrypt HTTPS. Move to your own domain: see **Switch to your own domain** below.
- Admin login: phone `9999999999`. The password was printed once when the server was set up. It is also stored in `/opt/dhi/deploy/production.env` (`SEED_ADMIN_PASSWORD`) on the server. It is **not** kept in this repository.
- Swagger docs (`/api/docs`) are switched off in production on purpose.

## What runs where

Server: Hostinger KVM 2 VPS, Ubuntu 24.04, 2 vCPU, 8 GB RAM, IP `187.127.159.220`. It is shared with other sites.

```
Internet -> host Nginx (80/443, existing) -+-> 127.0.0.1:18480  web      (Next.js)
                                           +-> 127.0.0.1:18481  backend  (NestJS API)
                                                                  |
                                       private Docker network ->  db   (Postgres 18, no host port)
```

| Item | Value |
|---|---|
| Code and stack folder | `/opt/dhi` |
| Docker Compose project | `edumanage-prod` (containers `edumanage-prod-web-1`, `-backend-1`, `-db-1`) |
| Settings and secrets | `/opt/dhi/deploy/production.env` (mode 600, never commit) |
| Nginx site file | `/etc/nginx/sites-available/dhi-edumanage` (linked in `sites-enabled`) |
| Nginx backup taken before the change | `/root/nginx-backups/nginx-before-edumanage-20261006-072626.tgz` |
| Uploaded files (PDF notes, APKs) | Docker volume `edumanage-prod_storage` |
| Database | Docker volume `edumanage-prod_pgdata` |
| Memory caps | db 768 MB, backend 768 MB, web 512 MB |
| Restart | `restart: unless-stopped`, Docker starts on boot, so the stack returns after a reboot |
| Backup | cron, every day at 03:00, into `/opt/dhi/deploy/backups` (14 days kept) |
| HTTPS renewal | certbot timer (already active on the server) |

## Ports: what is ours, what is not

Ours (new): **18480** (web), **18481** (api). Both bound to `127.0.0.1`, so they are not reachable from the internet. The database publishes no port at all.

Already in use by other projects on the same server. **Do not touch:**

| Port | Used by |
|---|---|
| 80, 443 | host Nginx (shared by all sites) |
| 3000, 3001 | `ngo-frontend`, `inphora-frontend` (pm2) |
| 5000, 5001 | `ngo-backend`, `inphora-backend` (pm2) |
| 8000, 8443, 8080, 8888, 10000/udp | Jitsi Meet containers |
| 22 | SSH |
| 631 | CUPS |

Other sites on this server (leave them alone): `sbfngo.tech`, `api.sbfngo.tech`, `meet.sbfngo.tech`, `inphora.in`.

## Everyday commands (run on the server, in `/opt/dhi`)

```bash
cd /opt/dhi
./deploy/deploy.sh status            # are the 3 containers healthy?
./deploy/deploy.sh logs backend      # logs (also: web, db)
./deploy/deploy.sh backup            # backup now
./deploy/deploy.sh ports             # check the two ports
./deploy/deploy.sh up                # rebuild and restart after new code is uploaded
./deploy/deploy.sh down              # stop (data is kept)
```

`deploy.sh update` only works if `/opt/dhi` is a git clone. Right now the code was uploaded as an archive, so to ship new code: upload it again (or clone the GitHub repo into `/opt/dhi`), then run `./deploy/deploy.sh up`. Database migrations run automatically when the backend starts.

## Switch to your own domain

1. At your DNS provider, create **A records** for the two names (for example `admin.yourdomain.com` and `api.yourdomain.com`) pointing to `187.127.159.220`.
2. On the server:
   ```bash
   cd /opt/dhi
   ./deploy/deploy.sh domain admin.yourdomain.com api.yourdomain.com
   ./deploy/deploy.sh up
   sudo ./deploy/deploy.sh nginx        # adds the sites and gets HTTPS
   ```
3. Rebuild the Android app with the new API address (below) and upload it again.

## Android app

Build against the live API, then upload the APK in the admin panel under **Mobile App**:

```bash
flutter build apk --release --dart-define=API_URL=https://api.187-127-159-220.nip.io/api
```

If you move to your own domain later, build again with the new `API_URL`.

## Security notes

- HTTPS is required: login cookies are `Secure`.
- The firewall (`ufw`) on the server is **off**. It was left alone so existing sites are not cut off by a wrong rule. Turning it on should be done carefully (allow 22, 80, 443 and Jitsi's 10000/udp first).
- Change the server's root password if it was ever shared in a chat or message.
- Copy `/opt/dhi/deploy/backups/` off the server regularly. A failed disk would take the backups with it.
- `SEED_DEMO=false` in production: no demo accounts with well-known passwords exist.

## Quick health check

```bash
curl https://api.187-127-159-220.nip.io/api/health
# {"status":"ok","db":"up","uptimeSeconds":...}
```
