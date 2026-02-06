import React, { useCallback, useRef } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { usePresetStore } from '../../stores/presetStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useBgOpacityStore } from '../../stores/bgOpacityStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
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
  const { color, setColor, strokeWidth, setStrokeWidth } = useDrawingStore();
  const { selectedFontSize, selectFontSize } = usePresetStore();
  const { isSettingsBarCollapsed, toggleSettingsBar } = useSidebarStore();
  const { bgOpacity, setBgOpacity } = useBgOpacityStore();
  const { isActive: isViewerMode } = useViewerModeStore();

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
        </div>
      )}
    </div>
  );
};

export default DrawingSettingsBar;
