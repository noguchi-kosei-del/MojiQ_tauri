import React, { useState, useRef, useEffect } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import './LayerPanel.css';

// SVG Icons
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <path d="M1 1l22 22"/>
    <path d="M10.59 10.59a3 3 0 1 0 4.24 4.24"/>
  </svg>
);

const AddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h12"/>
    <path d="M7 5V3h4v2"/>
    <path d="M5 5l1 10h6l1-10"/>
  </svg>
);

const LayersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);

export const LayerPanel: React.FC = () => {
  const {
    pages,
    currentPage,
    currentLayerId,
    addLayer,
    removeLayer,
    setCurrentLayer,
    toggleLayerVisibility,
    setLayerOpacity,
  } = useDrawingStore();

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { isFlipped } = useWorkspaceStore();

  const currentPageState = pages[currentPage];

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!currentPageState) return null;

  const layers = currentPageState.layers;

  return (
    <div className={`layer-panel-container ${isFlipped ? 'flipped' : ''}`}>
      <button
        ref={buttonRef}
        className={`layer-panel-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="レイヤー"
      >
        <LayersIcon />
      </button>

      {isOpen && (
        <div className={`layer-panel-popup ${isFlipped ? 'flipped' : ''}`} ref={panelRef}>
          <div className="layer-panel-header">
            <span>レイヤー</span>
            <button onClick={addLayer} title="レイヤーを追加">
              <AddIcon />
            </button>
          </div>
          <div className="layer-list">
            {[...layers].reverse().map((layer) => (
              <div
                key={layer.id}
                className={`layer-item ${layer.id === currentLayerId ? 'active' : ''}`}
                onClick={() => setCurrentLayer(layer.id)}
              >
                <button
                  className="visibility-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisibility(layer.id);
                  }}
                  title={layer.visible ? '非表示' : '表示'}
                >
                  {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <span className="layer-name">{layer.name}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={layer.opacity}
                  onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  title="透明度"
                  className="opacity-slider"
                />
                {layers.length > 1 && (
                  <button
                    className="delete-layer"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    title="レイヤーを削除"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
