import type { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(parsed.error);
    // Reassign sanitized output back so downstream sees clean data.
    (req as any)[source] = parsed.data;
    next();
  };
