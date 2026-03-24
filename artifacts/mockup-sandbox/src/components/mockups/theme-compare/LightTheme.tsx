import React from 'react';
import { ArrowRightLeft, LayoutDashboard, CheckCircle2, Clock, AlertCircle, BarChart3, LogOut, User } from 'lucide-react';

export default function LightTheme() {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: 'linear-gradient(135deg, #f0faf4 0%, #ffffff 50%, #e8f5ec 100%)', color: '#1a1a2e' }}>

      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.85)', borderBottom: '1px solid #d4e8d8', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#2d7a47', padding: 8, borderRadius: 8 }}>
            <ArrowRightLeft size={18} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e' }}>Stock Reconciler</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(0,0,0,0.05)', border: '1px solid #d4e8d8', borderRadius: 8, fontSize: 13, color: '#555', cursor: 'pointer' }}>
            <BarChart3 size={14} /> Reports
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, borderLeft: '1px solid #d4e8d8' }}>
            <User size={14} color="#888" />
            <span style={{ fontSize: 13, color: '#888' }}>Rahul</span>
            <button style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={14} color="#888" />
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Upload card */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #d4e8d8', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef5f0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <LayoutDashboard size={20} color="#2d7a47" />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>Upload & Match</span>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {['Sales + Purchase', 'Sales Only', 'Purchase Only'].map((l, i) => (
                <button key={l} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d4e8d8', background: i === 0 ? '#2d7a47' : 'white', color: i === 0 ? 'white' : '#555', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {['Sales Data', 'Purchase Data'].map((label) => (
                <div key={label}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>{label}</p>
                  <div style={{ border: '2px dashed #d4e8d8', borderRadius: 12, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fafffe' }}>
                    <div style={{ width: 40, height: 40, background: '#f0faf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>📤</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>Click or drag to upload</p>
                    <p style={{ fontSize: 11, color: '#aaa' }}>Supports .xlsx and .xls</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={{ padding: '10px 28px', background: '#2d7a47', color: 'white', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowRightLeft size={16} /> Run Match
              </button>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Matched Lots', val: '142', color: '#16a34a', bg: '#dcfce7', icon: <CheckCircle2 size={28} color="#16a34a" /> },
            { label: 'Pending Payments', val: '8', color: '#d97706', bg: '#fef3c7', icon: <Clock size={28} color="#d97706" /> },
            { label: 'Unmatched Purchases', val: '3', color: '#dc2626', bg: '#fee2e2', icon: <AlertCircle size={28} color="#dc2626" /> },
          ].map((c) => (
            <div key={c.label} style={{ background: 'white', borderRadius: 16, border: '1px solid #d4e8d8', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{c.label}</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: '#1a1a2e', margin: '4px 0 0' }}>{c.val}</p>
              </div>
              <div style={{ background: c.bg, padding: 14, borderRadius: 12 }}>{c.icon}</div>
            </div>
          ))}
        </div>

        {/* Table snippet */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #d4e8d8', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef5f0', fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>Sales Records</div>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fdf9', borderBottom: '1px solid #eef5f0' }}>
                {['Date', 'Item', 'Qty', 'Rate', 'Amount', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['12 Jan 2024', 'Onion', '50.00', '₹2,200', '₹1,10,000', 'Matched'],
                ['12 Jan 2024', 'Corn', '30.00', '₹1,800', '₹54,000', 'Pending'],
                ['15 Jan 2024', 'Onion', '40.00', '₹2,300', '₹92,000', 'Matched'],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f4f1' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '10px 16px', color: j === 5 ? undefined : '#1a1a2e' }}>
                      {j === 5 ? (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cell === 'Matched' ? '#dcfce7' : '#fef3c7', color: cell === 'Matched' ? '#15803d' : '#d97706', border: `1px solid ${cell === 'Matched' ? '#bbf7d0' : '#fde68a'}` }}>{cell}</span>
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
