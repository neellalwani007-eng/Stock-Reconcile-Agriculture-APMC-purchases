import React from 'react';
import { ArrowRightLeft, LayoutDashboard, CheckCircle2, Clock, AlertCircle, BarChart3, LogOut, User } from 'lucide-react';

export default function DarkForestTheme() {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)', color: '#eeeeee' }}>

      {/* Header */}
      <header style={{ background: 'rgba(26,71,49,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#3a9e63', padding: 8, borderRadius: 8 }}>
            <ArrowRightLeft size={18} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'white' }}>Stock Reconciler</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, color: '#ccc', cursor: 'pointer' }}>
            <BarChart3 size={14} /> Reports
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <User size={14} color="rgba(255,255,255,0.5)" />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Rahul</span>
            <button style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={14} color="rgba(255,255,255,0.5)" />
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Upload card */}
        <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <LayoutDashboard size={20} color="#5ec98a" />
            <span style={{ fontWeight: 700, fontSize: 16, color: 'white' }}>Upload & Match</span>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {['Sales + Purchase', 'Sales Only', 'Purchase Only'].map((l, i) => (
                <button key={l} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: i === 0 ? '#3a9e63' : 'rgba(255,255,255,0.06)', color: i === 0 ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {['Sales Data', 'Purchase Data'].map((label) => (
                <div key={label}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>{label}</p>
                  <div style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>📤</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>Click or drag to upload</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Supports .xlsx and .xls</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={{ padding: '10px 28px', background: '#3a9e63', color: 'white', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowRightLeft size={16} /> Run Match
              </button>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Matched Lots', val: '142', iconBg: 'rgba(52,211,153,0.15)', icon: <CheckCircle2 size={28} color="#34d399" /> },
            { label: 'Pending Payments', val: '8', iconBg: 'rgba(251,191,36,0.15)', icon: <Clock size={28} color="#fbbf24" /> },
            { label: 'Unmatched Purchases', val: '3', iconBg: 'rgba(248,113,113,0.15)', icon: <AlertCircle size={28} color="#f87171" /> },
          ].map((c) => (
            <div key={c.label} style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{c.label}</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: 'white', margin: '4px 0 0' }}>{c.val}</p>
              </div>
              <div style={{ background: c.iconBg, padding: 14, borderRadius: 12 }}>{c.icon}</div>
            </div>
          ))}
        </div>

        {/* Table snippet */}
        <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: 14, color: 'white' }}>Sales Records</div>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Date', 'Item', 'Qty', 'Rate', 'Amount', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['12 Jan 2024', 'Onion', '50.00', '₹2,200', '₹1,10,000', 'Matched'],
                ['12 Jan 2024', 'Corn', '30.00', '₹1,800', '₹54,000', 'Pending'],
                ['15 Jan 2024', 'Onion', '40.00', '₹2,300', '₹92,000', 'Matched'],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '10px 16px', color: j === 5 ? undefined : 'rgba(255,255,255,0.85)' }}>
                      {j === 5 ? (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: cell === 'Matched' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                          color: cell === 'Matched' ? '#34d399' : '#fbbf24',
                          border: `1px solid ${cell === 'Matched' ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.4)'}` }}>{cell}</span>
                      ) : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
