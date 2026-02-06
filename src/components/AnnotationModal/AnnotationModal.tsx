import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '../../types';
import './AnnotationModal.css';

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string, isVertical: boolean, fontSize: number) => void;
  initialText?: string;
  initialIsVertical?: boolean;
  initialFontSize?: number;
  initialAnnotation?: Annotation | null;
}

export const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialText = '',
  initialIsVertical = false,
  initialFontSize = 16,
  initialAnnotation = null,
}) => {
  const [text, setText] = useState(initialText);
  const [isVertical, setIsVertical] = useState(initialIsVertical);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      // 編集モードの場合は既存のアノテーション値を使用
      if (initialAnnotation) {
        setText(initialAnnotation.text);
        setIsVertical(initialAnnotation.isVertical);
        setFontSize(initialAnnotation.fontSize);
      } else {
        setText(initialText);
        setIsVertical(initialIsVertical);
        setFontSize(initialFontSize);
      }
    }
  }, [isOpen, initialText, initialIsVertical, initialFontSize, initialAnnotation]);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text, isVertical, fontSize);
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
            OK (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
};
