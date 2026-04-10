import { useEffect, useCallback } from 'react';
import { useModalStore } from '../../stores/modalStore';
import './CustomModal.css';

export const CustomModal = () => {
  const { isOpen, title, message, type, okLabel, cancelLabel, confirmDanger, close } =
    useModalStore();

  const handleOk = useCallback(() => close(true), [close]);
  const handleCancel = useCallback(() => close(false), [close]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        // alert → OK扱い、confirm → キャンセル扱い
        type === 'alert' ? handleOk() : handleCancel();
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        handleOk();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, type, handleOk, handleCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="custom-modal-overlay"
      onClick={type === 'alert' ? handleOk : handleCancel}
    >
      <div className="custom-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="custom-modal-header">
          <span className="custom-modal-title">{title}</span>
        </div>
        <div className="custom-modal-body">
          {message.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <div className="custom-modal-actions">
          {type === 'confirm' && (
            <button className="custom-modal-btn cancel" onClick={handleCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            className={`custom-modal-btn ${confirmDanger ? 'danger' : 'ok'}`}
            onClick={handleOk}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
