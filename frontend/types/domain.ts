export type RoleName =
  | "OWNER"
  | "ADMINISTRATOR"
  | "MANAGER"
  | "SALES_STAFF"
  | "WAREHOUSE_STAFF"
  | "PRODUCTION_STAFF"
  | "ACCOUNTANT"
  | "VIEWER";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  currencyCode: string;
  countryCode: string;
  taxRegistrationNo: string | null;
  financialYearStart: number;
  allowNegativeStock: boolean;
  valuationMethod: string;
  planTier: string;
  isDemo: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role?: RoleName;
  isActive?: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  taxRegistrationNo?: string | null;
  currencyCode?: string;
  financialYearStart?: number;
  planTier?: string;
  isDemo?: boolean;
  role: RoleName;
  issuedAt: number;
  expiresAt: number;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  location: string;
  isActive: boolean;
  createdAt: string;
}

export type ProductType = "FINISHED_GOOD" | "RAW_MATERIAL" | "INTERMEDIATE" | "TRADED_GOOD";

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryName: string;
  uom: string;
  productType: ProductType;
  purchasePriceMinor: number;
  sellingPriceMinor: number;
  taxRateBps: number;
  reorderThreshold: number;
  isActive: boolean;
  createdAt: string;
}

export interface StockBalance {
  id: string;
  tenantId: string;
  warehouseId: string;
  productId: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  unitCostMinor: number;
  valuationMinor: number;
  version: number;
  isLowStock?: boolean;
  sku?: string;
  productName?: string;
  uom?: string;
  warehouseCode?: string;
  warehouseName?: string;
  updatedAt: string;
}

export type MovementType =
  | "OPENING_STOCK"
  | "PURCHASE_RECEIPT"
  | "SALES_DISPATCH"
  | "PRODUCTION_ISSUE"
  | "PRODUCTION_RECEIPT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "REVERSAL";

export interface StockMovement {
  id: string;
  tenantId: string;
  warehouseId: string;
  productId: string;
  movementType: MovementType;
  quantityDelta: number;
  balanceAfter: number;
  unitCostMinor: number;
  referenceType: string;
  referenceId: string | null;
  reason: string;
  reversedMovementId: string | null;
  actorUserId: string;
  createdAt: string;
  sku?: string;
  productName?: string;
  uom?: string;
  warehouseCode?: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  taxId: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  orderedQty: number;
  receivedQty: number;
  rejectedQty: number;
  unitCostMinor: number;
  sku?: string;
  productName?: string;
  uom?: string;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  warehouseId: string;
  poNumber: string;
  status: "ISSUED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  items: PurchaseOrderItem[];
  totalMinor: number;
  createdAt: string;
  supplierName?: string;
  warehouseCode?: string;
}

export interface GoodsReceipt {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  warehouseId: string;
  grnNumber: string;
  idempotencyKey: string;
  notes: string;
  createdAt: string;
  poNumber?: string;
  warehouseCode?: string;
  items: Array<{
    id: string;
    productId: string;
    receivedQty: number;
    rejectedQty: number;
    unitCostMinor: number;
  }>;
}

export interface Customer {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  taxId: string;
  creditLimitMinor: number;
  paymentTermsDays: number;
  createdAt: string;
}

export interface QuotationItem {
  id: string;
  productId: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxRateBps: number;
  lineTotalMinor: number;
}

export interface Quotation {
  id: string;
  tenantId: string;
  customerId: string;
  quoteNumber: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "EXPIRED";
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  items: QuotationItem[];
  customerName?: string;
  createdAt: string;
}

export type OrderStatus =
  | "DRAFT"
  | "QUOTED"
  | "CONFIRMED"
  | "AWAITING_STOCK"
  | "IN_PRODUCTION"
  | "READY_FOR_DISPATCH"
  | "PARTIALLY_DISPATCHED"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  orderedQty: number;
  dispatchedQty: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxRateBps: number;
  taxMinor: number;
  lineTotalMinor: number;
}

export interface Order {
  id: string;
  tenantId: string;
  customerId: string;
  warehouseId: string;
  orderNumber: string;
  quotationId: string | null;
  status: OrderStatus;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  items: OrderItem[];
  notes: string;
  createdByUserId: string;
  customerName?: string;
  customerCode?: string;
  warehouseName?: string;
  warehouseCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BomItem {
  id: string;
  rawMaterialId: string;
  sku: string;
  name: string;
  quantityPerBase: number;
  scrapPercent: number;
}

export interface BillOfMaterials {
  id: string;
  tenantId: string;
  finishedProductId: string;
  code: string;
  name: string;
  baseOutputQty: number;
  estLaborCostMinor: number;
  estOverheadCostMinor: number;
  items: BomItem[];
  finishedProductName?: string;
  finishedProductSku?: string;
  uom?: string;
  createdAt: string;
}

export interface ProductionBatch {
  id: string;
  tenantId: string;
  bomId: string;
  warehouseId: string;
  finishedProductId: string;
  batchNumber: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  plannedQty: number;
  actualGoodQty: number;
  rejectedWastageQty: number;
  estimatedCostMinor: number;
  actualTotalCostMinor: number;
  finishedProductName?: string;
  finishedProductSku?: string;
  uom?: string;
  warehouseCode?: string;
  bomCode?: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Dispatch {
  id: string;
  tenantId: string;
  orderId: string;
  warehouseId: string;
  dispatchNumber: string;
  status: "DISPATCHED" | "DELIVERED" | "CANCELLED";
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  notes: string;
  podReference: string | null;
  orderNumber?: string;
  customerName?: string;
  items: Array<{ productId: string; sku: string; quantity: number }>;
  dispatchedAt: string;
  deliveredAt: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  customerId: string;
  orderId: string;
  financialYear: string;
  invoiceNumber: string;
  status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
  currencyCode: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  balanceDueMinor: number;
  dueDate: string;
  issuedAt: string;
  customerName?: string;
  orderNumber?: string;
  isOverdue?: boolean;
}

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  customerId: string;
  paymentNumber: string;
  amountMinor: number;
  method: string;
  reference: string;
  isReversal: boolean;
  reversedPaymentId: string | null;
  invoiceNumber?: string;
  customerName?: string;
  paidAt: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string;
  actorRole: RoleName;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardSummary {
  todaysSalesMinor: number;
  totalOrdersCount: number;
  pendingOrdersCount: number;
  inventoryValueMinor: number;
  lowStockCount: number;
  lowStockProducts: StockBalance[];
  awaitingProductionCount: number;
  productionOutputQty: number;
  awaitingDispatchCount: number;
  outstandingReceivablesMinor: number;
  overdueInvoicesCount: number;
  recentActivity: AuditLog[];
}

export interface ApiEnvelope<T> {
  requestId: string;
  data: T;
}

export interface ApiErrorEnvelope {
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
