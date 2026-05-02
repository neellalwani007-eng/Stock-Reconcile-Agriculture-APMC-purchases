import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute top-12 left-12 opacity-50">
        <h2 className="text-[#FDFBF7] text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Step 2: Upload Ledgers</h2>
      </div>

      <div className="flex gap-8 w-full max-w-4xl">
        {/* Sales Dropzone */}
        <motion.div 
          className="flex-1 bg-[#1E293B] border-2 border-dashed border-[#475569] rounded-2xl p-10 flex flex-col items-center justify-center relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          {phase >= 2 && (
            <motion.div 
              className="absolute inset-0 bg-[#064E3B]/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          )}
          
          <div className="w-16 h-16 rounded-full bg-[#0F172A] flex items-center justify-center mb-4 relative z-10">
            <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <h3 className="text-lg text-[#FDFBF7] font-semibold mb-1 relative z-10">Sales File</h3>
          <p className="text-[#94A3B8] text-sm relative z-10">Excel (.xlsx) or PDF</p>
          
          {phase >= 2 && (
            <motion.div 
              className="absolute bottom-6 bg-[#064E3B] text-[#10B981] px-4 py-2 rounded-full text-sm font-medium border border-[#10B981]/30 flex items-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              sales_apr25.xlsx
            </motion.div>
          )}
        </motion.div>

        {/* Purchase Dropzone */}
        <motion.div 
          className="flex-1 bg-[#1E293B] border-2 border-dashed border-[#475569] rounded-2xl p-10 flex flex-col items-center justify-center relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {phase >= 3 && (
            <motion.div 
              className="absolute inset-0 bg-[#064E3B]/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          )}
          
          <div className="w-16 h-16 rounded-full bg-[#0F172A] flex items-center justify-center mb-4 relative z-10">
            <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <h3 className="text-lg text-[#FDFBF7] font-semibold mb-1 relative z-10">Purchase File</h3>
          <p className="text-[#94A3B8] text-sm relative z-10">Excel (.xlsx) or PDF</p>

          {phase >= 3 && (
            <motion.div 
              className="absolute bottom-6 bg-[#064E3B] text-[#10B981] px-4 py-2 rounded-full text-sm font-medium border border-[#10B981]/30 flex items-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              purchase_apr25.pdf
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Run Button */}
      <motion.div 
        className="mt-12 bg-[#D97706] text-[#0F172A] px-8 py-4 rounded-xl font-bold text-lg shadow-[0_0_30px_rgba(217,119,6,0.3)] flex items-center gap-3"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={phase >= 4 ? { opacity: 1, scale: 1, boxShadow: '0 0 40px rgba(217,119,6,0.6)' } : { opacity: 0, scale: 0.9 }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Run Reconciliation
      </motion.div>
    </motion.div>
  );
}
