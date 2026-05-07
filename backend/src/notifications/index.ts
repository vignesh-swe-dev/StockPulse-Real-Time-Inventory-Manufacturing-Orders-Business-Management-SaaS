/**
 * StockPulse Module: notifications
 * Responsibility: NotificationsController & BullMqProcessor — Deduplicated in-app alerts, overdue sweeps, bounded backoff retries
 * Backed by the transactional domain engine in ../engine/stockpulse-engine.mjs
 */
export const MODULE_METADATA = {
  name: "notifications",
  description: "NotificationsController & BullMqProcessor — Deduplicated in-app alerts, overdue sweeps, bounded backoff retries",
  apiPrefix: "/api/v1/notifications"
};
