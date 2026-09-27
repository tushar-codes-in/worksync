# SYNC Frontend

Next.js 14 (App Router) + TypeScript + Tailwind + Shadcn + Zustand + Zod.

## Develop

```bash
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev
```

## Routes

| Path                                    | Notes                                     |
|-----------------------------------------|-------------------------------------------|
| `/`                                     | Marketing / redirects to dashboard if logged in |
| `/login`, `/register`                   | Public auth                               |
| `/forgot-password`, `/reset-password`   | Email-driven reset                        |
| `/dashboard`                            | Project list (RBAC: any role)             |
| `/projects/[projectId]`                 | Kanban + members + activity + files       |
| `/invitations/accept?token=…`           | Accept an email invitation                |

All `(app)` routes share `AppLayout` which guards on hydration of the auth store.

## State

- `src/store/auth.ts` — access token (in memory), `me`, hydrated flag
- `src/store/tasks.ts` — `byProject -> taskId -> Task` + edit-presence sets
- `src/store/notifications.ts` — list + unread count

The socket client lives in `src/lib/socket.ts` and is initialized lazily when a
project page mounts. Joined rooms are tracked so reconnection re-joins them.

## API client

`src/lib/api.ts` provides:
- `api<T>(path, opts)` — typed JSON helper, single-flight refresh on 401
- `apiRaw<T>` — same but returns `{ data, meta }` (for paginated endpoints)
- `uploadWithProgress` — XHR-based upload with `onprogress` (fetch can't)

## Realtime UX

- Optimistic status changes via kanban drag — rolled back on 409
- Edit-presence badge ("X editing") on cards using `task:editing` events
- Notifications toast via Sonner + bell-icon dropdown
- Reconnect is automatic; Socket.io exponential backoff with infinite retries

## Build

`npm run build` then `npm start`. On Vercel, set the project root to `frontend/`.
