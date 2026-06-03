"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { useRealtimeSocket } from "../../hooks/useRealtimeSocket";
import { apiClient } from "../../lib/api";
import { Dispatch, Order } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatDateIndian } from "../../lib/currency";

export default function DispatchPage() {
  const { hasPermission } = useAuth();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);
  const [fVehicle, setFVehicle] = useState("MH-12-PQ-9988");
  const [fDriver, setFDriver] = useState("Ramesh K");
  const [fPhone, setFPhone] = useState("+91 98220 11223");

  const [deliveringDispatch, setDeliveringDispatch] = useState<Dispatch | null>(null);
  const [fPodRef, setFPodRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [dspList, ordList] = await Promise.all([
        apiClient<Dispatch[]>("/dispatches"),
        apiClient<Order[]>("/orders")
      ]);
      setDispatches(dspList);
      setConfirmedOrders(
        ordList.filter((o) => ["CONFIRMED", "READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED"].includes(o.status))
      );
    } catch (err: any) {
      setError(err.message || "Failed to load dispatches.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeSocket((event) => {
    if (["dispatch.updated", "order.updated"].includes(event.eventType)) {
      fetchData();
    }
  });

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForDispatch) return;
    setFormError(null);

    try {
      setIsSubmitting(true);
      const items = selectedOrderForDispatch.items.map((i) => ({
        productId: i.productId,
        quantity: i.orderedQty - i.dispatchedQty
      }));

      await apiClient<Dispatch>("/dispatches", {
        method: "POST",
        body: JSON.stringify({
          orderId: selectedOrderForDispatch.id,
          vehicleNumber: fVehicle.trim(),
          driverName: fDriver.trim(),
          driverPhone: fPhone.trim(),
          items
        })
      });

      setIsDispatchModalOpen(false);
      setSelectedOrderForDispatch(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to execute dispatch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringDispatch) return;
    try {
      setIsSubmitting(true);
      await apiClient(`/dispatches/${deliveringDispatch.id}/deliver`, {
        method: "POST",
        body: JSON.stringify({ podReference: fPodRef.trim() || "POD-SIGNED-CLIENT" })
      });
      setDeliveringDispatch(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to record delivery.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Dispatch>[] = [
    {
      key: "dispatchNumber",
      header: "Dispatch #",
      render: (d) => <span style={{ fontWeight: 700 }}>{d.dispatchNumber}</span>
    },
    {
      key: "dispatchedAt",
      header: "Date",
      render: (d) => formatDateIndian(d.dispatchedAt, { includeTime: true })
    },
    {
      key: "orderNumber",
      header: "Order / Customer",
      render: (d) => (
        <div>
          <div style={{ fontWeight: 600 }}>{d.orderNumber}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.customerName}</div>
        </div>
      )
    },
    {
      key: "vehicleNumber",
      header: "Vehicle & Driver",
      render: (d) => (
        <div>
          <div style={{ fontWeight: 600 }}>{d.vehicleNumber}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.driverName} ({d.driverPhone})</div>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (d) => {
        const isDelivered = d.status === "DELIVERED";
        return (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: isDelivered ? "var(--color-success-bg)" : "var(--color-info-bg)",
              color: isDelivered ? "var(--color-success-text)" : "var(--color-info-text)"
            }}
          >
            {d.status}
          </span>
        );
      }
    },
    {
      key: "podReference",
      header: "Proof of Delivery",
      render: (d) => d.podReference ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-success-text)" }}>
          {d.podReference}
        </span>
      ) : (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pending</span>
      )
    },
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (d) => {
        if (!hasPermission("dispatch:write") || d.status === "DELIVERED") return null;
        return (
          <button
            onClick={() => {
              setDeliveringDispatch(d);
              setFPodRef(`POD-${d.dispatchNumber}-ACK`);
            }}
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-success)",
              color: "#fff",
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Mark Delivered (POD)
          </button>
        );
      }
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner */}
      <div className="page-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Dispatches & Logistics Hub</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Order fulfillment, vehicle assignment, stock deduction, and Proof of Delivery (POD) tracking.
          </p>
        </div>

        {hasPermission("dispatch:write") && confirmedOrders.length > 0 && (
          <button
            onClick={() => {
              setSelectedOrderForDispatch(confirmedOrders[0]);
              setIsDispatchModalOpen(true);
            }}
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
            + Execute Dispatch ({confirmedOrders.length} Ready)
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger-border)" }}>
          {error}
        </div>
      )}

      {/* Dispatches Table */}
      <DataTable
        columns={columns}
        data={dispatches}
        keyField="id"
        searchPlaceholder="Search dispatches by vehicle, driver, order #..."
        exportFilename="stockpulse_dispatches.csv"
        isLoading={isLoading}
        emptyTitle="No dispatches recorded"
        emptyDescription="Confirmed sales orders will appear here ready for fleet loading and dispatch."
      />

      {/* Execute Dispatch Modal */}
      {isDispatchModalOpen && selectedOrderForDispatch && (
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
          onClick={() => setIsDispatchModalOpen(false)}
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Execute Order Dispatch</h3>
              <button onClick={() => setIsDispatchModalOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: "8px 12px", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateDispatch} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Select Confirmed Order *
                </label>
                <select
                  value={selectedOrderForDispatch.id}
                  onChange={(e) => {
                    const ord = confirmedOrders.find((o) => o.id === e.target.value);
                    if (ord) setSelectedOrderForDispatch(ord);
                  }}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {confirmedOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {o.customerName} ({o.items?.length || 0} items)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Vehicle Registration Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TN-30-AQ-8899"
                  value={fVehicle}
                  onChange={(e) => setFVehicle(e.target.value.toUpperCase())}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Driver Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fDriver}
                    onChange={(e) => setFDriver(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Driver Contact
                  </label>
                  <input
                    type="text"
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
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
                  {isSubmitting ? "Dispatching..." : "Dispatch Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deliver POD Modal */}
      {deliveringDispatch && (
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
          onClick={() => setDeliveringDispatch(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Record Proof of Delivery</h3>
              <button onClick={() => setDeliveringDispatch(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleDeliverSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  POD Reference / Gate Receipt Number *
                </label>
                <input
                  type="text"
                  required
                  value={fPodRef}
                  onChange={(e) => setFPodRef(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setDeliveringDispatch(null)}
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
                    backgroundColor: "var(--color-success)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Confirming..." : "Confirm Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
