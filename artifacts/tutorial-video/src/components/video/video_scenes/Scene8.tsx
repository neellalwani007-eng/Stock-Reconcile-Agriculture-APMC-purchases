import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene8() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.slideRight}
    >
      <h2 className="text-[#FDFBF7] text-3xl font-bold mb-12" style={{ fontFamily: 'var(--font-display)' }}>Manage Financial Years</h2>

      <div className="w-full max-w-2xl flex gap-8">
        {/* FY Switcher */}
        <motion.div 
          className="flex-1 bg-[#1E293B] rounded-2xl border border-[#475569] p-6 flex flex-col"
          initial={{ opacity: 0, x: -40 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
        >
          <span className="text-[#94A3B8] text-sm mb-4">Current Active Year</span>
          <div className="bg-[#0F172A] border border-[#D97706] rounded-xl px-4 py-3 flex justify-between items-center text-[#D97706] font-bold text-xl">
            FY 2024-25
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>

          <div className="mt-4 flex flex-col gap-2 opacity-50">
            <div className="bg-[#0F172A] border border-[#475569] rounded-xl px-4 py-3 flex justify-between items-center text-[#94A3B8] font-medium">
              FY 2023-24
            </div>
            <div className="bg-[#0F172A] border border-[#475569] rounded-xl px-4 py-3 flex justify-between items-center text-[#94A3B8] font-medium">
              FY 2022-23
            </div>
          </div>
        </motion.div>

        {/* Create New FY */}
        <motion.div 
          className="flex-1 bg-[#1E293B] rounded-2xl border border-[#475569] p-6 flex flex-col"
          initial={{ opacity: 0, x: 40 }}
          animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
        >
          <span className="text-[#FDFBF7] text-lg font-bold mb-4">Create New Year</span>
          <div className="bg-[#0F172A] border border-[#475569] rounded-xl px-4 py-3 flex items-center text-[#FDFBF7] text-xl relative">
            <span className="opacity-50 absolute">Enter year...</span>
            <motion.span 
              initial={{ opacity: 0 }}
              animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            >
              FY 2025-26
            </motion.span>
            {phase >= 3 && <motion.span className="w-0.5 h-6 bg-[#D97706] ml-1 animate-pulse" />}
          </div>
          
          <motion.div 
            className="mt-auto w-full bg-[#064E3B] text-[#FDFBF7] py-3 rounded-xl font-bold flex justify-center items-center gap-2"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.5 }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Create Year
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
