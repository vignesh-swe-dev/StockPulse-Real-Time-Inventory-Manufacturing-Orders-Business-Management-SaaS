# StockPulse — Backend API & Domain Engine

> For full system architecture, frontend portal, product modules, and quick start guides, see the root [README.md](../README.md).

StockPulse is a production-oriented, multi-tenant B2B SaaS modular monolith built for manufacturers, wholesalers, distributors, and building-material suppliers to manage inventory ledgers, bills of materials (BOM), production batches, quotations, sales orders, dispatches, GST/tax invoices, payments, and real-time analytics.

## 1. Architecture & Core Invariants

1. **Modular Monolith**: Organized into 16 bounded modules (`auth`, `tenants`, `users`, `products`, `warehouses`, `inventory`, `suppliers`, `purchases`, `customers`, `orders`, `production`, `dispatch`, `invoices`, `payments`, `notifications`, `reports`, `audit`).
2. **Strict Multi-Tenant Isolation**: Every tenant-owned record carries `tenantId`. The active tenant is derived exclusively from the server-side authenticated session and validated against `tenant_memberships`. Cross-tenant access across REST routes, exports, and WebSocket rooms (`tenant:<id>`) is blocked on the server.
3. **Immutable Stock Ledger & Reservation Math**:
   - `Available Stock = On-Hand Stock − Reserved Stock` (tracked per warehouse).
   - Direct edits or deletions of historical `stock_movements` are forbidden (`405 IMMUTABLE_LEDGER_ERROR`); corrections require auditable `REVERSAL` entries.
   - Negative physical stock is prevented unless explicitly permitted by tenant policy.
4. **Exact Integer Minor Currency Units**:
   - All monetary values (`purchasePriceMinor`, `sellingPriceMinor`, `subtotalMinor`, `discountMinor`, `taxMinor`, `totalMinor`, `paidMinor`, `balanceDueMinor`) are persisted and calculated as integer minor currency units (`paise` for INR, `cents` for USD), eliminating IEEE-754 floating-point drift.
5. **Transactional Outbox for Real-Time Socket.IO Events**:
   - Domain events (`order.created`, `order.updated`, `inventory.updated`, `inventory.low_stock`, `production.started`, `production.completed`, `dispatch.updated`, `invoice.overdue`, `payment.received`, `notification.created`) are staged inside the database transaction and published only after commit.

## 2. Quick Start (Local Development)

### Using Node.js Directly (Zero External Daemon Mode)
```bash
# Run the automated Unit, Integration, Concurrency & E2E Test Suite
npm test

# Start the StockPulse REST API Server on http://localhost:4000/api/v1
npm run dev:api
```

### Using Docker Compose (PostgreSQL 16 + Redis 7 + MinIO S3 + API + Web)
```bash
cp .env.example .env
docker compose up --build -d
npx prisma migrate deploy --schema prisma/schema.prisma
npm run db:seed
```

## 3. Backup, Recovery & Rollback Procedures

- **PostgreSQL Automated Backup**:
  ```bash
  pg_dump -Fc --no-acl --no-owner "$DATABASE_URL" > backups/stockpulse_$(date +%Y%m%d_%H%M%S).dump
  ```
- **Point-in-Time Restore**:
  ```bash
  pg_restore --clean --no-acl --no-owner -d "$DATABASE_URL" backups/<dump_file>.dump
  ```
- **Migration Rollback**:
  If a deployment fails health checks (`/api/v1/health`), roll back the container image tag and mark failed migrations via `npx prisma migrate resolve --rolled-back <migration_name>`.
