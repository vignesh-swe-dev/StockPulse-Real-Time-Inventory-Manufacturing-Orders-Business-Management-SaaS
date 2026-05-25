export default function Loading() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="skeleton" style={{ height: 110, borderRadius: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 18 }} />)}
      </div>
      <div className="skeleton" style={{ height: 260, borderRadius: 18 }} />
    </div>
  );
}
