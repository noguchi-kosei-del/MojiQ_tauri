import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Annotation } from '../../types';
import { getAvailableFonts, DEFAULT_FONT, formatFontFamily } from '../../utils/fontService';
import './AnnotationModal.css';

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string, isVertical: boolean, fontSize: number, fontFamily: string) => void;
  initialText?: string;
  initialIsVertical?: boolean;
  initialFontSize?: number;
  initialFontFamily?: string;
  initialAnnotation?: Annotation | null;
}

export const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialText = '',
  initialIsVertical = false,
  initialFontSize = 14,
  initialFontFamily = DEFAULT_FONT,
  initialAnnotation = null,
}) => {
  const [text, setText] = useState(initialText);
  const [isVertical, setIsVertical] = useState(initialIsVertical);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [fontFamily, setFontFamily] = useState(initialFontFamily);
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  const [fontSearch, setFontSearch] = useState('');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const fontSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      // 編集モードの場合は既存のアノテーション値を使用
      if (initialAnnotation) {
        setText(initialAnnotation.text);
        setIsVertical(initialAnnotation.isVertical);
        setFontSize(initialAnnotation.fontSize);
        setFontFamily(initialAnnotation.fontFamily || DEFAULT_FONT);
      } else {
        setText(initialText);
        setIsVertical(initialIsVertical);
        setFontSize(initialFontSize);
        setFontFamily(initialFontFamily);
      }
    }
  }, [isOpen, initialText, initialIsVertical, initialFontSize, initialFontFamily, initialAnnotation]);

  // フォント一覧をモーダル表示時に取得
  useEffect(() => {
    if (isOpen && availableFonts.length === 0) {
      getAvailableFonts().then(setAvailableFonts);
    }
  }, [isOpen, availableFonts.length]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!isFontDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setIsFontDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFontDropdownOpen]);

  // 検索でフィルタリングされたフォント一覧
  const filteredFonts = useMemo(() => {
    if (!fontSearch) return availableFonts;
    const query = fontSearch.toLowerCase();
    return availableFonts.filter(f => f.toLowerCase().includes(query));
  }, [availableFonts, fontSearch]);

  const handleFontSelect = (font: string) => {
    setFontFamily(font);
    setIsFontDropdownOpen(false);
    setFontSearch('');
  };

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text, isVertical, fontSize, fontFamily);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="annotation-modal-overlay" onClick={onClose}>
      <div className="annotation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="annotation-modal-header">
          <h3>テキスト指示</h3>
          <button className="annotation-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="annotation-modal-body">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="テキストを入力..."
            rows={4}
            style={{ fontFamily }}
          />
          <div className="annotation-modal-options">
            <label className="annotation-checkbox">
              <input
                type="checkbox"
                checked={isVertical}
                onChange={(e) => setIsVertical(e.target.checked)}
              />
              縦書き
            </label>
            <div className="annotation-font-size">
              <label>文字サイズ:</label>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Math.max(8, Math.min(72, parseInt(e.target.value) || 16)))}
                min={8}
                max={72}
              />
            </div>
          </div>
          <div className="annotation-font-family" ref={fontDropdownRef}>
            <label>フォント:</label>
            <div className="font-dropdown-container">
              <button
                type="button"
                className="font-dropdown-trigger"
                onClick={() => {
                  setIsFontDropdownOpen(!isFontDropdownOpen);
                  if (!isFontDropdownOpen) {
                    setTimeout(() => fontSearchRef.current?.focus(), 0);
                  }
                }}
                style={{ fontFamily: formatFontFamily(fontFamily) }}
              >
                <span className="font-dropdown-value">{fontFamily}</span>
                <span className="font-dropdown-arrow">{isFontDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {isFontDropdownOpen && (
                <div className="font-dropdown-panel">
                  <input
                    ref={fontSearchRef}
                    type="text"
                    className="font-dropdown-search"
                    placeholder="フォント名を検索..."
                    value={fontSearch}
                    onChange={(e) => setFontSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsFontDropdownOpen(false);
                        setFontSearch('');
                      }
                    }}
                  />
                  <div className="font-dropdown-list">
                    {filteredFonts.map((font) => (
                      <div
                        key={font}
                        className={`font-dropdown-item${font === fontFamily ? ' selected' : ''}`}
                        style={{ fontFamily: formatFontFamily(font) }}
                        onClick={() => handleFontSelect(font)}
                      >
                        {font}
                      </div>
                    ))}
                    {filteredFonts.length === 0 && (
                      <div className="font-dropdown-empty">一致するフォントがありません</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="annotation-modal-footer">
          <button className="annotation-btn-cancel" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="annotation-btn-submit"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
