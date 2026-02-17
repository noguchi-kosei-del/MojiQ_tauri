import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { usePresetStore, FontPreset, WorkSpec } from '../../stores/presetStore';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { invoke } from '@tauri-apps/api/core';
import './RightToolbar.css';

// JSONフォルダのベースパス
const JSON_FOLDER_BASE_PATH = 'G:\\共有ドライブ\\CLLENN\\編集部フォルダ\\編集企画部\\編集企画_C班(AT業務推進)\\DTP制作部\\JSONフォルダ';

// フォルダエントリの型
interface FolderEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

// アイコン
const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const ChevronDownIcon = () => (
  <span className="right-toolbar-section-toggle">▲</span>
);

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// 折りたたみボタンアイコン
const CollapseRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ExpandLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const FolderSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const CheckListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="10" y1="6" x2="21" y2="6"/>
    <line x1="10" y1="12" x2="21" y2="12"/>
    <line x1="10" y1="18" x2="21" y2="18"/>
    <polyline points="3,6 4,7 6,5"/>
    <polyline points="3,12 4,13 6,11"/>
    <polyline points="3,18 4,19 6,17"/>
  </svg>
);

// メモストレージキー
const MEMO_STORAGE_KEY = 'mojiq_memo';

export const RightToolbar: React.FC = () => {
  const { history, historyIndex, undo, redo, clearHistory, tool, setTool, setColor, setCurrentStampType } = useDrawingStore();
  const { isActive: isViewerMode } = useViewerModeStore();
  const { isRightCollapsed, toggleRightSidebar } = useSidebarStore();
  const { fontSizes, fonts, selectedFontSize, selectedFont, selectFontSize, selectFont, appendWorkSpec, clearFonts, addFont, removeFont, updateFont, fontColorIndex } = usePresetStore();
  const { openModal: openProofreadingCheckModal } = useProofreadingCheckStore();

  // パネル開閉状態
  const [isProofreadingOpen, setIsProofreadingOpen] = useState(false);
  const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
  const [isFontOpen, setIsFontOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);

  // ポップアップ位置
  const [popupPosition, setPopupPosition] = useState<{ top: number; right: number } | null>(null);

  // メモ
  const [memo, setMemo] = useState('');

  // フォルダブラウザ
  const [currentPath, setCurrentPath] = useState(JSON_FOLDER_BASE_PATH);
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォント追加モーダル
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);
  const [editingFont, setEditingFont] = useState<FontPreset | null>(null);
  const [modalFontName, setModalFontName] = useState('');
  const [modalFontColor, setModalFontColor] = useState('#FF0000');

  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  // メモ初期化
  useEffect(() => {
    const savedMemo = localStorage.getItem(MEMO_STORAGE_KEY);
    if (savedMemo) {
      setMemo(savedMemo);
    }
  }, []);

  // 起動時にフォント指定をクリア
  useEffect(() => {
    clearFonts();
  }, [clearFonts]);

  // メモ保存
  useEffect(() => {
    localStorage.setItem(MEMO_STORAGE_KEY, memo);
  }, [memo]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      Object.entries(dropdownRefs.current).forEach(([key, ref]) => {
        if (ref && !ref.contains(e.target as Node)) {
          switch (key) {
            case 'proofreading':
              setIsProofreadingOpen(false);
              break;
            case 'fontSize':
              setIsFontSizeOpen(false);
              break;
            case 'font':
              setIsFontOpen(false);
              break;
            case 'history':
              setIsHistoryOpen(false);
              break;
          }
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // フォルダ内容を読み込み
  const loadFolder = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FolderEntry[]>('list_folder_entries', {
        path,
        extensionFilter: 'json'
      });
      setEntries(result);
      setCurrentPath(path);
    } catch (err) {
      console.error('フォルダ読み込みエラー:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // フォルダブラウザを開いた時に読み込み
  useEffect(() => {
    if (isFolderBrowserOpen) {
      loadFolder(JSON_FOLDER_BASE_PATH);
    }
  }, [isFolderBrowserOpen, loadFolder]);

  // 戻るボタン
  const handleBack = useCallback(() => {
    if (currentPath !== JSON_FOLDER_BASE_PATH) {
      const parentPath = currentPath.replace(/\\[^\\]+$/, '');
      if (parentPath.length >= JSON_FOLDER_BASE_PATH.length) {
        loadFolder(parentPath);
      } else {
        loadFolder(JSON_FOLDER_BASE_PATH);
      }
    }
  }, [currentPath, loadFolder]);

  // JSONファイルを読み込んでプリセットに追加
  const loadJsonFile = useCallback(async (filePath: string) => {
    try {
      const content = await invoke<string>('read_text_file', { path: filePath });
      const data = JSON.parse(content);
      const presetData = data.presetData || data;

      let sizes: number[] = [];
      const fontSizeStats = presetData.fontSizeStats;
      if (fontSizeStats) {
        if (Array.isArray(fontSizeStats.sizes)) {
          sizes = fontSizeStats.sizes;
        } else if (Array.isArray(fontSizeStats)) {
          sizes = fontSizeStats;
        }
      }

      const fontsList: FontPreset[] = [];
      const presets = presetData.presets;
      if (presets) {
        Object.keys(presets).forEach(key => {
          const group = presets[key];
          if (Array.isArray(group)) {
            group.forEach((item: { name?: string; color?: string }) => {
              if (item.name) {
                fontsList.push({
                  id: `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: item.name,
                  color: item.color || '',
                });
              }
            });
          }
        });
      } else if (presetData.fonts) {
        presetData.fonts.forEach((item: { name: string; color?: string }) => {
          fontsList.push({
            id: `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.name,
            color: item.color || '',
          });
        });
      }

      if (sizes.length > 0 || fontsList.length > 0) {
        const spec: WorkSpec = {
          fontSizes: sizes,
          fonts: fontsList,
        };
        appendWorkSpec(spec);
      }
    } catch (err) {
      console.error('作品仕様の読み込みに失敗:', err);
    }
  }, [appendWorkSpec]);

  // エントリクリック
  const handleEntryClick = useCallback((entry: FolderEntry) => {
    if (entry.is_dir) {
      loadFolder(entry.path);
    } else {
      loadJsonFile(entry.path);
      setIsFolderBrowserOpen(false);
    }
  }, [loadFolder, loadJsonFile]);

  // 現在のフォルダ名を取得
  const getCurrentFolderName = () => {
    if (currentPath === JSON_FOLDER_BASE_PATH) {
      return 'JSONフォルダ';
    }
    return currentPath.split('\\').pop() || 'JSONフォルダ';
  };

  // 履歴クリック
  const handleHistoryClick = (targetIndex: number) => {
    if (targetIndex === historyIndex) return;
    const diff = targetIndex - historyIndex;
    if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        undo();
      }
    } else {
      for (let i = 0; i < diff; i++) {
        redo();
      }
    }
  };

  // 文字サイズ選択
  const handleSelectSize = useCallback((size: number) => {
    selectFontSize(size);
    setTool('text');
    setColor('#ff0000');
    setIsFontSizeOpen(false);
  }, [selectFontSize, setTool, setColor]);

  // フォント選択
  const handleSelectFont = useCallback((font: FontPreset) => {
    selectFont(font);
    setTool('rect');
    setColor(font.color);
    setIsFontOpen(false);
  }, [selectFont, setTool, setColor]);

  // 自動色パレット
  const AUTO_COLORS = ['#FF0000', '#FF00FF', '#00C400', '#FF6A00', '#0066FF', '#AA00FF', '#FF0070', '#0099E0'];

  // フォント追加モーダルを開く（新規）
  const openFontModalForAdd = useCallback(() => {
    setEditingFont(null);
    setModalFontName('');
    setModalFontColor(AUTO_COLORS[fontColorIndex % AUTO_COLORS.length]);
    setIsFontModalOpen(true);
  }, [fontColorIndex]);

  // フォント追加モーダルを開く（編集）
  const openFontModalForEdit = useCallback((font: FontPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFont(font);
    setModalFontName(font.name);
    setModalFontColor(font.color);
    setIsFontModalOpen(true);
  }, []);

  // モーダル送信
  const handleFontModalSubmit = useCallback(() => {
    if (!modalFontName.trim()) return;

    if (editingFont) {
      // 編集
      updateFont(editingFont.id, { name: modalFontName.trim(), color: modalFontColor });
    } else {
      // 新規追加
      addFont(modalFontName.trim(), modalFontColor);
    }
    setIsFontModalOpen(false);
  }, [modalFontName, modalFontColor, editingFont, addFont, updateFont]);

  // フォント削除
  const handleRemoveFont = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFont(id);
  }, [removeFont]);

  // 校正ツール選択
  const handleProofreadingSelect = useCallback((stampType: string) => {
    setColor('#ff0000');
    // 描画モードに切り替えるツール
    const drawingModeTools: Record<string, string> = {
      'jikan': 'doubleArrow',
      'chevron': 'chevron',
      'lshape': 'lshape',
      'zshape': 'zshape',
      'bracket': 'bracket',
      'semicircle': 'semicircle',
      'labeledRect': 'labeledRect',
    };

    if (drawingModeTools[stampType]) {
      setCurrentStampType(null);
      setTool(drawingModeTools[stampType] as any);
    } else {
      setCurrentStampType(stampType as any);
      setTool('stamp');
    }
    setIsProofreadingOpen(false);
  }, [setTool, setColor, setCurrentStampType]);

  // ポップアップ位置を計算して開く
  const openPopup = useCallback((key: string, setOpen: React.Dispatch<React.SetStateAction<boolean>>, isOpen: boolean) => {
    if (isOpen) {
      setOpen(false);
      return;
    }
    const btn = buttonRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPopupPosition({
        top: rect.top,
        right: window.innerWidth - rect.left + 8,
      });
    }
    setOpen(true);
  }, []);

  if (isViewerMode) return null;

  const displayHistory = [...history].map((_, index) => ({
    index,
    label: index === 0 ? '初期状態' : `操作 ${index}`,
    isCurrent: index === historyIndex,
  })).reverse();

  return (
    <div className={`right-toolbar ${isRightCollapsed ? 'collapsed' : ''}`}>
      {/* 折りたたみヘッダー */}
      <div className="right-toolbar-header">
        <button
          className="sidebar-toggle-btn"
          onClick={toggleRightSidebar}
          title={isRightCollapsed ? 'サイドバーを展開' : 'サイドバーを折り畳む'}
        >
          {isRightCollapsed ? <ExpandLeftIcon /> : <CollapseRightIcon />}
        </button>
      </div>

      {!isRightCollapsed && (
        <div className="right-toolbar-content">
          {/* 校正ツール */}
          <div ref={el => { dropdownRefs.current['proofreading'] = el; }} className="right-toolbar-dropdown-wrapper">
            <button
              ref={el => { buttonRefs.current['proofreading'] = el; }}
              className={`right-toolbar-menu-btn ${tool === 'stamp' || tool === 'doubleArrow' ? 'active' : ''}`}
              onClick={() => openPopup('proofreading', setIsProofreadingOpen, isProofreadingOpen)}
            >
              校正ツール
            </button>
            {isProofreadingOpen && popupPosition && (
              <div className="right-toolbar-popup right-toolbar-popup-sections" style={{ position: 'fixed', top: popupPosition.top, right: popupPosition.right }}>
                {/* 校正指示ツール */}
                <div className="right-toolbar-popup-section">
                  <div className="right-toolbar-popup-section-label">校正指示ツール</div>
                  <div className="right-toolbar-popup-section-grid">
                    {[
                      { id: 'toru', label: 'トル', stamp: 'toruStamp' },
                      { id: 'torutsume', label: 'トルツメ', stamp: 'torutsumeStamp' },
                      { id: 'torumama', label: 'トルママ', stamp: 'torumamaStamp' },
                      { id: 'zenkakuaki', label: '全角アキ', stamp: 'zenkakuakiStamp' },
                      { id: 'hankakuaki', label: '半角アキ', stamp: 'hankakuakiStamp' },
                      { id: 'kaigyou', label: '改行', stamp: 'kaigyouStamp' },
                      { id: 'tojiru', label: 'とじる', stamp: 'tojiruStamp' },
                      { id: 'hiraku', label: 'ひらく', stamp: 'hirakuStamp' },
                      { id: 'jikan', label: '字間指示', stamp: 'jikan' },
                      { id: 'komoji', label: '小文字指定', stamp: 'labeledRect' },
                    ].map(item => (
                      <button
                        key={item.id}
                        className="right-toolbar-popup-stamp-btn"
                        onClick={() => handleProofreadingSelect(item.stamp)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 写植指示スタンプ */}
                <div className="right-toolbar-popup-section">
                  <div className="right-toolbar-popup-section-label">写植指示スタンプ</div>
                  <div className="right-toolbar-popup-section-grid">
                    {[
                      { id: 'done', label: '済', stamp: 'doneStamp' },
                      { id: 'ruby', label: 'ルビ', stamp: 'rubyStamp' },
                    ].map(item => (
                      <button
                        key={item.id}
                        className="right-toolbar-popup-stamp-btn"
                        onClick={() => handleProofreadingSelect(item.stamp)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 校正記号ツール */}
                <div className="right-toolbar-popup-section">
                  <div className="right-toolbar-popup-section-label">校正記号ツール</div>
                  <div className="right-toolbar-popup-section-grid symbol-grid">
                    {[
                      { id: 'rectSymbol', label: '全角アキ', icon: '□', stamp: 'rectSymbolStamp' },
                      { id: 'triangleSymbol', label: '半角アキ', icon: '△', stamp: 'triangleSymbolStamp' },
                      { id: 'chevron', label: 'アキ', icon: '＜', stamp: 'chevron' },
                      { id: 'lshape', label: '行移動', icon: '∟', stamp: 'lshape' },
                      { id: 'zshape', label: '改行', icon: 'Z', stamp: 'zshape' },
                      { id: 'bracket', label: '全体移動', icon: '⊐', stamp: 'bracket' },
                      { id: 'semicircle', label: '半円', icon: '◠', stamp: 'semicircle' },
                    ].map(item => (
                      <button
                        key={item.id}
                        className="right-toolbar-popup-symbol-btn"
                        onClick={() => handleProofreadingSelect(item.stamp)}
                        title={item.label}
                      >
                        <span className="symbol-icon">{item.icon}</span>
                        <span className="symbol-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 文字サイズ */}
          <div ref={el => { dropdownRefs.current['fontSize'] = el; }} className="right-toolbar-dropdown-wrapper">
            <button
              ref={el => { buttonRefs.current['fontSize'] = el; }}
              className={`right-toolbar-menu-btn ${selectedFontSize !== null ? 'active' : ''}`}
              onClick={() => openPopup('fontSize', setIsFontSizeOpen, isFontSizeOpen)}
            >
              文字サイズ {selectedFontSize !== null && `(${selectedFontSize}P)`}
            </button>
            {isFontSizeOpen && popupPosition && (
              <div className="right-toolbar-popup right-toolbar-popup-grid" style={{ position: 'fixed', top: popupPosition.top, right: popupPosition.right }}>
                {fontSizes.map(size => (
                  <button
                    key={size}
                    className={`right-toolbar-popup-size-btn ${selectedFontSize === size ? 'active' : ''}`}
                    onClick={() => handleSelectSize(size)}
                  >
                    {size}P
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* フォント指定 */}
          <div ref={el => { dropdownRefs.current['font'] = el; }} className="right-toolbar-dropdown-wrapper">
            <button
              ref={el => { buttonRefs.current['font'] = el; }}
              className={`right-toolbar-menu-btn ${selectedFont !== null ? 'active' : ''}`}
              onClick={() => openPopup('font', setIsFontOpen, isFontOpen)}
            >
              フォント指定
            </button>
            {isFontOpen && popupPosition && (
              <div className="right-toolbar-popup" style={{ position: 'fixed', top: popupPosition.top, right: popupPosition.right }}>
                {fonts.length === 0 ? (
                  <div className="right-toolbar-popup-empty">フォントがありません</div>
                ) : (
                  fonts.map(font => (
                    <div key={font.id} className="right-toolbar-popup-font-row">
                      <button
                        className={`right-toolbar-popup-item right-toolbar-popup-font-item ${selectedFont?.id === font.id ? 'active' : ''}`}
                        onClick={() => handleSelectFont(font)}
                        onDoubleClick={(e) => openFontModalForEdit(font, e)}
                        title="ダブルクリックで編集"
                      >
                        <span className="right-toolbar-popup-font-color" style={{ background: font.color }} />
                        {font.name}
                      </button>
                      <button
                        className="right-toolbar-popup-font-delete"
                        onClick={(e) => handleRemoveFont(font.id, e)}
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
                <button
                  className="right-toolbar-popup-add-btn"
                  onClick={openFontModalForAdd}
                >
                  + フォント追加
                </button>
              </div>
            )}
          </div>

          {/* 作品仕様を読み込みボタン */}
          <button
            className="right-toolbar-load-btn"
            onClick={() => setIsFolderBrowserOpen(true)}
          >
            <FolderIcon />
            作品仕様を読み込み
          </button>

          {/* 校正チェックボタン */}
          <button
            className="right-toolbar-load-btn proofreading-check-btn"
            onClick={openProofreadingCheckModal}
          >
            <CheckListIcon />
            校正チェック
          </button>

          <div className="right-toolbar-divider" />

          {/* 作業履歴 */}
          <div ref={el => { dropdownRefs.current['history'] = el; }} className="right-toolbar-dropdown-wrapper">
            <button
              ref={el => { buttonRefs.current['history'] = el; }}
              className={`right-toolbar-menu-btn ${isHistoryOpen ? 'active' : ''}`}
              onClick={() => openPopup('history', setIsHistoryOpen, isHistoryOpen)}
            >
              作業履歴
            </button>
            {isHistoryOpen && popupPosition && (
              <div className="right-toolbar-popup" style={{ position: 'fixed', top: popupPosition.top, right: popupPosition.right }}>
                <div className="right-toolbar-history-list">
                  {displayHistory.map(item => (
                    <button
                      key={item.index}
                      className={`right-toolbar-popup-item ${item.isCurrent ? 'active' : ''}`}
                      onClick={() => handleHistoryClick(item.index)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {history.length > 1 && (
                  <button
                    className="right-toolbar-history-clear-btn"
                    onClick={clearHistory}
                  >
                    履歴をクリア
                  </button>
                )}
              </div>
            )}
          </div>

          {/* メモ */}
          <div className={`right-toolbar-section ${isMemoOpen ? 'open' : ''}`}>
            <button
              className="right-toolbar-section-header"
              onClick={() => setIsMemoOpen(!isMemoOpen)}
            >
              <div className="right-toolbar-section-header-left">
                <span>メモ</span>
              </div>
              <ChevronDownIcon />
            </button>
            {isMemoOpen && (
              <div className="right-toolbar-section-content">
                <textarea
                  className="right-toolbar-memo-textarea"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="メモを入力..."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* フォルダブラウザモーダル */}
      {isFolderBrowserOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setIsFolderBrowserOpen(false)}>
          <div style={{ width: 400, maxHeight: '80vh', background: 'var(--bg-primary)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <button onClick={handleBack} disabled={currentPath === JSON_FOLDER_BASE_PATH} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, marginRight: 8, opacity: currentPath === JSON_FOLDER_BASE_PATH ? 0.3 : 1 }}>
                <BackIcon />
              </button>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{getCurrentFolderName()}</span>
              <button onClick={() => setIsFolderBrowserOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-primary)' }}>
                <CloseIcon />
              </button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: 8 }}>
              {loading && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>読み込み中...</div>}
              {error && <div style={{ padding: 16, textAlign: 'center', color: '#f44336' }}>{error}</div>}
              {!loading && !error && entries.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>ファイルがありません</div>
              )}
              {!loading && !error && entries.map((entry, index) => (
                <button
                  key={index}
                  onClick={() => handleEntryClick(entry)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {entry.is_dir ? <FolderSmallIcon /> : <FileIcon />}
                  <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.is_dir ? entry.name : entry.name.replace(/\.json$/i, '')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* フォント追加/編集モーダル */}
      {isFontModalOpen && (
        <div className="font-modal-overlay" onClick={() => setIsFontModalOpen(false)}>
          <div className="font-modal-content" onClick={e => e.stopPropagation()}>
            <div className="font-modal-header">
              <span>{editingFont ? 'フォント編集' : 'カスタムフォント追加'}</span>
            </div>
            <div className="font-modal-body">
              <label className="font-modal-label">フォント名（表示ラベル）</label>
              <input
                type="text"
                className="font-modal-input"
                value={modalFontName}
                onChange={(e) => setModalFontName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    handleFontModalSubmit();
                  }
                }}
                placeholder="例: 太ゴシック"
                autoFocus
              />
              <label className="font-modal-label">枠線の色指定</label>
              <div className="font-modal-color-row">
                <input
                  type="color"
                  className="font-modal-color-input"
                  value={modalFontColor}
                  onChange={(e) => setModalFontColor(e.target.value)}
                />
                <span className="font-modal-color-value">{modalFontColor}</span>
              </div>
            </div>
            <div className="font-modal-actions">
              <button className="font-modal-cancel-btn" onClick={() => setIsFontModalOpen(false)}>
                キャンセル
              </button>
              <button
                className="font-modal-submit-btn"
                onClick={handleFontModalSubmit}
                disabled={!modalFontName.trim()}
              >
                {editingFont ? '更新' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
