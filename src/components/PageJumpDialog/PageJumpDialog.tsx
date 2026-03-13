import React, { useState, useRef, useEffect } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import {
  isLandscapeDocument,
  getTotalNombre,
  nombreToPdfPage,
} from '../../utils/pageNumberUtils';
import './PageJumpDialog.css';

interface PageJumpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PageJumpDialog: React.FC<PageJumpDialogProps> = ({ isOpen, onClose }) => {
  const { pages, setCurrentPage, currentPage } = useDrawingStore();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const totalPages = pages.length;
  const isLandscape = isLandscapeDocument(pages);
  const totalNombre = getTotalNombre(pages);

  // 現在のノンブルを計算
  const getCurrentNombre = (): number => {
    const pdfPageNum = currentPage + 1;
    if (!isLandscape || pdfPageNum === 1) {
      return pdfPageNum;
    }
    // 2ページ目以降は見開きの最初のノンブル
    return (pdfPageNum - 1) * 2;
  };

  // ダイアログが開いたときに入力欄にフォーカス
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setInputValue(String(getCurrentNombre()));
      setError('');
      // 少し遅延させてフォーカスを確実に設定
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentPage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedValue = inputValue.trim();
    if (trimmedValue === '') {
      onClose();
      return;
    }

    const targetNombre = parseInt(trimmedValue, 10);

    if (isNaN(targetNombre)) {
      setError('数値を入力してください');
      return;
    }

    if (targetNombre < 1 || targetNombre > totalNombre) {
      setError(`1から${totalNombre}の範囲で入力してください`);
      return;
    }

    // ノンブルからPDFページ番号を計算
    const pdfPageNum = nombreToPdfPage(targetNombre, isLandscape);

    // ページ移動（0-indexed）
    setCurrentPage(pdfPageNum - 1);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || totalPages === 0) return null;

  return (
    <div className="page-jump-overlay" onClick={handleOverlayClick}>
      <div className="page-jump-dialog" onKeyDown={handleKeyDown}>
        <form onSubmit={handleSubmit}>
          <label htmlFor="page-jump-input">
            ページ番号を入力 (1-{totalNombre})
          </label>
          <input
            ref={inputRef}
            id="page-jump-input"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            placeholder={`1-${totalNombre}`}
            autoComplete="off"
          />
          {error && <div className="page-jump-error">{error}</div>}
          <div className="page-jump-buttons">
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit">
              移動
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
