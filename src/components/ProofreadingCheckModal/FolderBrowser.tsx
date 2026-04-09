import React, { useEffect, useCallback, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { FolderEntry, ProofreadingCheckData } from '../../types';

interface SearchResult {
  name: string;
  path: string;
  relative_path: string;
}

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

const SearchIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)' }}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

/** テキスト内のクエリ一致部分をハイライトして返す */
const highlightMatch = (text: string, query: string) => {
  if (!query) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="spec-search-highlight">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
};

export const FolderBrowser: React.FC = () => {
  const {
    basePath,
    currentPath,
    navigationStack,
    navigateToFolder,
    goBack,
    closeModal,
    setLoading,
    setError,
    setCurrentData,
    isLoading,
  } = useProofreadingCheckStore();
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [isLoadCompleteOpen, setIsLoadCompleteOpen] = useState(false);

  // 検索
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 検索実行（デバウンス300ms）
  const performSearch = useCallback(async (query: string) => {
    if (!query || !basePath) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await invoke<SearchResult[]>('search_json_files_recursive', {
        basePath,
        query,
      });
      setSearchResults(results);
    } catch (e) {
      console.error('検索エラー:', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [basePath]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

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

  // 現在のフォルダ名を取得
  const getCurrentFolderName = () => {
    if (!basePath || !currentPath) return '読み込み中...';

    const normalizedBase = basePath.replace(/\\/g, '/');
    const normalizedCurrent = currentPath.replace(/\\/g, '/');

    if (normalizedCurrent === normalizedBase) return 'TOP';

    const parts = normalizedCurrent.substring(normalizedBase.length + 1).split('/').filter(Boolean);
    return parts[parts.length - 1] || 'TOP';
  };

  const canGoBack = navigationStack.length > 0;
  const isAtRoot = !canGoBack;

  return (
    <>
      {/* ヘッダー（戻る + フォルダ名） */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <button
          onClick={goBack}
          disabled={isAtRoot || !!searchQuery}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, marginRight: 8, opacity: (isAtRoot || !!searchQuery) ? 0.3 : 1 }}
        >
          <BackIcon />
        </button>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getCurrentFolderName()}
        </span>
      </div>

      {/* 検索バー */}
      <div className="spec-search-bar">
        <SearchIcon />
        <input
          type="text"
          className="spec-search-input"
          placeholder="検索..."
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') clearSearch(); }}
          autoComplete="off"
        />
        {searchQuery && (
          <button className="spec-search-clear" onClick={clearSearch}>&times;</button>
        )}
      </div>

      {/* 検索結果 or フォルダ一覧 */}
      {searchQuery ? (
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: 8, background: 'var(--folder-list-bg, #eee)' }}>
          {isSearching ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>検索中...</div>
          ) : searchResults.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>一致する結果がありません</div>
          ) : (
            <>
              <div className="spec-search-result-count">{searchResults.length}件</div>
              {searchResults.map((result) => (
                <button
                  key={result.path}
                  onClick={() => handleFileClick({ name: result.name, path: result.path, is_dir: false })}
                  className="spec-search-result-item"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <FileIcon />
                  <div className="spec-search-result-info">
                    <span className="spec-search-result-name">{highlightMatch(result.name.replace(/\.json$/i, ''), searchQuery)}</span>
                    <span className="spec-search-result-path">{highlightMatch(result.relative_path, searchQuery)}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: 8, background: 'var(--folder-list-bg, #eee)' }}>
          {isLoading ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>読み込み中...</div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>データがありません</div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => entry.is_dir ? handleFolderClick(entry.path) : handleFileClick(entry)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {entry.is_dir ? <FolderIcon /> : <FileIcon />}
                <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}

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
    </>
  );
};
