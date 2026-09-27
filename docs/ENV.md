# Environment variables — complete reference

Every env var SYNC reads, what it's for, and the value to use in each deployment
mode. Pick a column, copy-paste, done.

> **TL;DR — Vercel single-deploy.** Go to your Vercel project → Settings →
> Environment Variables, then paste the values from the **"Vercel single-deploy"**
> column into the corresponding service (`frontend` or `backend`).

---

## 1. Frontend (`frontend/.env.local` or Vercel `frontend` service env)

| Variable | Local Docker dev | Vercel single-deploy | Vercel + Render | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | `/_/backend` | `https://your-api.onrender.com` | Relative paths are resolved against the current origin — perfect for Vercel preview URLs. |
| `NEXT_PUBLIC_SOCKET_PATH` | *unset* | *unset* (auto) | *unset* | Only set this to manually override the Socket.io handshake path. Auto-derived from the API URL otherwise. |

---

## 2. Backend (`backend/.env` or Vercel `backend` service env)

### 2.1 Server

| Variable | Local Docker | Vercel single-deploy | Vercel + Render |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | `production` |
| `PORT` | `4000` | `4000` *(Vercel sets it)* | `10000` *(Render sets it)* |
| `LOG_LEVEL` | `info` | `info` | `info` |
| `APP_URL` | `http://localhost:4000` | `https://your-app.vercel.app/_/backend` | `https://your-api.onrender.com` |
| `FRONTEND_URL` | `http://localhost:3000` | `https://your-app.vercel.app` | `https://your-app.vercel.app` |
| `CORS_ORIGINS` | `http://localhost:3000` | `https://your-app.vercel.app` | `https://your-app.vercel.app` |

### 2.2 Database

| Variable | Local Docker | Vercel single-deploy | Vercel + Render |
|---|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/sync` | `mongodb+srv://user:pass@cluster.mongodb.net/sync` | `mongodb+srv://user:pass@cluster.mongodb.net/sync` |

### 2.3 JWT — four independent secrets

```bash
# Generate strong randoms (run each line separately):
openssl rand -base64 64   # JWT_ACCESS_SECRET
openssl rand -base64 64   # JWT_REFRESH_SECRET
openssl rand -base64 64   # JWT_RESET_SECRET
openssl rand -base64 64   # JWT_INVITE_SECRET
```

| Variable | All modes |
|---|---|
| `JWT_ACCESS_SECRET` | *(64-byte random base64)* |
| `JWT_REFRESH_SECRET` | *(64-byte random base64)* |
| `JWT_RESET_SECRET` | *(64-byte random base64)* |
| `JWT_INVITE_SECRET` | *(64-byte random base64)* |
| `ACCESS_TOKEN_TTL` | `15m` |
| `REFRESH_TOKEN_TTL` | `30d` |
| `RESET_TOKEN_TTL` | `30m` |
| `INVITE_TOKEN_TTL` | `7d` |

### 2.4 Cookies — pay attention to `COOKIE_PATH`

| Variable | Local Docker | Vercel single-deploy | Vercel + Render |
|---|---|---|---|
| `COOKIE_PATH` | `/api/auth` | **`/_/backend/api/auth`** | `/api/auth` |
| `COOKIE_DOMAIN` | *unset* | *unset* | *unset (or shared parent like `.example.com`)* |
| `COOKIE_SECURE` | `false` | `true` | `true` |
| `COOKIE_SAMESITE` | *unset* (auto → `lax`) | `lax` | `none` |

> **Why `COOKIE_PATH` matters on Vercel single-deploy:** the browser sees the auth
> URL as `https://your-app.vercel.app/_/backend/api/auth/refresh`. If the server
> sets the cookie at `Path=/api/auth`, the browser won't send it back on the
> `/_/backend/api/auth/*` URL. The cookie path must match the BROWSER-visible URL.

### 2.5 Storage — pick `cloudinary` or `s3`

| Variable | Local Docker (MinIO) | Vercel — Cloudinary | Vercel — AWS S3 |
|---|---|---|---|
| `STORAGE_PROVIDER` | `s3` | `cloudinary` | `s3` |

#### When `STORAGE_PROVIDER=cloudinary`

| Variable | Value |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | *from Cloudinary dashboard* |
| `CLOUDINARY_API_KEY` | *from Cloudinary dashboard* |
| `CLOUDINARY_API_SECRET` | *from Cloudinary dashboard* |
| `CLOUDINARY_UPLOAD_FOLDER` | `sync` |

#### When `STORAGE_PROVIDER=s3`

| Variable | Local Docker (MinIO) | AWS S3 production |
|---|---|---|
| `S3_ENDPOINT` | `http://localhost:9000` | *leave unset to use default AWS endpoint* |
| `S3_REGION` | `us-east-1` | *your bucket's region* |
| `S3_BUCKET` | `sync` | *your bucket name* |
| `S3_ACCESS_KEY` | `minioadmin` | *IAM access key* |
| `S3_SECRET_KEY` | `minioadmin` | *IAM secret key* |
| `S3_FORCE_PATH_STYLE` | `true` | `false` |
| `S3_PUBLIC_URL_BASE` | `http://localhost:9000/sync` | *unset (use signed URLs)* |

### 2.6 Email — pick `resend`, `smtp`, or `console`

| Variable | Local Docker (Mailpit) | Vercel — Resend | Vercel — SES/SMTP |
|---|---|---|---|
| `EMAIL_PROVIDER` | `smtp` | `resend` | `smtp` |

#### When `EMAIL_PROVIDER=resend`

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | *from Resend dashboard* |
| `RESEND_FROM` | `SYNC <noreply@yourdomain.com>` |

#### When `EMAIL_PROVIDER=smtp`

| Variable | Local Docker (Mailpit) | AWS SES production |
|---|---|---|
| `SMTP_HOST` | `localhost` | `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_PORT` | `1025` | `587` |
| `SMTP_USER` | *unset* | *SMTP credentials user* |
| `SMTP_PASS` | *unset* | *SMTP credentials secret* |
| `SMTP_SECURE` | `false` | `false` (use STARTTLS) |
| `SMTP_FROM` | `SYNC <noreply@local.test>` | `SYNC <noreply@yourdomain.com>` |

### 2.7 Rate limiting and uploads

| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_AUTH_MAX` | `10` | Requests per window for auth endpoints |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` | 15 minutes |
| `RATE_LIMIT_GLOBAL_MAX` | `300` | Requests per window globally |
| `RATE_LIMIT_GLOBAL_WINDOW_MS` | `900000` | 15 minutes |
| `MAX_FILE_SIZE_MB` | `5` | Per-upload cap (also enforced by multer) |

---

## 3. Ready-to-paste templates

### 3.1 Vercel single-deploy

#### `frontend` service

```bash
NEXT_PUBLIC_API_URL=/_/backend
```

#### `backend` service

```bash
# Server
NODE_ENV=production
LOG_LEVEL=info
APP_URL=https://your-app.vercel.app/_/backend
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGINS=https://your-app.vercel.app

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/sync

# JWT (replace each with `openssl rand -base64 64`)
JWT_ACCESS_SECRET=__GENERATE_ME__
JWT_REFRESH_SECRET=__GENERATE_ME__
JWT_RESET_SECRET=__GENERATE_ME__
JWT_INVITE_SECRET=__GENERATE_ME__
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
RESET_TOKEN_TTL=30m
INVITE_TOKEN_TTL=7d

# Cookies — IMPORTANT: path matches the browser-visible URL
COOKIE_PATH=/_/backend/api/auth
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# Storage — Cloudinary
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=sync

# Email — Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=
RESEND_FROM="SYNC <noreply@yourdomain.com>"

# Rate limits & uploads (defaults are fine)
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_GLOBAL_MAX=300
RATE_LIMIT_GLOBAL_WINDOW_MS=900000
MAX_FILE_SIZE_MB=5
```

### 3.2 Local Docker dev

#### `frontend/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

#### `backend/.env`

```bash
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

MONGO_URI=mongodb://localhost:27017/sync

JWT_ACCESS_SECRET=dev-access-please-change-me
JWT_REFRESH_SECRET=dev-refresh-please-change-me
JWT_RESET_SECRET=dev-reset-please-change-me
JWT_INVITE_SECRET=dev-invite-please-change-me
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
RESET_TOKEN_TTL=30m
INVITE_TOKEN_TTL=7d

COOKIE_PATH=/api/auth
COOKIE_SECURE=false

# Local MinIO from docker-compose.yml
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=sync
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL_BASE=http://localhost:9000/sync

# Local Mailpit from docker-compose.yml
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM="SYNC <noreply@local.test>"

RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_GLOBAL_MAX=300
RATE_LIMIT_GLOBAL_WINDOW_MS=900000
MAX_FILE_SIZE_MB=5
```

### 3.3 Vercel (frontend) + Render (backend)

#### Vercel frontend service env

```bash
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

#### Render backend service env

Everything from §3.1's backend block, but with:

```bash
APP_URL=https://your-api.onrender.com
COOKIE_PATH=/api/auth
COOKIE_SAMESITE=none   # required for cross-origin cookies
COOKIE_SECURE=true
```

---

## 4. Setting env vars on Vercel

1. **Project Settings → Environment Variables**.
2. The `experimentalServices` block in `vercel.json` defines two services
   (`frontend` and `backend`). Vercel's UI lets you scope each env var to one
   service, both services, or all environments.
3. Mark anything ending in `_SECRET` or `_KEY` as **Sensitive** so it can't be
   re-read after saving.
4. After saving, redeploy — env changes don't propagate to already-running
   deploys.

## 5. Setting env vars on Render

The repo ships a `render.yaml` blueprint. On first deploy Render reads it and
prompts for any var declared with `sync: false`. JWT secrets declared with
`generateValue: true` are auto-generated with strong randoms — you never see or
manage them.

## 6. Verifying

Once everything's deployed:

```bash
curl https://your-app.vercel.app/_/backend/health
# → { "ok": true, "env": "production", "time": "..." }

# Swagger UI:
open https://your-app.vercel.app/_/backend/docs
```

Then walk the standard flow: register → log in → create project → drop a file
into a task. If anything 401s right after login, check `COOKIE_PATH` — it's the
single biggest gotcha on the Vercel single-deploy.
