import React, { useState, useRef, useEffect } from 'react';
import { useBgOpacityStore } from '../../stores/bgOpacityStore';
import './BgOpacityPanel.css';

// 背景透過アイコン
const BgOpacityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* 四角形（背景） */}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* 斜線（透過を表現） */}
    <line x1="3" y1="21" x2="21" y2="3" />
  </svg>
);

// リセットアイコン（円形矢印）
const ResetIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const BgOpacityPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { bgOpacity, setBgOpacity, resetBgOpacity } = useBgOpacityStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBgOpacity(Number(e.target.value));
  };

  const isTransparent = bgOpacity < 100;

  return (
    <div className="bg-opacity-panel" ref={dropdownRef}>
      <button
        className={`preset-icon-btn bg-opacity-btn ${isOpen ? 'open' : ''} ${isTransparent ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="背景透過"
      >
        <BgOpacityIcon />
      </button>

      {isOpen && (
        <div className="bg-opacity-dropdown">
          <div className="bg-opacity-dropdown-header">
            <span>背景透過</span>
            <button
              className="bg-opacity-reset-btn"
              onClick={resetBgOpacity}
              disabled={bgOpacity === 100}
              title="リセット"
            >
              <ResetIcon />
            </button>
          </div>
          <div className="bg-opacity-content">
            <div className="bg-opacity-slider-container">
              <div className="bg-opacity-custom-slider">
                <div className="bg-opacity-custom-track">
                  <div
                    className="bg-opacity-custom-fill"
                    style={{ width: `${bgOpacity}%` }}
                  />
                </div>
                <div
                  className="bg-opacity-custom-thumb"
                  style={{ left: `${bgOpacity}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bgOpacity}
                  onChange={handleSliderChange}
                  className="bg-opacity-hidden-input"
                />
              </div>
              <span className="bg-opacity-value">{bgOpacity}%</span>
            </div>
            <div className="bg-opacity-labels">
              <span>透明</span>
              <span>不透明</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
