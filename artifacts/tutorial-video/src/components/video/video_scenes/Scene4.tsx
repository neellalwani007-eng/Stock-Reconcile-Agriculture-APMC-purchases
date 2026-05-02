import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const cards = [
    { label: 'Total Sales', value: '128', color: '#3B82F6' },
    { label: 'Total Purchases', value: '115', color: '#8B5CF6' },
    { label: 'Matched', value: '98', color: '#10B981' },
    { label: 'Unmatched', value: '30', color: '#EF4444' },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-start pt-24 px-16 bg-[#0F172A]"
      {...sceneTransitions.slideUp}
    >
      <div className="w-full max-w-6xl">
        <h2 className="text-[#FDFBF7] text-3xl font-bold mb-8" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-6 mb-12">
          {cards.map((card, i) => (
            <motion.div 
              key={i}
              className="bg-[#1E293B] border border-[#475569] rounded-xl p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <p className="text-[#94A3B8] text-sm font-medium mb-2">{card.label}</p>
              <h3 className="text-4xl font-bold" style={{ color: card.color, fontFamily: 'var(--font-display)' }}>{card.value}</h3>
            </motion.div>
          ))}
        </div>

        {/* Table */}
        <motion.div 
          className="bg-[#1E293B] border border-[#475569] rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid grid-cols-6 gap-4 p-4 border-b border-[#475569] bg-[#0F172A] text-[#94A3B8] text-sm font-medium">
            <div>Date</div>
            <div>Item</div>
            <div>Qty (Qtl)</div>
            <div>Rate</div>
            <div>Amount</div>
            <div>Status</div>
          </div>
          
          <div className="p-2 flex flex-col gap-2">
            {[1, 2, 3].map((row, i) => (
              <motion.div 
                key={i}
                className="grid grid-cols-6 gap-4 p-3 items-center rounded-lg bg-[#0F172A]/50 border border-transparent"
                initial={{ opacity: 0, x: -20 }}
                animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
              >
                <div className="text-[#FDFBF7]">12 Apr 25</div>
                <div className="text-[#FDFBF7]">{i === 0 ? 'Wheat' : i === 1 ? 'Corn' : 'Soybean'}</div>
                <div className="text-[#FDFBF7]">250</div>
                <div className="text-[#FDFBF7]">₹2,100</div>
                <div className="text-[#FDFBF7]">₹5,25,000</div>
                
                <div>
                  <motion.div 
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      phase >= 3 + i ? 'bg-[#064E3B] text-[#10B981] border-[#10B981]/30' : 'bg-[#78350F] text-[#F59E0B] border-[#F59E0B]/30'
                    }`}
                    initial={false}
                    animate={{ 
                      backgroundColor: phase >= 3 + i ? '#064E3B' : '#78350F',
                      color: phase >= 3 + i ? '#10B981' : '#F59E0B',
                      borderColor: phase >= 3 + i ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    {phase >= 3 + i ? 'Matched' : 'Pending'}
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
