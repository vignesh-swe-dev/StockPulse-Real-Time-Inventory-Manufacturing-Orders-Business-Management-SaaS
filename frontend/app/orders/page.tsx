"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { useRealtimeSocket } from "../../hooks/useRealtimeSocket";
import { apiClient } from "../../lib/api";
import { Order, Quotation, Customer, Warehouse, Product } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, formatDateIndian, parseInrToPaise } from "../../lib/currency";

export default function OrdersPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"orders" | "quotes">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Order for Detail Drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [fCustomerId, setFCustomerId] = useState("");
  const [fWarehouseId, setFWarehouseId] = useState("");
  const [fProductId, setFProductId] = useState("");
  const [fQuantity, setFQuantity] = useState("10");
  const [fUnitPrice, setFUnitPrice] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const [ordList, quoteList, custList, whList, prodList] = await Promise.all([
        apiClient<Order[]>("/orders"),
        apiClient<Quotation[]>("/quotations"),
        apiClient<Customer[]>("/customers"),
        apiClient<Warehouse[]>("/warehouses"),
        apiClient<Product[]>("/products")
      ]);

      setOrders(ordList);
      setQuotations(quoteList);
      setCustomers(custList);
      setWarehouses(whList);
      setProducts(prodList);

      if (custList.length > 0 && !fCustomerId) setFCustomerId(custList[0].id);
      if (whList.length > 0 && !fWarehouseId) setFWarehouseId(whList[0].id);
      if (prodList.length > 0 && !fProductId) {
        setFProductId(prodList[0].id);
        setFUnitPrice((prodList[0].sellingPriceMinor / 100).toFixed(2));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load orders.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeSocket((event) => {
    if (["order.created", "order.updated", "dispatch.updated"].includes(event.eventType)) {
      fetchData();
    }
  });

  const handleProductSelect = (prodId: string) => {
    setFProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setFUnitPrice((prod.sellingPriceMinor / 100).toFixed(2));
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      setIsSubmitting(true);
      const prod = products.find((p) => p.id === fProductId);
      const unitPriceMinor = parseInrToPaise(fUnitPrice);

      await apiClient<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: fCustomerId,
          warehouseId: fWarehouseId,
          items: [
            {
              productId: fProductId,
              orderedQty: Number(fQuantity),
              unitPriceMinor,
              taxRateBps: prod?.taxRateBps || 1800
            }
          ],
          notes: fNotes.trim()
        })
      });

      setIsOrderModalOpen(false);
      setFNotes("");
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create sales order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      setError(null);
      await apiClient(`/orders/${orderId}/confirm`, {
        method: "POST",
        idempotencyKey: `confirm_${orderId}_${Date.now()}`
      });
      fetchData();
      if (selectedOrder?.id === orderId) {
        const updated = await apiClient<Order>(`/orders/${orderId}`);
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      setError(err.message || "Failed to confirm order.");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      setError(null);
      await apiClient(`/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Order cancelled by staff" })
      });
      fetchData();
      if (selectedOrder?.id === orderId) {
        const updated = await apiClient<Order>(`/orders/${orderId}`);
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      setError(err.message || "Failed to cancel order.");
    }
  };

  const getStatusBadge = (status: string) => {
    let bg = "var(--bg-subtle)";
    let color = "var(--text-secondary)";

    switch (status) {
      case "CONFIRMED":
      case "ACCEPTED":
        bg = "var(--color-info-bg)";
        color = "var(--color-info-text)";
        break;
      case "READY_FOR_DISPATCH":
      case "DISPATCHED":
      case "DELIVERED":
        bg = "var(--color-success-bg)";
        color = "var(--color-success-text)";
        break;
      case "AWAITING_STOCK":
      case "IN_PRODUCTION":
        bg = "var(--color-warning-bg)";
        color = "var(--color-warning-text)";
        break;
      case "CANCELLED":
        bg = "var(--color-danger-bg)";
        color = "var(--color-danger-text)";
        break;
    }

    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "var(--radius-full)",
          fontSize: 11,
          fontWeight: 700,
          backgroundColor: bg,
          color
        }}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const orderColumns: Column<Order>[] = [
    {
      key: "orderNumber",
      header: "Order #",
      render: (o) => (
        <span
          onClick={() => setSelectedOrder(o)}
          style={{ fontWeight: 700, color: "var(--color-brand)", cursor: "pointer" }}
        >
          {o.orderNumber}
        </span>
      )
    },
    {
      key: "createdAt",
      header: "Date",
      render: (o) => formatDateIndian(o.createdAt)
    },
    {
      key: "customerName",
      header: "Customer",
      render: (o) => (
        <div>
          <div style={{ fontWeight: 600 }}>{o.customerName || "Customer"}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.customerCode}</div>
        </div>
      )
    },
    {
      key: "warehouseCode",
      header: "Fulfillment Hub",
      render: (o) => <span style={{ fontWeight: 500 }}>{o.warehouseCode}</span>
    },
    {
      key: "status",
      header: "Workflow Status",
      render: (o) => getStatusBadge(o.status)
    },
    {
      key: "totalMinor",
      header: "Total (GST Incl)",
      isNumeric: true,
      render: (o) => (
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatPaiseToInr(o.totalMinor)}</span>
      )
    },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      render: (o) => {
        if (!hasPermission("orders:write")) return null;
        return (
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {["DRAFT", "QUOTED"].includes(o.status) && (
              <button
                onClick={() => handleConfirmOrder(o.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-brand)",
                  color: "#fff",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Confirm & Reserve
              </button>
            )}
            {!["DELIVERED", "CANCELLED"].includes(o.status) && (
              <button
                onClick={() => handleCancelOrder(o.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-default)",
                  color: "var(--color-danger)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner */}
      <div className="page-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Sales Orders & Quotations</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            End-to-end sales pipeline: quotation → order confirmation → atomic stock reservation → dispatch.
          </p>
        </div>

        {hasPermission("orders:write") && (
          <button
            onClick={() => setIsOrderModalOpen(true)}
            style={{
              padding: "9px 18px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-brand)",
              color: "#ffffff",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            + Create Sales Order
          </button>
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
          Sales Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab("quotes")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: activeTab === "quotes" ? "var(--color-brand)" : "var(--bg-subtle)",
            color: activeTab === "quotes" ? "#ffffff" : "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          Quotations ({quotations.length})
        </button>
      </div>

      {/* Orders Table */}
      {activeTab === "orders" ? (
        <DataTable
          columns={orderColumns}
          data={orders}
          keyField="id"
          searchPlaceholder="Search orders by customer or order #..."
          exportFilename="stockpulse_sales_orders.csv"
          isLoading={isLoading}
          emptyTitle="No sales orders yet"
          emptyDescription="Create your first sales order to reserve inventory and initiate dispatch."
          emptyAction={
            hasPermission("orders:write") ? (
              <button
                onClick={() => setIsOrderModalOpen(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-brand)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                + Create Order
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={[
            { key: "quoteNumber", header: "Quote #", render: (q) => <span style={{ fontWeight: 700 }}>{q.quoteNumber}</span> },
            { key: "createdAt", header: "Date", render: (q) => formatDateIndian(q.createdAt) },
            { key: "customerName", header: "Customer" },
            { key: "status", header: "Status", render: (q) => getStatusBadge(q.status) },
            { key: "totalMinor", header: "Total (₹)", isNumeric: true, render: (q) => formatPaiseToInr(q.totalMinor) }
          ]}
          data={quotations}
          keyField="id"
          searchPlaceholder="Search quotations..."
          exportFilename="stockpulse_quotations.csv"
          isLoading={isLoading}
          emptyTitle="No quotations"
          emptyDescription="Issue quotations to send GST-compliant cost estimates to customers."
        />
      )}

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "flex-end"
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: "var(--bg-surface)",
              height: "100%",
              padding: 24,
              overflowY: "auto",
              boxShadow: "var(--shadow-xl)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              animation: "slideInRight 0.25s ease-out"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>{selectedOrder.orderNumber}</h3>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  Customer: {selectedOrder.customerName}
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>STATUS</div>
              <div>{getStatusBadge(selectedOrder.status)}</div>
            </div>

            {/* Line Items */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Order Items</div>
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.productName || item.sku}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Qty: {item.orderedQty} | Dispatched: {item.dispatchedQty}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="tabular-nums" style={{ fontWeight: 700, fontSize: 13 }}>{formatPaiseToInr(item.lineTotalMinor)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{formatPaiseToInr(item.unitPriceMinor)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ padding: 14, backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal:</span>
                <span className="tabular-nums">{formatPaiseToInr(selectedOrder.subtotalMinor)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>GST Tax (18%):</span>
                <span className="tabular-nums">{formatPaiseToInr(selectedOrder.taxMinor)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15, borderTop: "1px solid var(--border-subtle)", paddingTop: 6 }}>
                <span>Total Amount:</span>
                <span className="tabular-nums" style={{ color: "var(--color-brand)" }}>{formatPaiseToInr(selectedOrder.totalMinor)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
              {["DRAFT", "QUOTED"].includes(selectedOrder.status) && hasPermission("orders:write") && (
                <button
                  onClick={() => handleConfirmOrder(selectedOrder.id)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-brand)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Confirm & Reserve Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {isOrderModalOpen && (
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
          onClick={() => setIsOrderModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Create New Sales Order</h3>
              <button onClick={() => setIsOrderModalOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: "8px 12px", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Customer *
                </label>
                <select
                  value={fCustomerId}
                  onChange={(e) => setFCustomerId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Fulfillment Warehouse *
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
                  Product *
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
                    Ordered Quantity *
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
                    Unit Price (₹) *
                  </label>
                  <input
                    type="text"
                    required
                    value={fUnitPrice}
                    onChange={(e) => setFUnitPrice(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="e.g. Urgent dispatch via 10-wheeler"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
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
                  {isSubmitting ? "Creating..." : "Save Draft Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
