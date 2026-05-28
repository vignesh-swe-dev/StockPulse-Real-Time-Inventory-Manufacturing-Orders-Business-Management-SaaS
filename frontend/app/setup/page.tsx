"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { apiClient } from "../../lib/api";
import { Customer, Warehouse, Tenant } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, parseInrToPaise } from "../../lib/currency";

type Tab = "warehouses" | "customers" | "company";

const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14 };
const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12.5, fontWeight: 600 };
const card: React.CSSProperties = { padding: 24, borderRadius: "var(--radius-lg)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" };
const primaryBtn: React.CSSProperties = { padding: "11px 18px", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-brand)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13.5 };

export default function SetupPage() {
  const { hasPermission, session } = useAuth();
  const [tab, setTab] = useState<Tab>("warehouses");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [wh, setWh] = useState({ code: "", name: "", location: "" });
  const [cu, setCu] = useState({ code: "", name: "", phone: "", email: "", taxId: "", creditLimit: "", paymentTermsDays: "30" });
  const [co, setCo] = useState({ name: "", taxRegistrationNo: "", allowNegativeStock: false });

  const load = useCallback(async () => {
    try {
      const [w, c, t] = await Promise.all([
        hasPermission("warehouses:read") ? apiClient<Warehouse[]>("/warehouses") : Promise.resolve([]),
        hasPermission("customers:read") ? apiClient<Customer[]>("/customers") : Promise.resolve([]),
        apiClient<Tenant>("/tenants/current")
      ]);
      setWarehouses(w);
      setCustomers(c);
      setTenant(t);
      setCo({ name: t.name, taxRegistrationNo: t.taxRegistrationNo || "", allowNegativeStock: t.allowNegativeStock });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Failed to load setup data." });
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    if (session?.accessToken) load();
  }, [session?.accessToken, load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ type: "ok", text: ok });
      await load();
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };

  const addWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await apiClient("/warehouses", { method: "POST", body: JSON.stringify(wh) });
      setWh({ code: "", name: "", location: "" });
    }, "Warehouse added.");
  };

  const addCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await apiClient("/customers", {
        method: "POST",
        body: JSON.stringify({
          code: cu.code, name: cu.name, phone: cu.phone, email: cu.email, taxId: cu.taxId,
          creditLimitMinor: cu.creditLimit ? parseInrToPaise(cu.creditLimit) : 0,
          paymentTermsDays: Number(cu.paymentTermsDays) || 0
        })
      });
      setCu({ code: "", name: "", phone: "", email: "", taxId: "", creditLimit: "", paymentTermsDays: "30" });
    }, "Customer added.");
  };

  const saveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await apiClient("/tenants/current", { method: "PATCH", body: JSON.stringify(co) });
    }, "Company details saved.");
  };

  const whCols: Column<Warehouse>[] = [
    { key: "code", header: "Code", render: (w) => <strong>{w.code}</strong> },
    { key: "name", header: "Name" },
    { key: "location", header: "Location", render: (w) => w.location || "—" }
  ];
  const cuCols: Column<Customer>[] = [
    { key: "code", header: "Code", render: (c) => <strong>{c.code}</strong> },
    { key: "name", header: "Customer" },
    { key: "phone", header: "Phone", render: (c) => c.phone || "—" },
    { key: "taxId", header: "GSTIN", render: (c) => c.taxId || "—" },
    { key: "creditLimitMinor", header: "Credit limit", isNumeric: true, render: (c) => formatPaiseToInr(c.creditLimitMinor) },
    { key: "paymentTermsDays", header: "Terms", isNumeric: true, render: (c) => `${c.paymentTermsDays} days` }
  ];

  const tabBtn = (id: Tab, text: string) => (
    <button
      key={id}
      onClick={() => { setTab(id); setMsg(null); }}
      style={{ padding: "8px 16px", borderRadius: "var(--radius-full)", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", backgroundColor: tab === id ? "var(--color-brand)" : "var(--bg-subtle)", color: tab === id ? "#fff" : "var(--text-secondary)" }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="page-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Setup & Masters</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Your warehouses, customers and company details. Add these first so you can receive stock and take orders.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tabBtn("warehouses", `Warehouses (${warehouses.length})`)}
        {tabBtn("customers", `Customers (${customers.length})`)}
        {tabBtn("company", "Company")}
      </div>

      {msg && (
        <div role={msg.type === "err" ? "alert" : "status"} style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", fontSize: 13.5, backgroundColor: msg.type === "ok" ? "var(--color-success-bg)" : "var(--color-danger-bg)", border: `1px solid ${msg.type === "ok" ? "var(--color-success-border)" : "var(--color-danger-border)"}`, color: msg.type === "ok" ? "var(--color-success-text)" : "var(--color-danger-text)" }}>
          {msg.text}
        </div>
      )}

      {tab === "warehouses" && (
        <>
          {hasPermission("warehouses:write") && (
            <form onSubmit={addWarehouse} style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) auto", gap: 14, alignItems: "end" }}>
              <label style={label}>Code<input required style={input} value={wh.code} onChange={(e) => setWh({ ...wh, code: e.target.value })} placeholder="WH-MAIN" /></label>
              <label style={label}>Name<input required style={input} value={wh.name} onChange={(e) => setWh({ ...wh, name: e.target.value })} placeholder="Main Warehouse" /></label>
              <label style={label}>Location<input style={input} value={wh.location} onChange={(e) => setWh({ ...wh, location: e.target.value })} placeholder="City / address" /></label>
              <button type="submit" disabled={busy} style={primaryBtn}>Add warehouse</button>
            </form>
          )}
          <DataTable columns={whCols} data={warehouses} keyField="id" isLoading={loading} searchPlaceholder="Search warehouses…" searchFilter={(w, t) => (w.code + w.name + w.location).toLowerCase().includes(t.toLowerCase())} emptyTitle="No warehouses yet" emptyDescription="Add your first warehouse above. Stock is always held in a warehouse." />
        </>
      )}

      {tab === "customers" && (
        <>
          {hasPermission("customers:write") && (
            <form onSubmit={addCustomer} style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, alignItems: "end" }}>
              <label style={label}>Code<input required style={input} value={cu.code} onChange={(e) => setCu({ ...cu, code: e.target.value })} placeholder="CUST-001" /></label>
              <label style={label}>Customer name<input required style={input} value={cu.name} onChange={(e) => setCu({ ...cu, name: e.target.value })} /></label>
              <label style={label}>Phone<input style={input} value={cu.phone} onChange={(e) => setCu({ ...cu, phone: e.target.value })} /></label>
              <label style={label}>Email<input type="email" style={input} value={cu.email} onChange={(e) => setCu({ ...cu, email: e.target.value })} /></label>
              <label style={label}>GSTIN<input style={{ ...input, textTransform: "uppercase" }} maxLength={15} value={cu.taxId} onChange={(e) => setCu({ ...cu, taxId: e.target.value })} /></label>
              <label style={label}>Credit limit (₹)<input type="number" min="0" step="0.01" style={input} value={cu.creditLimit} onChange={(e) => setCu({ ...cu, creditLimit: e.target.value })} /></label>
              <label style={label}>Payment terms (days)<input type="number" min="0" style={input} value={cu.paymentTermsDays} onChange={(e) => setCu({ ...cu, paymentTermsDays: e.target.value })} /></label>
              <button type="submit" disabled={busy} style={primaryBtn}>Add customer</button>
            </form>
          )}
          <DataTable columns={cuCols} data={customers} keyField="id" isLoading={loading} searchPlaceholder="Search customers…" searchFilter={(c, t) => (c.code + c.name + c.phone + c.taxId).toLowerCase().includes(t.toLowerCase())} emptyTitle="No customers yet" emptyDescription="Add a customer above before creating a sales order." />
        </>
      )}

      {tab === "company" && (
        <form onSubmit={saveCompany} style={{ ...card, display: "grid", gap: 16, maxWidth: 620 }}>
          <label style={label}>Company name<input required style={input} value={co.name} disabled={!hasPermission("settings:write")} onChange={(e) => setCo({ ...co, name: e.target.value })} /></label>
          <label style={label}>GSTIN<input style={{ ...input, textTransform: "uppercase", fontFamily: "var(--font-mono)" }} maxLength={15} value={co.taxRegistrationNo} disabled={!hasPermission("settings:write")} onChange={(e) => setCo({ ...co, taxRegistrationNo: e.target.value })} /></label>
          <label style={{ display: "flex", gap: 10, fontSize: 13.5, alignItems: "center" }}>
            <input type="checkbox" checked={co.allowNegativeStock} disabled={!hasPermission("settings:write")} onChange={(e) => setCo({ ...co, allowNegativeStock: e.target.checked })} />
            Allow negative stock
          </label>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Currency: {tenant?.currencyCode || "INR"} · Costing: {tenant?.valuationMethod?.replace("_", " ").toLowerCase() || "weighted average"} · Plan: {tenant?.planTier || "-"}</div>
          {hasPermission("settings:write") ? <button type="submit" disabled={busy} style={{ ...primaryBtn, justifySelf: "start" }}>Save changes</button> : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Only an Owner or Administrator can change company details.</div>}
        </form>
      )}
    </div>
  );
}
