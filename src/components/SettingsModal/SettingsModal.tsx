import React, { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeStore } from '../../stores/themeStore';
import { ask } from '@tauri-apps/plugin-dialog';
import './SettingsModal.css';

// タブの種類
type TabType = 'shortcuts' | 'scroll' | 'arrowKey' | 'panel';

// ショートカットのカテゴリ
const SHORTCUT_CATEGORIES: Record<string, string[]> = {
  'ズーム': ['zoomIn', 'zoomOut', 'zoomReset'],
  '履歴': ['undo', 'redo'],
  'ファイル': ['open', 'save'],
  'ページ移動': ['pagePrev', 'pageNext', 'pageFirst', 'pageLast'],
  '編集': ['clearAll'],
  '線幅': ['lineWidthUp', 'lineWidthDown'],
  'ツール': ['toolSelect', 'toolDraw', 'toolMarker', 'toolEraser', 'toolText', 'toolRect', 'toolEllipse', 'toolLine', 'toolArrow', 'toolDoubleArrow', 'toolPolyline', 'toolImage'],
  'その他': ['viewerMode'],
};

// キーキャプチャモーダル
interface KeyCaptureModalProps {
  isOpen: boolean;
  shortcutId: string;
  description: string;
  onConfirm: (key: string, modifiers: ('ctrl' | 'shift' | 'alt')[]) => void;
  onCancel: () => void;
}

const KeyCaptureModal: React.FC<KeyCaptureModalProps> = ({
  isOpen,
  shortcutId,
  description,
  onConfirm,
  onCancel,
}) => {
  const [capturedKey, setCapturedKey] = useState<string | null>(null);
  const [capturedModifiers, setCapturedModifiers] = useState<('ctrl' | 'shift' | 'alt')[]>([]);
  const [conflict, setConflict] = useState<{ conflict: boolean; description?: string } | null>(null);
  const { theme } = useThemeStore();

  const { checkConflict, formatShortcutDisplay } = useSettingsStore();

  useEffect(() => {
    if (!isOpen) {
      setCapturedKey(null);
      setCapturedModifiers([]);
      setConflict(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escapeでキャンセル
      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      // 修飾キーのみは無視
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const modifiers: ('ctrl' | 'shift' | 'alt')[] = [];
      if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
      if (e.shiftKey) modifiers.push('shift');
      if (e.altKey) modifiers.push('alt');

      setCapturedKey(e.key);
      setCapturedModifiers(modifiers);

      // 衝突チェック
      const conflictResult = checkConflict(shortcutId, e.key, modifiers);
      setConflict(conflictResult);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, shortcutId, checkConflict, onCancel]);

  if (!isOpen) return null;

  const displayKey = capturedKey
    ? formatShortcutDisplay({ key: capturedKey, modifiers: capturedModifiers, description: '' })
    : null;

  return (
    <div className="settings-key-capture-overlay" onClick={onCancel}>
      <div
        className={`settings-key-capture-modal ${theme === 'dark' ? 'dark' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-key-capture-title">
          「{description}」のショートカットを入力
        </div>
        <div className={`settings-key-capture-display ${capturedKey ? 'has-key' : 'waiting'}`}>
          {displayKey || 'キーを押してください...'}
        </div>
        <div className="settings-key-capture-hint">Escでキャンセル</div>
        {conflict?.conflict && (
          <div className="settings-key-capture-conflict">
            「{conflict.description}」と重複しています。上書きしますか？
          </div>
        )}
        <div className="settings-key-capture-actions">
          <button className="settings-btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button
            className="settings-btn-primary"
            onClick={() => capturedKey && onConfirm(capturedKey, capturedModifiers)}
            disabled={!capturedKey}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('shortcuts');
  const [keyCaptureTarget, setKeyCaptureTarget] = useState<{ id: string; description: string } | null>(null);
  const { theme } = useThemeStore();

  const {
    isModalOpen,
    closeModal,
    settings,
    setShortcut,
    resetShortcutsToDefault,
    formatShortcutDisplay,
    getScrollDirection,
    setScrollDirection,
    getArrowKeyInverted,
    setArrowKeyInverted,
    getPanelCloseOnSelect,
    setPanelCloseOnSelect,
    checkConflict,
  } = useSettingsStore();

  // Escapeキーで閉じる
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !keyCaptureTarget) {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, keyCaptureTarget, closeModal]);

  const handleResetShortcuts = useCallback(async () => {
    const confirmed = await ask('デフォルトのショートカットに戻します。よろしいですか？', {
      title: 'ショートカットのリセット',
      kind: 'warning',
    });
    if (confirmed) {
      resetShortcutsToDefault();
    }
  }, [resetShortcutsToDefault]);

  const handleKeyCapture = useCallback(
    (key: string, modifiers: ('ctrl' | 'shift' | 'alt')[]) => {
      if (!keyCaptureTarget) return;

      // 衝突チェック
      const conflictResult = checkConflict(keyCaptureTarget.id, key, modifiers);
      if (conflictResult.conflict && conflictResult.with) {
        // 衝突先をクリア
        setShortcut(conflictResult.with, '', []);
      }

      // ショートカットを設定
      setShortcut(keyCaptureTarget.id, key, modifiers);
      setKeyCaptureTarget(null);
    },
    [keyCaptureTarget, checkConflict, setShortcut]
  );

  if (!isModalOpen) return null;

  const scrollDirection = getScrollDirection();
  const arrowKeyInverted = getArrowKeyInverted();
  const panelCloseOnSelect = getPanelCloseOnSelect();

  return (
    <>
      <div className="settings-modal-overlay" onClick={closeModal}>
        <div
          className={`settings-modal-content ${theme === 'dark' ? 'dark' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="settings-modal-header">
            <span className="settings-modal-title">環境設定</span>
          </div>

          {/* タブナビゲーション */}
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              ショートカット
            </button>
            <button
              className={`settings-tab ${activeTab === 'scroll' ? 'active' : ''}`}
              onClick={() => setActiveTab('scroll')}
            >
              スクロール
            </button>
            <button
              className={`settings-tab ${activeTab === 'arrowKey' ? 'active' : ''}`}
              onClick={() => setActiveTab('arrowKey')}
            >
              方向キー
            </button>
            <button
              className={`settings-tab ${activeTab === 'panel' ? 'active' : ''}`}
              onClick={() => setActiveTab('panel')}
            >
              パネル動作
            </button>
          </div>

          {/* ショートカットタブ */}
          <div className={`settings-tab-content ${activeTab === 'shortcuts' ? 'active' : ''}`}>
            <div className="settings-section">
              <div className="settings-section-header">
                <span>ショートカット一覧</span>
                <button className="settings-reset-btn" onClick={handleResetShortcuts}>
                  デフォルトに戻す
                </button>
              </div>
              <div className="settings-shortcut-list">
                {Object.entries(SHORTCUT_CATEGORIES).map(([, ids]) =>
                  ids.map((id) => {
                    const shortcut = settings.shortcuts[id];
                    if (!shortcut) return null;
                    const displayKey = formatShortcutDisplay(shortcut);
                    return (
                      <div key={id} className="settings-shortcut-item">
                        <span className="settings-shortcut-label">{shortcut.description}</span>
                        <button
                          className="settings-shortcut-key-btn"
                          onClick={() => setKeyCaptureTarget({ id, description: shortcut.description })}
                        >
                          {displayKey || '未設定'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* スクロールタブ */}
          <div className={`settings-tab-content ${activeTab === 'scroll' ? 'active' : ''}`}>
            <div className="settings-section">
              <p className="settings-section-description">
                マウスホイールでのスクロール方向を設定します。
              </p>
              <div className="settings-scroll-options">
                <label
                  className={`settings-scroll-option ${scrollDirection === 'normal' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="scrollDirection"
                    value="normal"
                    checked={scrollDirection === 'normal'}
                    onChange={() => setScrollDirection('normal')}
                  />
                  <div className="settings-scroll-option-label">
                    <span className="settings-scroll-option-title">通常</span>
                    <span className="settings-scroll-option-desc">
                      ホイールを下に回すと次のページへ
                    </span>
                  </div>
                </label>
                <label
                  className={`settings-scroll-option ${scrollDirection === 'inverted' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="scrollDirection"
                    value="inverted"
                    checked={scrollDirection === 'inverted'}
                    onChange={() => setScrollDirection('inverted')}
                  />
                  <div className="settings-scroll-option-label">
                    <span className="settings-scroll-option-title">反転</span>
                    <span className="settings-scroll-option-desc">
                      ホイールを上に回すと次のページへ
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 方向キータブ */}
          <div className={`settings-tab-content ${activeTab === 'arrowKey' ? 'active' : ''}`}>
            <div className="settings-section">
              <p className="settings-section-description">
                キーボードの方向キーでのページ移動方向を設定します。
              </p>
              <div className="settings-scroll-options">
                <label
                  className={`settings-scroll-option ${!arrowKeyInverted ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="arrowKeyDirection"
                    value="normal"
                    checked={!arrowKeyInverted}
                    onChange={() => setArrowKeyInverted(false)}
                  />
                  <div className="settings-scroll-option-label">
                    <span className="settings-scroll-option-title">通常</span>
                    <span className="settings-scroll-option-desc">
                      右キー → 次のページ、左キー → 前のページ
                    </span>
                  </div>
                </label>
                <label
                  className={`settings-scroll-option ${arrowKeyInverted ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="arrowKeyDirection"
                    value="inverted"
                    checked={arrowKeyInverted}
                    onChange={() => setArrowKeyInverted(true)}
                  />
                  <div className="settings-scroll-option-label">
                    <span className="settings-scroll-option-title">反転</span>
                    <span className="settings-scroll-option-desc">
                      左キー → 次のページ、右キー → 前のページ
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* パネル動作タブ */}
          <div className={`settings-tab-content ${activeTab === 'panel' ? 'active' : ''}`}>
            <div className="settings-section">
              <p className="settings-section-description">
                ツールパネルで項目を選択した後の動作を設定します。
              </p>
              <div className="settings-scroll-options">
                <label
                  className={`settings-scroll-option ${!panelCloseOnSelect ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="panelBehavior"
                    value="keepOpen"
                    checked={!panelCloseOnSelect}
                    onChange={() => setPanelCloseOnSelect(false)}
                  />
                  <div className="settings-scroll-option-label">
                    <span className="settings-scroll-option-title">開いたまま</span>
                    <span className="settings-scroll-option-desc">
                      項目を選択してもパネルは開いたまま
                    </span>
                  </div>
                </label>
                <label
                  className={`settings-scroll-option ${panelCloseOnSelect ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="panelBehavior"
                    value="closeOnSelect"
                    checked={panelCloseOnSelect}
                    onChange={() => setPanelCloseOnSelect(true)}
                  />
                  <div className="settings-scroll-option-label">
                    <span className="settings-scroll-option-title">選択後に閉じる</span>
                    <span className="settings-scroll-option-desc">
                      項目を選択するとパネルが自動的に閉じる
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-modal-actions">
            <button className="settings-btn-primary" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      </div>

      {/* キーキャプチャモーダル */}
      <KeyCaptureModal
        isOpen={!!keyCaptureTarget}
        shortcutId={keyCaptureTarget?.id || ''}
        description={keyCaptureTarget?.description || ''}
        onConfirm={handleKeyCapture}
        onCancel={() => setKeyCaptureTarget(null)}
      />
    </>
  );
};
