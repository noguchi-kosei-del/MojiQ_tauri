import React from 'react';
import './CloseConfirmDialog.css';

export type CloseConfirmResult = 'save' | 'discard' | 'cancel';

interface CloseConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onResult: (result: CloseConfirmResult) => void;
}

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
          <span className="close-confirm-icon">⚠️</span>
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
