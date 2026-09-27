import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);

/**
 * Disable Mongoose's command buffering. In a persistent server you want it on
 * (queue work until the connection lands); on serverless / Vercel persistent
 * compute it hides connection failures behind a 10s buffer-timeout error that
 * masks the real cause. We gate behind ensureDB() instead so handlers fail fast
 * with a real error if Mongo is unreachable.
 */
mongoose.set('bufferCommands', false);

interface ConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

/**
 * Caches the connection across Vercel invocations. The persistent-compute model
 * keeps modules warm, but defensive coding here makes the same code work even if
 * a future runtime tears down between requests.
 */
const cache: ConnectionCache = (globalThis as any).__SYNC_MONGOOSE__ ?? { conn: null, promise: null };
if (!(globalThis as any).__SYNC_MONGOOSE__) {
  (globalThis as any).__SYNC_MONGOOSE__ = cache;
}

const READY_STATE_CONNECTED = 1;

/**
 * Idempotent connect. Returns the existing connection if ready; awaits the
 * in-flight connect promise if one exists; otherwise starts a new connect.
 * Safe to call on every request.
 */
export async function ensureDB(uri = env.MONGO_URI): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === READY_STATE_CONNECTED) {
    return cache.conn;
  }

  if (!cache.promise) {
    logger.info('Opening MongoDB connection');
    cache.promise = mongoose
      .connect(uri, {
        // Fail fast on selection — better to surface a 500 than to hang for 10s.
        serverSelectionTimeoutMS: 7_000,
        // Small pool — serverless / single-tenant compute doesn't benefit from huge pools.
        maxPoolSize: 10,
        socketTimeoutMS: 45_000,
        // Build indexes in dev, not in prod (avoids long index builds on cold deploys).
        autoIndex: !env.isProd,
      })
      .then((m) => {
        cache.conn = m;
        logger.info(
          { host: m.connection.host, db: m.connection.name, state: m.connection.readyState },
          'MongoDB connected',
        );
        return m;
      })
      .catch((err) => {
        // Clear so the next call retries instead of holding a dead promise forever.
        cache.promise = null;
        logger.error({ err }, 'MongoDB connect failed');
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/** Kept for back-compat — `index.ts` still calls it at boot for eager connect. */
export const connectDB = ensureDB;

export async function disconnectDB(): Promise<void> {
  cache.conn = null;
  cache.promise = null;
  await mongoose.disconnect();
}