import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.slideUp}
    >
      {/* Background Row Context */}
      <div className="absolute top-1/4 w-full max-w-4xl opacity-30">
         <div className="grid grid-cols-6 gap-4 p-4 items-center rounded-lg bg-[#1E293B] border border-[#475569]">
          <div>14 Apr 25</div>
          <div>Corn</div>
          <div>100</div>
          <div>₹1,800</div>
          <div>₹1,80,000</div>
          <div>Pending</div>
        </div>
      </div>

      {/* Edit Modal */}
      <motion.div 
        className="w-[500px] bg-[#1E293B] rounded-2xl border border-[#475569] shadow-2xl overflow-hidden flex flex-col relative z-20"
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={phase >= 1 && phase < 4 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: -40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="px-6 py-4 border-b border-[#475569] bg-[#0F172A] flex justify-between items-center">
          <h3 className="text-[#FDFBF7] font-semibold text-lg">Edit Record</h3>
          <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Date</label>
              <div className="w-full bg-[#0F172A] border border-[#475569] rounded-lg px-3 py-2 text-[#FDFBF7] text-sm">14 Apr 2025</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Item Name</label>
              <div className="w-full bg-[#0F172A] border border-[#475569] rounded-lg px-3 py-2 text-[#FDFBF7] text-sm flex items-center relative overflow-hidden">
                <motion.span 
                  className="absolute"
                  animate={{ y: phase >= 2 ? -30 : 0, opacity: phase >= 2 ? 0 : 1 }}
                >
                  Corn
                </motion.span>
                <motion.span 
                  className="absolute text-[#10B981] font-bold"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: phase >= 2 ? 0 : 30, opacity: phase >= 2 ? 1 : 0 }}
                >
                  Maize
                </motion.span>
                {/* spacer */}
                <span className="opacity-0">Maize</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Qty</label>
              <div className="w-full bg-[#0F172A] border border-[#475569] rounded-lg px-3 py-2 text-[#FDFBF7] text-sm">100</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Rate</label>
              <div className="w-full bg-[#0F172A] border border-[#475569] rounded-lg px-3 py-2 text-[#FDFBF7] text-sm">1800</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Amount</label>
              <div className="w-full bg-[#0F172A] border border-[#475569] rounded-lg px-3 py-2 text-[#FDFBF7] text-sm">180000</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#475569] bg-[#0F172A]/50 flex justify-end gap-3">
          <div className="px-4 py-2 rounded-lg text-sm font-medium text-[#94A3B8] border border-[#475569]">Cancel</div>
          <motion.div 
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#D97706] text-[#0F172A] relative overflow-hidden"
            animate={phase >= 3 ? { scale: 0.95 } : { scale: 1 }}
            transition={{ duration: 0.1 }}
          >
            {phase >= 3 && <motion.div className="absolute inset-0 bg-white/30" initial={{ opacity: 1 }} animate={{ opacity: 0 }} />}
            Save Changes
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
