"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";
import { apiClient } from "../lib/api";
import { DashboardSummary } from "../types/domain";
import { Icon, IconName } from "../components/Icon";
import { CountUp } from "../components/CountUp";
import { BarList, Donut } from "../components/Charts";
import { formatPaiseToInr, formatQuantity, formatDateIndian } from "../lib/currency";

export default function DashboardPage() {
  const { session, hasPermission } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (session?.fullName || "there").split(" ")[0];
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockBars, setStockBars] = useState<{ label: string; value: number }[]>([]);
  const [salesSplit, setSalesSplit] = useState<{ label: string; value: number }[]>([]);

  const fetchSummary = async () => {
    try {
      setError(null);
      const data = await apiClient<DashboardSummary>("/dashboard/summary");
      setSummary(data);
      if (hasPermission("reports:read")) {
        try {
          const [inv, sales] = await Promise.all([
            apiClient<any>("/reports/inventory-valuation"),
            apiClient<any>("/reports/sales-summary")
          ]);
          setStockBars(
            [...(inv.items || [])]
              .sort((a: any, b: any) => b.valuationMinor - a.valuationMinor)
              .slice(0, 6)
              .map((b: any) => ({ label: b.productName || b.sku, value: b.valuationMinor }))
          );
          setSalesSplit(
            [...(sales.byCustomer || [])]
              .sort((a: any, b: any) => b.totalSalesMinor - a.totalSalesMinor)
              .slice(0, 5)
              .map((c: any) => ({ label: c.customerName, value: c.totalSalesMinor }))
          );
        } catch {
          /* charts are optional */
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard summary.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchSummary();
    }
  }, [session?.accessToken]);

  // Real-time auto refresh on relevant domain events
  useRealtimeSocket((event) => {
    if (
      [
        "order.created",
        "order.updated",
        "inventory.updated",
        "inventory.low_stock",
        "production.completed",
        "payment.received"
      ].includes(event.eventType)
    ) {
      fetchSummary();
    }
  });

  const [setup, setSetup] = useState<{ warehouses: number; products: number; customers: number; stock: number } | null>(null);
  useEffect(() => {
    if (!session?.accessToken) return;
    Promise.all([
      hasPermission("warehouses:read") ? apiClient<any[]>("/warehouses") : Promise.resolve([]),
      hasPermission("products:read") ? apiClient<any[]>("/products") : Promise.resolve([]),
      hasPermission("customers:read") ? apiClient<any[]>("/customers") : Promise.resolve([]),
      hasPermission("inventory:read") ? apiClient<any[]>("/inventory/balances") : Promise.resolve([])
    ]).then(([w, p, c, i]) => setSetup({ warehouses: w.length, products: p.length, customers: c.length, stock: i.length })).catch(() => {});
  }, [session?.accessToken, summary]);

  const lowCount = summary?.lowStockCount ?? 0;
  const receivables = summary?.outstandingReceivablesMinor ?? 0;
  const kpis: {
    label: string; icon: IconName; tint: string; value: number; format: (n: number) => string; hint: string; color?: string;
  }[] = [
    { label: "Total Sales Value", icon: "wallet", tint: "#0369a1", value: summary?.todaysSalesMinor ?? 0, format: (n) => formatPaiseToInr(n), hint: `Orders count: ${summary?.totalOrdersCount ?? 0}` },
    { label: "Inventory Valuation", icon: "inventory", tint: "#0891b2", value: summary?.inventoryValueMinor ?? 0, format: (n) => formatPaiseToInr(n), hint: "Weighted average asset cost" },
    { label: "Low Stock SKUs", icon: "alert", tint: lowCount > 0 ? "#f59e0b" : "#10b981", value: lowCount, format: (n) => String(n), color: lowCount > 0 ? "var(--color-warning)" : "var(--color-success)", hint: lowCount > 0 ? "Action required: reorder materials" : "All SKUs above reorder levels" },
    { label: "Manufacturing Output", icon: "factory", tint: "#0ea5e9", value: summary?.productionOutputQty ?? 0, format: (n) => formatQuantity(n), hint: "Completed batch yield units" },
    { label: "Receivables Due", icon: "invoice", tint: receivables > 0 ? "#ef4444" : "#10b981", value: receivables, format: (n) => formatPaiseToInr(n), color: receivables > 0 ? "var(--color-danger)" : "var(--color-success)", hint: `Overdue invoices: ${summary?.overdueInvoicesCount ?? 0}` }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Hero banner */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          padding: "34px 36px",
          background: "linear-gradient(120deg, #082f49 0%, #0c4a6e 45%, #0f766e 120%)",
          backgroundSize: "200% 200%",
          animation: "gradientShift 14s ease infinite",
          color: "#fff",
          boxShadow: "var(--shadow-lg)"
        }}
      >
        <div aria-hidden style={{ position: "absolute", right: -60, top: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.22), transparent 65%)", animation: "floatY 7s ease-in-out infinite" }} />
        <div aria-hidden style={{ position: "absolute", right: 140, bottom: -90, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,.35), transparent 65%)", animation: "floatY 9s ease-in-out infinite reverse" }} />
        <svg aria-hidden viewBox="0 0 400 80" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 70, opacity: 0.35 }}>
          <path className="hero-line" d="M0 50 L60 50 L80 20 L105 70 L130 35 L150 50 L260 50 L282 12 L308 66 L330 38 L350 50 L400 50" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="900" style={{ ["--len" as any]: 900, animation: "drawLine 3s var(--ease-out) .3s both" }} />
        </svg>

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div style={{ maxWidth: 620 }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: "var(--radius-full)",
                background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", fontSize: 12, fontWeight: 600, letterSpacing: ".04em"
              }}
            >
              <span className="live-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }} />
              LIVE OPERATIONS
            </span>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginTop: 14, lineHeight: 1.15, color: "#fff" }}>
              {greeting}, {firstName}.
            </h1>
            <p style={{ color: "rgba(255,255,255,.78)", fontSize: 14.5, marginTop: 8 }}>
              Inventory, production throughput, order pipeline and cash flow in Indian Rupees, updating in real time.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {hasPermission("orders:write") && (
              <Link
                href="/orders"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--radius-md)",
                  backgroundColor: "#ffffff", color: "#0c4a6e", textDecoration: "none", fontSize: 13.5, fontWeight: 700,
                  boxShadow: "0 8px 20px -8px rgba(0,0,0,.45)"
                }}
              >
                <Icon name="plus" size={17} strokeWidth={2.4} /> New Order
              </Link>
            )}
            {hasPermission("inventory:write") && (
              <Link
                href="/inventory"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)", color: "#fff",
                  textDecoration: "none", fontSize: 13.5, fontWeight: 600, backdropFilter: "blur(6px)"
                }}
              >
                <Icon name="download" size={17} /> Receive Stock
              </Link>
            )}
            {hasPermission("production:write") && (
              <Link
                href="/production"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)", color: "#fff",
                  textDecoration: "none", fontSize: 13.5, fontWeight: 600, backdropFilter: "blur(6px)"
                }}
              >
                <Icon name="production" size={17} /> Start Batch
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger-border)",
            color: "var(--color-danger-text)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{error}</span>
          <button
            onClick={fetchSummary}
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-danger)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Getting started checklist (only until the basics exist) */}
      {setup && (setup.warehouses === 0 || setup.products === 0 || setup.stock === 0 || setup.customers === 0) && (
        <section style={{ padding: 24, borderRadius: "var(--radius-lg)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Get started with your real data</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, margin: "4px 0 18px" }}>Complete these steps and your dashboard fills up automatically.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
            {[
              { done: setup.warehouses > 0, t: "Add a warehouse", d: "Where your stock is kept", href: "/setup" },
              { done: setup.products > 0, t: "Add products", d: "Raw materials and finished goods", href: "/products" },
              { done: setup.stock > 0, t: "Receive opening stock", d: "Record what you have today", href: "/inventory" },
              { done: setup.customers > 0, t: "Add a customer", d: "So you can create sales orders", href: "/setup" }
            ].map((st, i) => (
              <Link key={st.t} href={st.href} className="kpi" style={{ display: "flex", gap: 12, alignItems: "center", padding: 16, borderRadius: 14, border: "1px solid var(--border-subtle)", background: st.done ? "var(--color-success-bg)" : "var(--bg-subtle)", textDecoration: "none", color: "var(--text-primary)" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: st.done ? "var(--color-success)" : "var(--bg-hover)", color: st.done ? "#fff" : "var(--text-secondary)", fontWeight: 700, fontSize: 13 }}>
                  {st.done ? <Icon name="check" size={17} strokeWidth={2.6} /> : i + 1}
                </span>
                <span><span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{st.t}</span><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{st.d}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Primary KPI Metric Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className="kpi reveal"
            style={{
              ["--i" as any]: i,
              position: "relative",
              overflow: "hidden",
              padding: 22,
              borderRadius: "var(--radius-lg)",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <div aria-hidden style={{ position: "absolute", right: -30, top: -30, width: 110, height: 110, borderRadius: "50%", background: k.tint, opacity: 0.14 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".01em" }}>{k.label}</span>
              <span style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: k.tint, color: "#fff", boxShadow: `0 8px 16px -6px ${k.tint}` }}>
                <Icon name={k.icon} size={19} />
              </span>
            </div>
            <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 600, color: k.color ?? "var(--text-primary)", minHeight: 36 }}>
              {isLoading ? <div className="skeleton" style={{ height: 30, width: 140 }} /> : <CountUp value={k.value} format={k.format} />}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Analytics charts */}
      {(stockBars.length > 0 || salesSplit.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
          {stockBars.length > 0 && (
            <div className="reveal" style={{ ["--i" as any]: 5, padding: 24, borderRadius: "var(--radius-lg)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Stock value by product</h2>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20 }}>Top items by weighted-average valuation</p>
              <BarList items={stockBars} format={(n) => formatPaiseToInr(n, { showPaisa: false })} />
            </div>
          )}
          {salesSplit.length > 0 && (
            <div className="reveal" style={{ ["--i" as any]: 6, padding: 24, borderRadius: "var(--radius-lg)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Sales by customer</h2>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20 }}>Share of confirmed sales value</p>
              <Donut items={salesSplit} format={(n) => formatPaiseToInr(n, { showPaisa: false })} centerLabel="Customers" />
            </div>
          )}
        </div>
      )}

      {/* Grid: Low Stock Alert Warnings & Recent Tenant Activity Feed */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        {/* Low Stock Alerts Card */}
        <div
          style={{
            padding: 24,
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Low Stock Watchlist</h2>
            <Link href="/inventory" style={{ fontSize: 13, color: "var(--color-brand)", textDecoration: "none", fontWeight: 600 }}>
              View Ledger →
            </Link>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="skeleton" style={{ height: 40, width: "100%" }} />
              <div className="skeleton" style={{ height: 40, width: "100%" }} />
            </div>
          ) : !summary?.lowStockProducts || summary.lowStockProducts.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: "50%", background: "var(--color-success-bg)", color: "var(--color-success)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={26} strokeWidth={2.4} /></div>
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>All stock levels healthy</div>
              <div style={{ fontSize: 12 }}>No items currently under minimum reorder thresholds.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {summary.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-warning-bg)",
                    border: "1px solid var(--color-warning-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-warning-text)" }}>
                      {p.sku} — {p.productName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Warehouse: {p.warehouseCode} ({p.warehouseName})
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tabular-nums" style={{ fontWeight: 800, fontSize: 15, color: "var(--color-danger)" }}>
                      {formatQuantity(p.availableQty, p.uom)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      On Hand: {p.onHandQty}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Audit Activity Stream */}
        <div
          style={{
            padding: 24,
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Recent Tenant Activity</h2>
            <Link href="/audit" style={{ fontSize: 13, color: "var(--color-brand)", textDecoration: "none", fontWeight: 600 }}>
              Full Audit →
            </Link>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="skeleton" style={{ height: 36, width: "100%" }} />
              <div className="skeleton" style={{ height: 36, width: "100%" }} />
              <div className="skeleton" style={{ height: 36, width: "100%" }} />
            </div>
          ) : !summary?.recentActivity || summary.recentActivity.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: "50%", background: "var(--color-brand-subtle)", color: "var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="shield" size={24} /></div>
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>No recent audit activity</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {summary.recentActivity.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 10,
                        fontWeight: 700,
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-default)"
                      }}
                    >
                      {item.action}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {item.entityType} ({item.actorRole})
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {formatDateIndian(item.createdAt, { includeTime: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
