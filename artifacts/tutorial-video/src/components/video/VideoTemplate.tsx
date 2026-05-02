import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';
import { Scene9 } from './video_scenes/Scene9';

export const SCENE_DURATIONS: Record<string, number> = {
  scene1: 5000,
  scene2: 6000,
  scene3: 7000,
  scene4: 8000,
  scene5: 7000,
  scene6: 7000,
  scene7: 6000,
  scene8: 6000,
  scene9: 5000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  scene1: Scene1,
  scene2: Scene2,
  scene3: Scene3,
  scene4: Scene4,
  scene5: Scene5,
  scene6: Scene6,
  scene7: Scene7,
  scene8: Scene8,
  scene9: Scene9,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#1E293B] text-[#FDFBF7]">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[80px] opacity-20"
          style={{ background: 'radial-gradient(circle, #064E3B, transparent)' }}
          animate={{
            x: ['-20%', '30%', '-10%'],
            y: ['-10%', '20%', '-20%'],
            scale: [1, 1.2, 0.9],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-0 bottom-0 w-[60vw] h-[60vw] rounded-full blur-[80px] opacity-10"
          style={{ background: 'radial-gradient(circle, #D97706, transparent)' }}
          animate={{
            x: ['20%', '-30%', '10%'],
            y: ['10%', '-40%', '0%'],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      {/* suppress unused warning */}
      <span style={{ display: 'none' }}>{sceneIndex}</span>
    </div>
  );
}
