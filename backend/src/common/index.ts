/**
 * StockPulse Module: common
 * Responsibility: TenantContextMiddleware, GlobalExceptionFilter, RequestIdInterceptor, and TransactionalOutboxPublisher
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "common",
  description: "TenantContextMiddleware, GlobalExceptionFilter, RequestIdInterceptor, and TransactionalOutboxPublisher",
  apiPrefix: "/api/v1/common"
};
