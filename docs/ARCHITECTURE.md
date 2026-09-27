# Architecture Decision Log

This document captures the non-obvious choices made in SYNC and the reasoning behind
them. Read alongside the code in `backend/src/` and `frontend/src/`.

## High-level shape

```
                       ┌──────────────────┐
   browser  ─REST,WS─▶ │  Express + IO    │ ─▶ MongoDB Atlas
                       │  (Render)        │ ─▶ Cloudinary
                       └──────────────────┘ ─▶ Resend
        ▲                       │
        └─── HTTP-only refresh ─┘
```

The frontend is a Next.js App-Router SPA on Vercel. All state-changing requests go
to the Express API on Render; the browser holds a short-lived access token in memory
and the refresh token in a Secure / HttpOnly / SameSite=None cookie scoped to
`/api/auth`. Vercel never proxies API traffic — it serves static + RSC only.

## Backend layering

Strict separation of concerns:

- **Routes** wire HTTP verbs to controllers and apply middleware (auth, RBAC,
  validation, rate limit).
- **Controllers** decode the request, call services, and shape the response. No
  business logic.
- **Services** own the domain rules. They are pure of `req`/`res` and easy to test
  in isolation.
- **Models** are Mongoose schemas with indexes, instance methods, and pre-hooks.
- **Middleware** centralizes cross-cutting concerns.

## Auth

- **Access tokens** are 15-minute JWTs signed with `JWT_ACCESS_SECRET`. They never
  leave memory on the client — XSS surface is minimized.
- **Refresh tokens** are 30-day JWTs with a unique `jti`, stored in a Secure
  HttpOnly cookie. We store **the bcrypt hash** of each refresh token server-side
  along with `jti`, `userAgent`, `ip`, and `revokedAt`. Mongo's TTL index purges
  expired rows automatically.
- **Rotation:** every `/refresh` issues a new pair and revokes the old. If a
  previously-revoked token is presented again, we treat it as **theft** and revoke
  every refresh token belonging to that user — a single compromised device cannot
  outlive a re-login.
- **Password reset** uses a dedicated `JWT_RESET_SECRET` so a leaked access secret
  can't forge resets. Resetting the password also revokes all live refresh tokens.
- **bcrypt cost = 12** for password hashing (PRD recommended ≥12).

## RBAC

Three roles per project:

| Role   | Read | Create tasks | Edit tasks | Delete tasks | Manage members & project |
|--------|------|--------------|------------|--------------|--------------------------|
| viewer | ✅    | ❌            | ❌          | ❌            | ❌                        |
| member | ✅    | ✅            | ✅ (own)    | ❌            | ❌                        |
| admin  | ✅    | ✅            | ✅          | ✅            | ✅                        |

The `requireProjectRole(min)` middleware resolves the caller's role from the
Project document and attaches it to `req`. Each route declares the minimum role
required — there is no role check inside controllers, so privilege escalation
requires breaking the middleware itself.

The project owner is implicitly an admin and cannot be demoted or removed.

## Realtime + concurrency

- Socket.io uses a JWT handshake (same access token as REST). On `connect`, the
  client joins `user:<id>`; on `project:join` it joins `project:<id>` after the
  server re-checks membership.
- Server emits `task:created`, `task:updated`, `task:deleted` (and bulk variants)
  to `project:<id>` whenever the REST controllers mutate state. This guarantees
  exactly one broadcast source-of-truth.
- **Optimistic concurrency:** each task has a `version` integer. Updates require
  `expectedVersion` matching the stored value (`findOneAndUpdate` with that filter
  and `$inc: { version: 1 }`). Conflict → 409 with a `VERSION_CONFLICT` code,
  client refetches.
- **Presence:** `task:editing` / `task:stop_editing` events; the server cleans up
  on disconnect so a dropped connection can't leave a ghost "editing" badge.

## Caching

`backend/src/cache/memoryCache.ts` wraps `node-cache` behind a `Cache` interface.
We cache the project list (per-user, 30s) and task list (per-project + filters,
15s). Mutations invalidate by prefix.

The contract is intentionally small so swapping to Redis is one file. We start
with in-memory because single-instance Render dynos don't benefit from Redis until
we scale horizontally — premature optimization would have cost us a day.

## File uploads

`multer` streams to memory (small files only, max 5MB), then we pipe to Cloudinary
via `upload_stream`. The bytes never hit local disk. Downloads return a 302 to a
short-lived signed Cloudinary URL — the backend stays out of the bytes path on
read too. Type whitelist is enforced server-side in `assertAllowed`.

## Frontend

- **Next.js App Router** with client components for everything that touches auth
  or sockets. The home page is the only RSC; we don't need server-side renders for
  protected pages and SSR would complicate token plumbing.
- **Zustand** for global state. We keep tasks in a `byProject -> taskId -> Task`
  shape so the kanban can subscribe with shallow selectors and avoid re-renders
  on unrelated tasks.
- **API wrapper** transparently retries on 401 via a single-flight `/auth/refresh`.
- **Socket client** lives outside React, surviving navigation. The room set
  re-joins automatically on reconnect.
- **Optimistic updates** on status change (kanban drag) and on task patch; we
  rollback on server error. Bulk operations apply optimistically too.

## Trade-offs

- **No SSR for protected pages.** Saves a round-trip of token plumbing complexity.
  The auth provider runs `/auth/refresh` on mount; route guards key off that.
- **`role: 'member'` can edit any task they have access to.** A finer-grained
  "edit own only" mode would need per-task ownership checks; the PRD bar was
  "create/edit assigned tasks" which we treat as the project-level capability.
- **Activity log is best-effort.** Logging failures don't roll back the parent
  mutation; we accept eventual consistency on the audit feed.
- **Single Cloudinary folder per project.** Cleanup-on-delete is best effort;
  production would use BullMQ to retry.
