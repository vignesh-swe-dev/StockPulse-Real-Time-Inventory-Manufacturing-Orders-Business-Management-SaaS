"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, IconName } from "./Icon";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? commands.filter((c) => (c.label + " " + (c.hint ?? "")).toLowerCase().includes(t)) : commands;
  }, [q, commands]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);
  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  const exec = (c?: Command) => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div
        className="cmdk"
        role="dialog"
        aria-label="Quick search"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); exec(results[sel]); }
          else if (e.key === "Escape") onClose();
        }}
      >
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages and actions…" aria-label="Search" />
        <div style={{ maxHeight: 340, overflowY: "auto", padding: "8px 0" }}>
          {results.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No matches for “{q}”</div>}
          {results.map((c, i) => (
            <div key={c.id} className={`cmdk-item${i === sel ? " sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => exec(c)}>
              <Icon name={c.icon} size={18} />
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.hint && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.hint}</span>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, padding: "10px 18px", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-muted)" }}>
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">Enter</span> open</span>
          <span><span className="kbd">Esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
