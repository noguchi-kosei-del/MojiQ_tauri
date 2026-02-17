import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ProofreadingCheckData, ProofreadingCheckItem } from '../../types';
import './ProofreadingViewer.css';

type TabType = 'both' | 'correctness' | 'proposal';

// Color mapping based on category number
const getCategoryColorClass = (category: string): string => {
  const match = category.match(/^(\d+)\./);
  if (!match) return 'cal-color-default';
  const num = parseInt(match[1], 10);
  const colors = [
    'cal-color-1', 'cal-color-2', 'cal-color-3', 'cal-color-4', 'cal-color-5',
    'cal-color-6', 'cal-color-7', 'cal-color-8', 'cal-color-9', 'cal-color-10',
  ];
  return colors[(num - 1) % colors.length];
};

// Format page number
const formatPage = (page?: string): string => {
  if (!page) return '';
  const match = page.match(/^(\d+)/);
  return match ? `${match[1]}P` : page;
};

// Copy icon
const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

// Check icon
const CheckIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

// Group items by category
const groupByCategory = (items: ProofreadingCheckItem[]): Record<string, ProofreadingCheckItem[]> => {
  const groups: Record<string, ProofreadingCheckItem[]> = {};
  items.forEach(item => {
    const cat = item.category || '未分類';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });
  return groups;
};

// Sort category keys
const sortCategories = (keys: string[]): string[] => {
  return keys.sort((a, b) => {
    const matchA = a.match(/^(\d+)\./);
    const matchB = b.match(/^(\d+)\./);
    if (matchA && matchB) {
      return parseInt(matchA[1]) - parseInt(matchB[1]);
    }
    return a.localeCompare(b, 'ja');
  });
};

// Category items component
interface CategoryItemsProps {
  items: ProofreadingCheckItem[];
  collapsedCategories: Set<string>;
  toggleCategory: (category: string) => void;
  copiedId: string | null;
  handleCopy: (content: string, id: string) => void;
  prefix?: string;
}

const CategoryItems: React.FC<CategoryItemsProps> = ({
  items,
  collapsedCategories,
  toggleCategory,
  copiedId,
  handleCopy,
  prefix = '',
}) => {
  const grouped = groupByCategory(items);
  const sortedKeys = sortCategories(Object.keys(grouped));

  return (
    <>
      {sortedKeys.map(category => {
        const isCollapsed = collapsedCategories.has(`${prefix}${category}`);
        const colorClass = getCategoryColorClass(category);
        const catItems = grouped[category];

        return (
          <div key={category} className={`calibration-category ${colorClass} ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="calibration-category-header" onClick={() => toggleCategory(`${prefix}${category}`)}>
              <span className="calibration-category-toggle">{isCollapsed ? '▶' : '▼'}</span>
              <span className="calibration-category-name">{category}</span>
              <span className="calibration-category-count">({catItems.length})</span>
            </div>
            {!isCollapsed && (
              <div className="calibration-category-body">
                <table className="calibration-table">
                  <tbody>
                    {catItems.map((item, index) => {
                      const itemId = `${prefix}${category}-${index}`;
                      const isCopied = copiedId === itemId;

                      return (
                        <tr key={index}>
                          <td className="cal-page">{formatPage(item.page)}</td>
                          <td className="cal-excerpt">{item.excerpt || ''}</td>
                          <td className="cal-content">{item.content || ''}</td>
                          <td className="cal-copy">
                            {item.content && (
                              <button
                                className={`cal-copy-btn ${isCopied ? 'copied' : ''}`}
                                onClick={() => handleCopy(item.content!, itemId)}
                                title="コピー"
                              >
                                {isCopied ? <CheckIcon /> : <CopyIcon />}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export const ProofreadingViewer: React.FC = () => {
  const [data, setData] = useState<ProofreadingCheckData | null>(null);
  const [allItems, setAllItems] = useState<ProofreadingCheckItem[]>([]);
  const [currentTab, setCurrentTab] = useState<TabType>('both');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Get file path and base path from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    const basePath = params.get('basePath');
    const darkMode = params.get('darkMode') === 'true';

    setIsDarkMode(darkMode);

    if (filePath && basePath) {
      loadFile(decodeURIComponent(filePath), decodeURIComponent(basePath));
      // Extract file name from path
      const parts = filePath.split(/[/\\]/);
      setFileName(parts[parts.length - 1] || '');
    } else {
      setError('ファイルパスが指定されていません');
      setLoading(false);
    }
  }, []);

  const loadFile = async (filePath: string, basePath: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<ProofreadingCheckData>('read_proofreading_check_file', {
        path: filePath,
        basePath: basePath,
      });
      setData(result);

      // Merge items (picked関係なくすべて表示)
      const items: ProofreadingCheckItem[] = [];
      if (result?.checks?.variation?.items) {
        items.push(...result.checks.variation.items);
      }
      if (result?.checks?.simple?.items) {
        items.push(...result.checks.simple.items);
      }
      setAllItems(items);

      // Set default tab to 'both' when checkKind exists
      const hasCheckKindData = items.some(i => i.checkKind);
      if (hasCheckKindData) {
        setCurrentTab('both');
      }
    } catch (e) {
      setError(`ファイルの読み込みに失敗: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Separate items by checkKind
  const correctnessItems = useMemo(() =>
    allItems.filter(item => item.checkKind === 'correctness'), [allItems]);
  const proposalItems = useMemo(() =>
    allItems.filter(item => item.checkKind === 'proposal'), [allItems]);

  // Check if any items have checkKind
  const hasCheckKind = allItems.some(item => item.checkKind);

  // Counts
  const showAllOnly = !hasCheckKind && allItems.length > 0;

  // Toggle category collapse
  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Copy to clipboard
  const handleCopy = useCallback(async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }, []);

  // Title
  const title = useMemo(() => {
    if (!data) return fileName;
    const work = data.work || '';
    return work ? `${work} ${fileName}` : fileName;
  }, [data, fileName]);

  if (loading) {
    return (
      <div className={`proofreading-viewer ${isDarkMode ? 'dark' : ''}`}>
        <div className="viewer-loading">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`proofreading-viewer ${isDarkMode ? 'dark' : ''}`}>
        <div className="viewer-error">{error}</div>
      </div>
    );
  }

  // Render content based on current tab
  const renderContent = () => {
    // If no checkKind exists, show all items
    if (showAllOnly) {
      if (allItems.length === 0) {
        return <div className="calibration-empty">チェック項目がありません</div>;
      }
      return (
        <CategoryItems
          items={allItems}
          collapsedCategories={collapsedCategories}
          toggleCategory={toggleCategory}
          copiedId={copiedId}
          handleCopy={handleCopy}
        />
      );
    }

    if (currentTab === 'both') {
      // Two-column layout
      return (
        <div className="calibration-dual-columns">
          {/* 正誤チェック column */}
          <div className="calibration-column">
            <div className="calibration-column-header correctness-header">
              正誤チェック ({correctnessItems.length})
            </div>
            <div className="calibration-column-content">
              {correctnessItems.length > 0 ? (
                <CategoryItems
                  items={correctnessItems}
                  collapsedCategories={collapsedCategories}
                  toggleCategory={toggleCategory}
                  copiedId={copiedId}
                  handleCopy={handleCopy}
                  prefix="correctness-"
                />
              ) : (
                <div className="calibration-empty">項目がありません</div>
              )}
            </div>
          </div>

          {/* 提案チェック column */}
          <div className="calibration-column">
            <div className="calibration-column-header proposal-header">
              提案チェック ({proposalItems.length})
            </div>
            <div className="calibration-column-content">
              {proposalItems.length > 0 ? (
                <CategoryItems
                  items={proposalItems}
                  collapsedCategories={collapsedCategories}
                  toggleCategory={toggleCategory}
                  copiedId={copiedId}
                  handleCopy={handleCopy}
                  prefix="proposal-"
                />
              ) : (
                <div className="calibration-empty">項目がありません</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Single column layout for correctness or proposal
    const items = currentTab === 'correctness' ? correctnessItems : proposalItems;
    const tabName = currentTab === 'correctness' ? '正誤チェック' : '提案チェック';

    if (items.length === 0) {
      return <div className="calibration-empty">「{tabName}」の項目がありません</div>;
    }

    return (
      <CategoryItems
        items={items}
        collapsedCategories={collapsedCategories}
        toggleCategory={toggleCategory}
        copiedId={copiedId}
        handleCopy={handleCopy}
      />
    );
  };

  // Show tabs when checkKind exists in any items
  const showTabs = hasCheckKind;

  return (
    <div className={`proofreading-viewer ${isDarkMode ? 'dark' : ''}`}>
      {/* Header */}
      <div className="viewer-header">
        <h1 className="viewer-title">{title}</h1>
        {showTabs && (
          <div className="calibration-tabs">
            <button
              className={`calibration-tab ${currentTab === 'both' ? 'active' : ''}`}
              onClick={() => setCurrentTab('both')}
            >
              両方表示
            </button>
            <button
              className={`calibration-tab ${currentTab === 'correctness' ? 'active' : ''}`}
              onClick={() => setCurrentTab('correctness')}
            >
              正誤チェック ({correctnessItems.length})
            </button>
            <button
              className={`calibration-tab ${currentTab === 'proposal' ? 'active' : ''}`}
              onClick={() => setCurrentTab('proposal')}
            >
              提案チェック ({proposalItems.length})
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="viewer-content">
        {renderContent()}
      </div>
    </div>
  );
};
