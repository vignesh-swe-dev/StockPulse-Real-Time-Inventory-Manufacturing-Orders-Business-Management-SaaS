"use client";

import React, { useState } from "react";
import { Notification } from "../types/domain";
import { formatDateIndian } from "../lib/currency";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationDrawer({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead
}: NotificationDrawerProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (!isOpen) return null;

  const displayList = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "flex-end"
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          height: "100%",
          backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s ease-out"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Notifications</h3>
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: "var(--color-brand)",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)"
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close notification drawer"
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-subtle)"
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setFilter("all")}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: filter === "all" ? "var(--bg-surface)" : "transparent",
                color: filter === "all" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: filter === "all" ? "var(--shadow-sm)" : "none",
                cursor: "pointer"
              }}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: filter === "unread" ? "var(--bg-surface)" : "transparent",
                color: filter === "unread" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: filter === "unread" ? "var(--shadow-sm)" : "none",
                cursor: "pointer"
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-brand)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications Scroll List */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {displayList.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>No notifications</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>You are all caught up with tenant alerts!</div>
            </div>
          ) : (
            displayList.map((notif) => {
              const isWarning = notif.type.includes("LOW_STOCK") || notif.type.includes("OVERDUE");
              return (
                <div
                  key={notif.id}
                  style={{
                    padding: 14,
                    borderRadius: "var(--radius-md)",
                    marginBottom: 8,
                    backgroundColor: notif.isRead ? "transparent" : "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderLeft: `4px solid ${isWarning ? "var(--color-warning)" : "var(--color-brand)"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    transition: "var(--transition-fast)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{notif.title}</span>
                    {!notif.isRead && (
                      <button
                        onClick={() => onMarkRead(notif.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-brand)",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>{notif.message}</p>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {formatDateIndian(notif.createdAt, { includeTime: true })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
