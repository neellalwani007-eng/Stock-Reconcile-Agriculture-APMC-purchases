import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene9() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.zoomThrough}
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          className="w-32 h-32 mb-8 bg-[#064E3B] rounded-2xl flex items-center justify-center border border-[#D97706]/40 shadow-[0_0_50px_rgba(6,78,59,0.5)]"
          initial={{ scale: 0, rotate: 45, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="w-16 h-16 border-[6px] border-[#D97706] rounded flex items-center justify-center">
            <div className="w-8 h-8 bg-[#FDFBF7] rounded-sm" />
          </div>
        </motion.div>

        <motion.h1 
          className="text-[7vw] font-bold tracking-tight text-[#FDFBF7] leading-none mb-6" 
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          Stock Reconciler
        </motion.h1>

        <motion.p
          className="text-[2.5vw] text-[#94A3B8] font-medium tracking-wide"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1 }}
        >
          Your APMC Trading, <span className="text-[#D97706]">Perfectly Reconciled.</span>
        </motion.p>
      </div>
    </motion.div>
  );
}
