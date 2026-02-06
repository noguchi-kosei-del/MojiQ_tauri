import React, { useState, useRef, useEffect } from 'react';
import './MemoPanel.css';

// SVGアイコン
const MemoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
);

const ClearIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const MEMO_STORAGE_KEY = 'mojiq_memo';

export const MemoPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [memo, setMemo] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 初期化時にローカルストレージから読み込み
  useEffect(() => {
    const savedMemo = localStorage.getItem(MEMO_STORAGE_KEY);
    if (savedMemo) {
      setMemo(savedMemo);
    }
  }, []);

  // メモ変更時にローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(MEMO_STORAGE_KEY, memo);
  }, [memo]);

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

  // 開いた時にフォーカス
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleClear = () => {
    setMemo('');
  };

  return (
    <div className="memo-panel" ref={dropdownRef}>
      <button
        className={`preset-icon-btn memo-btn ${isOpen ? 'open' : ''} ${memo.trim() ? 'has-content' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="メモ"
      >
        <MemoIcon />
        {memo.trim() && <span className="memo-badge">!</span>}
      </button>

      {isOpen && (
        <div className="memo-dropdown">
          <div className="memo-dropdown-header">
            <span>メモ</span>
            <button
              className="memo-clear-btn"
              onClick={handleClear}
              disabled={!memo.trim()}
              title="クリア"
            >
              <ClearIcon />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="memo-textarea"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="メモを入力..."
          />
        </div>
      )}
    </div>
  );
};
