/**
 * StockPulse Module: payments
 * Responsibility: PaymentsController & PaymentsService — Idempotent payment recording and non-destructive payment reversals
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "payments",
  description: "PaymentsController & PaymentsService — Idempotent payment recording and non-destructive payment reversals",
  apiPrefix: "/api/v1/payments"
};
