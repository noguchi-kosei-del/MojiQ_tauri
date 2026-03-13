import React, { useState, useMemo, useCallback } from 'react';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { useThemeStore } from '../../stores/themeStore';
import { useDrawingStore } from '../../stores/drawingStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { ProofreadingCheckItem } from '../../types';
import { isLandscapeDocument, nombreToPdfPage } from '../../utils/pageNumberUtils';
import './ProofreadingPanel.css';

// Comment item for PDF annotations
interface CommentItem {
  pageIndex: number;  // 0-based page index
  pageDisplay: string;  // Display string like "1P"
  text: string;
  type: string;
}

// Parse page string and extract page number
// Supports: "3巻 6ページ", "3巻1P", "25P", "25ページ", "25"
const parsePageNumber = (pageStr?: string): number | null => {
  if (!pageStr) return null;
  const str = String(pageStr);

  // Try to match "〇〇ページ" or "〇〇P" pattern
  let pageMatch = str.match(/(\d+)\s*(?:ページ|P)/i);
  if (!pageMatch) {
    // Fallback: use leading digits
    pageMatch = str.match(/^(\d+)/);
  }
  if (!pageMatch) return null;

  const pageNum = parseInt(pageMatch[1], 10);
  return isNaN(pageNum) || pageNum < 1 ? null : pageNum;
};

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

// Icons
const FolderOpenIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const CheckListIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="10" y1="6" x2="21" y2="6"/>
    <line x1="10" y1="12" x2="21" y2="12"/>
    <line x1="10" y1="18" x2="21" y2="18"/>
    <polyline points="3,6 4,7 6,5"/>
    <polyline points="3,12 4,13 6,11"/>
    <polyline points="3,18 4,19 6,17"/>
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

// 折りたたみボタンアイコン（RightToolbarと統一）
const CollapseRightIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ExpandLeftIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

// Category items component
interface CategoryItemsProps {
  items: ProofreadingCheckItem[];
  collapsedCategories: Set<string>;
  toggleCategory: (category: string) => void;
  copiedId: string | null;
  handleCopy: (content: string, id: string) => void;
  handlePageClick: (pageStr?: string) => void;
  prefix?: string;
}

const CategoryItems: React.FC<CategoryItemsProps> = ({
  items,
  collapsedCategories,
  toggleCategory,
  copiedId,
  handleCopy,
  handlePageClick,
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
          <div key={category} className={`panel-category ${colorClass} ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-category-header" onClick={() => toggleCategory(`${prefix}${category}`)}>
              <span className="panel-category-toggle">{isCollapsed ? '▶' : '▼'}</span>
              <span className="panel-category-name">{category}</span>
              <span className="panel-category-count">({catItems.length})</span>
            </div>
            {!isCollapsed && (
              <div className="panel-category-body">
                <table className="panel-table">
                  <tbody>
                    {catItems.map((item, index) => {
                      const itemId = `${prefix}${category}-${index}`;
                      const isCopied = copiedId === itemId;
                      const hasPage = !!item.page;

                      return (
                        <tr key={index}>
                          <td
                            className={`panel-page ${hasPage ? 'clickable' : ''}`}
                            onClick={hasPage ? (e) => { e.stopPropagation(); handlePageClick(item.page); } : undefined}
                            title={hasPage ? 'クリックでページにジャンプ' : undefined}
                          >
                            {formatPage(item.page)}
                          </td>
                          <td className="panel-excerpt">{item.excerpt || ''}</td>
                          <td className="panel-content">{item.content || ''}</td>
                          <td className="panel-copy">
                            {item.content && (
                              <button
                                className={`panel-copy-btn ${isCopied ? 'copied' : ''}`}
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

export const ProofreadingPanel: React.FC = () => {
  const { theme } = useThemeStore();
  const {
    currentData,
    currentFileName,
    allItems,
    currentTab,
    setCurrentTab,
    isLoading,
    error,
    openModal,
  } = useProofreadingCheckStore();
  const { pages, setCurrentPage, pdfAnnotations } = useDrawingStore();
  const { isProofreadingPanelCollapsed, toggleProofreadingPanel } = useSidebarStore();

  // Flatten PDF annotations into comment items
  const commentItems = useMemo((): CommentItem[] => {
    const items: CommentItem[] = [];
    if (!pdfAnnotations) return items;

    pdfAnnotations.forEach((pageAnnotations, pageIndex) => {
      if (!pageAnnotations) return;
      pageAnnotations.forEach(annot => {
        if (annot.text && annot.text.trim()) {
          // Calculate page display (1-based, handle landscape)
          const isLandscape = pages.length > 0 && isLandscapeDocument(pages);
          let pageDisplay: string;
          if (isLandscape && pageIndex > 0) {
            // Landscape: page 0 = 1P, page 1 = 2-3P, page 2 = 4-5P, etc.
            const startNombre = pageIndex * 2;
            const endNombre = startNombre + 1;
            pageDisplay = `${startNombre}-${endNombre}P`;
          } else {
            pageDisplay = `${pageIndex + 1}P`;
          }

          items.push({
            pageIndex,
            pageDisplay,
            text: annot.text,
            type: annot.pdfAnnotationSource || 'Text',
          });
        }
      });
    });

    return items;
  }, [pdfAnnotations, pages]);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Separate items by checkKind
  const correctnessItems = useMemo(() =>
    allItems.filter(item => item.checkKind === 'correctness'), [allItems]);
  const proposalItems = useMemo(() =>
    allItems.filter(item => item.checkKind === 'proposal'), [allItems]);

  // Check if any items have checkKind
  const hasCheckKind = allItems.some(item => item.checkKind);
  // Always show tabs when we have data or comments
  const showTabs = (hasCheckKind && allItems.length > 0) || commentItems.length > 0 || currentData;

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

  // Jump to page
  const handlePageClick = useCallback((pageStr?: string) => {
    if (!pageStr || pages.length === 0) return;

    let pageNum = parsePageNumber(pageStr);
    if (!pageNum) return;

    // Handle landscape documents (見開きPDF)
    const isLandscape = isLandscapeDocument(pages);
    if (isLandscape && pageNum >= 2) {
      // Convert nombre to PDF page
      // ノンブル2,3 → PDFページ2
      // ノンブル4,5 → PDFページ3
      pageNum = nombreToPdfPage(pageNum, true);
    }

    // Validate page number range
    if (pageNum < 1 || pageNum > pages.length) {
      console.warn(`[ProofreadingPanel] Page ${pageNum} out of range (1-${pages.length})`);
      return;
    }

    // setCurrentPage uses 0-based index
    setCurrentPage(pageNum - 1);
  }, [pages, setCurrentPage]);

  // Title
  const title = useMemo(() => {
    if (!currentData) return currentFileName || '校正チェック';
    // Use title if set, otherwise fall back to work or fileName
    if (currentData.title) return currentData.title;
    const work = currentData.work || '';
    return work || currentFileName || '校正チェック';
  }, [currentData, currentFileName]);

  // Handle comment page click (0-based index)
  const handleCommentPageClick = useCallback((pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= pages.length) return;
    setCurrentPage(pageIndex);
  }, [pages.length, setCurrentPage]);

  // Render comments tab content
  const renderCommentsContent = () => {
    if (commentItems.length === 0) {
      return <div className="panel-empty-small">コメントがありません</div>;
    }

    return (
      <div className="panel-comments-list">
        {commentItems.map((comment, index) => (
          <div key={index} className="panel-comment-item">
            <div className="panel-comment-header">
              <span
                className="panel-comment-page clickable"
                onClick={() => handleCommentPageClick(comment.pageIndex)}
                title="クリックでページにジャンプ"
              >
                {comment.pageDisplay}
              </span>
              <span className={`panel-comment-type ${comment.type.toLowerCase()}`}>
                {comment.type}
              </span>
            </div>
            <div className="panel-comment-text">{comment.text}</div>
          </div>
        ))}
      </div>
    );
  };

  // Render content based on current tab
  const renderContent = () => {
    // Comments tab - show PDF annotations
    if (currentTab === 'comments') {
      return renderCommentsContent();
    }

    // Check tabs - need data
    if (!currentData || allItems.length === 0) {
      return (
        <div className="panel-empty">
          <p>校正チェックJSONを選択してください</p>
          <button className="panel-select-btn" onClick={openModal}>
            <FolderOpenIcon />
            <span>ファイルを選択</span>
          </button>
        </div>
      );
    }

    // If no checkKind exists, show all items
    if (!hasCheckKind) {
      return (
        <CategoryItems
          items={allItems}
          collapsedCategories={collapsedCategories}
          toggleCategory={toggleCategory}
          copiedId={copiedId}
          handleCopy={handleCopy}
          handlePageClick={handlePageClick}
        />
      );
    }

    // Single column layout for correctness or proposal
    const items = currentTab === 'correctness' ? correctnessItems : proposalItems;
    const tabName = currentTab === 'correctness' ? '正誤チェック' : '提案チェック';

    if (items.length === 0) {
      return <div className="panel-empty-small">「{tabName}」の項目がありません</div>;
    }

    return (
      <CategoryItems
        items={items}
        collapsedCategories={collapsedCategories}
        toggleCategory={toggleCategory}
        copiedId={copiedId}
        handleCopy={handleCopy}
        handlePageClick={handlePageClick}
      />
    );
  };

  const isDarkMode = theme === 'dark';

  return (
    <div className={`proofreading-panel ${isDarkMode ? 'dark' : ''} ${isProofreadingPanelCollapsed ? 'collapsed' : ''}`}>
      {/* 折りたたみヘッダー */}
      <div className="panel-collapse-header">
        <button
          className="panel-toggle-btn"
          onClick={toggleProofreadingPanel}
          title={isProofreadingPanelCollapsed ? 'パネルを展開' : 'パネルを折り畳む'}
        >
          {isProofreadingPanelCollapsed ? <ExpandLeftIcon /> : <CollapseRightIcon />}
        </button>
      </div>

      {!isProofreadingPanelCollapsed && (
        <>
          {/* 校正チェック読み込みボタン */}
          <div className="panel-load-section">
            <button
              className="panel-load-btn"
              onClick={openModal}
            >
              <CheckListIcon />
              <span>校正チェックを読み込み</span>
            </button>
          </div>

          {/* Header */}
          <div className="panel-header">
            <div className="panel-header-top">
              <h2 className="panel-title">{title}</h2>
              <button
                className="panel-folder-btn"
                onClick={openModal}
                title="ファイルを選択"
              >
                <FolderOpenIcon />
              </button>
            </div>
            {showTabs && (
              <div className="panel-tabs">
                <button
                  className={`panel-tab ${currentTab === 'comments' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('comments')}
                >
                  コメント{commentItems.length > 0 ? ` (${commentItems.length})` : ''}
                </button>
                <button
                  className={`panel-tab ${currentTab === 'correctness' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('correctness')}
                >
                  正誤{correctnessItems.length > 0 ? ` (${correctnessItems.length})` : ''}
                </button>
                <button
                  className={`panel-tab ${currentTab === 'proposal' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('proposal')}
                >
                  提案{proposalItems.length > 0 ? ` (${proposalItems.length})` : ''}
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="panel-content">
            {isLoading ? (
              <div className="panel-loading">読み込み中...</div>
            ) : error ? (
              <div className="panel-error">{error}</div>
            ) : (
              renderContent()
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProofreadingPanel;
