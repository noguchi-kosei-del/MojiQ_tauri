import React, { useState, useEffect, useRef } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import './HistoryPanel.css';

// 履歴アイコン
const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const HistoryPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { history, historyIndex, undo, redo, currentPage } = useDrawingStore();

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

  // 履歴エントリのラベルを生成
  const getHistoryLabel = (index: number): string => {
    if (index === 0) return '初期状態';
    return `操作 ${index}`;
  };

  // 履歴エントリをクリックした時の処理
  const handleHistoryClick = (targetIndex: number) => {
    if (targetIndex === historyIndex) return;

    // 目標のインデックスに向かってundo/redoを繰り返す
    const diff = targetIndex - historyIndex;
    if (diff < 0) {
      // 過去に戻る
      for (let i = 0; i < Math.abs(diff); i++) {
        undo();
      }
    } else {
      // 未来に進む
      for (let i = 0; i < diff; i++) {
        redo();
      }
    }
  };

  // 表示用の履歴リスト（新しい順に表示）
  const displayHistory = [...history].map((_, index) => ({
    index,
    label: getHistoryLabel(index),
    isCurrent: index === historyIndex,
  })).reverse();

  return (
    <div className="history-panel" ref={dropdownRef}>
      <button
        className="history-icon-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="作業履歴"
      >
        <HistoryIcon />
        {history.length > 1 && (
          <span className="history-badge">{historyIndex + 1}/{history.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="history-dropdown">
          <div className="history-dropdown-header">
            作業履歴 (ページ {currentPage + 1})
          </div>
          <div className="history-list">
            {displayHistory.length === 0 ? (
              <div className="history-empty">履歴がありません</div>
            ) : (
              displayHistory.map((item) => (
                <button
                  key={item.index}
                  className={`history-item ${item.isCurrent ? 'current' : ''}`}
                  onClick={() => handleHistoryClick(item.index)}
                >
                  <span className="history-item-index">{item.index + 1}</span>
                  <span className="history-item-label">{item.label}</span>
                  {item.isCurrent && <span className="history-item-current-badge">現在</span>}
                </button>
              ))
            )}
          </div>
          <div className="history-footer">
            <span className="history-count">{history.length} 件の履歴</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
