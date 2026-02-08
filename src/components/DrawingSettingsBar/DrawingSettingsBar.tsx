import React, { useCallback, useRef } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { usePresetStore } from '../../stores/presetStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useBgOpacityStore } from '../../stores/bgOpacityStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
import { usePageNavStore } from '../../stores/pageNavStore';
import { useCommentVisibilityStore } from '../../stores/commentVisibilityStore';
import { GridSettingsPanel } from '../GridSettingsPanel';
import './DrawingSettingsBar.css';

// 折りたたみボタンアイコン
const CollapseLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ExpandRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// Page nav show icon (目のアイコン - 旧MojiQ準拠)
const PageNavShowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

// Page nav hide icon (目に斜線 - 旧MojiQ準拠)
const PageNavHideIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M10.59 10.59a3 3 0 1 0 4.24 4.24"/>
  </svg>
);

// Comment text show icon
const CommentShowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
    <path d="M8 8h8"/>
    <path d="M12 8v9"/>
  </svg>
);

// Comment text hide icon
const CommentHideIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" strokeDasharray="3 2"/>
    <path d="M8 8h8" strokeDasharray="3 2"/>
    <path d="M12 8v9" strokeDasharray="3 2"/>
    <line x1="4" y1="4" x2="20" y2="20"/>
  </svg>
);

// プリセットカラーパレット
const PRESET_COLORS = [
  '#000000', '#ff0000', '#0000ff', '#ffff00',
];

// 拡張カラーパレット（グラデーション用）
const GRADIENT_COLORS = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00',
  '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff',
  '#ff00ff', '#ff0080',
];

export const DrawingSettingsBar: React.FC = () => {
  const { color, setColor, strokeWidth, setStrokeWidth, pages, pdfDocument } = useDrawingStore();
  const { selectedFontSize, selectFontSize } = usePresetStore();
  const { isSettingsBarCollapsed, toggleSettingsBar } = useSidebarStore();
  const { bgOpacity, setBgOpacity } = useBgOpacityStore();
  const { isActive: isViewerMode } = useViewerModeStore();
  const { isPageNavHidden, togglePageNavHidden } = usePageNavStore();
  const { isHidden: isCommentHidden, toggle: toggleCommentVisibility } = useCommentVisibilityStore();

  // カラーピッカーref
  const colorInputRef = useRef<HTMLInputElement>(null);

  // カラー選択
  const handleColorSelect = useCallback((newColor: string) => {
    setColor(newColor);
  }, [setColor]);

  // カラーピッカーを開く
  const handleOpenColorPicker = useCallback(() => {
    colorInputRef.current?.click();
  }, []);

  // 線の太さ変更
  const handleStrokeWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 50) {
      setStrokeWidth(value);
    }
  }, [setStrokeWidth]);

  // 背景透過度変更
  const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setBgOpacity(value);
    }
  }, [setBgOpacity]);

  // 文字サイズ変更
  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1) {
      selectFontSize(value);
    }
  }, [selectFontSize]);

  // 線の太さスライダーのホイール操作
  const handleStrokeWidthWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newValue = Math.max(1, Math.min(20, strokeWidth + delta));
    setStrokeWidth(newValue);
  }, [strokeWidth, setStrokeWidth]);

  // 背景透過度スライダーのホイール操作
  const handleOpacityWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    const newValue = Math.max(0, Math.min(100, bgOpacity + delta));
    setBgOpacity(newValue);
  }, [bgOpacity, setBgOpacity]);

  // 閲覧モード時は非表示
  if (isViewerMode) {
    return null;
  }

  return (
    <div className={`drawing-settings-bar ${isSettingsBarCollapsed ? 'collapsed' : ''}`}>
      {/* 折りたたみヘッダー */}
      <div className="drawing-settings-bar-header">
        <button
          className="sidebar-toggle-btn"
          onClick={toggleSettingsBar}
          title={isSettingsBarCollapsed ? '設定バーを展開' : '設定バーを折り畳む'}
        >
          {isSettingsBarCollapsed ? <ExpandRightIcon /> : <CollapseLeftIcon />}
        </button>
      </div>
      {!isSettingsBarCollapsed && (
        <div className="drawing-settings-bar-content">
      {/* カラーセクション */}
      <div className="settings-section">
        <div className="settings-label">カラー</div>
        <div className="color-palette">
          {PRESET_COLORS.map((presetColor, index) => (
            <button
              key={index}
              className={`color-swatch ${color === presetColor ? 'active' : ''}`}
              style={{ backgroundColor: presetColor }}
              onClick={() => handleColorSelect(presetColor)}
              title={presetColor}
            />
          ))}
          {/* カスタムカラーピッカー */}
          <button
            className={`color-swatch custom ${!PRESET_COLORS.includes(color) ? 'active' : ''}`}
            style={!PRESET_COLORS.includes(color) ? { backgroundColor: color } : undefined}
            onClick={handleOpenColorPicker}
            title="カスタムカラー"
          />
          <input
            ref={colorInputRef}
            type="color"
            value={color}
            onChange={(e) => handleColorSelect(e.target.value)}
            className="hidden-color-input"
          />
        </div>
        {/* グラデーションバー */}
        <div className="color-gradient">
          {GRADIENT_COLORS.map((gradColor, index) => (
            <button
              key={index}
              className="gradient-segment"
              style={{ backgroundColor: gradColor }}
              onClick={() => handleColorSelect(gradColor)}
            />
          ))}
        </div>
      </div>

      {/* 線の太さセクション */}
      <div className="settings-section">
        <div className="settings-row">
          <span className="settings-label">線の太さ</span>
          <input
            type="number"
            value={strokeWidth}
            onChange={handleStrokeWidthChange}
            min={1}
            max={50}
            className="settings-input"
          />
          <span className="settings-unit">px</span>
        </div>
        <input
          type="range"
          value={strokeWidth}
          onChange={handleStrokeWidthChange}
          onWheel={handleStrokeWidthWheel}
          min={1}
          max={20}
          className="settings-slider stroke-width-slider"
          style={{
            background: `linear-gradient(to right, #ff9800 0%, #ff9800 ${((strokeWidth - 1) / 19) * 100}%, var(--bg-tertiary) ${((strokeWidth - 1) / 19) * 100}%, var(--bg-tertiary) 100%)`
          }}
        />
      </div>

      {/* 背景透過度セクション */}
      <div className="settings-section">
        <div className="settings-row">
          <span className="settings-label">背景透過度</span>
          <input
            type="number"
            value={bgOpacity}
            onChange={handleOpacityChange}
            min={0}
            max={100}
            className="settings-input"
          />
          <span className="settings-unit">%</span>
        </div>
        <input
          type="range"
          value={bgOpacity}
          onChange={handleOpacityChange}
          onWheel={handleOpacityWheel}
          min={0}
          max={100}
          className="settings-slider"
          style={{
            background: `linear-gradient(to right, #00bcd4 0%, #00bcd4 ${bgOpacity}%, var(--bg-tertiary) ${bgOpacity}%, var(--bg-tertiary) 100%)`
          }}
        />
      </div>

      {/* 文字サイズセクション */}
      <div className="settings-section">
        <div className="settings-label">文字サイズ (pt)</div>
        <input
          type="number"
          value={selectedFontSize || 12}
          onChange={handleFontSizeChange}
          min={1}
          className="settings-input large grayed"
        />
      </div>

      {/* 写植グリッド設定パネル */}
      <GridSettingsPanel />

        </div>
      )}

      {/* 下部アイコン - 折りたたみ時は非表示 */}
      {!isSettingsBarCollapsed && (
        <div className="sidebar-bottom-actions">
          <button
            className={`sidebar-bottom-btn ${isPageNavHidden ? 'active' : ''}`}
            onClick={togglePageNavHidden}
            disabled={pages.length <= 1}
            title={isPageNavHidden ? 'ページバー表示' : 'ページバー非表示'}
          >
            {isPageNavHidden ? <PageNavHideIcon /> : <PageNavShowIcon />}
          </button>
          <button
            className={`sidebar-bottom-btn ${isCommentHidden ? 'active' : ''}`}
            onClick={toggleCommentVisibility}
            disabled={!pdfDocument}
            title={isCommentHidden ? 'コメントテキスト表示 (Ctrl+T)' : 'コメントテキスト非表示 (Ctrl+T)'}
          >
            {isCommentHidden ? <CommentHideIcon /> : <CommentShowIcon />}
          </button>
        </div>
      )}
    </div>
  );
};

export default DrawingSettingsBar;
