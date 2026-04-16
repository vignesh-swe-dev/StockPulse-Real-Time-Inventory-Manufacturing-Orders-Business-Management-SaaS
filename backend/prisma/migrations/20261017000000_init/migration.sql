-- StockPulse Initial PostgreSQL Migration (Normalized Multi-Tenant Schema)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "tenants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "currencyCode" TEXT NOT NULL DEFAULT 'INR',
  "countryCode" TEXT NOT NULL DEFAULT 'IN',
  "taxRegistrationNo" TEXT,
  "financialYearStart" INTEGER NOT NULL DEFAULT 4,
  "allowNegativeStock" BOOLEAN NOT NULL DEFAULT FALSE,
  "valuationMethod" TEXT NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
  "planTier" TEXT NOT NULL DEFAULT 'GROWTH',
  "isDemo" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "warehouses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "code")
);

CREATE TABLE "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "sku" TEXT NOT NULL,
  "barcode" TEXT,
  "name" TEXT NOT NULL,
  "uom" TEXT NOT NULL DEFAULT 'PCS',
  "productType" TEXT NOT NULL DEFAULT 'FINISHED_GOOD',
  "purchasePriceMinor" BIGINT NOT NULL DEFAULT 0,
  "sellingPriceMinor" BIGINT NOT NULL DEFAULT 0,
  "taxRateBps" INTEGER NOT NULL DEFAULT 1800,
  "reorderThreshold" NUMERIC(14,3) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "sku")
);

CREATE TABLE "stock_balances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "warehouseId" UUID NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  "productId" UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "onHandQty" NUMERIC(14,3) NOT NULL DEFAULT 0,
  "reservedQty" NUMERIC(14,3) NOT NULL DEFAULT 0,
  "unitCostMinor" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "warehouseId", "productId")
);

CREATE INDEX "idx_stock_balances_tenant_product" ON "stock_balances"("tenantId", "productId");
