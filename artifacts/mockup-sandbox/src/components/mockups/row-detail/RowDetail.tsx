const appBg = "#0d2818";
const cardBg = "#1a4731";
const primary = "#2d9e54";
const border = "rgba(45,158,84,0.18)";
const muted = "rgba(255,255,255,0.45)";

const salesRows = [
  { id: 1, date: "01-Apr-2026", item: "Wheat",   qty: "100 Qtl", rate: "₹2,150", amount: "₹2,15,000", marka: "Sharbati"   },
  { id: 2, date: "02-Apr-2026", item: "Soybean",  qty: "50 Qtl",  rate: "₹4,500", amount: "₹2,25,000", marka: ""           },
  { id: 3, date: "03-Apr-2026", item: "Onion",    qty: "80 Qtl",  rate: "₹1,800", amount: "₹1,44,000", marka: "Nashik Red" },
];

const purchaseRows = [
  { id: 1, date: "01-Apr-2026", item: "Wheat",   qty: "100 Qtl", rate: "₹2,140", amount: "₹2,14,000", marka: "Sharbati"   },
  { id: 2, date: "02-Apr-2026", item: "Soybean",  qty: "50 Qtl",  rate: "₹4,480", amount: "₹2,24,000", marka: ""           },
  { id: 3, date: "03-Apr-2026", item: "Onion",    qty: "80 Qtl",  rate: "₹1,790", amount: "₹1,43,200", marka: "Nashik Red" },
];

const hStyle = (align: "left" | "right" = "left"): React.CSSProperties => ({
  padding: "10px 14px", fontSize: 10, fontWeight: 700, color: muted,
  textTransform: "uppercase", letterSpacing: "0.06em", textAlign: align,
  borderBottom: `1px solid ${border}`, whiteSpace: "nowrap",
});
const cStyle = (align: "left" | "right" = "left"): React.CSSProperties => ({
  padding: "13px 14px", fontSize: 13, color: "#e8f5ee",
  whiteSpace: "nowrap", verticalAlign: "middle", textAlign: align,
});

function MarkaCell({ value }: { value: string }) {
  if (!value) return <td style={cStyle()}><span style={{ color: muted, fontStyle: "italic", fontSize: 12 }}>—</span></td>;
  return (
    <td style={cStyle()}>
      <span style={{
        background: `${primary}18`, color: primary, border: `1px solid ${primary}30`,
        borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
      }}>{value}</span>
    </td>
  );
}

function ActionDots() {
  return <td style={{ ...cStyle("right"), color: muted }}><span style={{ letterSpacing: 2, fontSize: 16 }}>· · ·</span></td>;
}

function SectionLabel({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>{title}</span>
      <span style={{
        background: "rgba(234,179,8,0.15)", color: "#eab308",
        border: "1px solid rgba(234,179,8,0.3)",
        borderRadius: 20, padding: "1px 9px", fontSize: 11, fontWeight: 600,
      }}>{count} records</span>
    </div>
  );
}

export function RowDetail() {
  return (
    <div style={{ minHeight: "100vh", background: appBg, padding: "20px", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Pending Pavati ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel title="Pending Pavati (Sales Exceptions)" count={3} />
        <div style={{ background: cardBg, borderRadius: 14, border: `1px solid ${border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={hStyle()}>Sale Date</th>
                <th style={hStyle()}>Item</th>
                <th style={hStyle("right")}>Qty</th>
                <th style={hStyle("right")}>Rate</th>
                <th style={hStyle("right")}>Amount</th>
                <th style={hStyle()}>Marka</th>
                <th style={hStyle("right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: idx < salesRows.length - 1 ? `1px solid ${border}` : "none" }}>
                  <td style={cStyle()}>{row.date}</td>
                  <td style={{ ...cStyle(), fontWeight: 600, color: "#fff" }}>{row.item}</td>
                  <td style={cStyle("right")}>{row.qty}</td>
                  <td style={cStyle("right")}>{row.rate}</td>
                  <td style={{ ...cStyle("right"), fontWeight: 600 }}>{row.amount}</td>
                  <MarkaCell value={row.marka} />
                  <ActionDots />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Purchase Exceptions ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel title="Purchase Exceptions" count={3} />
        <div style={{ background: cardBg, borderRadius: 14, border: `1px solid ${border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={hStyle()}>Purchase Date</th>
                <th style={hStyle()}>Item</th>
                <th style={hStyle("right")}>Qty</th>
                <th style={hStyle("right")}>Rate</th>
                <th style={hStyle("right")}>Amount</th>
                <th style={hStyle()}>Marka</th>
                <th style={hStyle("right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: idx < purchaseRows.length - 1 ? `1px solid ${border}` : "none" }}>
                  <td style={cStyle()}>{row.date}</td>
                  <td style={{ ...cStyle(), fontWeight: 600, color: "#fff" }}>{row.item}</td>
                  <td style={cStyle("right")}>{row.qty}</td>
                  <td style={cStyle("right")}>{row.rate}</td>
                  <td style={{ ...cStyle("right"), fontWeight: 600 }}>{row.amount}</td>
                  <MarkaCell value={row.marka} />
                  <ActionDots />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        padding: "10px 14px", background: "rgba(45,158,84,0.06)",
        borderRadius: 10, border: `1px solid ${border}`, fontSize: 12, color: muted,
      }}>
        <strong style={{ color: primary }}>Pending Pavati:</strong> Sale Date · Item · Qty · Rate · Amount · <strong style={{ color: primary }}>Marka</strong> · Actions
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong style={{ color: primary }}>Purchase Exceptions:</strong> Purchase Date · Item · Qty · Rate · Amount · <strong style={{ color: primary }}>Marka</strong> · Actions
      </div>
    </div>
  );
}
