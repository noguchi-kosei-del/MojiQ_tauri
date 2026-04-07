import { useEffect, useRef, useState } from 'react';
import './SplashScreen.css';

declare global {
  interface Window {
    __splashInterval?: ReturnType<typeof setInterval>;
    __splashProgress?: () => number;
  }
}

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Clean up HTML splash
    if (window.__splashInterval) {
      clearInterval(window.__splashInterval);
      window.__splashInterval = undefined;
    }
    const splashStyles = document.getElementById('splash-styles');
    if (splashStyles) splashStyles.remove();

    // Inherit progress from HTML splash
    const initialProgress = window.__splashProgress ? window.__splashProgress() : 0;
    setProgress(Math.round(initialProgress));

    // Animate from current progress to 100%
    const startTime = performance.now();
    const duration = 2000;
    const startValue = initialProgress;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-in-out curve
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const current = startValue + (100 - startValue) * eased;
      setProgress(Math.round(current));

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Fade out
        setFadingOut(true);
        setTimeout(() => {
          onComplete();
        }, 400);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen${fadingOut ? ' splash-fade-out' : ''}`}>
      <div className="splash-screen-top" data-tauri-drag-region>
        <img
          src="/logo/MojiQ Pro_logo_WH.png"
          className="splash-screen-logo"
          alt="MojiQ Pro"
        />
      </div>
      <div className="splash-screen-progress-track">
        <div
          className="splash-screen-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="splash-screen-bottom">
        <div className="splash-screen-message">
          MojiQ Proを起動しています<br />
          しばらくお待ちください…
        </div>
        <div className="splash-screen-percent">{progress}%</div>
      </div>
    </div>
  );
};
