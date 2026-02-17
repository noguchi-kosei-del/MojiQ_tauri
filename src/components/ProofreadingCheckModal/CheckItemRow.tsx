import React, { useCallback, useState } from 'react';
import { ProofreadingCheckItem } from '../../types';

// Format page number to "●P" format
const formatPage = (page?: string): string => {
  if (!page) return '';
  const match = page.match(/^(\d+)/);
  return match ? `${match[1]}P` : page;
};

// Copy icon
const CopyIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

// Check icon
const CheckIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

interface CheckItemRowProps {
  item: ProofreadingCheckItem;
}

export const CheckItemRow: React.FC<CheckItemRowProps> = ({ item }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.content) return;

    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }, [item.content]);

  return (
    <tr className="check-row">
      <td className="check-page">{formatPage(item.page)}</td>
      <td className="check-excerpt">{item.excerpt || ''}</td>
      <td className="check-content">{item.content || ''}</td>
      <td className="check-copy">
        {item.content && (
          <button
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="コピー"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}
      </td>
    </tr>
  );
};
