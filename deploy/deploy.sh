#!/usr/bin/env bash
# EduManage deploy helper for a shared VPS (Docker + Nginx).
#
#   ./deploy/deploy.sh init --admin-domain admin.example.com --api-domain api.example.com \
#                           --admin-phone 98xxxxxxxx --admin-email you@example.com [--nginx-in-docker]
#   ./deploy/deploy.sh up          build + start (first run also creates the admin user)
#   ./deploy/deploy.sh update      git pull, rebuild, restart (migrations run automatically)
#   ./deploy/deploy.sh ports [--fix]   show / repair the two host ports
#   ./deploy/deploy.sh status | logs [service] | seed | backup | down
#
# Safe on a server that already runs other sites: it only ever uses two high ports on
# 127.0.0.1, never touches 80/443/3000/5432, and never stops containers it did not create.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=deploy/production.env
PROJECT=edumanage-prod
COMPOSE=(docker compose --env-file "$ENV_FILE" -f deploy/docker-compose.prod.yml)
PORT_MIN=18400
PORT_MAX=18999

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed."; }

preflight() {
  need docker
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required ('docker compose')."
  docker info >/dev/null 2>&1 || die "Cannot talk to Docker. Is it running, and are you in the 'docker' group?"
}

env_get() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }

env_set() { # env_set KEY VALUE  (values here never contain | or newlines)
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i.bak "s|^$1=.*|$1=$2|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}

rand_hex() { openssl rand -hex "$1"; }

# ── ports ────────────────────────────────────────────────────────────────

port_in_use() { # anything listening on this TCP port, on any address
  local p=$1
  if command -v ss >/dev/null 2>&1; then
    ss -H -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$p$"
  else
    netstat -an 2>/dev/null | grep -E "[:.]$p[[:space:]].*LISTEN" >/dev/null
  fi
}

owned_by_us() { # is this host port published by OUR compose project?
  docker ps --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Ports}}' 2>/dev/null \
    | grep -qE "[:.]$1->"
}

free_port() { # first free port >= $1 that is also not one of the other args
  local p=$1; shift
  while port_in_use "$p" || [[ " $* " == *" $p "* ]]; do
    p=$((p + 1)); (( p <= PORT_MAX )) || die "No free port left in $PORT_MIN-$PORT_MAX."
  done
  echo "$p"
}

check_ports() { # $1 = "fix" to repair instead of failing
  local web api bad=0
  web=$(env_get WEB_PORT); api=$(env_get API_PORT)
  for name in WEB_PORT API_PORT; do
    local p; p=$(env_get "$name")
    if port_in_use "$p" && ! owned_by_us "$p"; then
      if [[ "${1:-}" == fix ]]; then
        local other=$([[ $name == WEB_PORT ]] && echo "$api" || echo "$web")
        local n; n=$(free_port "$PORT_MIN" "$other")
        warn "$name $p is used by another program: switching to $n"
        env_set "$name" "$n"
        [[ $name == WEB_PORT ]] && web=$n || api=$n
      else
        warn "$name $p is already used by another program on this server."; bad=1
      fi
    else
      if owned_by_us "$p"; then say "$name $p is in use by this stack"; else say "$name $p is free"; fi
    fi
  done
  (( bad == 0 )) || die "Run:  ./deploy/deploy.sh ports --fix   (picks free ports and updates $ENV_FILE), then re-run."
}

# ── commands ─────────────────────────────────────────────────────────────

render_nginx() {
  local web api admin apidom host
  web=$(env_get WEB_PORT); api=$(env_get API_PORT)
  admin=$(env_get ADMIN_DOMAIN); apidom=$(env_get API_DOMAIN); host=$(env_get BIND_ADDR)
  sed -e "s|__ADMIN_DOMAIN__|$admin|g" -e "s|__API_DOMAIN__|$apidom|g" \
      -e "s|__WEB_PORT__|$web|g" -e "s|__API_PORT__|$api|g" -e "s|__UPSTREAM_HOST__|$host|g" \
      deploy/nginx/edumanage.conf.template > deploy/nginx/edumanage.conf
}

cmd_init() {
  preflight; need openssl
  [[ ! -f $ENV_FILE ]] || die "$ENV_FILE already exists. Edit it, or delete it to start over."
  local admin_domain="" api_domain="" phone="" email="" in_docker=0
  while (( $# )); do
    case $1 in
      --admin-domain) admin_domain=$2; shift 2 ;;
      --api-domain)   api_domain=$2; shift 2 ;;
      --admin-phone)  phone=$2; shift 2 ;;
      --admin-email)  email=$2; shift 2 ;;
      --nginx-in-docker) in_docker=1; shift ;;
      *) die "Unknown option: $1" ;;
    esac
  done
  [[ -n $admin_domain && -n $api_domain && -n $phone && -n $email ]] \
    || die "Need --admin-domain, --api-domain, --admin-phone and --admin-email (see the top of this script)."
  [[ $phone =~ ^[0-9]{10}$ ]] || die "--admin-phone must be a 10 digit number."

  cp deploy/production.env.example "$ENV_FILE"; chmod 600 "$ENV_FILE"
  local admin_pw; admin_pw="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Aa1!"
  env_set ADMIN_DOMAIN "$admin_domain"; env_set API_DOMAIN "$api_domain"
  env_set POSTGRES_PASSWORD "$(rand_hex 24)"; env_set JWT_ACCESS_SECRET "$(rand_hex 48)"
  env_set SEED_ADMIN_PHONE "$phone"; env_set SEED_ADMIN_EMAIL "$email"; env_set SEED_ADMIN_PASSWORD "$admin_pw"

  if (( in_docker )); then
    local gw; gw=$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || true)
    env_set BIND_ADDR "${gw:-172.17.0.1}"
    warn "Nginx-in-Docker: ports are bound to ${gw:-172.17.0.1} (the Docker bridge), still not public."
  fi

  local web api
  web=$(free_port 18480); api=$(free_port 18481 "$web")
  env_set WEB_PORT "$web"; env_set API_PORT "$api"
  render_nginx

  say "Created $ENV_FILE (secrets generated, mode 600). Host ports: web $web, api $api."
  say "Admin login:  phone $phone   password $admin_pw   <- save it now"
  echo
  echo "Next:"
  echo "  1. DNS: point $admin_domain and $api_domain (A records) to this server's IP."
  echo "  2. ./deploy/deploy.sh up"
  echo "  3. sudo cp deploy/nginx/edumanage.conf /etc/nginx/conf.d/edumanage.conf && sudo nginx -t && sudo systemctl reload nginx"
  echo "  4. sudo certbot --nginx -d $admin_domain -d $api_domain"
}

wait_healthy() { # $1 = service
  local id status tries=0
  id=$("${COMPOSE[@]}" ps -q "$1")
  until [[ "$(docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null)" == healthy ]]; do
    status=$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || echo missing)
    [[ $status == running ]] || { "${COMPOSE[@]}" logs --tail 40 "$1" >&2; die "$1 is $status."; }
    (( ++tries < 90 )) || { "${COMPOSE[@]}" logs --tail 40 "$1" >&2; die "$1 did not become healthy in 3 minutes."; }
    sleep 2
  done
  say "$1 is healthy"
}

cmd_up() {
  preflight
  [[ -f $ENV_FILE ]] || die "No $ENV_FILE yet. Run './deploy/deploy.sh init ...' first."
  check_ports
  render_nginx
  say "Building images (first build takes a few minutes)"
  "${COMPOSE[@]}" build
  say "Starting"
  "${COMPOSE[@]}" up -d
  wait_healthy db; wait_healthy backend; wait_healthy web
  if [[ ! -f deploy/.seeded ]]; then
    cmd_seed && touch deploy/.seeded
  fi
  say "EduManage is running on $(env_get BIND_ADDR): web :$(env_get WEB_PORT), api :$(env_get API_PORT)"
}

cmd_seed() {
  say "Creating the admin user (safe to repeat: existing users are not overwritten)"
  "${COMPOSE[@]}" exec -T backend npx prisma db seed
}

cmd_update() {
  preflight
  say "Pulling latest code"
  git pull --ff-only
  cmd_up
  docker image prune -f >/dev/null
}

cmd_ports() {
  [[ -f $ENV_FILE ]] || die "No $ENV_FILE yet."
  if [[ "${1:-}" == --fix ]]; then check_ports fix; render_nginx; say "Restart with ./deploy/deploy.sh up"; else check_ports; fi
}

cmd_status() { preflight; "${COMPOSE[@]}" ps; }
cmd_logs()   { preflight; "${COMPOSE[@]}" logs -f --tail 100 "$@"; }
cmd_down()   { preflight; "${COMPOSE[@]}" down; }   # keeps the database and uploaded files (volumes)

# Database dump + uploaded files (notes PDFs, APKs). Run daily from cron:
#   0 3 * * *  cd /path/to/repo && ./deploy/deploy.sh backup >> deploy/backups/backup.log 2>&1
cmd_backup() {
  preflight
  local dir=deploy/backups stamp; stamp=$(date +%Y%m%d-%H%M%S)
  mkdir -p "$dir"
  say "Backing up database"
  "${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$dir/db-$stamp.sql.gz"
  say "Backing up uploaded files"
  docker run --rm -v "${PROJECT}_storage:/data:ro" -v "$PWD/$dir:/out" alpine \
    tar czf "/out/files-$stamp.tar.gz" -C /data .
  find "$dir" -name '*.gz' -mtime +14 -delete    # keep two weeks
  say "Done: $dir/db-$stamp.sql.gz  $dir/files-$stamp.tar.gz  (copy them off this server too)"
}

case "${1:-}" in
  init)   shift; cmd_init "$@" ;;
  up)     cmd_up ;;
  update) cmd_update ;;
  ports)  shift; cmd_ports "$@" ;;
  status) cmd_status ;;
  logs)   shift; cmd_logs "$@" ;;
  seed)   preflight; cmd_seed ;;
  backup) cmd_backup ;;
  down)   cmd_down ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
