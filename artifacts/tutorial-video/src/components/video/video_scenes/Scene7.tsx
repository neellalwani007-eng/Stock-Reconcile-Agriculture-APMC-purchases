import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const reports = [
    { title: "Matched Sales", icon: "S" },
    { title: "Unmatched Sales", icon: "U" },
    { title: "Matched Purchases", icon: "P" },
    { title: "Unmatched Purchases", icon: "U" },
    { title: "Full Summary", icon: "F" },
    { title: "Date-wise", icon: "D" },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]"
      {...sceneTransitions.fadeBlur}
    >
      <h2 className="text-[#FDFBF7] text-3xl font-bold mb-12" style={{ fontFamily: 'var(--font-display)' }}>Export Reports</h2>

      <div className="grid grid-cols-3 gap-6 w-full max-w-4xl relative z-10">
        {reports.map((report, i) => (
          <motion.div
            key={i}
            className="bg-[#1E293B] border border-[#475569] rounded-xl p-6 flex flex-col items-center gap-4 hover:border-[#D97706] cursor-pointer"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
          >
            <div className="w-12 h-12 rounded-lg bg-[#0F172A] border border-[#475569] flex items-center justify-center text-[#94A3B8] font-bold text-xl">
              {report.icon}
            </div>
            <span className="text-[#FDFBF7] font-medium">{report.title}</span>
          </motion.div>
        ))}
      </div>

      {/* Excel Download Animation */}
      {phase >= 2 && (
        <motion.div
          className="absolute z-20 flex flex-col items-center"
          initial={{ y: -200, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1.5 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <div className="w-20 h-24 bg-[#10B981] rounded-lg shadow-2xl flex items-center justify-center border-2 border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1/4 bg-white/20" />
            <span className="text-white font-bold text-2xl" style={{ fontFamily: 'var(--font-display)' }}>XLSX</span>
          </div>
          <motion.div 
            className="mt-4 bg-[#064E3B] text-[#10B981] px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase border border-[#10B981]/30"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Downloaded
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
