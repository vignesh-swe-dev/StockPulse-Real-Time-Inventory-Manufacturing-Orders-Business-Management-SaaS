/**
 * StockPulse Module: auth
 * Responsibility: AuthController & AuthService — Argon2id/scrypt hashing, short-lived access tokens, HttpOnly refresh sessions, rate limiting
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "auth",
  description: "AuthController & AuthService — Argon2id/scrypt hashing, short-lived access tokens, HttpOnly refresh sessions, rate limiting",
  apiPrefix: "/api/v1/auth"
};
