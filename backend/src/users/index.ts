/**
 * StockPulse Module: users
 * Responsibility: UsersController & RbacGuard — 8 built-in roles and permission matrix enforcement
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "users",
  description: "UsersController & RbacGuard — 8 built-in roles and permission matrix enforcement",
  apiPrefix: "/api/v1/users"
};
