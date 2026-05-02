import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.fadeBlur}
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          className="w-24 h-24 mb-8 bg-[#064E3B] rounded-xl flex items-center justify-center border border-[#D97706]/30 shadow-2xl"
          initial={{ scale: 0, rotate: -45, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="w-12 h-12 border-4 border-[#D97706] rounded-sm flex items-center justify-center">
            <div className="w-6 h-6 bg-[#FDFBF7] rounded-sm" />
          </div>
        </motion.div>

        <h1 className="text-[6vw] font-bold tracking-tight text-[#FDFBF7] leading-none mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          {'Stock Reconciler'.split('').map((char, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, y: 40 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ delay: phase >= 1 ? i * 0.05 : 0, type: 'spring', stiffness: 400, damping: 30 }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </h1>

        <motion.p
          className="text-[2vw] text-[#D97706] font-medium tracking-wide uppercase"
          initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
          animate={phase >= 2 ? { opacity: 1, filter: 'blur(0px)', y: 0 } : { opacity: 0, filter: 'blur(10px)', y: 20 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          APMC Trading, Reconciled.
        </motion.p>
      </div>
    </motion.div>
  );
}
