import React, { useMemo } from 'react';
import { useProofreadingCheckStore, ProofreadingTabType } from '../../stores/proofreadingCheckStore';
import { CategoryGroup } from './CategoryGroup';
import { ProofreadingCheckItem } from '../../types';

export const DataViewer: React.FC = () => {
  const {
    currentData,
    currentFileName,
    allItems,
    currentTab,
    setCurrentTab,
    hasCorrectnessItems,
    hasProposalItems,
  } = useProofreadingCheckStore();

  const hasCorrectness = hasCorrectnessItems();
  const hasProposal = hasProposalItems();
  const hasBoth = hasCorrectness && hasProposal;

  // Get filtered items based on current tab
  const filteredItems = useMemo(() => {
    if (currentTab === 'both') {
      return allItems;
    }
    return allItems.filter(item => item.checkKind === currentTab);
  }, [allItems, currentTab]);

  // Group by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, ProofreadingCheckItem[]> = {};
    filteredItems.forEach(item => {
      const cat = item.category || '未分類';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Generate title
  const title = useMemo(() => {
    if (!currentData) return '';
    const work = currentData.work || '';
    const fileName = currentFileName || currentData.title || '';
    return work ? `${work} - ${fileName}` : fileName;
  }, [currentData, currentFileName]);

  // Get item counts
  const correctnessCount = useMemo(() =>
    allItems.filter(i => i.checkKind === 'correctness').length
  , [allItems]);

  const proposalCount = useMemo(() =>
    allItems.filter(i => i.checkKind === 'proposal').length
  , [allItems]);

  const handleTabClick = (tab: ProofreadingTabType) => {
    setCurrentTab(tab);
  };

  return (
    <div className="data-viewer">
      {/* Header */}
      <div className="data-viewer-header">
        <h2 className="data-viewer-title">{title}</h2>

        {/* Tabs */}
        <div className="data-viewer-tabs">
          {hasBoth && (
            <button
              className={`data-tab ${currentTab === 'both' ? 'active' : ''}`}
              onClick={() => handleTabClick('both')}
            >
              両方表示 ({allItems.length})
            </button>
          )}
          {hasCorrectness && (
            <button
              className={`data-tab correctness ${currentTab === 'correctness' ? 'active' : ''}`}
              onClick={() => handleTabClick('correctness')}
            >
              正誤チェック ({correctnessCount})
            </button>
          )}
          {hasProposal && (
            <button
              className={`data-tab proposal ${currentTab === 'proposal' ? 'active' : ''}`}
              onClick={() => handleTabClick('proposal')}
            >
              提案チェック ({proposalCount})
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="data-viewer-content">
        {filteredItems.length === 0 ? (
          <div className="data-viewer-empty">チェック項目がありません</div>
        ) : (
          Object.keys(groupedItems).sort((a, b) => {
            // Sort by category number if present
            const matchA = a.match(/^(\d+)\./);
            const matchB = b.match(/^(\d+)\./);
            if (matchA && matchB) {
              return parseInt(matchA[1]) - parseInt(matchB[1]);
            }
            return a.localeCompare(b, 'ja');
          }).map(category => (
            <CategoryGroup
              key={category}
              category={category}
              items={groupedItems[category]}
            />
          ))
        )}
      </div>
    </div>
  );
};
