export type RoleName =
  | "OWNER"
  | "ADMINISTRATOR"
  | "MANAGER"
  | "SALES_STAFF"
  | "WAREHOUSE_STAFF"
  | "PRODUCTION_STAFF"
  | "ACCOUNTANT"
  | "VIEWER";

export type RealtimeEventType =
  | "order.created"
  | "order.updated"
  | "inventory.updated"
  | "inventory.low_stock"
  | "production.started"
  | "production.completed"
  | "dispatch.updated"
  | "invoice.overdue"
  | "payment.received"
  | "notification.created";

export interface RealtimeEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: RealtimeEventType;
  tenantId: string;
  entityId: string;
  timestamp: string;
  schemaVersion: "1.0";
  payload: TPayload;
}
