import React from 'react';
import './CloseConfirmDialog.css';

export type CloseConfirmResult = 'save' | 'discard' | 'cancel';

interface CloseConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onResult: (result: CloseConfirmResult) => void;
}

const WarningIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const CloseConfirmDialog: React.FC<CloseConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onResult,
}) => {
  if (!isOpen) return null;

  return (
    <div className="close-confirm-overlay" onClick={() => onResult('cancel')}>
      <div className="close-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="close-confirm-header">
          <span className="close-confirm-icon" aria-hidden="true">
            <WarningIcon />
          </span>
          <span className="close-confirm-title">{title}</span>
        </div>
        <div className="close-confirm-body">
          <p>{message}</p>
        </div>
        <div className="close-confirm-actions">
          <button
            className="close-confirm-btn cancel"
            onClick={() => onResult('cancel')}
          >
            キャンセル
          </button>
          <button
            className="close-confirm-btn discard"
            onClick={() => onResult('discard')}
          >
            保存せずに閉じる
          </button>
          <button
            className="close-confirm-btn save"
            onClick={() => onResult('save')}
          >
            保存して閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloseConfirmDialog;
