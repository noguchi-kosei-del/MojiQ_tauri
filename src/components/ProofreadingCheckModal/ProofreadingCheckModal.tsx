import React, { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { useThemeStore } from '../../stores/themeStore';
import { FolderBrowser } from './FolderBrowser';
import './ProofreadingCheckModal.css';

export const ProofreadingCheckModal: React.FC = () => {
  const {
    isModalOpen,
    closeModal,
    basePath,
    setBasePath,
    isLoading,
    error,
    setLoading,
    setError,
  } = useProofreadingCheckStore();

  const { theme } = useThemeStore();

  // Load base path on mount
  useEffect(() => {
    if (isModalOpen && !basePath) {
      loadBasePath();
    }
  }, [isModalOpen, basePath]);

  const loadBasePath = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const path = await invoke<string>('get_proofreading_check_base_path');
      setBasePath(path);
    } catch (e) {
      setError(`ベースパスの取得に失敗: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [setBasePath, setLoading, setError]);

  // Close on Escape
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  return (
    <div className="proofreading-modal-overlay" onClick={closeModal}>
      <div
        className={`proofreading-modal-content browser-only ${theme === 'dark' ? 'dark' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="proofreading-modal-header">
          <span className="proofreading-modal-title">校正チェック</span>
          <button className="proofreading-modal-close" onClick={closeModal}>
            &times;
          </button>
        </div>

        <div className="proofreading-modal-body">
          <FolderBrowser />
          {isLoading && (
            <div className="proofreading-loading">読み込み中...</div>
          )}
        </div>

        {error && (
          <div className="proofreading-error">{error}</div>
        )}
      </div>
    </div>
  );
};
