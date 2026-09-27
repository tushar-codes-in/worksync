import NodeCache from 'node-cache';

/**
 * Simple in-memory cache used for high-read endpoints (project list, activity feed).
 * Per-process — in a multi-instance deploy you'd swap this for Redis. The Cache contract
 * below is the only thing we depend on, so the swap is local.
 */
export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlSeconds?: number): boolean;
  del(keys: string | string[]): number;
  /** Delete every key matching the prefix. */
  invalidatePrefix(prefix: string): number;
  flush(): void;
}

const cache = new NodeCache({ stdTTL: 30, useClones: false, checkperiod: 60 });

export const memoryCache: Cache = {
  get: (key) => cache.get(key) as any,
  set: (key, value, ttl) => cache.set(key, value, ttl as any),
  del: (keys) => cache.del(keys as any),
  invalidatePrefix(prefix) {
    const keys = cache.keys().filter((k) => k.startsWith(prefix));
    return cache.del(keys);
  },
  flush: () => cache.flushAll(),
};

export function cacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter((p) => p !== undefined && p !== '').join(':');
}
