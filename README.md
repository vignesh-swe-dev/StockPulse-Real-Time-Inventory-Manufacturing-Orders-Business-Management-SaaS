# StockPulse-Real-Time-Inventory-Manufacturing-Orders-Business-Management-SaaS

<p align="center">
  <img src="frontend/public/icon.svg" alt="StockPulse Logo" width="80" height="80" />
</p>

<h3 align="center">Enterprise Multi-Tenant B2B SaaS for Real-Time Inventory, Manufacturing, Order Management & Tax Invoicing</h3>

<p align="center">
  <a href="#core-architectural-invariants"><img src="https://img.shields.io/badge/Architecture-Modular%20Monolith-blue.svg?style=flat-square" alt="Modular Monolith" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/Frontend-Next.js%2014%20(App%20Router)-black.svg?style=flat-square" alt="Next.js 14" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/Backend-Node.js%20%3E%3D18.18-green.svg?style=flat-square" alt="Node.js" /></a>
  <a href="#testing--verification"><img src="https://img.shields.io/badge/Tests-11%2F11%20Passing%20(100%25)-success.svg?style=flat-square" alt="Tests" /></a>
  <a href="#core-architectural-invariants"><img src="https://img.shields.io/badge/Ledger-Immutable%20Double--Entry-purple.svg?style=flat-square" alt="Immutable Ledger" /></a>
  <a href="#core-architectural-invariants"><img src="https://img.shields.io/badge/Currency-Exact%20Integer%20Paise%2FCents-orange.svg?style=flat-square" alt="Integer Minor Units" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-lightgrey.svg?style=flat-square" alt="License" /></a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Architectural Invariants](#core-architectural-invariants)
- [Product Modules & Features](#product-modules--features)
- [Technology Stack](#technology-stack)
- [Quick Start (Local Development)](#quick-start-local-development)
  - [Prerequisites](#prerequisites)
  - [1. Single-Command Launch (Backend + Frontend)](#1-single-command-launch-backend--frontend)
  - [2. Demo Mode (Sample Data)](#2-demo-mode-sample-data)
  - [3. Running Services Independently](#3-running-services-independently)
- [Service URLs & Endpoints](#service-urls--endpoints)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Production Deployment (Docker & PostgreSQL)](#production-deployment-docker--postgresql)
- [Configuration Reference](#configuration-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Repository Structure](#repository-structure)
- [Data Storage & Reset](#data-storage--reset)
- [License](#license)

---

## Overview

**StockPulse** is a production-grade, multi-tenant B2B operating system tailored for manufacturers, wholesalers, distributors, and supply-chain enterprises. It consolidates fragmented operational workflows—inventory ledgers, bills of materials (BOM), shop-floor work orders, quotations, sales orders, fulfillment dispatches, GST/tax invoicing, and payment tracking—into a unified, real-time platform with strict mathematical and architectural guarantees.

### Key Problem Solved
Traditional ERPs and fragmented spreadsheets suffer from:
- **Inventory drift & overselling**: Disconnect between physical stock and order commitments.
- **Rounding and floating-point errors**: Inconsistent financial statements caused by IEEE-754 precision issues.
- **Audit vulnerability**: Uncontrolled retroactive edits to stock history and financial transactions.
- **Complex infrastructure overhead**: Heavy setup requirements that slow down agile development and deployment.

StockPulse resolves these challenges through a dual-mode engine: an ultra-fast, zero-dependency atomic persistence layer for local instant onboarding, alongside an enterprise PostgreSQL + Redis stack for production scale.

---

## System Architecture

StockPulse is architected as a clean **Modular Monolith** with 16 bounded domain contexts, decoupled via an in-memory event bus and transactional outbox.

```mermaid
graph TD
    Client["Next.js 14 Web Portal (App Router)"]
    API["StockPulse API Gateway (:4000)"]
    Engine["Domain Engine (16 Bounded Contexts)"]
    Outbox["Transactional Outbox & Event Dispatcher"]
    WebSockets["Real-Time WebSocket Rooms (tenant:id)"]
    
    subgraph Storage ["Dual-Mode Storage Engine"]
        LocalFile["Atomic JSON Storage Engine (Zero Setup)"]
        Postgres["PostgreSQL 16 + Prisma ORM (Production)"]
        Redis["Redis 7 (Distributed Pub/Sub)"]
    end

    Client -->|REST API Requests| API
    Client <-->|Live Updates / Rooms| WebSockets
    API --> Engine
    Engine --> Outbox
    Outbox --> WebSockets
    Engine --> Storage
```

---

## Core Architectural Invariants

StockPulse enforces strict guarantees at the domain engine level:

1. **Strict Multi-Tenant Isolation**
   - Every tenant record carries a permanent `tenantId`.
   - The active tenant is derived exclusively from cryptographic server-side sessions, never from client-provided path arguments or request bodies.
   - Cross-tenant data leakage across REST endpoints, exports, and WebSocket rooms (`tenant:<id>`) is blocked by default.

2. **Immutable Double-Entry Stock Ledger**
   - Inventory formula:
     $$\text{Available Stock} = \text{On-Hand Stock} - \text{Reserved Stock}$$
   - Direct updates or deletions of historical `stock_movements` are strictly prohibited (`405 IMMUTABLE_LEDGER_ERROR`).
   - Inventory adjustments require auditable `REVERSAL` or `ADJUSTMENT` movement entries.
   - Negative physical stock is blocked unless explicitly enabled in tenant settings.

3. **Exact Integer Minor Currency Units**
   - All financial figures (`purchasePriceMinor`, `sellingPriceMinor`, `subtotalMinor`, `discountMinor`, `taxMinor`, `totalMinor`, `paidMinor`, `balanceDueMinor`) are stored and computed in integer minor currency units (paise for INR, cents for USD).
   - Eliminates IEEE-754 floating-point rounding discrepancies across invoices, line items, and ledger balances.

4. **Transactional Outbox for Event Publishing**
   - Domain events (`order.created`, `order.updated`, `inventory.updated`, `inventory.low_stock`, `production.completed`, `dispatch.updated`, `payment.received`) are staged within the transaction and dispatched only upon commit.

5. **Concurrency-Safe Reservation & Order Locking**
   - Concurrent order confirmations lock required stock atomic allocations, preventing overselling or stock race conditions under high volume.

---

## Product Modules & Features

| Module | Features & Capabilities |
|---|---|
| **🏢 Setup & Masters** | Multi-warehouse configurations, product category trees, customer & supplier directories with GSTIN/tax registration. |
| **📦 Inventory & Ledger** | Real-time multi-warehouse stock balances, FIFO/Weighted Average valuation, reorder thresholds, inter-warehouse stock transfers, immutable stock movement audit trail. |
| **⚙️ Bills of Materials (BOM)** | Multi-level recipe management, raw material cost roll-up calculations, scrap factor estimation, version tracking. |
| **🏭 Manufacturing & Work Orders** | Batch production planning, material issue from inventory, finished goods receipt, yield analysis, wastage tracking. |
| **🛒 Quotations & Sales Orders** | Quotation-to-order pipeline, automated stock reservation allocation, granular order lifecycles (`DRAFT` → `QUOTED` → `CONFIRMED` → `IN_PRODUCTION` → `READY_FOR_DISPATCH` → `DISPATCHED`). |
| **🚚 Fulfillment & Dispatch** | Partial and complete fulfillment, automated packing slips, dispatch notes, courier/vehicle tracking integration. |
| **🧾 Tax & GST Invoicing** | Automated invoice generation from dispatches, statutory tax calculations, payment status lifecycles (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`). |
| **💳 Payments & Reconciliation** | Multi-mode payment recording (Bank Transfer, UPI, Cheque, Cash), payment allocation against invoices, customer balance tracking. |
| **📊 Reports & Financial Analytics** | Real-time executive dashboard, inventory valuation reports, sales velocity charts, gross margin analytics, tax liabilities. |
| **🔒 Compliance & Audit Trail** | Tamper-evident logging of all actor mutations with actor role, IP address, entity ID, previous/new state, and timestamp. |

---

## Technology Stack

### Frontend Application
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, React Server Components & Client Hooks)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode enabled)
- **Styling & UI**: Tailwind CSS, CSS Custom Properties Design Tokens, [Lucide React](https://lucide.dev/)
- **Typography**: Google Fonts (`Sora` for headings, `Inter` for interfaces, `JetBrains Mono` for ledger/data)
- **State & Security**: In-memory secure token management (immune to XSS token exfiltration from `localStorage`)

### Backend Engine & API
- **Runtime**: [Node.js](https://nodejs.org/) 18.18+ (ES Modules, `--watch` hot-reload)
- **Architecture**: Modular Monolith organized across 16 domain contexts
- **Security**: Timing-safe scrypt password hashing, session revocation, brute-force login rate limiting
- **Real-Time**: Native WebSocket engine with tenant-scoped room routing

### Database & Persistence
- **Local Development**: Built-in zero-dependency atomic JSON persistence engine (`backend/data/stockpulse-data.json`)
- **Production Scale**: [PostgreSQL 16](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/) schema migrations, [Redis 7](https://redis.io/) for caching/pub-sub, [MinIO](https://min.io/) for S3-compatible document storage.

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js**: `18.18.0` or newer ([Download Node.js](https://nodejs.org/))
- **Package Manager**: `npm` (comes bundled with Node.js)
- **OS**: Windows, macOS, or Linux

> [!NOTE]
> No database server, Docker daemon, or external service is required for local development. StockPulse runs out of the box with zero setup.

### 1. Single-Command Launch (Backend + Frontend)

Clone the repository and run:

```bash
# Clone the repository
git clone https://github.com/your-username/stockpulse.git
cd stockpulse

# Start both backend and frontend concurrently
npm run dev
```

*On Windows, you can also double-click `start-local.bat`. On macOS/Linux: `./start-local.sh`.*

StockPulse will automatically install missing dependencies on the first run and boot:
- **Web App & Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Marketing & Features**: [http://localhost:3000/welcome](http://localhost:3000/welcome)
- **REST API Gateway**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)

### 2. Demo Mode (Sample Data)

To explore StockPulse with pre-configured warehouses, products, BOM recipes, suppliers, and sales orders:

```bash
node scripts/dev.mjs --demo
```

**Demo Credentials**:
- **Email**: `vikram@sahyadri.in`
- **Password**: `SahyadriSecure#2026`

*(Demo data is stored in a isolated `demo-data.json` file and never pollutes real business records).*

### 3. Running Services Independently

You can also run the backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend API
cd backend
npm run dev

# Terminal 2 — Frontend Web Portal
cd frontend
npm run dev
```

---

## Service URLs & Endpoints

| Portal / Service | Address | Access Level | Description |
|---|---|---|---|
| **Marketing Website** | `http://localhost:3000/welcome` | Public | Feature walkthrough, workflows, and platform architecture |
| **Application Portal** | `http://localhost:3000` | Authenticated | Main ERP & Operations executive dashboard |
| **Sign-In Page** | `http://localhost:3000/login` | Public | Multi-tenant user login with lockout protection |
| **Company Registration** | `http://localhost:3000/register` | Public | New tenant setup and company account creation |
| **REST API Root** | `http://localhost:4000/api/v1` | Public | API service registry and documentation |
| **Health Check** | `http://localhost:4000/api/v1/health` | Public | Service health, tenant status, and persistence mode |

---

## Role-Based Access Control (RBAC)

StockPulse enforces strict server-side RBAC across 8 discrete roles:

| Role | Scope & Permissions |
|---|---|
| **`OWNER`** | Full root authority (`*`) across all company data, billing, and organizational configurations. |
| **`ADMINISTRATOR`** | Complete operational and master data management, user invitations, and system settings. |
| **`MANAGER`** | Cross-department operations: products, inventory, production, dispatch, purchasing, and sales. |
| **`SALES_STAFF`** | Customer records, quotations, sales order entry, and invoice viewing. |
| **`WAREHOUSE_STAFF`** | Stock balance inspection, stock transfers, purchase order receiving, and dispatch fulfillment. |
| **`PRODUCTION_STAFF`** | BOM viewing, shop-floor work orders, batch execution, and finished goods recording. |
| **`ACCOUNTANT`** | Customer/supplier ledgers, invoice issuance, payment entries, financial analytics, and audit logs. |
| **`VIEWER`** | Read-only inspection across reports and operational status screens. |

---

## Production Deployment (Docker & PostgreSQL)

For production deployment with PostgreSQL 16, Redis 7, and MinIO S3 object storage:

```bash
cd backend

# 1. Configure environment variables
cp .env.example .env

# 2. Start PostgreSQL, Redis, MinIO, and API containers
docker compose up --build -d

# 3. Apply Prisma database migrations
npx prisma migrate deploy

# 4. (Optional) Seed initial production data
npm run db:seed
```

### Production Backup & Recovery

- **Automated PostgreSQL Backup**:
  ```bash
  pg_dump -Fc --no-acl --no-owner "$DATABASE_URL" > backups/stockpulse_$(date +%Y%m%d_%H%M%S).dump
  ```
- **Point-in-Time Restore**:
  ```bash
  pg_restore --clean --no-acl --no-owner -d "$DATABASE_URL" backups/<backup_file>.dump
  ```

---

## Configuration Reference

The application can be configured via environment variables:

| Variable | Default (Local) | Production Example | Description |
|---|---|---|---|
| `PORT` / `BACKEND_PORT` | `4000` | `4000` | Port for the backend API service. |
| `FRONTEND_PORT` | `3000` | `3000` | Port for the Next.js web application. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | `https://api.yourdomain.com/api/v1` | Public API URL accessed by frontend clients. |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | `https://app.yourdomain.com` | Allowed CORS origins for browser clients. |
| `DATA_FILE` | `backend/data/stockpulse-data.json` | — | Path to the local JSON persistence file. |
| `DATABASE_URL` | — | `postgresql://user:pass@host:5432/stockpulse` | PostgreSQL connection string for Prisma. |
| `REDIS_URL` | — | `redis://host:6379` | Redis connection URL for distributed events. |
| `DEMO_DATA` | `0` | `0` | Set to `1` to boot with sample demo business data. |

---

## Testing & Quality Assurance

StockPulse includes an automated test suite covering unit invariants, integration workflows, concurrency locks, and complete end-to-end vertical slices.

Run the entire test suite:

```bash
npm test
```

### Test Suite Coverage:
- `Unit: Exact integer minor currency calculation (zero floating-point drift)`
- `Unit: Password hashing and timing-safe verification`
- `Unit: Role and permission matrix decisions across all 8 roles`
- `Unit: Valid server-side order status transitions`
- `Unit: BOM material requirement & estimated cost calculation`
- `Integration: Comprehensive REST API Suite for all 16 Bounded Contexts`
- `Integration: Strict Multi-Tenant Isolation across Products, Inventory, Orders, and WebSockets`
- `Integration: Concurrent Order Confirmation prevents overselling (Available = OnHand - Reserved)`
- `Integration: Goods Receipt (GRN) Idempotency & Immutable Stock Ledger Reversal`
- `Integration: Background Job Bounded Retry Recovery`
- `E2E: Full Vertical Slice: Company → Product → Stock Receipt → Order → Production → Dispatch → Invoice → Payment`

---

## Repository Structure

```text
stockpulse/
├── README.md                 # Primary project documentation & architecture guide
├── README-LOCAL.md           # Quick developer notes for local execution
├── package.json              # Monorepo task orchestration scripts
├── start-local.bat           # Windows 1-click launcher
├── start-local.sh            # Unix/macOS 1-click launcher
├── scripts/
│   └── dev.mjs               # Cross-platform multi-process development runner
├── backend/                  # Node.js Modular Monolith REST API & Engine
│   ├── package.json          # Backend dependencies & test scripts
│   ├── docker-compose.yml    # Docker stack (PostgreSQL, Redis, MinIO, API)
│   ├── data/                 # Local atomic persistence directory (*.json)
│   ├── prisma/               # Production PostgreSQL schema & migrations
│   ├── src/                  # 16 Bounded Context modules
│   │   ├── auth/             # Authentication & session token management
│   │   ├── tenants/          # Multi-tenant scoping & configuration
│   │   ├── inventory/        # Multi-warehouse ledgers & stock movements
│   │   ├── products/         # SKU catalog, valuation & category masters
│   │   ├── orders/           # Quotations & sales orders state machines
│   │   ├── production/       # BOM definitions & batch manufacturing
│   │   ├── dispatch/         # Fulfillment & carrier tracking
│   │   ├── invoices/         # GST/Tax invoicing calculation engine
│   │   ├── payments/         # Payment recording & reconciliation
│   │   ├── engine/           # In-memory domain engine & atomic persistence
│   │   └── server.mjs        # HTTP server & route registration
│   └── tests/                # Automated test suite (unit, integration, e2e)
└── frontend/                 # Next.js 14 Web Application
    ├── package.json          # Frontend dependencies & Next scripts
    ├── tsconfig.json         # TypeScript configuration
    ├── app/                  # Next.js App Router pages
    │   ├── welcome/          # Marketing website & feature showcase
    │   ├── register/         # Company onboarding & tenant registration
    │   ├── login/            # Authentication interface
    │   ├── setup/            # Masters: Warehouses, categories, suppliers
    │   ├── inventory/        # Stock balance view & transfer workflows
    │   ├── products/         # Product catalog management
    │   ├── orders/           # Sales orders & quotation pipelines
    │   ├── production/       # Manufacturing work orders & BOM recipes
    │   ├── dispatch/         # Order shipping & fulfillment notes
    │   ├── invoices/         # Tax invoices & overdue tracking
    │   ├── reports/          # Financial summaries & inventory valuation
    │   └── audit/            # Security audit logs
    ├── components/           # Reusable UI component library
    └── lib/                  # In-memory auth store & typed API client
```

---

## Data Storage & Reset

- **Where data is saved**: When running locally without Docker, all business data is automatically persisted to `backend/data/stockpulse-data.json`.
- **How to back up**: Simply make a copy of `backend/data/stockpulse-data.json`.
- **How to reset to empty**: Delete `backend/data/stockpulse-data.json` while the backend is stopped. On the next startup, StockPulse will begin with an empty database ready for a fresh company registration.

---

## License

This project is licensed under the [MIT License](LICENSE).
