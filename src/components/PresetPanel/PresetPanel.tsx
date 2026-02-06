import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePresetStore, FontPreset, WorkSpec } from '../../stores/presetStore';
import { useDrawingStore } from '../../stores/drawingStore';
import { invoke } from '@tauri-apps/api/core';
import './PresetPanel.css';

// JSONフォルダのベースパス
const JSON_FOLDER_BASE_PATH = 'G:\\共有ドライブ\\CLLENN\\編集部フォルダ\\編集企画部\\編集企画_C班(AT業務推進)\\DTP制作部\\JSONフォルダ';

// フォルダエントリの型
interface FolderEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

// SVGアイコン
const AddIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const DeleteIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const FolderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
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

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

// 文字サイズアイコン
const FontSizeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <text x="4" y="17" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none">A</text>
    <text x="14" y="20" fontSize="10" fill="currentColor" stroke="none">a</text>
  </svg>
);

// フォント指定アイコン
const FontIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);

// フォント追加モーダル
interface FontModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, color: string) => void;
  editFont?: FontPreset;
  onUpdate?: (id: string, name: string, color: string) => void;
}

const FontModal: React.FC<FontModalProps> = ({ isOpen, onClose, onAdd, editFont, onUpdate }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#FF0000');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (editFont) {
        setName(editFont.name);
        setColor(editFont.color);
      } else {
        setName('');
        setColor('#FF0000');
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, editFont]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      if (editFont && onUpdate) {
        onUpdate(editFont.id, name.trim(), color);
      } else {
        onAdd(name.trim(), color);
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="preset-modal-overlay" onClick={onClose}>
      <div className="preset-modal" onClick={e => e.stopPropagation()}>
        <div className="preset-modal-header">
          {editFont ? 'フォント編集' : 'フォント追加'}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="preset-modal-row">
            <label>フォント名</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: ゴシック"
            />
          </div>
          <div className="preset-modal-row">
            <label>色</label>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
            />
          </div>
          <div className="preset-modal-actions">
            <button type="button" onClick={onClose}>キャンセル</button>
            <button type="submit" className="primary">
              {editFont ? '更新' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// サイズ追加モーダル
interface SizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (size: number) => void;
}

const SizeModal: React.FC<SizeModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [size, setSize] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSize('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sizeNum = parseInt(size, 10);
    if (!isNaN(sizeNum) && sizeNum > 0 && sizeNum <= 200) {
      onAdd(sizeNum);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="preset-modal-overlay" onClick={onClose}>
      <div className="preset-modal" onClick={e => e.stopPropagation()}>
        <div className="preset-modal-header">文字サイズ追加</div>
        <form onSubmit={handleSubmit}>
          <div className="preset-modal-row">
            <label>サイズ (pt)</label>
            <input
              ref={inputRef}
              type="number"
              min="1"
              max="200"
              value={size}
              onChange={e => setSize(e.target.value)}
              placeholder="例: 14"
            />
          </div>
          <div className="preset-modal-actions">
            <button type="button" onClick={onClose}>キャンセル</button>
            <button type="submit" className="primary">追加</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// フォルダブラウザモーダル
interface FolderBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (path: string) => void;
}

const FolderBrowserModal: React.FC<FolderBrowserModalProps> = ({ isOpen, onClose, onSelectFile }) => {
  const [currentPath, setCurrentPath] = useState(JSON_FOLDER_BASE_PATH);
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // モーダル開いた時に読み込み
  useEffect(() => {
    if (isOpen) {
      loadFolder(JSON_FOLDER_BASE_PATH);
    }
  }, [isOpen, loadFolder]);

  // 戻るボタン
  const handleBack = useCallback(() => {
    if (currentPath !== JSON_FOLDER_BASE_PATH) {
      // 親フォルダへ移動
      const parentPath = currentPath.replace(/\\[^\\]+$/, '');
      if (parentPath.length >= JSON_FOLDER_BASE_PATH.length) {
        loadFolder(parentPath);
      } else {
        loadFolder(JSON_FOLDER_BASE_PATH);
      }
    }
  }, [currentPath, loadFolder]);

  // エントリクリック
  const handleEntryClick = useCallback((entry: FolderEntry) => {
    if (entry.is_dir) {
      loadFolder(entry.path);
    } else {
      onSelectFile(entry.path);
      onClose();
    }
  }, [loadFolder, onSelectFile, onClose]);

  // 現在のフォルダ名を取得
  const getCurrentFolderName = () => {
    if (currentPath === JSON_FOLDER_BASE_PATH) {
      return 'JSONフォルダ';
    }
    return currentPath.split('\\').pop() || 'JSONフォルダ';
  };

  if (!isOpen) return null;

  return (
    <div className="preset-modal-overlay" onClick={onClose}>
      <div className="folder-browser-modal" onClick={e => e.stopPropagation()}>
        <div className="folder-browser-header">
          <button
            className="folder-browser-back-btn"
            onClick={handleBack}
            disabled={currentPath === JSON_FOLDER_BASE_PATH}
            title="戻る"
          >
            <BackIcon />
          </button>
          <span className="folder-browser-title">{getCurrentFolderName()}</span>
          <button className="folder-browser-close-btn" onClick={onClose}>
            <DeleteIcon />
          </button>
        </div>
        <div className="folder-browser-content">
          {loading && <div className="folder-browser-loading">読み込み中...</div>}
          {error && <div className="folder-browser-error">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="folder-browser-empty">ファイルがありません</div>
          )}
          {!loading && !error && entries.map((entry, index) => (
            <button
              key={index}
              className="folder-browser-entry"
              onClick={() => handleEntryClick(entry)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                textAlign: 'left',
                minHeight: '40px',
              }}
            >
              {entry.is_dir ? <FolderSmallIcon /> : <FileIcon />}
              <span style={{ flex: 1, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.is_dir ? entry.name : entry.name.replace(/\.json$/i, '')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PresetPanel: React.FC = () => {
  const {
    fontSizes,
    selectedFontSize,
    fonts,
    selectedFont,
    addFontSize,
    removeFontSize,
    selectFontSize,
    addFont,
    removeFont,
    updateFont,
    selectFont,
    appendWorkSpec,
    clearSelection,
  } = usePresetStore();

  const { tool, setTool, setColor } = useDrawingStore();

  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
  const [editingFont, setEditingFont] = useState<FontPreset | undefined>();

  const sizeDropdownRef = useRef<HTMLDivElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target as Node)) {
        setIsSizeDropdownOpen(false);
      }
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setIsFontDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 他のツールに切り替わったら選択を解除
  useEffect(() => {
    // テキストツールとrectツール以外に切り替わった場合は選択解除
    if (tool !== 'text' && tool !== 'rect') {
      clearSelection();
    }
  }, [tool, clearSelection]);

  // 文字サイズ選択
  const handleSelectSize = useCallback((size: number) => {
    if (isDeleteMode) {
      removeFontSize(size);
      return;
    }
    selectFontSize(size);
    setTool('text');
    setColor('#ff0000');
    setIsSizeDropdownOpen(false);
  }, [isDeleteMode, removeFontSize, selectFontSize, setTool, setColor]);

  // フォント選択
  const handleSelectFont = useCallback((font: FontPreset) => {
    if (isDeleteMode) {
      removeFont(font.id);
      return;
    }
    selectFont(font);
    setTool('rect');
    setColor(font.color);
    setIsFontDropdownOpen(false);
  }, [isDeleteMode, removeFont, selectFont, setTool, setColor]);

  // フォント編集
  const handleEditFont = useCallback((font: FontPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFont(font);
    setIsFontModalOpen(true);
  }, []);

  // フォント更新
  const handleUpdateFont = useCallback((id: string, name: string, color: string) => {
    updateFont(id, { name, color });
    setEditingFont(undefined);
  }, [updateFont]);

  // JSONファイルを読み込んでプリセットに追加
  const loadJsonFile = useCallback(async (filePath: string) => {
    try {
      const content = await invoke<string>('read_text_file', { path: filePath });
      const data = JSON.parse(content);

      // プリセットデータの形式に対応
      const presetData = data.presetData || data;

      // 文字サイズを抽出
      let sizes: number[] = [];
      const fontSizeStats = presetData.fontSizeStats;
      if (fontSizeStats) {
        if (Array.isArray(fontSizeStats.sizes)) {
          sizes = fontSizeStats.sizes;
        } else if (Array.isArray(fontSizeStats)) {
          sizes = fontSizeStats;
        }
      }

      // フォントを抽出
      const fontsList: FontPreset[] = [];
      const presets = presetData.presets;
      if (presets) {
        Object.keys(presets).forEach(key => {
          const group = presets[key];
          if (Array.isArray(group)) {
            group.forEach((item: { name?: string; subName?: string; color?: string }) => {
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
    } catch (error) {
      console.error('作品仕様の読み込みに失敗:', error);
    }
  }, [appendWorkSpec]);

  return (
    <div className="preset-panel">
      {/* 作品仕様読み込みボタン */}
      <button
        className={`preset-icon-btn folder-btn`}
        onClick={() => setIsFolderBrowserOpen(true)}
        title="作品仕様を読み込み"
      >
        <FolderIcon />
      </button>

      {/* 文字サイズドロップダウン */}
      <div className="preset-dropdown-container" ref={sizeDropdownRef}>
        <button
          className={`preset-icon-btn ${isSizeDropdownOpen ? 'open' : ''} ${selectedFontSize !== null ? 'active' : ''}`}
          onClick={() => {
            setIsSizeDropdownOpen(!isSizeDropdownOpen);
            setIsFontDropdownOpen(false);
          }}
          title={selectedFontSize !== null ? `文字サイズ: ${selectedFontSize}P` : '文字サイズ'}
        >
          <FontSizeIcon />
          {selectedFontSize !== null && (
            <span className="preset-badge">{selectedFontSize}</span>
          )}
        </button>

        {isSizeDropdownOpen && (
          <div className="preset-dropdown preset-dropdown-left">
            <div className="preset-dropdown-header">文字サイズ</div>
            <div className="preset-palette">
              {fontSizes.map(size => (
                <button
                  key={size}
                  className={`preset-btn ${selectedFontSize === size ? 'active' : ''} ${isDeleteMode ? 'delete-mode' : ''}`}
                  onClick={() => handleSelectSize(size)}
                  style={{ fontSize: '10px' }}
                >
                  {size}P
                </button>
              ))}
            </div>
            <div className="preset-actions">
              <button
                className="preset-action-btn"
                onClick={() => setIsSizeModalOpen(true)}
                title="追加"
              >
                <AddIcon />
              </button>
              <button
                className={`preset-action-btn ${isDeleteMode ? 'active' : ''}`}
                onClick={() => setIsDeleteMode(!isDeleteMode)}
                title="削除モード"
              >
                <DeleteIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* フォント指定ドロップダウン */}
      <div className="preset-dropdown-container" ref={fontDropdownRef}>
        <button
          className={`preset-icon-btn ${isFontDropdownOpen ? 'open' : ''} ${selectedFont !== null ? 'active' : ''}`}
          onClick={() => {
            setIsFontDropdownOpen(!isFontDropdownOpen);
            setIsSizeDropdownOpen(false);
          }}
          title={selectedFont !== null ? `フォント: ${selectedFont.name}` : 'フォント指定'}
          style={selectedFont ? { color: selectedFont.color } : undefined}
        >
          <FontIcon />
        </button>

        {isFontDropdownOpen && (
          <div className="preset-dropdown preset-dropdown-left font-dropdown">
            <div className="preset-dropdown-header">フォント指定</div>
            <div className="preset-palette font-palette">
              {fonts.map(font => (
                <button
                  key={font.id}
                  className={`preset-btn font-btn ${selectedFont?.id === font.id ? 'active' : ''} ${isDeleteMode ? 'delete-mode' : ''}`}
                  onClick={() => handleSelectFont(font)}
                  onDoubleClick={(e) => handleEditFont(font, e)}
                  title={`${font.name} (ダブルクリックで編集)`}
                >
                  <span
                    className="font-color-indicator"
                    style={{ backgroundColor: font.color }}
                  />
                  <span className="font-name">{font.name}</span>
                </button>
              ))}
              {fonts.length === 0 && (
                <div className="preset-empty">フォントがありません</div>
              )}
            </div>
            <div className="preset-actions">
              <button
                className="preset-action-btn"
                onClick={() => {
                  setEditingFont(undefined);
                  setIsFontModalOpen(true);
                }}
                title="追加"
              >
                <AddIcon />
              </button>
              <button
                className={`preset-action-btn ${isDeleteMode ? 'active' : ''}`}
                onClick={() => setIsDeleteMode(!isDeleteMode)}
                title="削除モード"
              >
                <DeleteIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* モーダル */}
      <SizeModal
        isOpen={isSizeModalOpen}
        onClose={() => setIsSizeModalOpen(false)}
        onAdd={addFontSize}
      />
      <FontModal
        isOpen={isFontModalOpen}
        onClose={() => {
          setIsFontModalOpen(false);
          setEditingFont(undefined);
        }}
        onAdd={addFont}
        editFont={editingFont}
        onUpdate={handleUpdateFont}
      />
      <FolderBrowserModal
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onSelectFile={loadJsonFile}
      />
    </div>
  );
};
