# Deploying ZASS

Target: a **single persistent VPS** running **Debian 13 (Trixie)** with **root**.
The app is a long-running Node process that also runs the in-process WhatsApp
worker and a headless Chromium — so it must run on one always-on instance with
its own disk (never serverless, never multiple replicas).

Topology:

```
Flutter app ──HTTPS──▶ nginx (443) ──▶ Node app (127.0.0.1:8000)
                                          ├─ Express API (/api/*)
                                          ├─ message worker (in-process)
                                          └─ whatsapp-web.js + Chromium
                                                 │
Neon Postgres ◀── pooled (app) / direct (migrations)
```

Defaults used below (change to taste):

| Thing | Value |
|---|---|
| App directory | `/srv/zass` |
| Service user | `zass` |
| App port | `8000` (nginx proxies to it) |
| API hostname | `api.kalande.net` |

---

## 0. DNS (do this first)

Add an **A record** for the API subdomain pointing at the VPS IP:

```
api.kalande.net  A  <your-server-ip>
```

`kalande.net` itself can keep serving your existing site; the API lives on its
own subdomain.

---

## 1. One-time server setup (as root)

SSH in as **root**, then get the code onto the box and run the setup script.

### 1a. Install system dependencies

```bash
# from anywhere, as root — installs Node 20, Chromium, nginx, certbot, git,
# and creates the `zass` user + /srv/zass
bash deploy/setup-server.sh
```

(If you don't have the repo on the server yet, see step 2 first, then run this.)

### 1b. Get the code into /srv/zass

**Recommended — git** (create a private GitHub/GitLab repo and push this project
to it first):

```bash
sudo -u zass git clone <your-repo-url> /srv/zass
```

**No git yet — upload over SFTP/rsync** (the source only; never upload
`node_modules`, `dist`, `.env`, or `.wwebjs_auth`). From your machine:

```bash
rsync -av --exclude node_modules --exclude dist --exclude .env \
  --exclude .wwebjs_auth ./ <user>@<server-ip>:/srv/zass/
# then on the server: sudo chown -R zass:zass /srv/zass
```

> Strongly consider creating a git repo — every future deploy becomes
> `git pull` + `deploy.sh` instead of re-uploading files.

### 1c. Create the `.env`

```bash
sudo -u zass cp /srv/zass/.env.example /srv/zass/.env
sudo -u zass nano /srv/zass/.env
sudo chmod 600 /srv/zass/.env
```

Fill in (see the table in [§5](#5-environment-variables)):

- `NODE_ENV=production`, `PORT=8000`
- `DATABASE_URL` / `DIRECT_URL` (Neon: pooled + direct)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (two different long random strings:
  `openssl rand -base64 48`)
- `APP_RESET_URL` (your Flutter reset deep-link / web page)
- SMTP block (real email) — or leave `SMTP_HOST` empty to log-only
- `WHATSAPP_ENABLED=true` and (optional) `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

### 1d. Install the systemd service

```bash
sudo cp /srv/zass/deploy/zass.service /etc/systemd/system/zass.service
sudo systemctl daemon-reload
sudo systemctl enable zass        # start on boot (we start it in step 3)
```

### 1e. Install the nginx site + HTTPS

```bash
sudo cp /srv/zass/deploy/nginx-api.conf /etc/nginx/sites-available/zass
sudo ln -s /etc/nginx/sites-available/zass /etc/nginx/sites-enabled/zass
sudo nginx -t && sudo systemctl reload nginx
# Provision the TLS certificate (auto-renews):
sudo certbot --nginx -d api.kalande.net
```

---

## 2. First deploy

```bash
sudo bash /srv/zass/deploy/deploy.sh
```

This installs deps, runs `prisma migrate deploy`, builds, and starts the
service. Check it:

```bash
sudo systemctl status zass
sudo journalctl -u zass -f
curl -s https://api.kalande.net/health      # {"status":"ok","env":"production"}
```

### Seed the admin (once)

```bash
# set ADMIN_EMAIL / ADMIN_PASSWORD in .env first
sudo -u zass bash -lc 'cd /srv/zass && npm run db:seed'
```

---

## 3. Link WhatsApp (once)

With `WHATSAPP_ENABLED=true`, the app boots into a "waiting for QR" state. As an
admin, fetch the QR and scan it from the phone that will send messages:

```bash
# get an admin access token via POST /api/auth/login, then:
curl -s https://api.kalande.net/api/messages/whatsapp/status \
  -H "Authorization: Bearer <admin-access-token>"
# -> { "state": "QR", "qr": "data:image/png;base64,..." }
```

Render that `qr` data-URL in a browser (or the admin screen) and scan it in
WhatsApp ▸ Linked devices. The state flips to `CONNECTED`, the session is saved
to `/srv/zass/.wwebjs_auth`, and the worker starts delivering queued messages.
You only do this again if the session is unlinked.

---

## 4. Day-to-day: shipping updates

```bash
# with git (recommended):
sudo bash /srv/zass/deploy/deploy.sh

# without git: re-upload changed source via rsync (step 1b), then:
sudo bash /srv/zass/deploy/deploy.sh
```

`deploy.sh` = pull → `npm ci` → `prisma migrate deploy` → build → restart.

> **Migrations are authored locally** (`npm run db:migrate` in dev) and committed.
> The server only ever runs `prisma migrate deploy`, which *applies* them — it
> never generates migrations (per CLAUDE.md).

---

## 5. Environment variables

See `.env.example` for the full annotated list. Production essentials:

| Var | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8000` (must match nginx `proxy_pass`) |
| `DATABASE_URL` | Neon **pooled** connection (app) |
| `DIRECT_URL` | Neon **direct** connection (migrations) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | two distinct long random strings |
| `APP_RESET_URL` | frontend password-reset link base |
| `SMTP_*` / `EMAIL_FROM` | real email; empty `SMTP_HOST` ⇒ log-only |
| `WHATSAPP_ENABLED` | `true` to send real WhatsApp |
| `WHATSAPP_SESSION_PATH` | default `.wwebjs_auth` (durable on disk) |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` to use system Chromium |

`.env` lives at `/srv/zass/.env`, `chmod 600`, owned by `zass`, never committed.

---

## 6. Operations cheat-sheet

```bash
sudo systemctl status zass         # is it running?
sudo systemctl restart zass        # restart
sudo journalctl -u zass -f         # live logs
sudo journalctl -u zass --since "1 hour ago"
```

- **Health:** `GET /health` (app up) — used by uptime checks. WhatsApp readiness
  is separate: `GET /api/messages/whatsapp/status`.
- **Graceful shutdown** is built in: on restart/stop the app stops the worker,
  tears down Chromium, drains the server, and disconnects Prisma.
- **Backups:** the database is on Neon (use Neon's backups/branching). On the VPS
  the only stateful thing is `/srv/zass/.wwebjs_auth` (the WhatsApp login) — back
  it up if you want to avoid re-scanning the QR after a rebuild.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm run build` can't find `prisma` | run `npm ci` (NOT `--omit=dev`); the build needs dev deps |
| WhatsApp never reaches `CONNECTED` | check `journalctl -u zass` for the QR log; re-scan; ensure `WHATSAPP_ENABLED=true` |
| Chromium fails to launch | set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`; ensure `chromium` is installed; `--no-sandbox` is already set |
| `502 Bad Gateway` from nginx | app not running or wrong `PORT`; `systemctl status zass`, confirm port 8000 |
| Migrations fail | verify `DIRECT_URL` (not the pooled URL) is set for migrations |
| Emails not sending | empty `SMTP_HOST` ⇒ log-only by design; check the `EmailLog` table for `FAILED` rows |

---

## 8. Scaling later (not needed now)

If one instance isn't enough, split the **same image/code** into two process
types: a horizontally-scalable **web** tier (API only) and a **single** **worker**
tier (message worker + WhatsApp). The provider seam already isolates WhatsApp, so
this is a process/config change, not a rewrite. Until then, keep it as one
instance — `whatsapp-web.js` requires a single session anyway.
