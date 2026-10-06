# Deploying EduManage on a shared VPS (Docker + Nginx)

Runs three containers: **db** (Postgres 18), **backend** (NestJS API), **web** (Next.js admin/faculty/student panel).

## What it does NOT touch (the server already hosts other sites)

| | This stack |
|---|---|
| Ports 80 / 443 | Not used. Your existing Nginx keeps them; we only add two new `server_name` blocks. |
| Ports 3000 / 3001 / 5432 | Not used on the host. |
| Host ports it does use | **Two** high ports (default `18480` web, `18481` api), bound to `127.0.0.1` only, so they are not reachable from the internet. If either is taken, `deploy.sh` picks the next free one. |
| Database | **No host port at all.** Only the backend container reaches it, over a private network. |
| Names | Project `edumanage-prod`: containers, network and volumes are all prefixed, so nothing collides with your other Docker projects. |
| Resources | Memory caps: db 768 MB, backend 768 MB, web 512 MB (about 2 GB worst case on an 8 GB KVM 2). |
| Other containers | `deploy.sh` only ever starts/stops its own project. |

## One-time setup

```bash
# 1. On the server (needs: git, docker + compose v2, openssl; nginx + certbot for HTTPS)
git clone https://github.com/shiv90154/bilaspurclient.git && cd bilaspurclient

# 2. DNS: create A records  admin.yourdomain.com  and  api.yourdomain.com  -> this server's IP

# 3. Generate settings + secrets (prints the admin password ONCE, save it)
./deploy/deploy.sh init \
  --admin-domain admin.yourdomain.com --api-domain api.yourdomain.com \
  --admin-phone 98XXXXXXXX --admin-email you@yourdomain.com
#    Add  --nginx-in-docker  if your Nginx runs in a container (ports then bind to the Docker bridge, still private).

# 4. Build and start (first build takes a few minutes; creates the admin user)
./deploy/deploy.sh up

# 5. Tell your existing Nginx about the two new sites, then add HTTPS
sudo cp deploy/nginx/edumanage.conf /etc/nginx/conf.d/edumanage.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d admin.yourdomain.com -d api.yourdomain.com
```

Open `https://admin.yourdomain.com` and log in with the phone and password from step 3.
HTTPS is required: login cookies are `Secure`, so plain `http://` will not log in.

If Nginx runs in Docker: add the content of `deploy/nginx/edumanage.conf` to its config
(`proxy_pass` already points at the Docker bridge address) and reload it.

## Everyday commands

| Command | What |
|---|---|
| `./deploy/deploy.sh update` | `git pull`, rebuild, restart. Database migrations run automatically on start. |
| `./deploy/deploy.sh status` / `logs [web\|backend\|db]` | Health and logs |
| `./deploy/deploy.sh ports [--fix]` | Show ports, or move to free ones if another program took them |
| `./deploy/deploy.sh backup` | Database dump + uploaded files into `deploy/backups/` (14 days kept) |
| `./deploy/deploy.sh down` | Stop the stack (data is kept in volumes) |

Daily backup at 03:00: `0 3 * * * cd /path/to/bilaspurclient && ./deploy/deploy.sh backup >> deploy/backups/backup.log 2>&1`
and copy `deploy/backups/` off the server (a VPS disk failure would take the backups with it).

## Settings

All in `deploy/production.env` (git-ignored, mode 600). Template: `deploy/production.env.example`.
Never commit it; it holds the database password and the JWT secret.

## Mobile app

Build the app against your API domain:
`flutter build apk --release --dart-define=API_URL=https://api.yourdomain.com/api`
then upload the APK in the admin panel under **Mobile App**.

## If something fails

- `deploy.sh up` says a port is busy: `./deploy/deploy.sh ports --fix`, then `up` again.
- Login says "Origin" / 403: `ADMIN_DOMAIN` in `production.env` must be the exact address you open in the browser.
- 502 from Nginx: `./deploy/deploy.sh status`, and check the port in `edumanage.conf` matches `WEB_PORT`/`API_PORT`.
- Uploads fail around 1 MB: your Nginx is not using `client_max_body_size 160m` from our conf.
