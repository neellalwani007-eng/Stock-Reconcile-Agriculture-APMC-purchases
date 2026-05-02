import { useState } from "react";
import { ChevronDown, Edit2, Link2, Trash2, MessageSquare, Info, Tag, Store } from "lucide-react";

const appBg = "#0d2818";
const cardBg = "#1a4731";
const primary = "#2d9e54";
const border = "rgba(45,158,84,0.18)";
const muted = "rgba(255,255,255,0.45)";
const mutedBg = "rgba(255,255,255,0.05)";

const rows = [
  {
    id: 1,
    date: "01-Apr-2026",
    item: "Wheat",
    qty: "100 Qtl",
    rate: "₹2,150",
    amount: "₹2,15,000",
    status: "Pending",
    marka: "Sharbati",
    trader: "Ramesh Patil & Sons",
    hasOptional: true,
  },
  {
    id: 2,
    date: "02-Apr-2026",
    item: "Soybean",
    qty: "50 Qtl",
    rate: "₹4,500",
    amount: "₹2,25,000",
    status: "Pending",
    marka: "",
    trader: "",
    hasOptional: false,
  },
  {
    id: 3,
    date: "03-Apr-2026",
    item: "Onion",
    qty: "80 Qtl",
    rate: "₹1,800",
    amount: "₹1,44,000",
    status: "Pending",
    marka: "Nashik Red",
    trader: "Vijay Agro Traders",
    hasOptional: true,
  },
];

function StatusBadge() {
  return (
    <span style={{
      background: "rgba(234,179,8,0.15)",
      color: "#eab308",
      border: "1px solid rgba(234,179,8,0.3)",
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.02em",
    }}>
      Pending
    </span>
  );
}

function ActionBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button title={title} style={{
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: 6,
      borderRadius: 8,
      color: muted,
      display: "flex",
      alignItems: "center",
      transition: "color 0.15s, background 0.15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = mutedBg; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = muted; }}
    >
      {children}
    </button>
  );
}

function ExpandChevron({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={open ? "Collapse details" : "Expand optional details"} style={{
      background: open ? `${primary}22` : "transparent",
      border: "none",
      cursor: "pointer",
      padding: 6,
      borderRadius: 8,
      color: open ? primary : muted,
      display: "flex",
      alignItems: "center",
      transition: "all 0.15s",
    }}
      onMouseEnter={e => { if (!open) { (e.currentTarget as HTMLElement).style.background = mutedBg; (e.currentTarget as HTMLElement).style.color = "#fff"; } }}
      onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = muted; } }}
    >
      <ChevronDown size={15} style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
    </button>
  );
}

function DetailPanel({ marka, trader }: { marka: string; trader: string }) {
  return (
    <tr>
      <td colSpan={7} style={{ padding: 0 }}>
        <div style={{
          background: `${primary}0a`,
          borderTop: `1px dashed ${border}`,
          borderBottom: `1px solid ${border}`,
          padding: "12px 20px 14px 20px",
          display: "flex",
          gap: 32,
          alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: `${primary}18`,
              borderRadius: 8,
              padding: "5px 7px",
              display: "flex",
              alignItems: "center",
            }}>
              <Tag size={13} color={primary} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: muted, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Marka</div>
              <div style={{ fontSize: 13, color: marka ? "#fff" : muted, fontWeight: marka ? 600 : 400 }}>
                {marka || <span style={{ fontStyle: "italic" }}>— not set</span>}
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: border }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: `${primary}18`,
              borderRadius: 8,
              padding: "5px 7px",
              display: "flex",
              alignItems: "center",
            }}>
              <Store size={13} color={primary} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: muted, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Trader / Party</div>
              <div style={{ fontSize: 13, color: trader ? "#fff" : muted, fontWeight: trader ? 600 : 400 }}>
                {trader || <span style={{ fontStyle: "italic" }}>— not set</span>}
              </div>
            </div>
          </div>

          <div style={{ marginLeft: "auto", fontSize: 11, color: muted, fontStyle: "italic" }}>
            Optional — only shown when filled
          </div>
        </div>
      </td>
    </tr>
  );
}

export function RowDetail() {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]));

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const colHead: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 10,
    fontWeight: 700,
    color: muted,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    textAlign: "left",
    borderBottom: `1px solid ${border}`,
    whiteSpace: "nowrap",
  };

  const cell: React.CSSProperties = {
    padding: "13px 14px",
    fontSize: 13,
    color: "#e8f5ee",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: appBg,
      padding: "24px 20px",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* Section label */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>Pending Pavati (Sales Exceptions)</span>
        <span style={{
          background: "rgba(234,179,8,0.15)", color: "#eab308",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: 20, padding: "1px 9px", fontSize: 11, fontWeight: 600,
        }}>3 records</span>
      </div>

      {/* Table */}
      <div style={{
        background: cardBg,
        borderRadius: 14,
        border: `1px solid ${border}`,
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={colHead}>Sale Date</th>
              <th style={colHead}>Item</th>
              <th style={{ ...colHead, textAlign: "right" }}>Qty</th>
              <th style={{ ...colHead, textAlign: "right" }}>Rate</th>
              <th style={{ ...colHead, textAlign: "right" }}>Amount</th>
              <th style={colHead}>Status</th>
              <th style={{ ...colHead, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isOpen = expanded.has(row.id);
              const isLast = idx === rows.length - 1;
              return (
                <>
                  <tr key={row.id} style={{
                    background: isOpen ? `${primary}06` : "transparent",
                    borderBottom: (!isOpen && !isLast) ? `1px solid ${border}` : "none",
                    transition: "background 0.15s",
                  }}>
                    <td style={cell}>{row.date}</td>
                    <td style={{ ...cell, fontWeight: 600, color: "#fff" }}>{row.item}</td>
                    <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.qty}</td>
                    <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.rate}</td>
                    <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{row.amount}</td>
                    <td style={cell}><StatusBadge /></td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                        <ActionBtn title="Edit"><Edit2 size={14} /></ActionBtn>
                        <ActionBtn title="Note"><MessageSquare size={14} /></ActionBtn>
                        <ActionBtn title="Manual match"><Link2 size={14} /></ActionBtn>
                        {/* ← New expand button */}
                        <ExpandChevron open={isOpen} onClick={() => toggle(row.id)} />
                        <ActionBtn title="Delete"><Trash2 size={14} /></ActionBtn>
                      </div>
                    </td>
                  </tr>
                  {isOpen && <DetailPanel key={`detail-${row.id}`} marka={row.marka} trader={row.trader} />}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 16,
        padding: "10px 14px",
        background: mutedBg,
        borderRadius: 10,
        border: `1px solid ${border}`,
        fontSize: 12,
        color: muted,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <ChevronDown size={13} color={primary} />
        <span>Click the <strong style={{ color: primary }}>chevron ↓</strong> on any row to expand optional details (Marka + Trader). Rows without optional data show "— not set". No export needed.</span>
      </div>
    </div>
  );
}
