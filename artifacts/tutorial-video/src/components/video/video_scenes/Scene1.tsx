import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

function AppLogo({ size = 96 }: { size?: number }) {
  const icon = Math.round(size * 0.46);
  return (
    <div
      style={{ width: size, height: size }}
      className="bg-[#1a4731] rounded-2xl flex items-center justify-center shadow-2xl border border-white/10"
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m17 4 4 4-4 4" /><path d="M3 8h18" /><path d="m7 20-4-4 4-4" /><path d="M21 16H3" />
      </svg>
    </div>
  );
}

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
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d2818]"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.fadeBlur}
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          className="mb-8"
          initial={{ scale: 0, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <AppLogo size={96} />
        </motion.div>

        <h1
          className="text-[6vw] font-bold tracking-tight text-white leading-none mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
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
          className="text-[2vw] text-[#7a9183] font-medium tracking-wide"
          initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
          animate={phase >= 2 ? { opacity: 1, filter: 'blur(0px)', y: 0 } : { opacity: 0, filter: 'blur(10px)', y: 20 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          Automate reconciliation in seconds
        </motion.p>

        <motion.div
          className="mt-10 flex gap-8"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          {['1-to-1 Matching', 'Per-user Data', 'Excel Export'].map((feat, i) => (
            <motion.div
              key={feat}
              className="flex items-center gap-2 bg-[#122d1e] border border-[#2d4a35] rounded-xl px-4 py-2"
              initial={{ opacity: 0, y: 10 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ delay: i * 0.12, duration: 0.4 }}
            >
              <svg className="w-4 h-4 text-[#2d9e54]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-white text-sm font-medium">{feat}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
