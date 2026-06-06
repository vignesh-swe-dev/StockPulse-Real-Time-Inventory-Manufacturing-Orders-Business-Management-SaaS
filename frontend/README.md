# StockPulse — Frontend Web Portal

> For overall platform architecture, backend API documentation, and single-command local quick start, see the main [StockPulse README.md](../README.md).

The StockPulse frontend is built with **Next.js 14** (App Router), **React 18**, **TypeScript**, and **Tailwind CSS**. It provides a real-time, responsive operations dashboard and ERP interface for manufacturers and distributors.

## Tech Stack & Design Highlights

- **Next.js 14 App Router**: Server-rendered layouts, error boundaries, client navigation, and streaming.
- **Modern Typography**: Google Fonts (`Sora` for branding/headings, `Inter` for interfaces, `JetBrains Mono` for ledger tables and numeric amounts).
- **Secure Auth Handling**: In-memory access token storage (immune to XSS attacks targeting `localStorage` or `sessionStorage`) with automatic silent token refresh.
- **Real-Time Integration**: WebSocket room subscriptions (`tenant:<tenantId>`) for instant notifications, order updates, and low-stock alerts.

## Page Routes

| Route | Purpose |
|---|---|
| `/welcome` | Public marketing landing page with feature deep dives and workflow previews |
| `/register` | Company setup and tenant account onboarding |
| `/login` | Multi-tenant sign-in with lockout protection |
| `/` | Main ERP Dashboard (KPI cards, inventory alerts, order status) |
| `/setup` | Master Data: Warehouses, Categories, Customers, Suppliers |
| `/products` | SKU catalog, pricing, units of measure, and valuation settings |
| `/inventory` | Multi-warehouse stock balances, transfers, and movement ledgers |
| `/purchases` | Purchase orders and goods receipt notes (GRN) |
| `/orders` | Quotations and sales orders pipeline with stock reservations |
| `/production` | Bills of Materials (BOM) and batch manufacturing work orders |
| `/dispatch` | Fulfillment packing lists, dispatches, and tracking notes |
| `/invoices` | Tax & GST invoicing, invoice PDF generation, payment status |
| `/reports` | Financial summaries, inventory valuation, and sales velocity |
| `/audit` | Comprehensive tamper-evident security audit logs |

## Local Development

```bash
# Install dependencies
npm install

# Start Next.js dev server on port 3000
npm run dev
```

Configure the backend API URL if needed via `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```
