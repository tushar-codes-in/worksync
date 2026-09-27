# SYNC — Real-time Collaborative Project Management

A production-ready MERN stack platform for real-time team task management.

<img width="1335" height="521" alt="image" src="https://github.com/user-attachments/assets/d53b02c0-15a6-4ace-81f7-1699def86985" />


- **Frontend** — Next.js 14 (App Router), TypeScript, Tailwind, Shadcn, Zustand, Zod, React Hook Form, Socket.io-client
- **Backend** — Express 4, TypeScript, Mongoose, Socket.io, Zod, JWT, bcrypt, Helmet, express-rate-limit
- **Storage** — MongoDB Atlas, Cloudinary, Resend (email)
- **Deploy** — Vercel (frontend) + Render (backend)

> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the decision log, and
> [docs/API.md](docs/API.md) for the full REST/WebSocket reference.

---

## Monorepo layout

```
SYNC/
├── backend/         Express + Socket.io API
├── frontend/        Next.js App Router UI
├── docs/            Architecture & API documentation
├── render.yaml      One-click Render deploy for the backend
└── prd.md           Original assignment
```

## Quick start (Docker — fully local, no cloud accounts)

The repo ships a `docker-compose.yml` with **MongoDB**, **MinIO** (S3-compatible,
replaces Cloudinary), and **Mailpit** (SMTP catcher, replaces Resend).

```bash
# 1. Start the local infra
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env         # defaults already point at the Docker stack
pnpm install
pnpm dev                     # http://localhost:4000

# 3. Frontend (new shell)
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm install
pnpm dev                     # http://localhost:3000
```

Open <http://localhost:3000> and sign up. Useful URLs while it's running:

| URL                              | What                                          |
|----------------------------------|-----------------------------------------------|
| http://localhost:3000            | Next.js app                                   |
| http://localhost:4000/docs       | Swagger UI (with "Authorize" + Bearer token)  |
| http://localhost:4000/docs.json  | OpenAPI 3.1 spec (Postman import)             |
| http://localhost:8025            | Mailpit inbox — reset / invitation emails     |
| http://localhost:9001            | MinIO console (`minioadmin` / `minioadmin`)   |
| http://localhost:8081            | mongo-express data browser                    |

## Quick start (production services)

If you'd rather use cloud services (Atlas / Cloudinary / Resend), set the two
provider switches and fill in their credentials:

```bash
STORAGE_PROVIDER=cloudinary
EMAIL_PROVIDER=resend
```

### Deploying

Two supported topologies:

- **Vercel single-deploy** — frontend + backend on one Vercel app via
  `experimentalServices` (`vercel.json` ships with the right config). Backend
  is mounted at `/_/backend`. See [docs/DEPLOY.md §A](docs/DEPLOY.md).
- **Vercel + Render** — classic split, frontend on Vercel and backend on Render.
  See [docs/DEPLOY.md §B](docs/DEPLOY.md).

📋 **Every env var, with copy-pasteable templates per deployment mode:** see
[docs/ENV.md](docs/ENV.md).

## Generating real JWT secrets

```bash
openssl rand -base64 64   # run 4 times for the four secrets
```

## What's implemented

### Core
- [x] JWT auth with refresh-token rotation, reuse detection, password-reset
- [x] RBAC (Admin / Member / Viewer) enforced at every project-scoped route
- [x] Projects: create/update/archive/delete, member management, invitation emails
- [x] Tasks: full CRUD, filter/sort/search, bulk update + bulk delete, attachments
- [x] Real-time via Socket.io: project rooms, presence indicators, live updates, notifications
- [x] File uploads to Cloudinary with progress bar, size/type validation, signed download URLs
- [x] Activity log per project (server-aggregated, paginated)
- [x] Optimistic concurrency on task updates (version field + 409 on mismatch)
- [x] In-memory cache for the two hottest endpoints (project list, task list)
- [x] Pagination on every list endpoint
- [x] Rate limiting on auth + global
- [x] Helmet, strict CORS, input validation with Zod, XSS-safe serialization

### Frontend
- [x] Next.js 14 App Router + Tailwind + Shadcn UI
- [x] Zustand stores (auth, tasks, notifications)
- [x] Optimistic updates with rollback on 409
- [x] Loading skeletons, toast notifications, error states
- [x] Debounced search, code-split routes (App Router default)
- [x] React Hook Form + Zod validation
- [x] Drag-and-drop kanban board
- [x] Real-time edit-presence indicators
- [x] Responsive (mobile-friendly grid layouts)
- [x] Email reset / invitation acceptance flows

### Tests
Jest + Supertest + mongodb-memory-server on critical paths:
- `tests/auth.test.ts` — register / login / refresh / strength / hashing
- `tests/tasks.test.ts` — CRUD, version conflict (409), filters, RBAC denial, bulk
- `tests/files.test.ts` — multipart upload (Cloudinary mocked), mime/size validation

```bash
cd backend && npm test
```

## Deploy

- **Backend** — `render.yaml` provisions an Express web service. Set the env vars in
  the Render dashboard (or via the blueprint). See [docs/DEPLOY.md](docs/DEPLOY.md).
- **Frontend** — Connect the repo to Vercel; root = `frontend/`, build = `next build`.
  Set `NEXT_PUBLIC_API_URL` to your Render URL.
- **Database** — MongoDB Atlas. Add Render's egress IP (or `0.0.0.0/0` for trial) to
  the Atlas IP allowlist.
- **Files** — Cloudinary free tier is sufficient for the assignment.

<img width="1570" height="895" alt="image" src="https://github.com/user-attachments/assets/bbceed87-72d5-406e-afe6-95d71cd1f20e" />
<img width="1538" height="768" alt="image" src="https://github.com/user-attachments/assets/fa9cd134-c46a-49a9-820b-8f3ae5e9396b" />

<img width="1574" height="871" alt="image" src="https://github.com/user-attachments/assets/321db277-9d29-422d-b190-a923a9f6fc4d" />



## License

MIT
