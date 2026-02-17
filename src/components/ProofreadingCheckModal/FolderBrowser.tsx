import React, { useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { useThemeStore } from '../../stores/themeStore';
import { FolderEntry } from '../../types';

// SVG Icons
const FolderIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const FileIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
  </svg>
);

const BackIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
);

export const FolderBrowser: React.FC = () => {
  const {
    basePath,
    currentPath,
    navigationStack,
    navigateToFolder,
    goBack,
    goToRoot,
    closeModal,
    setLoading,
    setError,
    isLoading,
  } = useProofreadingCheckStore();

  const { theme } = useThemeStore();
  const [entries, setEntries] = useState<FolderEntry[]>([]);

  // Load folder contents when path changes
  useEffect(() => {
    if (currentPath) {
      loadFolderContents();
    }
  }, [currentPath]);

  const loadFolderContents = useCallback(async () => {
    if (!currentPath || !basePath) return;

    try {
      setLoading(true);
      setError(null);
      const items = await invoke<FolderEntry[]>('list_proofreading_check_directory', {
        path: currentPath,
        basePath: basePath,
      });
      setEntries(items);
    } catch (e) {
      setError(`フォルダの読み込みに失敗: ${e}`);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentPath, basePath, setLoading, setError]);

  const handleFolderClick = useCallback((path: string) => {
    navigateToFolder(path);
  }, [navigateToFolder]);

  const handleFileClick = useCallback(async (entry: FolderEntry) => {
    try {
      if (!basePath) {
        setError('ベースパスが設定されていません');
        return;
      }

      console.log('[ProofreadingCheck] ビューアーを開く:', { path: entry.path, basePath, fileName: entry.name });

      // Rustコマンドでウィンドウを開く
      await invoke('open_proofreading_viewer', {
        filePath: entry.path,
        basePath: basePath,
        fileName: entry.name,
        darkMode: theme === 'dark',
      });

      console.log('[ProofreadingCheck] ビューアーウィンドウが作成されました');

      // モーダルを閉じる
      closeModal();
    } catch (e) {
      console.error('[ProofreadingCheck] ビューアーの表示エラー:', e);
      setError(`ビューアーの表示に失敗: ${e}`);
    }
  }, [basePath, theme, closeModal, setError]);

  // Render breadcrumb
  const renderBreadcrumb = () => {
    if (!basePath || !currentPath) {
      return <span className="breadcrumb-root">読み込み中...</span>;
    }

    const normalizedBase = basePath.replace(/\\/g, '/');
    const normalizedCurrent = currentPath.replace(/\\/g, '/');

    if (normalizedCurrent === normalizedBase) {
      return <span className="breadcrumb-root">TOP</span>;
    }

    const relative = normalizedCurrent.substring(normalizedBase.length + 1);
    const parts = relative.split('/').filter(Boolean);

    return (
      <>
        <span className="breadcrumb-crumb clickable" onClick={goToRoot}>TOP</span>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span className={`breadcrumb-crumb ${i === parts.length - 1 ? 'current' : ''}`}>
              {part}
            </span>
          </React.Fragment>
        ))}
      </>
    );
  };

  const canGoBack = navigationStack.length > 0;

  return (
    <div className="folder-browser">
      <div className="folder-header">
        <button
          className="folder-back-btn"
          onClick={goBack}
          disabled={!canGoBack}
          title="戻る"
        >
          <BackIcon />
        </button>
        <div className="folder-breadcrumb">
          {renderBreadcrumb()}
        </div>
      </div>
      <div className="folder-list">
        {isLoading ? (
          <div className="folder-empty">読み込み中...</div>
        ) : entries.length === 0 ? (
          <div className="folder-empty">データがありません</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.path}
              className={`folder-item ${entry.is_dir ? 'folder' : 'file'}`}
              onClick={() => entry.is_dir ? handleFolderClick(entry.path) : handleFileClick(entry)}
            >
              <span className="folder-item-icon">
                {entry.is_dir ? <FolderIcon /> : <FileIcon />}
              </span>
              <span className="folder-item-name">{entry.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
