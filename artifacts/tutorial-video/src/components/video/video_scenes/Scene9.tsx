import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene9() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.zoomThrough}
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Real app logo */}
        <motion.div
          className="w-32 h-32 bg-[#1a4731] rounded-2xl flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_60px_rgba(45,158,84,0.3)]"
          initial={{ scale: 0, rotate: 20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m17 4 4 4-4 4" /><path d="M3 8h18" /><path d="m7 20-4-4 4-4" /><path d="M21 16H3" />
          </svg>
        </motion.div>

        <motion.h1
          className="text-[7vw] font-bold tracking-tight text-white leading-none mb-5"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        >
          Stock Reconciler
        </motion.h1>

        <motion.p
          className="text-[2.2vw] text-[#7a9183] font-medium"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.9 }}
        >
          Your Stock,{' '}
          <span className="text-[#2d9e54] font-semibold">Perfectly Reconciled.</span>
        </motion.p>

        <motion.div
          className="mt-10 flex gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6 }}
        >
          {['Upload Ledgers', 'Auto-Match', 'Export Reports'].map((step, i) => (
            <motion.div
              key={step}
              className="flex items-center gap-2.5 bg-[#122d1e] border border-[#2d4a35] rounded-full px-5 py-2"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              transition={{ delay: i * 0.12 }}
            >
              <span className="w-5 h-5 rounded-full bg-[#2d9e54] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-white text-sm font-medium">{step}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
