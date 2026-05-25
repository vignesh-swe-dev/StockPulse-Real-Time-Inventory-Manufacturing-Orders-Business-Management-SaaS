"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
      <div className="page-enter" style={{ maxWidth: 440 }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 18px", borderRadius: "50%", background: "var(--color-danger-bg)", color: "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700 }}>!</div>
        <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
        <p style={{ color: "var(--text-muted)", margin: "8px 0 22px" }}>{error?.message || "An unexpected error occurred."}</p>
        <button onClick={reset} className="btn-primary" style={{ padding: "12px 22px", borderRadius: "var(--radius-md)", color: "#fff", fontWeight: 600, border: "none" }}>Try again</button>
      </div>
    </div>
  );
}
