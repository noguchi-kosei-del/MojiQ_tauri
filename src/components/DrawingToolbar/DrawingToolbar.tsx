import React from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import './DrawingToolbar.css';

// 折りたたみボタンアイコン
const CollapseLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ExpandLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// SVG Icons (80% size: 16x16)
const SelectIcon = () => (
  <svg width="16" height="16" viewBox="0 -1 16 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1v14"/>
    <path d="M1 8h14"/>
    <path d="M8 1l-2 2"/>
    <path d="M8 1l2 2"/>
    <path d="M8 15l-2-2"/>
    <path d="M8 15l2-2"/>
    <path d="M1 8l2-2"/>
    <path d="M1 8l2 2"/>
    <path d="M15 8l-2-2"/>
    <path d="M15 8l-2 2"/>
  </svg>
);

const PenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3 L21 7 L8 20 L4 20 L4 16 Z"/>
    <line x1="14" y1="6" x2="18" y2="10"/>
  </svg>
);

const EraserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 15h8"/>
    <path d="M3 11l4 4 8-8-4-4z"/>
  </svg>
);

const RectIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  </svg>
);

const EllipseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="12" rx="10" ry="7"/>
  </svg>
);

const LineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5"/>
    <polyline points="10 5 19 5 19 14"/>
  </svg>
);

const DoubleArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5"/>
    <polyline points="10 5 19 5 19 14"/>
    <polyline points="14 19 5 19 5 10"/>
  </svg>
);

const PolylineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 18 8 10 14 14 20 6"/>
    <circle cx="4" cy="18" r="2" fill="currentColor"/>
    <circle cx="8" cy="10" r="2" fill="currentColor"/>
    <circle cx="14" cy="14" r="2" fill="currentColor"/>
    <circle cx="20" cy="6" r="2" fill="currentColor"/>
  </svg>
);

const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="14" height="12" rx="1"/>
    <circle cx="6" cy="7" r="1.5"/>
    <path d="M16 12l-4-4-6 6"/>
  </svg>
);

// +テキスト付きアイコン（枠線 + 引出線 + T）
const RectAnnotatedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="12" height="10" rx="1"/>
    <line x1="14" y1="11" x2="20" y2="5"/>
    <circle cx="20" cy="5" r="1.5" fill="currentColor"/>
    <text x="19" y="19" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">T</text>
  </svg>
);

const EllipseAnnotatedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="8" cy="12" rx="6" ry="4"/>
    <line x1="14" y1="10" x2="20" y2="5"/>
    <circle cx="20" cy="5" r="1.5" fill="currentColor"/>
    <text x="19" y="19" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">T</text>
  </svg>
);

const LineAnnotatedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="16" x2="14" y2="8"/>
    <line x1="14" y1="8" x2="20" y2="4"/>
    <circle cx="20" cy="4" r="1.5" fill="currentColor"/>
    <text x="19" y="19" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">T</text>
  </svg>
);

const MarkerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 3L6 15l-2 6 6-2L22 7z"/>
    <path d="M15 6l3 3"/>
  </svg>
);

const PanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
  </svg>
);

const TextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);

export const DrawingToolbar: React.FC = () => {
  const { tool, setTool } = useDrawingStore();
  const { isToolbarCollapsed, toggleToolbar } = useSidebarStore();

  return (
    <div className={`drawing-toolbar ${isToolbarCollapsed ? 'collapsed' : ''}`}>
      <div className="drawing-toolbar-header">
        <button
          className="sidebar-toggle-btn"
          onClick={toggleToolbar}
          title={isToolbarCollapsed ? 'ツールバーを展開' : 'ツールバーを折り畳む'}
        >
          {isToolbarCollapsed ? <ExpandLeftIcon /> : <CollapseLeftIcon />}
        </button>
      </div>
      {!isToolbarCollapsed && (
        <div className="drawing-toolbar-content">
          <button
            onClick={() => setTool('select')}
            className={tool === 'select' ? 'active' : ''}
            title="選択 (V)"
          >
            <SelectIcon />
          </button>
          <button
            onClick={() => setTool('pen')}
            className={tool === 'pen' ? 'active' : ''}
            title="ペン (P)"
          >
            <PenIcon />
          </button>
          <button
            onClick={() => setTool('marker')}
            className={tool === 'marker' ? 'active' : ''}
            title="マーカー (M)"
          >
            <MarkerIcon />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={tool === 'eraser' ? 'active' : ''}
            title="消しゴム (E)"
          >
            <EraserIcon />
          </button>
          <button
            onClick={() => setTool('pan')}
            className={tool === 'pan' ? 'active' : ''}
            title="移動 (Space)"
          >
            <PanIcon />
          </button>
          <button
            onClick={() => setTool('text')}
            className={tool === 'text' ? 'active' : ''}
            title="テキスト (T)"
          >
            <TextIcon />
          </button>

          {/* 枠線グループ */}
          <div className="tool-group">
            <button
              onClick={() => setTool('rect')}
              className={tool === 'rect' ? 'active' : ''}
              title="枠線 (R)"
            >
              <RectIcon />
            </button>
            <button
              onClick={() => setTool('rectAnnotated')}
              className={`annotated-btn ${tool === 'rectAnnotated' ? 'active' : ''}`}
              title="枠線+テキスト"
            >
              <RectAnnotatedIcon />
            </button>
          </div>

          {/* 楕円グループ */}
          <div className="tool-group">
            <button
              onClick={() => setTool('ellipse')}
              className={tool === 'ellipse' ? 'active' : ''}
              title="楕円 (O)"
            >
              <EllipseIcon />
            </button>
            <button
              onClick={() => setTool('ellipseAnnotated')}
              className={`annotated-btn ${tool === 'ellipseAnnotated' ? 'active' : ''}`}
              title="楕円+テキスト"
            >
              <EllipseAnnotatedIcon />
            </button>
          </div>

          {/* 直線グループ */}
          <div className="tool-group">
            <button
              onClick={() => setTool('line')}
              className={tool === 'line' ? 'active' : ''}
              title="直線 (L)"
            >
              <LineIcon />
            </button>
            <button
              onClick={() => setTool('lineAnnotated')}
              className={`annotated-btn ${tool === 'lineAnnotated' ? 'active' : ''}`}
              title="直線+テキスト"
            >
              <LineAnnotatedIcon />
            </button>
          </div>

          <button
            onClick={() => setTool('arrow')}
            className={tool === 'arrow' ? 'active' : ''}
            title="矢印 (A)"
          >
            <ArrowIcon />
          </button>

          <button
            onClick={() => setTool('doubleArrow')}
            className={tool === 'doubleArrow' ? 'active' : ''}
            title="両矢印 (D)"
          >
            <DoubleArrowIcon />
          </button>

          <button
            onClick={() => setTool('polyline')}
            className={tool === 'polyline' ? 'active' : ''}
            title="折れ線 (Y) - ダブルクリックで確定"
          >
            <PolylineIcon />
          </button>

          <button
            onClick={() => setTool('image')}
            className={tool === 'image' ? 'active' : ''}
            title="画像 (I)"
          >
            <ImageIcon />
          </button>
        </div>
      )}
    </div>
  );
};
