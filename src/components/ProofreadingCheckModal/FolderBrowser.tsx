import React, { useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { FolderEntry, ProofreadingCheckData } from '../../types';

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
    setCurrentData,
    isLoading,
  } = useProofreadingCheckStore();
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [isLoadCompleteOpen, setIsLoadCompleteOpen] = useState(false);

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

      // 「校正チェックデータ」フォルダの自動スキップ（旧MojiQ準拠）
      const subFolders = items.filter(i => i.is_dir);
      if (subFolders.length === 1 && subFolders[0].name === '校正チェックデータ') {
        navigateToFolder(subFolders[0].path);
        return;
      }

      setEntries(items);
    } catch (e) {
      setError(`フォルダの読み込みに失敗: ${e}`);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentPath, basePath, setLoading, setError, navigateToFolder]);

  const handleFolderClick = useCallback((path: string) => {
    navigateToFolder(path);
  }, [navigateToFolder]);

  const handleFileClick = useCallback(async (entry: FolderEntry) => {
    try {
      if (!basePath) {
        setError('ベースパスが設定されていません');
        return;
      }

      setLoading(true);

      // JSONファイルを読み込んでストアにセット
      const data = await invoke<ProofreadingCheckData>('read_proofreading_check_file', {
        path: entry.path,
        basePath: basePath,
      });

      // ファイル名から拡張子を除去してタイトルを生成
      const fileNameWithoutExt = entry.name.replace(/\.json$/i, '');
      const workName = data.work || '';
      const title = workName ? `${workName} ${fileNameWithoutExt}` : fileNameWithoutExt;

      // ストアにデータをセット（タイトルを含む）
      setCurrentData({ ...data, title }, entry.name);

      // モーダルを閉じる
      closeModal();

      // 読み込み完了ダイアログを表示
      setIsLoadCompleteOpen(true);
    } catch (e) {
      console.error('[ProofreadingCheck] JSONファイルの読み込みエラー:', e);
      setError(`ファイルの読み込みに失敗: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [basePath, closeModal, setError, setLoading, setCurrentData]);

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

      {/* 読み込み完了ダイアログ */}
      {isLoadCompleteOpen && (
        <div className="load-complete-overlay" onClick={() => setIsLoadCompleteOpen(false)}>
          <div className="load-complete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="load-complete-body">
              <p>校正チェックデータを読み込みました</p>
            </div>
            <div className="load-complete-actions">
              <button className="load-complete-btn" onClick={() => setIsLoadCompleteOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
