import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 2600),
      setTimeout(() => setPhase(4), 3800),
      setTimeout(() => setPhase(5), 5200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const cards = [
    { label: 'Total Sales', value: '128', color: '#3B82F6' },
    { label: 'Total Purchases', value: '115', color: '#8B5CF6' },
    { label: 'Matched', value: '98', color: '#2d9e54' },
    { label: 'Unmatched', value: '30', color: '#ef4444' },
  ];

  const rows = [
    { item: 'Wheat', qty: '500', rate: '₹2,100', amt: '₹10,50,000', matchAt: 3 },
    { item: 'Corn', qty: '250', rate: '₹1,850', amt: '₹4,62,500', matchAt: 4 },
    { item: 'Soybean', qty: '300', rate: '₹3,200', amt: '₹9,60,000', matchAt: 5 },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-start justify-start pt-16 px-12"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.slideUp}
    >
      {/* Header bar */}
      <div className="w-full flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1a4731] rounded-xl flex items-center justify-center border border-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m17 4 4 4-4 4" /><path d="M3 8h18" /><path d="m7 20-4-4 4-4" /><path d="M21 16H3" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>Stock Reconciler</span>
        </div>
        <div className="flex items-center gap-2 bg-[#122d1e] border border-[#2d4a35] rounded-xl px-3 py-1.5 text-sm text-[#7a9183]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          FY 2024-25
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 w-full mb-8">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            className="bg-[#122d1e] border border-[#2d4a35] rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: i * 0.08, duration: 0.45 }}
          >
            <p className="text-[#7a9183] text-xs font-medium mb-2">{card.label}</p>
            <h3 className="text-4xl font-bold" style={{ color: card.color, fontFamily: 'var(--font-display)' }}>{card.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div
        className="bg-[#122d1e] border border-[#2d4a35] rounded-xl overflow-hidden w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-[#2d4a35] bg-[#091a10] text-[#7a9183] text-xs font-semibold uppercase tracking-wide">
          <div>Date</div><div>Item</div><div>Qty</div><div>Rate</div><div>Amount</div><div>Status</div>
        </div>
        <div className="p-2 flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <motion.div
              key={i}
              className="grid grid-cols-6 gap-4 px-3 py-3 items-center rounded-lg bg-[#091a10]/60"
              initial={{ opacity: 0, x: -16 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
              transition={{ delay: 0.15 + i * 0.1 }}
            >
              <div className="text-white text-sm">12 Apr 25</div>
              <div className="text-white text-sm font-medium">{row.item}</div>
              <div className="text-white text-sm">{row.qty}</div>
              <div className="text-white text-sm">{row.rate}</div>
              <div className="text-white text-sm">{row.amt}</div>
              <motion.div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border w-fit`}
                animate={phase >= row.matchAt
                  ? { backgroundColor: 'rgba(45,158,84,0.15)', color: '#2d9e54', borderColor: 'rgba(45,158,84,0.3)' }
                  : { backgroundColor: 'rgba(217,119,6,0.12)', color: '#f5a41a', borderColor: 'rgba(245,164,26,0.3)' }
                }
                transition={{ duration: 0.4 }}
              >
                {phase >= row.matchAt
                  ? <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Matched</>
                  : 'Pending'
                }
              </motion.div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
