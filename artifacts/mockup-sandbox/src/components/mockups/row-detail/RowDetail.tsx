const appBg = "#0d2818";
const cardBg = "#1a4731";
const primary = "#2d9e54";
const border = "rgba(45,158,84,0.18)";
const muted = "rgba(255,255,255,0.45)";

const salesRows = [
  { id: 1, date: "01-Apr-2026", item: "Wheat",   marka: "Sharbati",   qty: "100 Qtl", rate: "₹2,150", amount: "₹2,15,000" },
  { id: 2, date: "02-Apr-2026", item: "Soybean",  marka: "",           qty: "50 Qtl",  rate: "₹4,500", amount: "₹2,25,000" },
  { id: 3, date: "03-Apr-2026", item: "Onion",    marka: "Nashik Red", qty: "80 Qtl",  rate: "₹1,800", amount: "₹1,44,000" },
];

const purchaseRows = [
  { id: 1, date: "01-Apr-2026", item: "Wheat",   marka: "Sharbati",   qty: "100 Qtl", rate: "₹2,140", amount: "₹2,14,000" },
  { id: 2, date: "02-Apr-2026", item: "Soybean",  marka: "",           qty: "50 Qtl",  rate: "₹4,480", amount: "₹2,24,000" },
  { id: 3, date: "03-Apr-2026", item: "Onion",    marka: "Nashik Red", qty: "80 Qtl",  rate: "₹1,790", amount: "₹1,43,200" },
];

const colHead = (align: "left" | "right" = "left"): React.CSSProperties => ({
  padding: "10px 14px",
  fontSize: 10,
  fontWeight: 700,
  color: muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  textAlign: align,
  borderBottom: `1px solid ${border}`,
  whiteSpace: "nowrap",
});

const cell = (align: "left" | "right" = "left"): React.CSSProperties => ({
  padding: "13px 14px",
  fontSize: 13,
  color: "#e8f5ee",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
  textAlign: align,
});

function PendingBadge() {
  return (
    <span style={{
      background: "rgba(234,179,8,0.15)", color: "#eab308",
      border: "1px solid rgba(234,179,8,0.3)",
      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
    }}>Pending</span>
  );
}

function UnmatchedBadge() {
  return (
    <span style={{
      background: "rgba(239,68,68,0.12)", color: "#f87171",
      border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
    }}>Unmatched</span>
  );
}

function MarkaCell({ value }: { value: string }) {
  if (!value) return <td style={cell()}><span style={{ color: muted, fontStyle: "italic", fontSize: 12 }}>—</span></td>;
  return (
    <td style={cell()}>
      <span style={{
        background: `${primary}18`,
        color: primary,
        border: `1px solid ${primary}30`,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 600,
      }}>{value}</span>
    </td>
  );
}

function ActionDots() {
  return (
    <td style={{ ...cell("right"), color: muted }}>
      <span style={{ letterSpacing: 2, fontSize: 16 }}>· · ·</span>
    </td>
  );
}

function Table({ title, badge, dateLabel, rows, badgeEl }: {
  title: string;
  badge: string;
  dateLabel: string;
  rows: typeof salesRows;
  badgeEl: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>{title}</span>
        <span style={{
          background: "rgba(234,179,8,0.15)", color: "#eab308",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: 20, padding: "1px 9px", fontSize: 11, fontWeight: 600,
        }}>{badge}</span>
      </div>
      <div style={{ background: cardBg, borderRadius: 14, border: `1px solid ${border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={colHead()}>{dateLabel}</th>
              <th style={colHead()}>Item</th>
              <th style={colHead()}>Marka</th>
              <th style={colHead("right")}>Qty</th>
              <th style={colHead("right")}>Rate</th>
              <th style={colHead("right")}>Amount</th>
              <th style={colHead()}>Status</th>
              <th style={colHead("right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom: idx < rows.length - 1 ? `1px solid ${border}` : "none" }}>
                <td style={cell()}>{row.date}</td>
                <td style={{ ...cell(), fontWeight: 600, color: "#fff" }}>{row.item}</td>
                <MarkaCell value={row.marka} />
                <td style={cell("right")}>{row.qty}</td>
                <td style={cell("right")}>{row.rate}</td>
                <td style={{ ...cell("right"), fontWeight: 600 }}>{row.amount}</td>
                <td style={cell()}>{badgeEl}</td>
                <ActionDots />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RowDetail() {
  return (
    <div style={{
      minHeight: "100vh",
      background: appBg,
      padding: "20px 20px",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <Table
        title="Pending Pavati (Sales Exceptions)"
        badge="3 records"
        dateLabel="Sale Date"
        rows={salesRows}
        badgeEl={<PendingBadge />}
      />
      <Table
        title="Purchase Exceptions"
        badge="3 records"
        dateLabel="Purchase Date"
        rows={purchaseRows}
        badgeEl={<UnmatchedBadge />}
      />

      <div style={{
        padding: "10px 14px",
        background: "rgba(45,158,84,0.06)",
        borderRadius: 10,
        border: `1px solid ${border}`,
        fontSize: 12, color: muted,
      }}>
        <strong style={{ color: primary }}>Marka column</strong> replaces Bill Date (already visible as Sale Date / Purchase Date). Blank entries show "—". Optional — leave blank to match any marka.
      </div>
    </div>
  );
}
