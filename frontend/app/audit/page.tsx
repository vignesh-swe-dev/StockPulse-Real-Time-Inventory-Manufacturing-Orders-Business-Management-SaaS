"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../lib/api";
import { AuditLog } from "../../types/domain";
import { DataTable, Column } from "../../components/DataTable";
import { formatDateIndian } from "../../lib/currency";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient<AuditLog[]>("/audit/logs?limit=200");
      setLogs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns: Column<AuditLog>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      render: (a) => (
        <span className="tabular-nums" style={{ fontSize: 12 }}>
          {formatDateIndian(a.createdAt, { includeTime: true })}
        </span>
      )
    },
    {
      key: "actorRole",
      header: "Actor Role",
      render: (a) => (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "var(--radius-full)",
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: "var(--bg-subtle)",
            color: "var(--text-secondary)"
          }}
        >
          {a.actorRole}
        </span>
      )
    },
    {
      key: "action",
      header: "Action / Event",
      render: (a) => (
        <code style={{ fontSize: 12, fontWeight: 700, color: "var(--color-brand)" }}>
          {a.action}
        </code>
      )
    },
    {
      key: "entityType",
      header: "Entity Scope",
      render: (a) => (
        <span>
          {a.entityType} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({a.entityId.slice(0, 8)}...)</span>
        </span>
      )
    },
    {
      key: "details",
      header: "Metadata",
      render: (a) => (
        <button
          onClick={() => setSelectedLog(a)}
          style={{
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-surface)",
            fontSize: 11,
            cursor: "pointer"
          }}
        >
          View Payload
        </button>
      )
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner */}
      <div className="page-hero">
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Immutable Audit Trail & Compliance</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Tamper-evident record of all tenant mutations: stock adjustments, confirmations, dispatches, and reversals.
        </p>
      </div>

      {error && (
        <div style={{ padding: 14, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger-text)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-danger-border)" }}>
          {error}
        </div>
      )}

      {/* Audit Table */}
      <DataTable
        columns={columns}
        data={logs}
        keyField="id"
        searchPlaceholder="Search audit events by action or entity..."
        exportFilename="stockpulse_audit_trail.csv"
        isLoading={isLoading}
        emptyTitle="No audit records"
        emptyDescription="All business operations and state changes are recorded automatically here."
      />

      {/* Metadata Payload Modal */}
      {selectedLog && (
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
          onClick={() => setSelectedLog(null)}
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Audit Event: {selectedLog.action}</h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>
                ✕
              </button>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Timestamp: {formatDateIndian(selectedLog.createdAt, { includeTime: true })} | Role: {selectedLog.actorRole}
            </div>

            <pre
              style={{
                padding: 14,
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-subtle)",
                overflowX: "auto",
                fontSize: 12,
                color: "var(--text-primary)"
              }}
            >
              {JSON.stringify(selectedLog.metadata, null, 2)}
            </pre>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-brand)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
