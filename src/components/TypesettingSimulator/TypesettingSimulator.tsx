import React, { useCallback, useEffect, useState } from 'react';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useGridStore, WritingMode, GridModeType } from '../../stores/gridStore';
import { useDrawingStore } from '../../stores/drawingStore';
import './TypesettingSimulator.css';

// 縮尺合わせアイコン（定規）
const CalibrateIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="18" height="10" rx="1.5"/>
    <path d="M4 5v3"/><path d="M7 5v5"/><path d="M10 5v3"/><path d="M13 5v5"/><path d="M16 5v3"/>
  </svg>
);

// 一文字グリッドアイコン
const SingleGridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="16" height="16" rx="1"/>
  </svg>
);

// セリフ見本アイコン
const SampleGridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="16" height="16" rx="1"/>
    <line x1="2" y1="7.33" x2="18" y2="7.33"/>
    <line x1="2" y1="12.67" x2="18" y2="12.67"/>
    <line x1="7.33" y1="2" x2="7.33" y2="18"/>
    <line x1="12.67" y1="2" x2="12.67" y2="18"/>
  </svg>
);

// 削除アイコン
const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

export const TypesettingSimulator: React.FC = () => {
  const { pages, currentPage } = useDrawingStore();
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
    isGridAdjusting,
    gridMode,
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
    deleteSelectedGrid,
    confirmPendingGrid,
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

  // 縮尺合わせモード切り替え
  const handleCalibrateClick = useCallback(() => {
    if (isCalibrationMode) {
      exitCalibrationMode();
    } else {
      if (isGridMode) {
        // pendingGridがあれば確定
        if (pendingGrid) {
          confirmPendingGrid(currentPage);
        }
        exitGridMode();
      }
      enterCalibrationMode();
    }
  }, [isCalibrationMode, isGridMode, pendingGrid, currentPage, enterCalibrationMode, exitCalibrationMode, exitGridMode, confirmPendingGrid]);

  // グリッドモード切り替え（共通）
  const handleGridModeClick = useCallback((mode: GridModeType) => {
    if (!isCalibrated) return;

    if (isGridMode && gridMode === mode) {
      // 同じモードをクリック: トグルオフ
      if (pendingGrid) {
        confirmPendingGrid(currentPage);
      }
      exitGridMode();
    } else {
      // キャリブレーションモードを終了
      if (isCalibrationMode) {
        exitCalibrationMode();
      }
      // 別のグリッドモードの場合、pendingGridを確定してからモード切り替え
      if (isGridMode && pendingGrid) {
        confirmPendingGrid(currentPage);
      }
      enterGridMode(mode);
      setGridAdjusting(true);
    }
  }, [isCalibrated, isGridMode, gridMode, isCalibrationMode, pendingGrid, currentPage, enterGridMode, exitGridMode, exitCalibrationMode, setGridAdjusting, confirmPendingGrid]);

  // テキスト変更時に行数・文字数を自動計算
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSampleText(text);
    if (pendingGrid && gridMode === 'sampleGrid') {
      const { lines, chars } = calculateGridFromText(text);
      updatePendingGrid({ textData: text, lines, chars });
    }
  }, [setSampleText, pendingGrid, gridMode, calculateGridFromText, updatePendingGrid]);

  // テキストクリア
  const handleClearText = useCallback(() => {
    setSampleText('');
    if (pendingGrid) {
      updatePendingGrid({ textData: '', lines: 1, chars: 1 });
    }
  }, [setSampleText, pendingGrid, updatePendingGrid]);

  // 書き方向切り替え
  const handleWritingModeToggle = useCallback(() => {
    const newMode: WritingMode = writingMode === 'horizontal' ? 'vertical' : 'horizontal';
    setWritingMode(newMode);
  }, [writingMode, setWritingMode]);

  // 選択グリッド削除
  const handleDeleteGrid = useCallback(() => {
    if (!pendingGrid) return;
    deleteSelectedGrid(currentPage);
  }, [pendingGrid, currentPage, deleteSelectedGrid]);

  // Deleteキーでグリッド削除
  useEffect(() => {
    if (!isGridAdjusting || !pendingGrid) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 入力フィールドにフォーカスがある場合は無視
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        deleteSelectedGrid(currentPage);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGridAdjusting, pendingGrid, currentPage, deleteSelectedGrid]);

  // ページがない場合は非表示
  if (pages.length === 0) {
    return null;
  }

  const canUseSampleGrid = isCalibrated && sampleText.trim().length > 0;

  return (
    <div className="simulator-section">
      <div className="simulator-section-label">写植シミュレーター</div>

      {/* 縮尺表示 */}
      <div className={`sim-scale-display ${isCalibrated ? 'calibrated' : ''}`}>
        {isCalibrated
          ? `縮尺: 設定済 (1mm=${pixelsPerMm.toFixed(1)}px)`
          : '縮尺: 未設定'
        }
      </div>

      {/* ツールボタン（3列） */}
      <div className="sim-tool-buttons">
        <button
          className={`sim-tool-btn ${isCalibrationMode ? 'active-calibrate' : ''}`}
          onClick={handleCalibrateClick}
          title="縮尺合わせ"
        >
          <CalibrateIcon />
        </button>
        <button
          className={`sim-tool-btn ${isGridMode && gridMode === 'grid' ? 'active-grid' : ''}`}
          onClick={() => handleGridModeClick('grid')}
          disabled={!isCalibrated}
          title="一文字グリッド"
        >
          <SingleGridIcon />
        </button>
        <button
          className={`sim-tool-btn ${isGridMode && gridMode === 'sampleGrid' ? 'active-grid' : ''}`}
          onClick={() => handleGridModeClick('sampleGrid')}
          disabled={!canUseSampleGrid}
          title="セリフ見本"
        >
          <SampleGridIcon />
        </button>
      </div>

      {/* セリフ見本入力エリア */}
      <div className={`sim-grid-settings ${!isCalibrated ? 'disabled-lock' : ''}`}>
        <label className="sim-grid-label">セリフ見本を入力</label>
        <textarea
          className="sim-grid-textarea"
          value={sampleText}
          onChange={handleTextChange}
          placeholder="入力するとセリフ見本が使用可能になります。"
          disabled={!isCalibrated}
        />
        <div className="sim-grid-actions">
          <button
            className={`sim-writing-mode-btn ${writingMode === 'horizontal' ? '' : 'active'}`}
            onClick={handleWritingModeToggle}
            disabled={!isCalibrated}
            title={writingMode === 'horizontal' ? '横方向 → 縦方向に切替' : '縦方向 → 横方向に切替'}
          >
            {writingMode === 'horizontal' ? '横方向' : '縦方向'}
          </button>
          <button
            className="sim-clear-btn"
            onClick={handleClearText}
            disabled={!isCalibrated || !sampleText}
          >
            削除
          </button>
        </div>
      </div>

      {/* サイズ表示（調整中のみ表示） */}
      <div className={`sim-adjust-message ${isGridAdjusting && pendingGrid ? 'active' : ''}`}>
        <span className="adjust-label">サイズ</span>
        <span className="adjust-value">{pendingGrid ? Math.round(pendingGrid.ptSize * 10) / 10 : '-'}</span>
        <span className="adjust-unit">pt</span>
      </div>

      {/* グリッド削除ボタン */}
      {isGridAdjusting && pendingGrid && (
        <button
          className="sim-delete-btn"
          onClick={handleDeleteGrid}
          title="選択中のグリッドを削除"
        >
          <DeleteIcon />
          <span>グリッド削除</span>
        </button>
      )}

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

export default TypesettingSimulator;
