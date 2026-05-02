import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video';

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 2600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const reports = [
    { title: 'Matched Sales', icon: 'S', color: '#2d9e54' },
    { title: 'Unmatched Sales', icon: 'U', color: '#ef4444' },
    { title: 'Matched Purchases', icon: 'P', color: '#3B82F6' },
    { title: 'Unmatched Purchases', icon: 'U', color: '#f5a41a' },
    { title: 'Full Summary', icon: 'F', color: '#8B5CF6' },
    { title: 'Date-wise', icon: 'D', color: '#06B6D4' },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(to bottom, #0d2818, #1a4731 50%, #0d2818)' }}
      {...sceneTransitions.fadeBlur}
    >
      <h2
        className="text-white text-3xl font-bold mb-3"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Export Reports
      </h2>
      <p className="text-[#7a9183] text-sm mb-10">6 formats — download any time as Excel (.xlsx)</p>

      <div className="grid grid-cols-3 gap-4 w-full max-w-3xl px-6 relative z-10">
        {reports.map((report, i) => (
          <motion.div
            key={i}
            className="bg-[#122d1e] border border-[#2d4a35] rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:border-[#2d9e54]/50"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
            transition={{ delay: i * 0.09, type: 'spring', stiffness: 280, damping: 22 }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
              style={{ backgroundColor: report.color + '22', border: `1px solid ${report.color}44` }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={report.color} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <span className="text-white text-sm font-semibold block">{report.title}</span>
              <span className="text-[#7a9183] text-xs">Download .xlsx</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Download animation */}
      {phase >= 2 && (
        <motion.div
          className="absolute z-20 flex flex-col items-center"
          initial={{ y: '-60%', opacity: 0, scale: 0.6 }}
          animate={{ y: 0, opacity: 1, scale: 1.3 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        >
          <div className="w-20 h-24 bg-[#2d9e54] rounded-xl shadow-2xl flex flex-col items-center justify-center border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1/4 bg-white/15" />
            <svg className="w-8 h-8 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="text-white font-bold text-sm">XLSX</span>
          </div>
          <motion.div
            className="mt-3 bg-[#122d1e] text-[#2d9e54] px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border border-[#2d9e54]/30"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            Downloaded
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
