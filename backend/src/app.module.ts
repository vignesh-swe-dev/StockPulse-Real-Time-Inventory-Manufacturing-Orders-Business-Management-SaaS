/**
 * StockPulse NestJS Modular Monolith Root Module
 * Connects all 16 bounded-context modules with global TenantGuard, RbacGuard, and ZodValidationPipe.
 */
export const STOCKPULSE_MODULES = [
  "AuthModule",
  "TenantsModule",
  "UsersModule",
  "ProductsModule",
  "WarehousesModule",
  "InventoryModule",
  "SuppliersModule",
  "PurchasesModule",
  "CustomersModule",
  "OrdersModule",
  "ProductionModule",
  "DispatchModule",
  "InvoicesModule",
  "PaymentsModule",
  "NotificationsModule",
  "ReportsModule",
  "AuditModule"
] as const;
