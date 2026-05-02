import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.scaleFade}
    >
      <div className="w-full max-w-4xl relative">
        <h2 className="text-[#FDFBF7] text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>Smart Manual Matching</h2>

        {/* Highlighted Row */}
        <motion.div 
          className="grid grid-cols-6 gap-4 p-4 items-center rounded-lg bg-[#1E293B] border-2 border-[#D97706] mb-8 relative z-10 shadow-[0_0_20px_rgba(217,119,6,0.2)]"
        >
          <div className="text-[#FDFBF7]">14 Apr 25</div>
          <div className="text-[#FDFBF7]">Maize</div>
          <div className="text-[#FDFBF7]">100</div>
          <div className="text-[#FDFBF7]">₹1,800</div>
          <div className="text-[#FDFBF7]">₹1,80,000</div>
          <div>
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${phase >= 3 ? 'bg-[#064E3B] text-[#10B981] border-[#10B981]/30' : 'bg-[#78350F] text-[#F59E0B] border-[#F59E0B]/30'}`}>
              {phase >= 3 ? 'Matched' : 'Pending'}
            </div>
          </div>
        </motion.div>

        {/* Suggestion Panel */}
        <motion.div 
          className="w-3/4 ml-auto bg-[#1E293B] border border-[#475569] rounded-xl overflow-hidden shadow-2xl relative z-20"
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={phase >= 1 && phase < 3 ? { opacity: 1, y: 0, height: 'auto' } : { opacity: 0, y: 20, height: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="bg-[#0F172A] px-4 py-3 border-b border-[#475569] text-sm font-medium text-[#94A3B8]">
            Suggested Purchase Records
          </div>

          <div className="p-2 flex flex-col gap-2">
            {/* Top Match */}
            <div className="bg-[#0F172A]/50 border border-[#064E3B] rounded-lg p-3 relative overflow-hidden">
              <motion.div 
                className="absolute inset-0 bg-[#064E3B]/20"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
              />
              <div className="flex justify-between items-center mb-2 relative z-10">
                <span className="text-[#10B981] text-xs font-bold px-2 py-1 bg-[#064E3B] rounded border border-[#10B981]/30">4/5 Fields Match</span>
                <span className="text-[#94A3B8] text-xs">Pur-0042</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm relative z-10">
                <div className="text-[#FDFBF7]">14 Apr 25</div>
                <div className="text-[#EF4444] line-through decoration-[#EF4444]">Corn</div>
                <div className="text-[#FDFBF7]">100</div>
                <div className="text-[#FDFBF7]">₹1,80,000</div>
              </div>
            </div>

            {/* Second Match */}
            <div className="bg-[#0F172A]/30 border border-[#475569] rounded-lg p-3 opacity-60">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#F59E0B] text-xs font-bold px-2 py-1 bg-[#78350F] rounded border border-[#F59E0B]/30">3/5 Fields Match</span>
                <span className="text-[#94A3B8] text-xs">Pur-0089</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="text-[#EF4444]">12 Apr 25</div>
                <div className="text-[#FDFBF7]">Maize</div>
                <div className="text-[#FDFBF7]">100</div>
                <div className="text-[#EF4444]">₹1,75,000</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
