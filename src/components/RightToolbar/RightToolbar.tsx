import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { usePresetStore, FontPreset, WorkSpec } from '../../stores/presetStore';
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

// メモストレージキー
const MEMO_STORAGE_KEY = 'mojiq_memo';

export const RightToolbar: React.FC = () => {
  const { history, historyIndex, undo, redo, clearHistory, tool, setTool, setColor, setCurrentStampType, currentStampType } = useDrawingStore();
  const { isActive: isViewerMode } = useViewerModeStore();
  const { isRightCollapsed, toggleRightSidebar } = useSidebarStore();
  const { fontSizes, fonts, selectedFontSize, selectedFont, selectFontSize, selectFont, appendWorkSpec, clearFonts, addFont, removeFont, updateFont, fontColorIndex, addFontSize, removeFontSize, clearFontSizes } = usePresetStore();

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
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = useState(false);
  const [isClearAllSizesConfirmOpen, setIsClearAllSizesConfirmOpen] = useState(false);
  const [isClearAllFontsConfirmOpen, setIsClearAllFontsConfirmOpen] = useState(false);
  const [isSizeDeleteMode, setIsSizeDeleteMode] = useState(false);
  const [isFontDeleteMode, setIsFontDeleteMode] = useState(false);
  const [isSizeAddOpen, setIsSizeAddOpen] = useState(false);
  const [sizeAddInput, setSizeAddInput] = useState('');
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
              setIsSizeDeleteMode(false);
              setIsSizeAddOpen(false);
              break;
            case 'font':
              if (!isFontModalOpen) {
                setIsFontOpen(false);
                setIsFontDeleteMode(false);
              }
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
  }, [isFontModalOpen]);

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
    if (isSizeDeleteMode) {
      removeFontSize(size);
      return;
    }
    selectFontSize(size);
    setTool('text');
    setColor('#ff0000');
    setIsFontSizeOpen(false);
  }, [isSizeDeleteMode, removeFontSize, selectFontSize, setTool, setColor]);

  // 文字サイズ追加
  const handleSizeAdd = useCallback(() => {
    const value = parseInt(sizeAddInput.trim(), 10);
    if (!isNaN(value) && value > 0 && value <= 200) {
      addFontSize(value);
      setSizeAddInput('');
      setIsSizeAddOpen(false);
    }
  }, [sizeAddInput, addFontSize]);

  // フォント選択
  const handleSelectFont = useCallback((font: FontPreset) => {
    if (isFontDeleteMode) {
      removeFont(font.id);
      return;
    }
    selectFont(font);
    setTool('rect');
    setColor(font.color);
    setIsFontOpen(false);
  }, [isFontDeleteMode, removeFont, selectFont, setTool, setColor]);

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

  // 校正ツールのアクティブラベルを取得
  const activeProofToolLabel = (() => {
    const allItems: { stamp: string; label: string; toolType?: string }[] = [
      { stamp: 'toruStamp', label: 'トル' },
      { stamp: 'torutsumeStamp', label: 'トルツメ' },
      { stamp: 'torumamaStamp', label: 'トルママ' },
      { stamp: 'zenkakuakiStamp', label: '全角アキ' },
      { stamp: 'hankakuakiStamp', label: '半角アキ' },
      { stamp: 'yonbunakiStamp', label: '四分アキ' },
      { stamp: 'kaigyouStamp', label: '改行' },
      { stamp: 'tojiruStamp', label: 'とじる' },
      { stamp: 'hirakuStamp', label: 'ひらく' },
      { stamp: 'doneStamp', label: '済' },
      { stamp: 'rubyStamp', label: 'ルビ' },
      { stamp: 'rectSymbolStamp', label: '□' },
      { stamp: 'triangleSymbolStamp', label: '△' },
      { stamp: 'jikan', label: '字間指示', toolType: 'doubleArrow' },
      { stamp: 'chevron', label: '＜', toolType: 'chevron' },
      { stamp: 'lshape', label: '∟', toolType: 'lshape' },
      { stamp: 'zshape', label: 'Z', toolType: 'zshape' },
      { stamp: 'bracket', label: '⊐', toolType: 'bracket' },
      { stamp: 'semicircle', label: '◠', toolType: 'semicircle' },
      { stamp: 'labeledRect', label: '小文字指定', toolType: 'labeledRect' },
      { stamp: '', label: '矢印', toolType: 'arrow' },
      { stamp: '', label: '両矢印', toolType: 'doubleArrow' },
      { stamp: '', label: '両矢印+T', toolType: 'doubleArrowAnnotated' },
    ];
    if (tool === 'stamp' && currentStampType) {
      const found = allItems.find(i => i.stamp === currentStampType);
      if (found) return found.label;
    }
    const byTool = allItems.find(i => i.toolType === tool);
    if (byTool) return byTool.label;
    return null;
  })();

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
              className={`right-toolbar-menu-btn ${activeProofToolLabel ? 'active' : ''}`}
              onClick={() => openPopup('proofreading', setIsProofreadingOpen, isProofreadingOpen)}
            >
              校正ツール
              {activeProofToolLabel && (
                <span className="right-toolbar-btn-badge badge-prooftool">{activeProofToolLabel}</span>
              )}
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
                      { id: 'yonbunaki', label: '四分アキ', stamp: 'yonbunakiStamp' },
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
                    <button
                      className="right-toolbar-popup-symbol-btn"
                      onClick={() => { setTool('arrow'); setColor('#ff0000'); setIsProofreadingOpen(false); }}
                      title="矢印"
                    >
                      <span className="symbol-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="19" x2="19" y2="5"/><polyline points="10 5 19 5 19 14"/>
                        </svg>
                      </span>
                      <span className="symbol-label">矢印</span>
                    </button>
                    <button
                      className="right-toolbar-popup-symbol-btn"
                      onClick={() => { setTool('doubleArrow'); setColor('#ff0000'); setIsProofreadingOpen(false); }}
                      title="両矢印"
                    >
                      <span className="symbol-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="19" x2="19" y2="5"/><polyline points="10 5 19 5 19 14"/><polyline points="14 19 5 19 5 10"/>
                        </svg>
                      </span>
                      <span className="symbol-label">両矢印</span>
                    </button>
                    <button
                      className="right-toolbar-popup-symbol-btn"
                      onClick={() => { setTool('doubleArrowAnnotated'); setColor('#ff0000'); setIsProofreadingOpen(false); }}
                      title="両矢印+テキスト"
                    >
                      <span className="symbol-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="16" x2="15" y2="6"/><polyline points="11 6 15 6 15 10"/><polyline points="9 16 5 16 5 12"/>
                          <line x1="15" y1="6" x2="20" y2="3"/><circle cx="20" cy="3" r="1.5" fill="currentColor"/>
                          <text x="19" y="19" fontSize="8" fontWeight="bold" fill="currentColor" stroke="none">T</text>
                        </svg>
                      </span>
                      <span className="symbol-label">両矢印+T</span>
                    </button>
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
              文字サイズ
              {selectedFontSize !== null && (
                <span className="right-toolbar-btn-badge badge-fontsize">{selectedFontSize}P</span>
              )}
            </button>
            {isFontSizeOpen && popupPosition && (
              <div className="right-toolbar-popup right-toolbar-popup-size-panel" style={{ position: 'fixed', top: popupPosition.top, right: popupPosition.right }}>
                <div className="size-panel-scroll">
                  {fontSizes.length === 0 ? (
                    <div className="right-toolbar-popup-empty">コメントがありません。追加するか作品仕様を読み込みから読み込んで下さい。</div>
                  ) : (
                    <div className="size-panel-grid">
                      {fontSizes.map(size => (
                        <button
                          key={size}
                          className={`right-toolbar-popup-size-btn ${selectedFontSize === size ? 'active' : ''} ${isSizeDeleteMode ? 'delete-mode' : ''}`}
                          onClick={() => handleSelectSize(size)}
                        >
                          {size}P
                          {isSizeDeleteMode && <span className="size-delete-x">&times;</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="size-panel-footer">
                  <button
                    className="right-toolbar-popup-action-btn add size-action-full-btn"
                    onClick={() => { setIsSizeAddOpen(true); setSizeAddInput(''); }}
                  >
                    + コメント追加
                  </button>
                  {isSizeAddOpen && (
                    <div className="right-toolbar-popup-add-row">
                      <input
                        type="number"
                        className="right-toolbar-popup-add-input"
                        value={sizeAddInput}
                        onChange={(e) => setSizeAddInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSizeAdd(); if (e.key === 'Escape') setIsSizeAddOpen(false); }}
                        placeholder="pt"
                        min={1}
                        max={200}
                        autoFocus
                      />
                      <button className="right-toolbar-popup-add-ok" onClick={handleSizeAdd}>OK</button>
                    </div>
                  )}
                  <button
                    className={`right-toolbar-popup-action-btn delete size-action-full-btn ${isSizeDeleteMode ? 'active' : ''}`}
                    onClick={() => setIsSizeDeleteMode(!isSizeDeleteMode)}
                  >
                    {isSizeDeleteMode ? '削除中' : '削除'}
                  </button>
                  <button
                    className="right-toolbar-popup-action-btn delete-all size-delete-all-btn"
                    onClick={() => setIsClearAllSizesConfirmOpen(true)}
                    disabled={fontSizes.length === 0}
                  >
                    すべて削除
                  </button>
                </div>
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
              {selectedFont !== null && (
                <span className="right-toolbar-btn-badge badge-font" style={{ borderColor: selectedFont.color, color: selectedFont.color }}>
                  {selectedFont.name}
                </span>
              )}
            </button>
            {isFontOpen && popupPosition && (
              <div className="right-toolbar-popup right-toolbar-popup-font-panel" style={{ position: 'fixed', top: popupPosition.top, right: popupPosition.right }}>
                <div className="font-panel-scroll">
                  {fonts.length === 0 ? (
                    <div className="right-toolbar-popup-empty">フォントがありません。追加するか作品仕様を読み込みから読み込んで下さい。</div>
                  ) : (
                    fonts.map(font => (
                      <div key={font.id} className="right-toolbar-popup-font-row">
                        <button
                          className={`right-toolbar-popup-item right-toolbar-popup-font-item ${selectedFont?.id === font.id ? 'active' : ''} ${isFontDeleteMode ? 'delete-mode' : ''}`}
                          onClick={() => handleSelectFont(font)}
                          onDoubleClick={(e) => !isFontDeleteMode && openFontModalForEdit(font, e)}
                          title={isFontDeleteMode ? 'クリックで削除' : 'ダブルクリックで編集'}
                        >
                          <span className="right-toolbar-popup-font-color" style={{ background: font.color }} />
                          {font.name}
                          {isFontDeleteMode && <span className="font-delete-x">&times;</span>}
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="font-panel-footer">
                  <button
                    className="right-toolbar-popup-action-btn add font-add-btn"
                    onClick={openFontModalForAdd}
                  >
                    + フォント追加
                  </button>
                  <button
                    className={`right-toolbar-popup-action-btn delete font-action-full-btn ${isFontDeleteMode ? 'active' : ''}`}
                    onClick={() => setIsFontDeleteMode(!isFontDeleteMode)}
                  >
                    {isFontDeleteMode ? '削除中' : '削除'}
                  </button>
                  <button
                    className="right-toolbar-popup-action-btn delete-all font-delete-all-btn"
                    onClick={() => setIsClearAllFontsConfirmOpen(true)}
                    disabled={fonts.length === 0}
                  >
                    すべて削除
                  </button>
                </div>
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
                  {displayHistory.length === 0 ? (
                    <div className="right-toolbar-popup-empty">作業履歴がありません</div>
                  ) : (
                    displayHistory.map(item => (
                      <button
                        key={item.index}
                        className={`right-toolbar-popup-item ${item.isCurrent ? 'active' : ''}`}
                        onClick={() => handleHistoryClick(item.index)}
                      >
                        {item.label}
                      </button>
                    ))
                  )}
                </div>
                {history.length > 1 && (
                  <button
                    className="right-toolbar-history-clear-btn"
                    onClick={() => setIsClearHistoryConfirmOpen(true)}
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

      {/* フォントすべて削除確認モーダル */}
      {isClearAllFontsConfirmOpen && (
        <div className="clear-history-confirm-overlay" onClick={() => setIsClearAllFontsConfirmOpen(false)}>
          <div className="clear-history-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="clear-history-confirm-header">
              <span className="clear-history-confirm-title">確認</span>
            </div>
            <div className="clear-history-confirm-body">
              <p>フォントをすべて削除しますか？</p>
            </div>
            <div className="clear-history-confirm-actions">
              <button className="clear-history-confirm-btn cancel" onClick={() => setIsClearAllFontsConfirmOpen(false)}>
                キャンセル
              </button>
              <button className="clear-history-confirm-btn confirm" onClick={() => { setIsClearAllFontsConfirmOpen(false); clearFonts(); }}>
                すべて削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 文字サイズすべて削除確認モーダル */}
      {isClearAllSizesConfirmOpen && (
        <div className="clear-history-confirm-overlay" onClick={() => setIsClearAllSizesConfirmOpen(false)}>
          <div className="clear-history-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="clear-history-confirm-header">
              <span className="clear-history-confirm-title">確認</span>
            </div>
            <div className="clear-history-confirm-body">
              <p>文字サイズをすべて削除しますか？</p>
            </div>
            <div className="clear-history-confirm-actions">
              <button className="clear-history-confirm-btn cancel" onClick={() => setIsClearAllSizesConfirmOpen(false)}>
                キャンセル
              </button>
              <button className="clear-history-confirm-btn confirm" onClick={() => { setIsClearAllSizesConfirmOpen(false); clearFontSizes(); setIsSizeDeleteMode(false); }}>
                すべて削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 履歴クリア確認モーダル */}
      {isClearHistoryConfirmOpen && (
        <div className="clear-history-confirm-overlay" onClick={() => setIsClearHistoryConfirmOpen(false)}>
          <div className="clear-history-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="clear-history-confirm-header">
              <span className="clear-history-confirm-title">確認</span>
            </div>
            <div className="clear-history-confirm-body">
              <p>作業履歴をクリアしますか？</p>
              <p>この操作は元に戻せません。</p>
            </div>
            <div className="clear-history-confirm-actions">
              <button className="clear-history-confirm-btn cancel" onClick={() => setIsClearHistoryConfirmOpen(false)}>
                キャンセル
              </button>
              <button className="clear-history-confirm-btn confirm" onClick={() => { setIsClearHistoryConfirmOpen(false); clearHistory(); }}>
                クリア
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
