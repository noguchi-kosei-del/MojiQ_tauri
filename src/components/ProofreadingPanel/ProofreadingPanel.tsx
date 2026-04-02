import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { useThemeStore } from '../../stores/themeStore';
import { useDrawingStore } from '../../stores/drawingStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useModeStore } from '../../stores/modeStore';
import { ProofreadingCheckItem, StampType } from '../../types';
import { isLandscapeDocument, pdfPageToNombreRange } from '../../utils/pageNumberUtils';
import './ProofreadingPanel.css';

// プリセットカラー（赤、青）
const PRESET_COLORS = ['#ff0000', '#0000ff'];

// グラデーションカラー（指示入れモードと同じ）
const GRADIENT_COLORS = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00',
  '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff',
  '#ff00ff', '#ff0080',
];

// Comment item for PDF annotations and MojiQ texts
interface CommentItem {
  pageIndex: number;  // 0-based page index
  pageDisplay: string;  // Display string like "1P"
  text: string;
  type: string;  // 'Text', 'FreeText', 'MojiQ', 'Annotation' など
  source: 'pdf' | 'text' | 'annotation';  // コメントのソース種別
  x: number;  // 座標
  y: number;  // 座標
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

// スポイトアイコン
const EyedropperIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 3l2 2-1 1-2-2"/>
    <path d="M17 5l-10 10-2 4 4-2 10-10"/>
    <path d="M11 9l4 4"/>
    <path d="M9 11l4 4"/>
    <path d="M5 19l-2 2"/>
  </svg>
);

// EyeDropper API type definition
interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperAPI {
  open(): Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperAPI;
  }
}

// Category items component
interface CategoryItemsProps {
  items: ProofreadingCheckItem[];
  collapsedCategories: Set<string>;
  toggleCategory: (category: string) => void;
  handlePageClick: (pageStr?: string) => void;
  onContentClick?: (content: string, checkKind?: 'correctness' | 'proposal') => void;
  prefix?: string;
  checkedItems?: Set<string>;
  onToggleCheck?: (itemId: string) => void;
  onToggleCategoryCheck?: (itemIds: string[], checked: boolean) => void;
}

const CategoryItems: React.FC<CategoryItemsProps> = ({
  items,
  collapsedCategories,
  toggleCategory,
  handlePageClick,
  onContentClick,
  prefix = '',
  checkedItems,
  onToggleCheck,
  onToggleCategoryCheck,
}) => {
  const grouped = groupByCategory(items);
  const sortedKeys = sortCategories(Object.keys(grouped));

  return (
    <>
      {sortedKeys.map(category => {
        const isCollapsed = collapsedCategories.has(`${prefix}${category}`);
        const colorClass = getCategoryColorClass(category);
        const catItems = grouped[category];

        // カテゴリ内の全アイテムIDを取得
        const categoryItemIds = catItems.map((_, index) => `${prefix}${category}-${index}`);
        // カテゴリ内の全アイテムがチェックされているか
        const allCategoryChecked = categoryItemIds.length > 0 &&
          categoryItemIds.every(id => checkedItems?.has(id));
        // カテゴリ内の一部がチェックされているか（indeterminate状態用）
        const someCategoryChecked = categoryItemIds.some(id => checkedItems?.has(id));

        return (
          <div key={category} className={`panel-category ${colorClass} ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-category-header">
              {onToggleCategoryCheck && (
                <label className="panel-category-checkbox" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={allCategoryChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someCategoryChecked && !allCategoryChecked;
                    }}
                    onChange={() => onToggleCategoryCheck(categoryItemIds, !allCategoryChecked)}
                  />
                </label>
              )}
              <span className="panel-category-toggle" onClick={() => toggleCategory(`${prefix}${category}`)}>{isCollapsed ? '▶' : '▼'}</span>
              <span className="panel-category-name" onClick={() => toggleCategory(`${prefix}${category}`)}>{category}</span>
              <span className="panel-category-count" onClick={() => toggleCategory(`${prefix}${category}`)}>({catItems.length})</span>
              {allCategoryChecked && <span className="panel-category-checked-label">確認済み</span>}
            </div>
            {!isCollapsed && (
              <div className="panel-category-body">
                <table className="panel-table">
                  <tbody>
                    {catItems.map((item, index) => {
                      const itemId = `${prefix}${category}-${index}`;
                      const hasPage = !!item.page;
                      const isChecked = checkedItems?.has(itemId) ?? false;

                      return (
                        <tr key={index} className={isChecked ? 'checked' : ''}>
                          {onToggleCheck && (
                            <td className="panel-checkbox">
                              <label onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => onToggleCheck(itemId)}
                                />
                              </label>
                            </td>
                          )}
                          <td
                            className={`panel-page ${hasPage ? 'clickable' : ''}`}
                            onClick={hasPage ? (e) => { e.stopPropagation(); handlePageClick(item.page); } : undefined}
                            title={hasPage ? 'クリックでページにジャンプ' : undefined}
                          >
                            {formatPage(item.page)}
                          </td>
                          <td className="panel-excerpt">{item.excerpt || ''}</td>
                          <td
                            className={`panel-content ${item.content ? 'clickable' : ''}`}
                            onClick={item.content ? (e) => { e.stopPropagation(); onContentClick?.(item.content!, item.checkKind); } : undefined}
                            title={item.content ? 'クリックでテキスト描画モード' : undefined}
                          >
                            {item.content || ''}
                          </td>
                          <td className="panel-item-status">
                            {isChecked && <span className="panel-item-checked-label">確認済み</span>}
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
  const { pages, setCurrentPage, pdfAnnotations, color, setColor, strokeWidth, setStrokeWidth, tool, setTool, currentStampType, setCurrentStampType, addDoneStampToPage, removeShapeById, setActiveProofreadingText } = useDrawingStore();
  const { isProofreadingPanelCollapsed, toggleProofreadingPanel } = useSidebarStore();
  const { mode } = useModeStore();
  const isInstructionMode = mode === 'instruction';

  // カラー選択
  const handleColorSelect = useCallback((newColor: string) => {
    setColor(newColor);
  }, [setColor]);

  // 線の太さ変更（数値入力）
  const handleStrokeWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= 20) {
      setStrokeWidth(value);
    }
  }, [setStrokeWidth]);

  // 線の太さ変更（スライダー）
  const handleStrokeWidthSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setStrokeWidth(value);
  }, [setStrokeWidth]);

  // 線の太さスライダーのホイール操作
  const handleStrokeWidthWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newValue = Math.max(1, Math.min(20, strokeWidth + delta));
    setStrokeWidth(newValue);
  }, [strokeWidth, setStrokeWidth]);

  // スポイトツール
  const handleEyedropper = useCallback(async () => {
    if (!window.EyeDropper) {
      console.warn('EyeDropper API is not supported in this browser');
      return;
    }
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      setColor(result.sRGBHex);
    } catch (e) {
      // User cancelled or error
      console.log('EyeDropper cancelled or error:', e);
    }
  }, [setColor]);

  // Check if EyeDropper API is available
  const isEyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;

  // スタンプ選択ハンドラー
  const handleStampSelect = useCallback((stampType: StampType) => {
    setCurrentStampType(stampType);
    setTool('stamp');
    setColor('#ff0000');
  }, [setCurrentStampType, setTool, setColor]);

  // 済スタンプがアクティブかどうか
  const isDoneStampActive = tool === 'stamp' && currentStampType === 'doneStamp';
  // ルビスタンプがアクティブかどうか
  const isRubyStampActive = tool === 'stamp' && currentStampType === 'rubyStamp';

  // Check if document is landscape (spread PDF)
  const isLandscape = useMemo(() => isLandscapeDocument(pages), [pages]);

  // ページ表示文字列を計算するヘルパー関数
  const getPageDisplay = useCallback((pageIndex: number, x: number, pageWidth: number): string => {
    const pdfPageNum = pageIndex + 1;
    if (isLandscape && pdfPageNum >= 2) {
      const [startNombre, endNombre] = pdfPageToNombreRange(pdfPageNum, true);
      if (pageWidth > 0 && x !== undefined) {
        if (x < pageWidth / 2) {
          return `${endNombre}P`;
        } else {
          return `${startNombre}P`;
        }
      } else {
        return `${startNombre}-${endNombre}P`;
      }
    }
    return `${pdfPageNum}P`;
  }, [isLandscape]);

  // Flatten PDF annotations and MojiQ texts into comment items
  const commentItems = useMemo((): CommentItem[] => {
    const items: CommentItem[] = [];

    // 1. PDF注釈を収集
    if (pdfAnnotations) {
      pdfAnnotations.forEach((pageAnnotations, pageIndex) => {
        if (!pageAnnotations) return;
        const pageData = pages[pageIndex];
        const pageWidth = pageData?.width || 0;

        pageAnnotations.forEach(annot => {
          if (annot.text && annot.text.trim()) {
            items.push({
              pageIndex,
              pageDisplay: getPageDisplay(pageIndex, annot.x, pageWidth),
              text: annot.text,
              type: annot.pdfAnnotationSource || 'Text',
              source: 'pdf',
              x: annot.x,
              y: annot.y,
            });
          }
        });
      });
    }

    // 2. ユーザー入力のMojiQテキストを収集（PDF注釈由来でないもの）
    pages.forEach((pageState, pageIndex) => {
      if (!pageState?.layers) return;
      const pageWidth = pageState.width || 0;

      pageState.layers.forEach(layer => {
        // テキスト要素を収集（PDF注釈由来でないもの）
        layer.texts?.forEach(textEl => {
          if (!textEl.pdfAnnotationSource && textEl.text && textEl.text.trim()) {
            items.push({
              pageIndex,
              pageDisplay: getPageDisplay(pageIndex, textEl.x, pageWidth),
              text: textEl.text,
              type: 'MojiQ',
              source: 'text',
              x: textEl.x,
              y: textEl.y,
            });
          }
        });

        // アノテーション付き図形のテキストを収集
        layer.shapes?.forEach(shape => {
          if (shape.annotation && shape.annotation.text && shape.annotation.text.trim()) {
            items.push({
              pageIndex,
              pageDisplay: getPageDisplay(pageIndex, shape.annotation.x, pageWidth),
              text: shape.annotation.text,
              type: 'Annotation',
              source: 'annotation',
              x: shape.annotation.x,
              y: shape.annotation.y,
            });
          }
        });
      });
    });

    // ページ順、Y座標順でソート
    items.sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return a.y - b.y;
    });

    return items;
  }, [pdfAnnotations, pages, getPageDisplay]);

  // JSON未読み込みでPDF注釈コメントがある場合、自動でコメントタブに切り替え
  useEffect(() => {
    if (!currentData && commentItems.length > 0 && currentTab !== 'comments') {
      setCurrentTab('comments');
    }
  }, [currentData, commentItems.length, currentTab, setCurrentTab]);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // チェック済み状態はストアで管理（永続化対象）
  const {
    checkedComments,
    checkedCorrectnessItems,
    checkedProposalItems,
    toggleCheckedComment,
    toggleCheckedCorrectnessItem,
    toggleCheckedProposalItem,
    toggleCheckedCorrectnessCategory,
    toggleCheckedProposalCategory,
    resetCheckedState,
  } = useProofreadingCheckStore();

  // コメント済スタンプの対応表（ローカル管理: スタンプIDはセッション固有のため）
  const [commentDoneStamps, setCommentDoneStamps] = useState<Map<number, { pageIndex: number; stampId: string }>>(new Map());

  // チェックボックス変更ハンドラー
  const toggleCommentChecked = useCallback((commentIndex: number) => {
    const comment = commentItems[commentIndex];
    if (!comment) return;

    const isNowChecked = toggleCheckedComment(commentIndex);

    if (!isNowChecked) {
      // チェック解除 → スタンプ削除
      const stampInfo = commentDoneStamps.get(commentIndex);
      if (stampInfo) {
        removeShapeById(stampInfo.pageIndex, stampInfo.stampId);
        setCommentDoneStamps(prev => {
          const next = new Map(prev);
          next.delete(commentIndex);
          return next;
        });
      }
    } else {
      // チェック → スタンプ追加
      const stampId = addDoneStampToPage(comment.pageIndex, { x: comment.x, y: comment.y });
      if (stampId) {
        setCommentDoneStamps(prev => {
          const next = new Map(prev);
          next.set(commentIndex, { pageIndex: comment.pageIndex, stampId });
          return next;
        });
      }
    }
  }, [commentItems, commentDoneStamps, toggleCheckedComment, addDoneStampToPage, removeShapeById]);

  // Separate items by checkKind
  const correctnessItems = useMemo(() =>
    allItems.filter(item => item.checkKind === 'correctness'), [allItems]);
  const proposalItems = useMemo(() =>
    allItems.filter(item => item.checkKind === 'proposal'), [allItems]);

  // PDF/JPEG読み込み時にチェック状態をリセット
  const pagesLengthRef = useRef(pages.length);
  useEffect(() => {
    // ページ数が変わった場合（新しいファイルが読み込まれた）にリセット
    if (pages.length !== pagesLengthRef.current) {
      pagesLengthRef.current = pages.length;
      resetCheckedState();
      setCommentDoneStamps(new Map());
    }
  }, [pages.length, resetCheckedState]);

  // 正誤・提案のアイテムID一覧を取得（全アイテム数のカウント用）
  const correctnessItemIds = useMemo(() => {
    const ids: string[] = [];
    const grouped = groupByCategory(correctnessItems);
    Object.keys(grouped).forEach(category => {
      grouped[category].forEach((_, index) => {
        ids.push(`correctness-${category}-${index}`);
      });
    });
    return ids;
  }, [correctnessItems]);

  const proposalItemIds = useMemo(() => {
    const ids: string[] = [];
    const grouped = groupByCategory(proposalItems);
    Object.keys(grouped).forEach(category => {
      grouped[category].forEach((_, index) => {
        ids.push(`proposal-${category}-${index}`);
      });
    });
    return ids;
  }, [proposalItems]);

  // 正誤チェックボックス変更ハンドラー
  const toggleCorrectnessCheck = useCallback((itemId: string) => {
    toggleCheckedCorrectnessItem(itemId);
  }, [toggleCheckedCorrectnessItem]);

  // 提案チェックボックス変更ハンドラー
  const toggleProposalCheck = useCallback((itemId: string) => {
    toggleCheckedProposalItem(itemId);
  }, [toggleCheckedProposalItem]);

  // 正誤カテゴリ全体チェックハンドラー
  const toggleCorrectnessCategoryCheck = useCallback((itemIds: string[], checked: boolean) => {
    toggleCheckedCorrectnessCategory(itemIds, checked);
  }, [toggleCheckedCorrectnessCategory]);

  // 提案カテゴリ全体チェックハンドラー
  const toggleProposalCategoryCheck = useCallback((itemIds: string[], checked: boolean) => {
    toggleCheckedProposalCategory(itemIds, checked);
  }, [toggleCheckedProposalCategory]);

  // 検索機能
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // タブ切替時に検索をクリア
  const handleTabChange = useCallback((tab: 'correctness' | 'proposal' | 'comments') => {
    setCurrentTab(tab);
    setSearchQuery('');
  }, [setCurrentTab]);

  // 検索クリア
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  // 検索フィルタ（正誤/提案）
  const filterItemsBySearch = useCallback((items: ProofreadingCheckItem[], query: string): ProofreadingCheckItem[] => {
    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter(item =>
      (item.content && item.content.toLowerCase().includes(lower)) ||
      (item.excerpt && item.excerpt.toLowerCase().includes(lower)) ||
      (item.category && item.category.toLowerCase().includes(lower))
    );
  }, []);

  // 検索フィルタ（コメント）
  const filteredCommentItems = useMemo(() => {
    if (!searchQuery) return commentItems;
    const lower = searchQuery.toLowerCase();
    return commentItems.filter(c => c.text.toLowerCase().includes(lower));
  }, [commentItems, searchQuery]);

  // 検索結果件数
  const searchMatchCount = useMemo(() => {
    if (!searchQuery) return -1;
    if (currentTab === 'comments') return filteredCommentItems.length;
    const items = currentTab === 'correctness' ? correctnessItems : proposalItems;
    return filterItemsBySearch(items, searchQuery).length;
  }, [searchQuery, currentTab, correctnessItems, proposalItems, filteredCommentItems, filterItemsBySearch]);

  // Check if any items have checkKind
  const hasCheckKind = allItems.some(item => item.checkKind);
  // Always show tabs when we have data or comments
  const showTabs = (hasCheckKind && allItems.length > 0) || commentItems.length > 0 || currentData;

  // すべてのコメントがチェックされているか
  const allCommentsChecked = commentItems.length > 0 && checkedComments.size === commentItems.length;
  // すべての正誤がチェックされているか
  const allCorrectnessChecked = correctnessItemIds.length > 0 && checkedCorrectnessItems.size === correctnessItemIds.length;
  // すべての提案がチェックされているか
  const allProposalChecked = proposalItemIds.length > 0 && checkedProposalItems.size === proposalItemIds.length;

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

  // Jump to page
  const handlePageClick = useCallback((pageStr?: string) => {
    if (!pageStr || pages.length === 0) return;

    const pageNum = parsePageNumber(pageStr);
    if (!pageNum) return;

    // Validate page number range
    if (pageNum < 1 || pageNum > pages.length) {
      console.warn(`[ProofreadingPanel] Page ${pageNum} out of range (1-${pages.length})`);
      return;
    }

    // setCurrentPage uses 0-based index
    setCurrentPage(pageNum - 1);
  }, [pages, setCurrentPage]);

  // Handle content click - set proofreading text for direct drawing
  const handleContentClick = useCallback((content: string, checkKind?: 'correctness' | 'proposal') => {
    if (!content) return;
    const textColor = checkKind === 'proposal' ? '#0000ff' : '#ff0000';
    setActiveProofreadingText(content, textColor);
  }, [setActiveProofreadingText]);

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

    const displayComments = searchQuery ? filteredCommentItems : commentItems;
    if (searchQuery && displayComments.length === 0) {
      return <div className="panel-empty-small">検索結果がありません</div>;
    }

    return (
      <div className="panel-comments-list">
        {displayComments.map((comment) => {
          const index = commentItems.indexOf(comment);
          const isChecked = checkedComments.has(index);
          return (
            <div key={index} className={`panel-comment-item ${isChecked ? 'checked' : ''}`}>
              <label className="panel-comment-checkbox" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCommentChecked(index)}
                />
              </label>
              {isChecked && <span className="panel-comment-done-badge">済</span>}
              <div className="panel-comment-body">
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
            </div>
          );
        })}
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
          handlePageClick={handlePageClick}
          onContentClick={handleContentClick}
        />
      );
    }

    // Single column layout for correctness or proposal
    const rawItems = currentTab === 'correctness' ? correctnessItems : proposalItems;
    const items = filterItemsBySearch(rawItems, searchQuery);
    const tabName = currentTab === 'correctness' ? '正誤チェック' : '提案チェック';
    const checkedItems = currentTab === 'correctness' ? checkedCorrectnessItems : checkedProposalItems;
    const onToggleCheck = currentTab === 'correctness' ? toggleCorrectnessCheck : toggleProposalCheck;
    const onToggleCategoryCheck = currentTab === 'correctness' ? toggleCorrectnessCategoryCheck : toggleProposalCategoryCheck;
    const prefix = currentTab === 'correctness' ? 'correctness-' : 'proposal-';

    if (rawItems.length === 0) {
      return <div className="panel-empty-small">「{tabName}」の項目がありません</div>;
    }
    if (searchQuery && items.length === 0) {
      return <div className="panel-empty-small">検索結果がありません</div>;
    }

    return (
      <CategoryItems
        items={items}
        collapsedCategories={collapsedCategories}
        toggleCategory={toggleCategory}
        handlePageClick={handlePageClick}
        onContentClick={handleContentClick}
        prefix={prefix}
        checkedItems={checkedItems}
        onToggleCheck={onToggleCheck}
        onToggleCategoryCheck={onToggleCategoryCheck}
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
          {/* 校正チェック読み込みボタン（校正チェックモードのみ） */}
          {!isInstructionMode && (
          <div className="panel-load-section">
            <button
              className="panel-load-btn"
              onClick={openModal}
            >
              <CheckListIcon />
              <span>校正チェックを読み込み</span>
            </button>
          </div>
          )}

          {/* カラーと線の太さ・スタンプセクション（校正チェックモードのみ） */}
          {!isInstructionMode && (<>
          <div className="panel-color-section">
            {/* カラー列 */}
            <div className="panel-color-column">
              <h3 className="panel-section-title">カラー</h3>
              <div className="panel-color-grid">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    className={`panel-color-swatch ${color === presetColor ? 'active' : ''}`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => handleColorSelect(presetColor)}
                    title={presetColor === '#ff0000' ? '赤' : '青'}
                  />
                ))}
                {/* カスタムカラー表示（グラデーションバーから選択した色を表示） */}
                <div
                  className={`panel-color-swatch custom-color ${!PRESET_COLORS.includes(color) ? 'active' : ''}`}
                  style={{
                    backgroundColor: !PRESET_COLORS.includes(color) ? color : 'transparent',
                  }}
                  title="グラデーションバーから選択した色"
                />
                {isEyeDropperSupported && (
                  <button
                    className="panel-eyedropper-btn"
                    onClick={handleEyedropper}
                    title="スポイト"
                  >
                    <EyedropperIcon />
                  </button>
                )}
              </div>
              {/* グラデーションバー */}
              <div className="panel-color-gradient">
                {GRADIENT_COLORS.map((gradColor, index) => (
                  <button
                    key={index}
                    className="panel-gradient-segment"
                    style={{ backgroundColor: gradColor }}
                    onClick={() => handleColorSelect(gradColor)}
                  />
                ))}
              </div>
            </div>
            {/* 線の太さ列 */}
            <div className="panel-linewidth-column">
              <h3 className="panel-section-title">線の太さ</h3>
              <div className="panel-line-width">
                <label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={strokeWidth}
                    onChange={handleStrokeWidthChange}
                    className="panel-line-width-input"
                  />
                  px
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={strokeWidth}
                  onChange={handleStrokeWidthSlider}
                  onWheel={handleStrokeWidthWheel}
                  className="panel-line-width-slider"
                  style={{
                    background: `linear-gradient(to right, #ff8c00 ${((strokeWidth - 1) / 19) * 100}%, #666 ${((strokeWidth - 1) / 19) * 100}%)`
                  }}
                />
              </div>
            </div>
          </div>

          {/* 済スタンプ・ルビスタンプセクション */}
          <div className="panel-stamp-section">
            <div className="panel-stamp-buttons">
              <button
                className={`panel-stamp-btn ${isDoneStampActive ? 'active' : ''}`}
                onClick={() => handleStampSelect('doneStamp')}
                title="済スタンプ"
              >
                済スタンプ
              </button>
              <button
                className={`panel-stamp-btn ${isRubyStampActive ? 'active' : ''}`}
                onClick={() => handleStampSelect('rubyStamp')}
                title="ルビスタンプ"
              >
                ルビスタンプ
              </button>
            </div>
          </div>
          </>)}

          {/* Header */}
          <div className="panel-header">
            <div className="panel-header-top">
              <h2 className="panel-title">{title}</h2>
            </div>
            {showTabs && (
              <div className="panel-tabs">
                <button
                  className={`panel-tab tab-correctness ${currentTab === 'correctness' ? 'active' : ''}`}
                  onClick={() => handleTabChange('correctness')}
                >
                  正誤{correctnessItems.length > 0 ? ` (${correctnessItems.length})` : ''}
                  {allCorrectnessChecked && <span className="panel-tab-done">済</span>}
                </button>
                <button
                  className={`panel-tab tab-proposal ${currentTab === 'proposal' ? 'active' : ''}`}
                  onClick={() => handleTabChange('proposal')}
                >
                  提案{proposalItems.length > 0 ? ` (${proposalItems.length})` : ''}
                  {allProposalChecked && <span className="panel-tab-done">済</span>}
                </button>
                <button
                  className={`panel-tab tab-comments ${currentTab === 'comments' ? 'active' : ''}`}
                  onClick={() => handleTabChange('comments')}
                >
                  コメント{commentItems.length > 0 ? ` (${commentItems.length})` : ''}
                  {allCommentsChecked && <span className="panel-tab-done">済</span>}
                </button>
              </div>
            )}
          </div>

          {/* Search */}
          {showTabs && (
            <div className="panel-search">
              <input
                ref={searchInputRef}
                type="text"
                className="panel-search-input"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') clearSearch(); }}
              />
              {searchQuery && (
                <>
                  <span className="panel-search-count">{searchMatchCount}件</span>
                  <button className="panel-search-clear" onClick={clearSearch} title="クリア">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}

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
