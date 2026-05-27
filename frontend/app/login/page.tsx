"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { Logo, LogoMark } from "../../components/Logo";
import { Icon } from "../../components/Icon";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
    fetch(`${base}/health`).then((r) => r.json()).then((j) => setDemoMode(Boolean(j?.data?.demoMode))).catch(() => {});
  }, []);
  const [error, setError] = useState<string | null>(null);

  const submit = async (creds: { email: string; password: string }) => {
    setBusy(true);
    setError(null);
    try {
      await login(creds);
      router.push("/");
    } catch (e: any) {
      setError(e?.message || "Sign-in failed. Check your email and password.");
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    width: "100%", padding: "13px 14px 13px 44px", borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14.5
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,1fr)", minHeight: "100vh" }} className="login-grid">
      {/* Brand panel */}
      <div className="login-art" style={{ position: "relative", overflow: "hidden", color: "#fff", padding: 56, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div className="grid-bg" aria-hidden style={{ position: "absolute", inset: 0 }} />
        <div aria-hidden style={{ position: "absolute", width: 420, height: 420, right: -120, bottom: -140, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,212,191,.45), transparent 65%)", animation: "floatY 9s ease-in-out infinite" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <LogoMark size={44} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em" }}>StockPulse</span>
        </div>
        <div style={{ position: "relative", maxWidth: 480 }}>
          <h1 className="reveal" style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 700, color: "#fff" }}>Your whole business, in one live pulse.</h1>
          <p className="reveal" style={{ ["--i" as any]: 1, marginTop: 18, color: "rgba(255,255,255,.8)", fontSize: 16 }}>
            Inventory, manufacturing, sales and GST invoicing, synced in real time for every role on your team.
          </p>
          <div style={{ display: "grid", gap: 14, marginTop: 34 }}>
            {[["inventory", "Multi-warehouse stock with live alerts"], ["production", "BOM-based production batches"], ["shield", "Role-based access and full audit trail"]].map(([ic, t], i) => (
              <div key={t} className="reveal" style={{ ["--i" as any]: i + 2, display: "flex", alignItems: "center", gap: 12, fontSize: 14.5 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={ic as any} size={18} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", fontSize: 12.5, color: "rgba(255,255,255,.6)" }}>© 2026 StockPulse</div>
      </div>

      {/* Form panel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div className="page-enter" style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: 28 }}><Logo size={36} showTagline={false} /></div>
          <h2 style={{ fontSize: 28, fontWeight: 700 }}>Welcome back</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 6, marginBottom: 26 }}>Sign in to your StockPulse workspace.</p>

          {error && (
            <div role="alert" style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger-border)", color: "var(--color-danger-text)", fontSize: 13.5, marginBottom: 16, animation: "popIn .25s ease" }}>
              {error}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); submit({ email, password }); }} style={{ display: "grid", gap: 16 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Email
              <span style={{ position: "relative", display: "block" }}>
                <span style={{ position: "absolute", left: 14, top: 13, color: "var(--text-muted)" }}><Icon name="users" size={18} /></span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={field} />
              </span>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Password
              <span style={{ position: "relative", display: "block" }}>
                <span style={{ position: "absolute", left: 14, top: 13, color: "var(--text-muted)" }}><Icon name="lock" size={18} /></span>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" style={field} />
              </span>
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{ padding: "14px 18px", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-brand)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}
            >
              {busy ? <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} /> : <>Sign in <Icon name="arrow" size={18} /></>}
            </button>
          </form>

          {demoMode && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0", color: "var(--text-muted)", fontSize: 12 }}>
                <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} /> OR <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit({ email: "vikram@sahyadri.in", password: "SahyadriSecure#2026" })}
                style={{ width: "100%", padding: "13px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14.5, fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}
              >
                <Icon name="zap" size={17} /> Continue with demo account
              </button>
            </>
          )}
          <p style={{ textAlign: "center", marginTop: 22, fontSize: 14, color: "var(--text-muted)" }}>
            New to StockPulse? <Link href="/register" style={{ color: "var(--color-brand)", fontWeight: 600 }}>Create your company account</Link>
          </p>
          <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
            <Link href="/welcome" style={{ color: "var(--color-brand)", fontWeight: 600 }}>Back to website</Link>
          </p>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .login-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
