import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 5500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute top-12 left-12 opacity-50">
        <h2 className="text-[#FDFBF7] text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Step 1: Secure Login</h2>
      </div>

      {/* Step 1: Google Login */}
      <motion.div 
        className="w-[400px] bg-[#1E293B] rounded-2xl border border-[#475569] shadow-2xl overflow-hidden flex flex-col items-center p-8 absolute"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={phase >= 1 && phase < 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: -20, pointerEvents: 'none' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-16 h-16 bg-[#064E3B] rounded-full flex items-center justify-center mb-6">
          <div className="w-8 h-8 border-2 border-[#D97706] rounded-sm" />
        </div>
        <h3 className="text-xl text-[#FDFBF7] font-semibold mb-2">Welcome Back</h3>
        <p className="text-[#94A3B8] text-sm mb-8 text-center">Sign in to access your reconciliation dashboard</p>
        
        <div className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] text-[#0F172A] py-3 rounded-lg font-medium">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Sign in with Google
        </div>
      </motion.div>

      {/* Step 2: T&C */}
      <motion.div 
        className="w-[500px] bg-[#1E293B] rounded-2xl border border-[#475569] shadow-2xl overflow-hidden flex flex-col items-center p-8 absolute"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={phase >= 2 && phase < 4 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: -20, pointerEvents: 'none' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h3 className="text-xl text-[#FDFBF7] font-semibold mb-4 w-full">Terms & Conditions</h3>
        <div className="w-full h-32 bg-[#0F172A] rounded-lg border border-[#475569] p-4 mb-6 overflow-hidden">
          <div className="w-full h-2 bg-[#475569]/30 rounded-full mb-3" />
          <div className="w-3/4 h-2 bg-[#475569]/30 rounded-full mb-3" />
          <div className="w-5/6 h-2 bg-[#475569]/30 rounded-full mb-3" />
          <div className="w-full h-2 bg-[#475569]/30 rounded-full mb-3" />
          <div className="w-1/2 h-2 bg-[#475569]/30 rounded-full" />
        </div>
        
        <div className="w-full flex items-center gap-3 mb-6">
          <motion.div 
            className="w-5 h-5 rounded border-2 border-[#D97706] flex items-center justify-center bg-[#D97706]"
            initial={{ scale: 0 }}
            animate={phase >= 3 ? { scale: 1 } : { scale: 0 }}
          >
            <svg className="w-3 h-3 text-[#0F172A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </motion.div>
          <span className="text-[#94A3B8] text-sm">I accept the trading terms and conditions</span>
        </div>

        <motion.div 
          className="w-full flex items-center justify-center gap-3 bg-[#064E3B] text-[#FDFBF7] py-3 rounded-lg font-medium"
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 5 }}
        >
          Continue to Dashboard
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
