const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * General API limiter — applies to all /api routes.
 * Dev: very permissive (no real limit)
 * Prod: 500 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Auth limiter — login/register only.
 * Dev: generous (100 per 15 min)
 * Prod: 20 per 15 min (prevents brute force)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

/**
 * Chat limiter — /api/chat only.
 * Dev: permissive
 * Prod: 60 per minute
 */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages, please slow down.' },
});

/**
 * Document upload limiter — /api/documents POST only.
 * Dev: permissive
 * Prod: 20 per hour
 */
const documentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Too many document uploads, please try again later.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  chatLimiter,
  documentLimiter,
};
