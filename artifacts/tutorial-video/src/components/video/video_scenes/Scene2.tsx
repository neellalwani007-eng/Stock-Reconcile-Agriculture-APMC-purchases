import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 2200),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 5500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.slideLeft}
    >
      {/* Real app screenshot as background reference, dimmed */}
      <img
        src="/tutorial-video/screenshots/login.jpg"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.18, filter: 'blur(2px) saturate(0.8)' }}
      />

      <div className="absolute top-10 left-12 z-10 opacity-70">
        <h2 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Step 1: Sign In</h2>
      </div>

      {/* Phase 1: Feature card overview (real app layout) */}
      <motion.div
        className="absolute z-20 w-[560px] flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={phase >= 1 && phase < 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.93, y: -20, pointerEvents: 'none' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-[#1a4731] rounded-2xl flex items-center justify-center mb-4 border border-white/10 shadow-xl">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m17 4 4 4-4 4" /><path d="M3 8h18" /><path d="m7 20-4-4 4-4" /><path d="M21 16H3" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>Stock Reconciler</h3>
          <p className="text-[#7a9183] text-sm">Automate reconciliation in seconds</p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          {[
            { title: '1-to-1 Matching', sub: 'Every sale matched to exact purchase lot' },
            { title: 'Per-user Data', sub: 'Your data, only visible to you' },
            { title: 'Excel Export', sub: '6 ready-to-use report formats' },
          ].map((c, i) => (
            <div key={i} className="bg-[#122d1e] border border-[#2d4a35] rounded-xl p-3 flex flex-col items-center text-center gap-2">
              <svg className="w-5 h-5 text-[#2d9e54]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-white text-xs font-semibold">{c.title}</span>
              <span className="text-[#7a9183] text-[10px]">{c.sub}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Phase 2-3: Sign-in card (matches real app exactly) */}
      <motion.div
        className="absolute z-20 w-[440px] bg-[#122d1e] rounded-2xl border border-[#2d4a35] shadow-2xl overflow-hidden flex flex-col items-center p-8"
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={phase >= 2 && phase < 4 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.93, y: 20, pointerEvents: 'none' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <h3 className="text-xl text-white font-semibold mb-6">Sign in to continue</h3>

        {/* T&C row */}
        <div className="w-full flex items-start gap-3 mb-6 bg-[#091a10] border border-[#2d4a35] rounded-xl p-4">
          <motion.div
            className="w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0"
            animate={phase >= 3
              ? { borderColor: '#2d9e54', backgroundColor: '#2d9e54' }
              : { borderColor: '#2d4a35', backgroundColor: 'transparent' }}
          >
            {phase >= 3 && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            )}
          </motion.div>
          <span className="text-[#7a9183] text-sm">
            I have read and agree to the{' '}
            <span className="text-[#2d9e54] underline underline-offset-2">Terms & Conditions and Privacy Policy</span>
          </span>
        </div>

        {/* Google button */}
        <motion.div
          className="w-full flex items-center justify-center gap-3 bg-white/90 text-[#0d2818] py-3.5 rounded-xl font-semibold text-sm cursor-pointer relative overflow-hidden"
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0.45, y: 4 }}
          transition={{ duration: 0.3 }}
        >
          {phase >= 3 && (
            <motion.div className="absolute inset-0 bg-white/30" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.4 }} />
          )}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </motion.div>

        {phase < 3 && (
          <p className="text-[#7a9183] text-xs mt-3">Please tick the checkbox above to continue</p>
        )}
      </motion.div>
    </motion.div>
  );
}
