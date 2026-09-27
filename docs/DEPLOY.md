# Deployment Guide

> For **fully-local development** with no cloud accounts, use `docker compose up -d`
> from the repo root — it ships Mongo + MinIO + Mailpit. See the root README.
> This guide covers **production** deployment.

There are two supported production topologies:

1. **Vercel single-deploy** — both frontend and backend on Vercel via
   `experimentalServices` (recommended for simplicity). See §A below.
2. **Vercel (frontend) + Render (backend)** — classic split. See §B below.

In both, the backend reads two switches at boot to pick providers:

| Var                | Values                          | Default       |
|--------------------|---------------------------------|---------------|
| `STORAGE_PROVIDER` | `cloudinary` \| `s3`            | `cloudinary`  |
| `EMAIL_PROVIDER`   | `resend` \| `smtp` \| `console` | `console`     |

> 📋 **Full env reference**: see [ENV.md](ENV.md) for copy-pasteable templates
> for every deployment mode.

---

## §A. Vercel single-deploy

`vercel.json` at the repo root declares two services via `experimentalServices`:

```json
{
  "experimentalServices": {
    "frontend": { "root": "frontend", "routePrefix": "/",           "framework": "nextjs" },
    "backend":  { "root": "backend",  "routePrefix": "/_/backend",  "framework": "express" }
  }
}
```

This routes:

- `/`, `/login`, `/projects/*` → Next.js frontend
- `/_/backend/*`               → Express backend (incl. `/_/backend/socket.io/`)

Both services live on the same Vercel domain — much simpler cookie + CORS story.

### 1. Pre-requisites

- A Vercel account
- A MongoDB Atlas connection string ([Atlas section below](#mongodb-atlas))
- Cloudinary credentials ([Cloudinary section below](#cloudinary)) — or skip if
  you want to use AWS S3, configured via the `S3_*` env vars
- Resend API key ([Resend section below](#resend))

### 2. Deploy

1. Push the repo to GitHub.
2. https://vercel.com/new → import the repo. Vercel reads `vercel.json` and
   picks up both services.
3. Open **Project Settings → Environment Variables**. Paste the env block from
   [ENV.md §3.1](ENV.md#31-vercel-single-deploy), splitting between the
   `frontend` and `backend` services as marked.
4. Redeploy.

### 3. Critical settings to double-check

| Setting | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_API_URL` (frontend) | `/_/backend` | Relative — works on preview URLs without per-deploy config |
| `COOKIE_PATH` (backend) | `/_/backend/api/auth` | Browser sees auth URLs at this path; cookie must match |
| `COOKIE_SAMESITE` (backend) | `lax` | Same-origin → don't need `none` |
| `COOKIE_SECURE` (backend) | `true` | Vercel is HTTPS |
| `CORS_ORIGINS` (backend) | `https://your-app.vercel.app` | Same origin; still set explicitly |

### 4. Note on Socket.io

Socket.io needs a long-lived connection. Vercel's `experimentalServices` with
`framework: "express"` supports persistent compute, which is what makes WebSocket
work. Classic Vercel serverless functions cannot hold WebSocket connections —
if you ever migrate to that, you'll need to move the realtime layer to a
managed service (Pusher / Ably / PartyKit) or a separate persistent backend.

### 5. Smoke test

```bash
curl https://your-app.vercel.app/_/backend/health
# → { "ok": true, "env": "production", "time": "..." }
```

Then open `https://your-app.vercel.app`, register, create a project, open it in
two tabs — drag a task and watch the second tab update in real time.

---

## §B. Vercel (frontend) + Render (backend)

Use this split when you want the backend on Render's free-tier persistent
compute (e.g. you don't have access to Vercel's experimentalServices yet).

## MongoDB Atlas

1. Create a free M0 cluster on https://cloud.mongodb.com.
2. Database Access → add a user with `readWrite` on the target database.
3. Network Access → for trial: `0.0.0.0/0` (Render IPs are dynamic on the free tier).
4. Copy the connection string → that's your `MONGO_URI`.

## Cloudinary

1. Sign up at https://cloudinary.com (free tier is enough).
2. From the dashboard, copy:
   - Cloud name → `CLOUDINARY_CLOUD_NAME`
   - API key → `CLOUDINARY_API_KEY`
   - API secret → `CLOUDINARY_API_SECRET`

## Resend

1. Create an account at https://resend.com.
2. Add a sender domain (or use the sandbox domain for dev).
3. Create an API key → `RESEND_API_KEY`.
4. Set `RESEND_FROM` to a verified address, e.g. `"SYNC <noreply@yourdomain.com>"`.

## Backend → Render

This repo includes a `render.yaml` for one-click deploy:

1. Push the repo to GitHub.
2. https://dashboard.render.com → New → Blueprint → connect repo.
3. Render reads `render.yaml`, provisions the service, and asks for the env vars.
   Fill in everything in `backend/.env.example` (the blueprint pre-fills sensible
   defaults for non-secret values).
4. After the first deploy, copy the public URL (e.g. `https://sync-api.onrender.com`).

Set `CORS_ORIGINS` to your Vercel URL, then redeploy.

## Frontend → Vercel

1. https://vercel.com/new → import the repo.
2. Set the project root to `frontend/`.
3. Build command: `next build` (default). Output: `.next` (default).
4. Add an env var `NEXT_PUBLIC_API_URL` pointing at the Render URL.
5. Deploy. Vercel auto-builds on every push to `main`.

## Cookies across domains

The refresh cookie uses `SameSite=None; Secure` in production so it can travel
from the Vercel frontend to the Render backend. Required because they live on
different registrable domains. `withCredentials` is set on every browser request.

If you wire the backend to a custom subdomain of the same root as the frontend
(e.g. `api.example.com` + `app.example.com`), you can set `COOKIE_DOMAIN=.example.com`
and switch to `SameSite=Lax` for slightly better browser-side defenses.

## Smoke test

```bash
curl https://your-backend.onrender.com/health
# → { "ok": true, "env": "production", "time": "..." }
```

Then:
1. Open the Vercel URL.
2. Register an account.
3. Create a project, then add a task.
4. Open the same project in a private window with a second account (invite first).
5. Drag a task between columns — watch the second window update in <1s.
