"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { useRealtimeSocket } from "../../hooks/useRealtimeSocket";
import { apiClient } from "../../lib/api";
import { Invoice, Payment, Order } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatPaiseToInr, formatDateIndian, parseInrToPaise } from "../../lib/currency";

export default function InvoicesPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"invoices" | "payments">("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedOrderIdForInvoice, setSelectedOrderIdForInvoice] = useState("");

  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [fAmount, setFAmount] = useState("");
  const [fMethod, setFMethod] = useState("NEFT");
  const [fReference, setFReference] = useState("");

  const [reversingPayment, setReversingPayment] = useState<Payment | null>(null);
  const [fReverseReason, setFReverseReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [invList, payList, ordList] = await Promise.all([
        apiClient<Invoice[]>("/invoices"),
        apiClient<Payment[]>("/payments"),
        apiClient<Order[]>("/orders")
      ]);
      setInvoices(invList);
      setPayments(payList);
      const eligibleOrders = ordList.filter(
        (o) => !["DRAFT", "CANCELLED"].includes(o.status) && !invList.some((i) => i.orderId === o.id)
      );
      setOrders(eligibleOrders);
      if (eligibleOrders.length > 0 && !selectedOrderIdForInvoice) {
        setSelectedOrderIdForInvoice(eligibleOrders[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load invoices.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeSocket((event) => {
    if (["invoice.overdue", "payment.received", "order.updated"].includes(event.eventType)) {
      fetchData();
    }
  });

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderIdForInvoice) return;
    setFormError(null);
    try {
      setIsSubmitting(true);
      await apiClient<Invoice>("/invoices", {
        method: "POST",
        body: JSON.stringify({ orderId: selectedOrderIdForInvoice })
      });
      setIsInvoiceModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    setFormError(null);
    try {
      setIsSubmitting(true);
      const amountMinor = parseInrToPaise(fAmount);
      await apiClient("/payments", {
        method: "POST",
        idempotencyKey: `pay_${paymentModalInvoice.id}_${Date.now()}`,
        body: JSON.stringify({
          invoiceId: paymentModalInvoice.id,
          amountMinor,
          method: fMethod,
          reference: fReference.trim() || `UTR-${Date.now()}`
        })
      });
      setPaymentModalInvoice(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Payment recording failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPayment) return;
    setFormError(null);
    try {
      setIsSubmitting(true);
      if (!fReverseReason || fReverseReason.trim().length < 5) {
        throw new Error("Audit reason must be at least 5 characters.");
      }
      await apiClient(`/payments/${reversingPayment.id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: fReverseReason.trim() })
      });
      setReversingPayment(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Payment reversal failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const invoiceColumns: Column<Invoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice #",
      render: (i) => <span style={{ fontWeight: 700 }}>{i.invoiceNumber}</span>
    },
    {
      key: "issuedAt",
      header: "Issued",
      render: (i) => formatDateIndian(i.issuedAt)
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (i) => (
        <span style={{ color: i.isOverdue ? "var(--color-danger)" : "inherit", fontWeight: i.isOverdue ? 700 : 500 }}>
          {formatDateIndian(i.dueDate)} {i.isOverdue && "(OVERDUE)"}
        </span>
      )
    },
    {
      key: "customerName",
      header: "Customer",
      render: (i) => <span>{i.customerName}</span>
    },
    {
      key: "status",
      header: "Status",
      render: (i) => {
        let bg = "var(--bg-subtle)";
        let color = "var(--text-secondary)";
        if (i.status === "PAID") {
          bg = "var(--color-success-bg)";
          color = "var(--color-success-text)";
        } else if (i.status === "PARTIALLY_PAID") {
          bg = "var(--color-info-bg)";
          color = "var(--color-info-text)";
        } else if (i.isOverdue || i.status === "OVERDUE") {
          bg = "var(--color-danger-bg)";
          color = "var(--color-danger-text)";
        }
        return (
          <span style={{ padding: "2px 8px", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 700, backgroundColor: bg, color }}>
            {i.isOverdue ? "OVERDUE" : i.status.replace("_", " ")}
          </span>
        );
      }
    },
    {
      key: "totalMinor",
      header: "Invoice Total",
      isNumeric: true,
      render: (i) => formatPaiseToInr(i.totalMinor)
    },
    {
      key: "balanceDueMinor",
      header: "Balance Due",
      isNumeric: true,
      render: (i) => (
        <span style={{ fontWeight: 700, color: i.balanceDueMinor > 0 ? "var(--color-danger)" : "var(--color-success-text)" }}>
          {formatPaiseToInr(i.balanceDueMinor)}
        </span>
      )
    },
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (i) => {
        if (!hasPermission("payments:write") || i.balanceDueMinor <= 0) return null;
        return (
          <button
            onClick={() => {
              setPaymentModalInvoice(i);
              setFAmount((i.balanceDueMinor / 100).toFixed(2));
              setFReference(`NEFT-${Date.now().toString().slice(-6)}`);
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
            Record Payment
          </button>
        );
      }
    }
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      key: "paymentNumber",
      header: "Payment #",
      render: (p) => <span style={{ fontWeight: 700 }}>{p.paymentNumber}</span>
    },
    {
      key: "paidAt",
      header: "Date",
      render: (p) => formatDateIndian(p.paidAt, { includeTime: true })
    },
    {
      key: "invoiceNumber",
      header: "Invoice / Customer",
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.invoiceNumber}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.customerName}</div>
        </div>
      )
    },
    {
      key: "method",
      header: "Method",
      render: (p) => <span style={{ fontWeight: 600 }}>{p.method}</span>
    },
    {
      key: "reference",
      header: "Reference / UTR",
      render: (p) => <span style={{ fontSize: 12 }}>{p.reference}</span>
    },
    {
      key: "amountMinor",
      header: "Amount Paid",
      isNumeric: true,
      render: (p) => {
        const isRev = p.isReversal || p.amountMinor < 0;
        return (
          <span style={{ fontWeight: 700, color: isRev ? "var(--color-danger)" : "var(--color-success-text)" }}>
            {formatPaiseToInr(p.amountMinor)}
          </span>
        );
      }
    },
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (p) => {
        if (!hasPermission("payments:write") || p.isReversal || p.amountMinor <= 0) return null;
        return (
          <button
            onClick={() => {
              setReversingPayment(p);
              setFReverseReason(`Payment reversal of ${p.paymentNumber}`);
            }}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--color-danger)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Reverse
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
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Invoicing, Tax & Collections</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            GST-compliant B2B invoicing, partial payments, reversal audit trails, and receivables ageing.
          </p>
        </div>

        {hasPermission("invoices:write") && orders.length > 0 && (
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
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
            + Generate Invoice ({orders.length} Ready)
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
          onClick={() => setActiveTab("invoices")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: activeTab === "invoices" ? "var(--color-brand)" : "var(--bg-subtle)",
            color: activeTab === "invoices" ? "#ffffff" : "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          Tax Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: activeTab === "payments" ? "var(--color-brand)" : "var(--bg-subtle)",
            color: activeTab === "payments" ? "#ffffff" : "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          Payment Ledger ({payments.length})
        </button>
      </div>

      {/* Main Table */}
      {activeTab === "invoices" ? (
        <DataTable
          columns={invoiceColumns}
          data={invoices}
          keyField="id"
          searchPlaceholder="Search invoices by number or customer..."
          exportFilename="stockpulse_invoices.csv"
          isLoading={isLoading}
          emptyTitle="No invoices issued"
          emptyDescription="Convert fulfilled orders into GST tax invoices to manage cash flow."
        />
      ) : (
        <DataTable
          columns={paymentColumns}
          data={payments}
          keyField="id"
          searchPlaceholder="Search payments by UTR or reference..."
          exportFilename="stockpulse_payments.csv"
          isLoading={isLoading}
          emptyTitle="No payment transactions"
          emptyDescription="Recorded customer bank transfers and payment receipts will appear here."
        />
      )}

      {/* Generate Invoice Modal */}
      {isInvoiceModalOpen && (
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
          onClick={() => setIsInvoiceModalOpen(false)}
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Generate GST Tax Invoice</h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateInvoice} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Select Sales Order *
                </label>
                <select
                  value={selectedOrderIdForInvoice}
                  onChange={(e) => setSelectedOrderIdForInvoice(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {o.customerName} ({formatPaiseToInr(o.totalMinor)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
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
                  {isSubmitting ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
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
          onClick={() => setPaymentModalInvoice(null)}
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Record Payment for {paymentModalInvoice.invoiceNumber}</h3>
              <button onClick={() => setPaymentModalInvoice(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 12, backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
              <div>Customer: <strong>{paymentModalInvoice.customerName}</strong></div>
              <div>Invoice Total: <strong>{formatPaiseToInr(paymentModalInvoice.totalMinor)}</strong></div>
              <div style={{ color: "var(--color-danger)", marginTop: 2 }}>Balance Due: <strong>{formatPaiseToInr(paymentModalInvoice.balanceDueMinor)}</strong></div>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Payment Amount (₹) *
                </label>
                <input
                  type="text"
                  required
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Method *
                  </label>
                  <select
                    value={fMethod}
                    onChange={(e) => setFMethod(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  >
                    <option value="NEFT">NEFT Transfer</option>
                    <option value="RTGS">RTGS Transfer</option>
                    <option value="IMPS">IMPS Instant</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="CHEQUE">Cheque / DD</option>
                    <option value="CASH">Cash Collection</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Reference / UTR Number
                  </label>
                  <input
                    type="text"
                    value={fReference}
                    onChange={(e) => setFReference(e.target.value)}
                    placeholder="e.g. UTR-AXIS-99120"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
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
                  {isSubmitting ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {reversingPayment && (
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
          onClick={() => setReversingPayment(null)}
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
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Reverse Payment {reversingPayment.paymentNumber}</h3>
              <button onClick={() => setReversingPayment(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 12, backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
              <div>Original Amount: <strong>{formatPaiseToInr(reversingPayment.amountMinor)}</strong></div>
              <div>Invoice: <strong>{reversingPayment.invoiceNumber}</strong></div>
            </div>

            <form onSubmit={handleReversePayment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Auditable Reason for Reversal * (Min 5 chars)
                </label>
                <textarea
                  required
                  rows={2}
                  value={fReverseReason}
                  onChange={(e) => setFReverseReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setReversingPayment(null)}
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
                    backgroundColor: "var(--color-danger)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Reversing..." : "Confirm Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
