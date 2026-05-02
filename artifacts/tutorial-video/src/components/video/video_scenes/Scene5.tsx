import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.scaleFade}
    >
      <div className="w-full max-w-3xl">
        <h2 className="text-white text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Smart Manual Matching
        </h2>

        {/* Highlighted pending row */}
        <motion.div
          className="grid grid-cols-6 gap-4 px-4 py-3.5 items-center rounded-xl bg-[#122d1e] border-2 border-[#f5a41a]/60 mb-6 shadow-[0_0_24px_rgba(245,164,26,0.15)] relative z-10"
        >
          <div className="text-white text-sm">14 Apr 25</div>
          <div className="text-white text-sm font-medium">Maize</div>
          <div className="text-white text-sm">100</div>
          <div className="text-white text-sm">₹1,800</div>
          <div className="text-white text-sm">₹1,80,000</div>
          <motion.div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border w-fit"
            animate={phase >= 3
              ? { backgroundColor: 'rgba(45,158,84,0.15)', color: '#2d9e54', borderColor: 'rgba(45,158,84,0.3)' }
              : { backgroundColor: 'rgba(245,164,26,0.12)', color: '#f5a41a', borderColor: 'rgba(245,164,26,0.3)' }
            }
            transition={{ duration: 0.4 }}
          >
            {phase >= 3 ? (
              <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Matched</>
            ) : 'Pending'}
          </motion.div>
        </motion.div>

        {/* Suggestions panel */}
        <motion.div
          className="bg-[#122d1e] border border-[#2d4a35] rounded-xl overflow-hidden shadow-2xl"
          initial={{ opacity: 0, y: -16, height: 0 }}
          animate={phase >= 1 && phase < 3
            ? { opacity: 1, y: 0, height: 'auto' }
            : { opacity: 0, y: 20, height: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        >
          <div className="bg-[#091a10] px-4 py-2.5 border-b border-[#2d4a35] text-xs font-semibold text-[#7a9183] uppercase tracking-wide">
            Suggested Purchase Records
          </div>

          <div className="p-3 flex flex-col gap-2">
            {/* Top match */}
            <div className="bg-[#091a10]/60 border border-[#2d9e54]/40 rounded-xl p-3 relative overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-[#2d9e54]/8"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
              />
              <div className="flex justify-between items-center mb-2.5 relative z-10">
                <span className="text-[#2d9e54] text-xs font-bold px-2.5 py-1 bg-[#2d9e54]/12 rounded-lg border border-[#2d9e54]/30">
                  4 / 5 Fields Match
                </span>
                <span className="text-[#7a9183] text-xs">Pur-0042</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-sm relative z-10">
                <div className="text-white">14 Apr 25</div>
                <div className="text-[#ef4444] line-through">Corn</div>
                <div className="text-white">100 qtl</div>
                <div className="text-white">₹1,800</div>
                <div className="text-white">₹1,80,000</div>
              </div>
            </div>

            {/* Second match */}
            <div className="bg-[#091a10]/40 border border-[#2d4a35] rounded-xl p-3 opacity-55">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[#f5a41a] text-xs font-bold px-2.5 py-1 bg-[#f5a41a]/10 rounded-lg border border-[#f5a41a]/30">
                  3 / 5 Fields Match
                </span>
                <span className="text-[#7a9183] text-xs">Pur-0089</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-sm">
                <div className="text-[#ef4444]">12 Apr 25</div>
                <div className="text-white">Maize</div>
                <div className="text-white">100 qtl</div>
                <div className="text-[#ef4444]">₹1,750</div>
                <div className="text-[#ef4444]">₹1,75,000</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
