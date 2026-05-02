import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2100),
      setTimeout(() => setPhase(3), 3800),
      setTimeout(() => setPhase(4), 5200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.slideUp}
    >
      {/* Dimmed row context */}
      <div className="absolute top-[30%] w-full max-w-3xl px-12 opacity-25">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 items-center rounded-xl bg-[#122d1e] border border-[#2d4a35]">
          <div className="text-white text-sm">14 Apr 25</div>
          <div className="text-white text-sm">Corn</div>
          <div className="text-white text-sm">100</div>
          <div className="text-white text-sm">₹1,800</div>
          <div className="text-white text-sm">₹1,80,000</div>
          <div className="text-[#f5a41a] text-xs">Pending</div>
        </div>
      </div>

      {/* Edit modal */}
      <motion.div
        className="w-[520px] bg-[#122d1e] rounded-2xl border border-[#2d4a35] shadow-2xl overflow-hidden flex flex-col relative z-20"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={phase >= 1 && phase < 4
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 0, scale: 0.92, y: -30 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      >
        <div className="px-6 py-4 border-b border-[#2d4a35] bg-[#091a10] flex justify-between items-center">
          <h3 className="text-white font-semibold text-base" style={{ fontFamily: 'var(--font-display)' }}>Edit Purchase Record</h3>
          <svg className="w-5 h-5 text-[#7a9183] cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#7a9183] mb-1.5">Date</label>
              <div className="w-full bg-[#091a10] border border-[#2d4a35] rounded-xl px-3 py-2.5 text-white text-sm">14 Apr 2025</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7a9183] mb-1.5">Item Name</label>
              <div className="w-full bg-[#091a10] border border-[#2d4a35] rounded-xl px-3 py-2.5 text-white text-sm flex items-center relative overflow-hidden h-10">
                <motion.span
                  className="absolute left-3"
                  animate={{ y: phase >= 2 ? -30 : 0, opacity: phase >= 2 ? 0 : 1 }}
                  transition={{ duration: 0.25 }}
                >
                  Corn
                </motion.span>
                <motion.span
                  className="absolute left-3 text-[#2d9e54] font-semibold"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: phase >= 2 ? 0 : 30, opacity: phase >= 2 ? 1 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  Maize
                </motion.span>
                <span className="opacity-0 text-sm">Maize</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[{ label: 'Qty (Qtl)', val: '100' }, { label: 'Rate (₹)', val: '1,800' }, { label: 'Amount (₹)', val: '1,80,000' }].map((f) => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-[#7a9183] mb-1.5">{f.label}</label>
                <div className="w-full bg-[#091a10] border border-[#2d4a35] rounded-xl px-3 py-2.5 text-white text-sm">{f.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#2d4a35] bg-[#091a10]/60 flex justify-end gap-3">
          <div className="px-4 py-2 rounded-xl text-sm font-medium text-[#7a9183] border border-[#2d4a35] cursor-pointer">Cancel</div>
          <motion.div
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#2d9e54] text-white cursor-pointer relative overflow-hidden"
            animate={phase >= 3 ? { scale: 0.95 } : { scale: 1 }}
            transition={{ duration: 0.1 }}
          >
            {phase >= 3 && <motion.div className="absolute inset-0 bg-white/25" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />}
            Save Changes
          </motion.div>
        </div>
      </motion.div>

      {/* Success toast */}
      {phase >= 4 && (
        <motion.div
          className="absolute bottom-12 right-12 z-30 bg-[#122d1e] border border-[#2d9e54]/40 rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl"
          initial={{ opacity: 0, x: 60, y: 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          <svg className="w-5 h-5 text-[#2d9e54]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span className="text-white text-sm font-medium">Record updated successfully</span>
        </motion.div>
      )}
    </motion.div>
  );
}
