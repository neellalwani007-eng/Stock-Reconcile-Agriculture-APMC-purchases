import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1600),
      setTimeout(() => setPhase(3), 2700),
      setTimeout(() => setPhase(4), 4600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute top-10 left-12 opacity-70 z-10">
        <h2 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Step 2: Upload Ledgers</h2>
      </div>

      <div className="flex gap-6 w-full max-w-4xl px-8">
        {/* Sales Dropzone */}
        <motion.div
          className="flex-1 bg-[#122d1e] border-2 border-dashed border-[#2d4a35] rounded-2xl p-10 flex flex-col items-center justify-center relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.55 }}
        >
          {phase >= 2 && (
            <motion.div className="absolute inset-0 bg-[#2d9e54]/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
          )}
          <div className="w-16 h-16 rounded-full bg-[#091a10] flex items-center justify-center mb-4 relative z-10 border border-[#2d4a35]">
            <svg className="w-8 h-8 text-[#7a9183]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-lg text-white font-semibold mb-1 relative z-10">Sales File</h3>
          <p className="text-[#7a9183] text-sm relative z-10">Excel (.xlsx) or PDF</p>

          {phase >= 2 && (
            <motion.div
              className="absolute bottom-5 bg-[#122d1e] text-[#2d9e54] px-4 py-2 rounded-full text-sm font-medium border border-[#2d9e54]/40 flex items-center gap-2 shadow-lg"
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
          className="flex-1 bg-[#122d1e] border-2 border-dashed border-[#2d4a35] rounded-2xl p-10 flex flex-col items-center justify-center relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          {phase >= 3 && (
            <motion.div className="absolute inset-0 bg-[#2d9e54]/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
          )}
          <div className="w-16 h-16 rounded-full bg-[#091a10] flex items-center justify-center mb-4 relative z-10 border border-[#2d4a35]">
            <svg className="w-8 h-8 text-[#7a9183]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-lg text-white font-semibold mb-1 relative z-10">Purchase File</h3>
          <p className="text-[#7a9183] text-sm relative z-10">Excel (.xlsx) or PDF</p>

          {phase >= 3 && (
            <motion.div
              className="absolute bottom-5 bg-[#122d1e] text-[#2d9e54] px-4 py-2 rounded-full text-sm font-medium border border-[#2d9e54]/40 flex items-center gap-2 shadow-lg"
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
        className="mt-10 bg-[#2d9e54] text-white px-10 py-4 rounded-xl font-bold text-lg flex items-center gap-3 shadow-xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={phase >= 4
          ? { opacity: 1, scale: 1, boxShadow: '0 0 40px rgba(45,158,84,0.45)' }
          : { opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Run Reconciliation
      </motion.div>
    </motion.div>
  );
}
