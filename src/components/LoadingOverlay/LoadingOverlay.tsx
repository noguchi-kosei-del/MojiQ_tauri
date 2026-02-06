import React from 'react';
import { useLoadingStore } from '../../stores/loadingStore';
import './LoadingOverlay.css';

export const LoadingOverlay: React.FC = () => {
  const { isLoading, progress, message } = useLoadingStore();

  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <div className="loading-text">{message || '読み込み中...'}</div>
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="progress-text">{Math.round(progress)}%</div>
      </div>
    </div>
  );
};
