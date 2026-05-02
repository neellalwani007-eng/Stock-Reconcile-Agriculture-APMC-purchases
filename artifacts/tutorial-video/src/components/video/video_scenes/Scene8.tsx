import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene8() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.slideRight}
    >
      <h2 className="text-white text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Financial Year Management
      </h2>
      <p className="text-[#7a9183] text-sm mb-10">Each year has isolated data — switch any time</p>

      <div className="w-full max-w-2xl flex gap-6 px-6">
        {/* FY Switcher */}
        <motion.div
          className="flex-1 bg-[#122d1e] rounded-2xl border border-[#2d4a35] p-6 flex flex-col"
          initial={{ opacity: 0, x: -36 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -36 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        >
          <span className="text-[#7a9183] text-xs font-semibold uppercase tracking-wide mb-4">Active Year</span>

          {/* Active FY */}
          <div className="bg-[#091a10] border border-[#2d9e54]/50 rounded-xl px-4 py-3 flex justify-between items-center mb-3 shadow-[0_0_16px_rgba(45,158,84,0.12)]">
            <span className="text-[#2d9e54] font-bold text-lg">FY 2024-25</span>
            <svg className="w-5 h-5 text-[#2d9e54]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>

          {/* Other FYs */}
          {['FY 2023-24', 'FY 2022-23'].map((fy) => (
            <div key={fy} className="bg-[#091a10] border border-[#2d4a35] rounded-xl px-4 py-2.5 flex justify-between items-center mb-2 opacity-50">
              <span className="text-[#7a9183] font-medium text-sm">{fy}</span>
            </div>
          ))}
        </motion.div>

        {/* Create New FY */}
        <motion.div
          className="flex-1 bg-[#122d1e] rounded-2xl border border-[#2d4a35] p-6 flex flex-col"
          initial={{ opacity: 0, x: 36 }}
          animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 36 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        >
          <span className="text-white font-bold text-base mb-4" style={{ fontFamily: 'var(--font-display)' }}>Create New Year</span>

          <div className="bg-[#091a10] border border-[#2d4a35] rounded-xl px-4 py-3 flex items-center text-white text-lg relative mb-4">
            <span className={`${phase >= 3 ? 'opacity-0' : 'opacity-40'} absolute text-sm`}>Enter year, e.g. 2025-26</span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            >
              FY 2025-26
            </motion.span>
            {phase >= 3 && <motion.span className="w-0.5 h-5 bg-[#2d9e54] ml-1 animate-pulse" />}
          </div>

          <motion.div
            className="mt-auto w-full bg-[#2d9e54] text-white py-3 rounded-xl font-semibold flex justify-center items-center gap-2 text-sm"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : { opacity: 0.35 }}
            transition={{ delay: 0.3 }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Create Year
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
