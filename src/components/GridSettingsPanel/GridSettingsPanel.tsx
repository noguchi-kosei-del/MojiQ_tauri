import React, { useCallback, useEffect, useState } from 'react';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useGridStore, WritingMode } from '../../stores/gridStore';
import { useDrawingStore } from '../../stores/drawingStore';
import './GridSettingsPanel.css';

// 縮尺合わせアイコン（計測）
const CalibrateIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h20"/>
    <path d="M6 8v8"/>
    <path d="M10 9v6"/>
    <path d="M14 9v6"/>
    <path d="M18 8v8"/>
  </svg>
);

// グリッドアイコン
const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

// 横書きアイコン
const HorizontalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="15" y2="18"/>
  </svg>
);

// 縦書きアイコン
const VerticalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="3" x2="18" y2="21"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
    <line x1="6" y1="3" x2="6" y2="15"/>
  </svg>
);

// 削除アイコン
const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

export const GridSettingsPanel: React.FC = () => {
  const { pages } = useDrawingStore();
  const {
    isCalibrated,
    pixelsPerMm,
    isCalibrationMode,
    calibrationStart,
    calibrationEnd,
    enterCalibrationMode,
    exitCalibrationMode,
    setCalibrated,
    calculatePixelsPerMm,
  } = useCalibrationStore();

  const {
    isGridMode,
    writingMode,
    sampleText,
    pendingGrid,
    enterGridMode,
    exitGridMode,
    setGridAdjusting,
    setWritingMode,
    setSampleText,
    calculateGridFromText,
    updatePendingGrid,
  } = useGridStore();

  // 縮尺入力モーダルの状態
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationDistance, setCalibrationDistance] = useState('10');
  const [measuredPixels, setMeasuredPixels] = useState(0);

  // キャリブレーションが完了したらモーダルを表示
  useEffect(() => {
    if (isCalibrationMode && calibrationStart && calibrationEnd) {
      const dx = calibrationEnd.x - calibrationStart.x;
      const dy = calibrationEnd.y - calibrationStart.y;
      const distancePx = Math.sqrt(dx * dx + dy * dy);
      setMeasuredPixels(distancePx);
      setShowCalibrationModal(true);
    }
  }, [isCalibrationMode, calibrationStart, calibrationEnd]);

  // 縮尺確定
  const handleCalibrationConfirm = useCallback(() => {
    const distanceMm = parseFloat(calibrationDistance);
    if (!isNaN(distanceMm) && distanceMm > 0 && measuredPixels > 0) {
      const ppm = calculatePixelsPerMm(measuredPixels, distanceMm);
      setCalibrated(ppm);
    }
    setShowCalibrationModal(false);
    exitCalibrationMode();
  }, [calibrationDistance, measuredPixels, calculatePixelsPerMm, setCalibrated, exitCalibrationMode]);

  // 縮尺キャンセル
  const handleCalibrationCancel = useCallback(() => {
    setShowCalibrationModal(false);
    exitCalibrationMode();
  }, [exitCalibrationMode]);

  // テキスト変更時に行数・文字数を自動計算
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSampleText(text);

    // 作成中のグリッドがあれば更新
    if (pendingGrid) {
      const { lines, chars } = calculateGridFromText(text);
      updatePendingGrid({ textData: text, lines, chars });
    }
  }, [setSampleText, pendingGrid, calculateGridFromText, updatePendingGrid]);

  // テキストクリア
  const handleClearText = useCallback(() => {
    setSampleText('');
    if (pendingGrid) {
      updatePendingGrid({ textData: '', lines: 1, chars: 1 });
    }
  }, [setSampleText, pendingGrid, updatePendingGrid]);

  // 縮尺合わせモード切り替え
  const handleCalibrateClick = useCallback(() => {
    if (isCalibrationMode) {
      exitCalibrationMode();
    } else {
      // グリッドモードを終了
      if (isGridMode) {
        exitGridMode();
      }
      enterCalibrationMode();
    }
  }, [isCalibrationMode, isGridMode, enterCalibrationMode, exitCalibrationMode, exitGridMode]);

  // グリッドモード切り替え
  const handleGridClick = useCallback(() => {
    if (!isCalibrated) return;

    if (isGridMode) {
      exitGridMode();
    } else {
      // キャリブレーションモードを終了
      if (isCalibrationMode) {
        exitCalibrationMode();
      }
      enterGridMode();
      setGridAdjusting(true); // グリッド調整モードを開始
    }
  }, [isCalibrated, isGridMode, isCalibrationMode, enterGridMode, exitGridMode, exitCalibrationMode, setGridAdjusting]);

  // 書き方向切り替え
  const handleWritingModeChange = useCallback((mode: WritingMode) => {
    setWritingMode(mode);
  }, [setWritingMode]);

  // ページがない場合は非表示
  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="grid-settings-panel">
      {/* 縮尺合わせ・グリッドボタン */}
      <div className="grid-tool-buttons">
        <button
          className={`grid-tool-btn ${isCalibrationMode ? 'active' : ''}`}
          onClick={handleCalibrateClick}
          title="縮尺合わせ"
        >
          <CalibrateIcon />
          <span>縮尺</span>
        </button>
        <button
          className={`grid-tool-btn ${isGridMode ? 'active' : ''}`}
          onClick={handleGridClick}
          disabled={!isCalibrated}
          title={isCalibrated ? '写植グリッド' : '先に縮尺合わせを行ってください'}
        >
          <GridIcon />
          <span>グリッド</span>
        </button>
      </div>

      {/* 縮尺表示 */}
      <div className={`scale-display ${isCalibrated ? 'calibrated' : ''}`}>
        {isCalibrated
          ? `設定済 (1mm=${pixelsPerMm.toFixed(1)}px)`
          : '縮尺: 未設定'
        }
      </div>

      {/* グリッド設定エリア */}
      <div className={`grid-settings-area ${!isCalibrated ? 'disabled' : ''}`}>
        <div className="grid-settings-header">写植グリッド設定</div>

        {/* セリフサンプル入力 */}
        <div className="grid-settings-row">
          <label>セリフサンプル</label>
          <textarea
            value={sampleText}
            onChange={handleTextChange}
            placeholder="セリフを入れると文字数を自動計算"
            disabled={!isCalibrated}
          />
        </div>

        {/* 書き方向・削除ボタン */}
        <div className="grid-settings-actions">
          <button
            className={`writing-mode-btn ${writingMode === 'horizontal' ? 'active' : ''}`}
            onClick={() => handleWritingModeChange('horizontal')}
            disabled={!isCalibrated}
            title="横書き"
          >
            <HorizontalIcon />
            <span>横</span>
          </button>
          <button
            className={`writing-mode-btn ${writingMode === 'vertical' ? 'active' : ''}`}
            onClick={() => handleWritingModeChange('vertical')}
            disabled={!isCalibrated}
            title="縦書き"
          >
            <VerticalIcon />
            <span>縦</span>
          </button>
          <button
            className="clear-text-btn"
            onClick={handleClearText}
            disabled={!isCalibrated || !sampleText}
            title="テキスト削除"
          >
            <ClearIcon />
          </button>
        </div>

        {/* グリッド情報表示 */}
        {pendingGrid && (
          <div className="grid-info">
            <div className="grid-info-item size-only">
              <span className="label">サイズ</span>
              <span className="value">{pendingGrid.ptSize}pt</span>
            </div>
          </div>
        )}
      </div>

      {/* 縮尺入力モーダル */}
      {showCalibrationModal && (
        <div className="calibration-modal-overlay" onClick={handleCalibrationCancel}>
          <div className="calibration-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calibration-modal-header">縮尺合わせ</div>
            <div className="calibration-modal-body">
              <p>測定した距離: {Math.round(measuredPixels)}px</p>
              <div className="calibration-input-row">
                <label>実際の距離 (mm):</label>
                <input
                  type="number"
                  value={calibrationDistance}
                  onChange={(e) => setCalibrationDistance(e.target.value)}
                  min="0.1"
                  step="0.1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCalibrationConfirm();
                    if (e.key === 'Escape') handleCalibrationCancel();
                  }}
                />
              </div>
            </div>
            <div className="calibration-modal-footer">
              <button className="calibration-btn cancel" onClick={handleCalibrationCancel}>
                キャンセル
              </button>
              <button className="calibration-btn confirm" onClick={handleCalibrationConfirm}>
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridSettingsPanel;
