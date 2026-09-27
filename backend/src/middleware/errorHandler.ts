import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.flatten();
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = err.message;
    details = err.errors;
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = `Invalid ${err.path}: ${err.value}`;
  } else if ((err as { code?: number }).code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'Resource already exists';
    details = (err as { keyValue?: unknown }).keyValue;
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = 401;
    code = 'INVALID_TOKEN';
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  } else {
    logger.warn({ status, code, path: req.path }, message);
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(env.isProd ? {} : { stack: (err as Error).stack }),
    },
  });
};
