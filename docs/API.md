# SYNC API Reference

All responses follow:
```json
{ "success": true,  "data": ..., "meta": {...optional...} }
{ "success": false, "error": { "code": "STRING", "message": "...", "details": ... } }
```

Authenticate by sending `Authorization: Bearer <accessToken>`.

## Auth

### POST /api/auth/register
```json
{ "name": "Alice", "email": "a@example.com", "password": "Password1" }
```
→ `201 { user, accessToken }` + sets `sync_rt` refresh cookie.

### POST /api/auth/login
Body: `{ email, password }`. Same response shape as register.

### POST /api/auth/refresh
Body: empty (uses cookie). → `200 { accessToken }` + rotated cookie.

### POST /api/auth/logout
Revokes the current refresh token and clears the cookie. → `204`.

### POST /api/auth/forgot-password
Body: `{ email }`. Always `200 { sent: true }` (no email enumeration).

### POST /api/auth/reset-password
Body: `{ token, password }`. → `200 { reset: true }` and revokes all sessions.

### GET /api/auth/me
Returns the current user. Requires Bearer.

---

## Projects

### GET /api/projects
Query: `status?=active|archived`, `search?`, `page?`, `limit?`
→ `200 { data: Project[], meta: { page, limit, total, totalPages } }`

### POST /api/projects
Body: `{ name, description? }`. → `201 Project`. (Caller becomes admin/owner.)

### GET /api/projects/:projectId
Members + owner populated. Requires `viewer` role.

### PATCH /api/projects/:projectId
Body: `{ name?, description?, status? }`. Requires `admin`. Broadcasts `project:updated`.

### DELETE /api/projects/:projectId
Owner-only. Cascade-deletes tasks, files, activity, invitations. → `204`.

### POST /api/projects/:projectId/invites
Body: `{ email, role }`. Requires `admin`. Sends an email; the link contains a
signed `JWT_INVITE_SECRET` token.

### POST /api/projects/accept-invite
Body: `{ token }`. Adds the caller as a member at the role embedded in the token.
Caller's email must match.

### PATCH /api/projects/:projectId/members/:userId
Body: `{ role }`. Requires `admin`. Owner cannot be demoted.

### DELETE /api/projects/:projectId/members/:userId
Requires `admin`. Owner cannot be removed.

### GET /api/projects/:projectId/activity
Query: `limit?`, `cursor?`. Cursor-paginated by `_id`. Returns Activity[] with
populated `actor`.

---

## Tasks (nested under `/api/projects/:projectId/tasks`)

### GET /
Query: `status?`, `priority?`, `assignee?`, `search?`, `sort?` (one of
`-updatedAt|updatedAt|-createdAt|createdAt|-priority|priority|-dueDate|dueDate`),
`page?`, `limit?` (max 100).

### POST /
Body: `{ title, description?, status?, priority?, assignees?, dueDate? }`.
Requires `member`. Broadcasts `task:created`.

### GET /:taskId
Populated assignees/createdBy/updatedBy.

### PATCH /:taskId
Body: `{ ...fields, expectedVersion? }`. If `expectedVersion` mismatches the stored
version, returns `409 VERSION_CONFLICT` so the client can refetch and retry.
Broadcasts `task:updated`.

### DELETE /:taskId
Requires `admin`. Broadcasts `task:deleted`.

### POST /bulk-update
Body: `{ taskIds: string[], patch: { status? | priority? | assignees? } }`.
Requires `member`. Broadcasts `task:bulk_updated`.

### POST /bulk-delete
Body: `{ taskIds: string[] }`. Requires `admin`. Broadcasts `task:bulk_deleted`.

---

## Files (nested under `/api/projects/:projectId/files`)

### POST /
`multipart/form-data` with field `file` (≤5MB). Optional `taskId` to attach to a
task. Requires `member`. Returns the new File document.

### GET /
Query: `taskId?`. Lists files in the project (or just for a task).

### GET /:fileId/download
302-redirects to a short-lived signed Cloudinary URL. Requires `viewer`.

### DELETE /:fileId
Requires `member`. Admins can delete any file; members can only delete their own.

---

## Notifications

### GET /api/notifications
Query: `limit?`. Returns `{ data: Notification[], meta: { unread } }`.

### POST /api/notifications/mark-read
Body: `{ ids?: string[] }`. Empty ids → mark all read. → `204`.

---

## WebSocket (Socket.io)

Connect to the backend root with `auth: { token }` (access JWT).

### Client → Server
| Event                | Payload                                  | Description                  |
|----------------------|------------------------------------------|------------------------------|
| `project:join`       | `projectId` (string)                     | Authorizes + joins room     |
| `project:leave`      | `projectId`                              | Leaves the room              |
| `task:editing`       | `{ projectId, taskId }`                  | Broadcasts presence          |
| `task:stop_editing`  | `{ projectId, taskId }`                  | Clears presence              |

### Server → Client
| Event                       | Payload                              |
|-----------------------------|--------------------------------------|
| `task:created`              | `{ task }`                           |
| `task:updated`              | `{ task }`                           |
| `task:deleted`              | `{ taskId }`                         |
| `task:bulk_updated`         | `{ taskIds, patch }`                 |
| `task:bulk_deleted`         | `{ taskIds }`                        |
| `task:attachment_added`     | `{ taskId, file }`                   |
| `task:attachment_removed`   | `{ fileId }`                         |
| `task:editing`              | `{ userId, taskId }`                 |
| `task:stop_editing`         | `{ userId, taskId }`                 |
| `presence:join`             | `{ userId }`                         |
| `presence:leave`            | `{ userId }`                         |
| `project:updated`           | `{ project }`                        |
| `project:deleted`           | `{ projectId }`                      |
| `project:member_added`      | `{ userId }`                         |
| `project:member_removed`    | `{ userId }`                         |
| `project:member_role_changed` | `{ userId, role }`                 |
| `notification`              | Notification document                |
