# SYNC Backend

Express + TypeScript + Mongoose + Socket.io API.

## Develop

```bash
cp .env.example .env
npm install
npm run dev
```

## Scripts

| Command          | Purpose                                  |
|------------------|------------------------------------------|
| `npm run dev`    | tsx watch with pino-pretty logs          |
| `npm run build`  | tsc → `dist/`                            |
| `npm start`      | run compiled `dist/index.js`             |
| `npm test`       | jest (runs against mongodb-memory-server)|
| `npm run typecheck` | strict tsc no-emit                    |

## Structure

```
src/
├── app.ts              Express factory
├── index.ts            Bootstrap (DB + HTTP + Socket.io)
├── config/             env, logger, db, cloudinary
├── middleware/         auth, rbac, validate, rateLimit, errorHandler, upload
├── models/             Mongoose schemas + indexes
├── routes/             HTTP route declarations
├── controllers/        thin HTTP adapters
├── services/           domain logic
├── validators/         zod schemas
├── sockets/            Socket.io server, room mgmt, emit helpers
├── cache/              memory cache (Cache interface)
├── utils/              jwt, errors, ms, asyncHandler, apiResponse
└── types/              ambient type augmentations
```

Routes never call models directly — they go through services. Controllers never
contain conditional business rules.

## Notes

- All API responses are `{ success, data, meta? }` or `{ success: false, error }`.
- Refresh cookie name: `sync_rt`, path `/api/auth`, HttpOnly.
- Rate limits skip when `NODE_ENV=test` so test runs aren't throttled.
- Mongo TTL indexes purge expired RefreshToken & Invitation rows automatically.
