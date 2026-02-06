import React from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import './Toolbar.css';

// SVG Icons
// Delete icon
const DeleteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h12"/>
    <path d="M7 5V3h4v2"/>
    <path d="M5 5l1 10h6l1-10"/>
  </svg>
);

export const Toolbar: React.FC = () => {
  const {
    deleteSelectedStrokes,
    hasSelection,
  } = useDrawingStore();

  const { isToolbarCollapsed } = useSidebarStore();

  const isAnythingSelected = hasSelection();

  // 折りたたみ時は非表示
  if (isToolbarCollapsed) {
    return null;
  }

  // 選択がない場合はツールバー自体を非表示
  if (!isAnythingSelected) {
    return null;
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          onClick={deleteSelectedStrokes}
          title="選択を削除 (Delete)"
          className="delete-btn"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
};
