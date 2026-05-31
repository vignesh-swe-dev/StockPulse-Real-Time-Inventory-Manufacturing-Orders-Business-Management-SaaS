"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { useRealtimeSocket } from "../../hooks/useRealtimeSocket";
import { apiClient } from "../../lib/api";
import { PurchaseOrder, Supplier, Warehouse, Product } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, formatDateIndian, parseInrToPaise } from "../../lib/currency";

export default function PurchasesPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"orders" | "suppliers">("orders");
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [grnModalPo, setGrnModalPo] = useState<PurchaseOrder | null>(null);

  // PO Form
  const [fSupplierId, setFSupplierId] = useState("");
  const [fWarehouseId, setFWarehouseId] = useState("");
  const [fProductId, setFProductId] = useState("");
  const [fQuantity, setFQuantity] = useState("100");
  const [fUnitCost, setFUnitCost] = useState("");

  // Supplier Form
  const [fSupCode, setFSupCode] = useState("");
  const [fSupName, setFSupName] = useState("");
  const [fSupContact, setFSupContact] = useState("");
  const [fSupPhone, setFSupPhone] = useState("");
  const [fSupEmail, setFSupEmail] = useState("");
  const [fSupTaxId, setFSupTaxId] = useState("");

  // GRN Form
  const [fRecvQty, setFRecvQty] = useState("");
  const [fRejQty, setFRejQty] = useState("0");
  const [fGrnNotes, setFGrnNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [poList, supList, whList, prodList] = await Promise.all([
        apiClient<PurchaseOrder[]>("/purchases/orders"),
        apiClient<Supplier[]>("/suppliers"),
        apiClient<Warehouse[]>("/warehouses"),
        apiClient<Product[]>("/products")
      ]);
      setPurchaseOrders(poList);
      setSuppliers(supList);
      setWarehouses(whList);
      setProducts(prodList);

      if (supList.length > 0 && !fSupplierId) setFSupplierId(supList[0].id);
      if (whList.length > 0 && !fWarehouseId) setFWarehouseId(whList[0].id);
      if (prodList.length > 0 && !fProductId) {
        setFProductId(prodList[0].id);
        setFUnitCost((prodList[0].purchasePriceMinor / 100).toFixed(2));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load purchases.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeSocket((event) => {
    if (["inventory.updated"].includes(event.eventType)) {
      fetchData();
    }
  });

  const handleProductSelect = (id: string) => {
    setFProductId(id);
    const p = products.find((prod) => prod.id === id);
    if (p) setFUnitCost((p.purchasePriceMinor / 100).toFixed(2));
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setIsSubmitting(true);
      const unitCostMinor = parseInrToPaise(fUnitCost);
      await apiClient<PurchaseOrder>("/purchases/orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: fSupplierId,
          warehouseId: fWarehouseId,
          items: [{ productId: fProductId, orderedQty: Number(fQuantity), unitCostMinor }]
        })
      });
      setIsPoModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create PO.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setIsSubmitting(true);
      await apiClient<Supplier>("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          code: fSupCode.trim().toUpperCase(),
          name: fSupName.trim(),
          contactPerson: fSupContact.trim(),
          phone: fSupPhone.trim(),
          email: fSupEmail.trim(),
          taxId: fSupTaxId.trim()
        })
      });
      setIsSupplierModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to add supplier.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnModalPo) return;
    setFormError(null);
    try {
      setIsSubmitting(true);
      const firstItem = grnModalPo.items[0];
      await apiClient("/purchases/goods-receipts", {
        method: "POST",
        idempotencyKey: `grn_${grnModalPo.id}_${Date.now()}`,
        body: JSON.stringify({
          purchaseOrderId: grnModalPo.id,
          items: [
            {
              productId: firstItem.productId,
              receivedQty: Number(fRecvQty),
              rejectedQty: Number(fRejQty) || 0
            }
          ],
          notes: fGrnNotes.trim()
        })
      });
      setGrnModalPo(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to record GRN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const poColumns: Column<PurchaseOrder>[] = [
    {
      key: "poNumber",
      header: "PO #",
      render: (p) => <span style={{ fontWeight: 700 }}>{p.poNumber}</span>
    },
    {
      key: "createdAt",
      header: "Date",
      render: (p) => formatDateIndian(p.createdAt)
    },
    {
      key: "supplierName",
      header: "Supplier",
      render: (p) => <span style={{ fontWeight: 600 }}>{p.supplierName}</span>
    },
    {
      key: "warehouseCode",
      header: "Destination",
      render: (p) => <span>{p.warehouseCode}</span>
    },
    {
      key: "status",
      header: "Status",
      render: (p) => {
        let bg = "var(--bg-subtle)";
        let color = "var(--text-secondary)";
        if (p.status === "RECEIVED") {
          bg = "var(--color-success-bg)";
          color = "var(--color-success-text)";
        } else if (p.status === "PARTIALLY_RECEIVED") {
          bg = "var(--color-warning-bg)";
          color = "var(--color-warning-text)";
        }
        return (
          <span style={{ padding: "2px 8px", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 700, backgroundColor: bg, color }}>
            {p.status.replace("_", " ")}
          </span>
        );
      }
    },
    {
      key: "totalMinor",
      header: "Total Cost",
      isNumeric: true,
      render: (p) => formatPaiseToInr(p.totalMinor)
    },
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (p) => {
        if (!hasPermission("purchases:write") || p.status === "RECEIVED") return null;
        return (
          <button
            onClick={() => {
              setGrnModalPo(p);
              const remaining = p.items[0]?.orderedQty - (p.items[0]?.receivedQty || 0);
              setFRecvQty(String(remaining > 0 ? remaining : 0));
              setFRejQty("0");
              setFGrnNotes(`Physical receipt against ${p.poNumber}`);
            }}
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-brand)",
              color: "#fff",
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Receive Goods (GRN)
          </button>
        );
      }
    }
  ];

  const supplierColumns: Column<Supplier>[] = [
    {
      key: "code",
      header: "Code",
      render: (s) => <span style={{ fontWeight: 700 }}>{s.code}</span>
    },
    {
      key: "name",
      header: "Company Name",
      render: (s) => <span style={{ fontWeight: 600 }}>{s.name}</span>
    },
    {
      key: "contactPerson",
      header: "Contact Person",
      render: (s) => <span>{s.contactPerson || "—"}</span>
    },
    {
      key: "phone",
      header: "Phone",
      render: (s) => <span>{s.phone || "—"}</span>
    },
    {
      key: "taxId",
      header: "GSTIN / Tax ID",
      render: (s) => <code style={{ fontSize: 12 }}>{s.taxId || "—"}</code>
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner */}
      <div className="page-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Procurement & Suppliers Hub</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Supplier master, Purchase Orders (PO), and Goods Receipt Notes (GRN) with idempotency control.
          </p>
        </div>

        {hasPermission("purchases:write") && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIsSupplierModalOpen(true)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              + Add Supplier
            </button>
            <button
              onClick={() => setIsPoModalOpen(true)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-brand)",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)"
              }}
            >
              + Issue Purchase Order
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger-border)" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab("orders")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: activeTab === "orders" ? "var(--color-brand)" : "var(--bg-subtle)",
            color: activeTab === "orders" ? "#ffffff" : "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          Purchase Orders ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: activeTab === "suppliers" ? "var(--color-brand)" : "var(--bg-subtle)",
            color: activeTab === "suppliers" ? "#ffffff" : "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* Main Table View */}
      {activeTab === "orders" ? (
        <DataTable
          columns={poColumns}
          data={purchaseOrders}
          keyField="id"
          searchPlaceholder="Search purchase orders..."
          exportFilename="stockpulse_purchase_orders.csv"
          isLoading={isLoading}
          emptyTitle="No purchase orders"
          emptyDescription="Issue purchase orders to suppliers for raw material replenishment."
        />
      ) : (
        <DataTable
          columns={supplierColumns}
          data={suppliers}
          keyField="id"
          searchPlaceholder="Search suppliers by name, code, GSTIN..."
          exportFilename="stockpulse_suppliers.csv"
          isLoading={isLoading}
          emptyTitle="No suppliers added"
          emptyDescription="Add vendors and raw material quarry suppliers."
        />
      )}

      {/* Receive Goods GRN Modal */}
      {grnModalPo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
          onClick={() => setGrnModalPo(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              backgroundColor: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Record Goods Receipt (GRN)</h3>
              <button onClick={() => setGrnModalPo(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 12, backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
              <div>PO Number: <strong>{grnModalPo.poNumber}</strong></div>
              <div>Supplier: <strong>{grnModalPo.supplierName}</strong></div>
            </div>

            <form onSubmit={handleReceiveGoods} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Received Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={fRecvQty}
                    onChange={(e) => setFRecvQty(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Rejected Quantity
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={fRejQty}
                    onChange={(e) => setFRejQty(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Inspection Notes
                </label>
                <input
                  type="text"
                  value={fGrnNotes}
                  onChange={(e) => setFGrnNotes(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setGrnModalPo(null)}
                  style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", backgroundColor: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-brand)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Receiving..." : "Confirm & Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New PO Modal */}
      {isPoModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
          onClick={() => setIsPoModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              backgroundColor: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Issue Purchase Order</h3>
              <button onClick={() => setIsPoModalOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePo} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Supplier *
                </label>
                <select
                  value={fSupplierId}
                  onChange={(e) => setFSupplierId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Destination Warehouse *
                </label>
                <select
                  value={fWarehouseId}
                  onChange={(e) => setFWarehouseId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Item *
                </label>
                <select
                  value={fProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Ordered Qty *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={fQuantity}
                    onChange={(e) => setFQuantity(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Agreed Unit Cost (₹) *
                  </label>
                  <input
                    type="text"
                    required
                    value={fUnitCost}
                    onChange={(e) => setFUnitCost(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", backgroundColor: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-brand)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Issuing..." : "Issue Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {isSupplierModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
          onClick={() => setIsSupplierModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              backgroundColor: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Add Vendor Supplier</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SUP-ABC"
                    value={fSupCode}
                    onChange={(e) => setFSupCode(e.target.value.toUpperCase())}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fSupName}
                    onChange={(e) => setFSupName(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={fSupContact}
                    onChange={(e) => setFSupContact(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    GSTIN Tax ID
                  </label>
                  <input
                    type="text"
                    placeholder="27AAACU1234F1Z8"
                    value={fSupTaxId}
                    onChange={(e) => setFSupTaxId(e.target.value.toUpperCase())}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", backgroundColor: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-brand)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Saving..." : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
