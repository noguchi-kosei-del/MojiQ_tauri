import React, { useState, useCallback } from 'react';
import { ProofreadingCheckItem } from '../../types';
import { CheckItemRow } from './CheckItemRow';

// Color mapping based on category number (matching ver_2.05)
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

interface CategoryGroupProps {
  category: string;
  items: ProofreadingCheckItem[];
}

export const CategoryGroup: React.FC<CategoryGroupProps> = ({
  category,
  items,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const colorClass = getCategoryColorClass(category);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  return (
    <div className={`category-group ${colorClass} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="category-header" onClick={toggleCollapse}>
        <span className="category-toggle">{isCollapsed ? '\u25B6' : '\u25BC'}</span>
        <span className="category-name">{category}</span>
        <span className="category-count">({items.length})</span>
      </div>
      {!isCollapsed && (
        <div className="category-body">
          <table className="check-table">
            <thead>
              <tr>
                <th className="check-th-page">ページ</th>
                <th className="check-th-excerpt">抜粋</th>
                <th className="check-th-content">内容</th>
                <th className="check-th-copy"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <CheckItemRow key={index} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
