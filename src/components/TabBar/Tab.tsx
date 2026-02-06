import React, { useRef } from 'react';

interface TabProps {
  id: string;
  title: string;
  isActive: boolean;
  isModified: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}

// 閉じるボタンアイコン
const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const Tab: React.FC<TabProps> = ({
  id,
  title,
  isActive,
  isModified,
  onActivate,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}) => {
  const tabRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    onActivate(id);
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(id, e);
  };

  const handleMiddleClick = (e: React.MouseEvent) => {
    // 中クリックでタブを閉じる
    if (e.button === 1) {
      e.preventDefault();
      onClose(id, e);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(e, id);
  };

  // タイトルを短縮（長すぎる場合）
  const displayTitle = title.length > 20 ? title.substring(0, 17) + '...' : title;

  return (
    <div
      ref={tabRef}
      className={`tab ${isActive ? 'active' : ''} ${isModified ? 'modified' : ''} ${isDragOver ? 'drop-target' : ''}`}
      onClick={handleClick}
      onMouseDown={handleMiddleClick}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      title={title}
    >
      <span className="tab-title">{displayTitle}</span>
      {isModified && <span className="tab-modified-indicator" title="未保存の変更があります"></span>}
      <button
        className="tab-close-btn"
        onClick={handleCloseClick}
        title="タブを閉じる"
      >
        <CloseIcon />
      </button>
    </div>
  );
};
