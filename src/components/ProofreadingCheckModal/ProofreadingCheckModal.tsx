import React, { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { FolderBrowser } from './FolderBrowser';
import './ProofreadingCheckModal.css';

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const ProofreadingCheckModal: React.FC = () => {
  const {
    isModalOpen,
    closeModal,
    basePath,
    setBasePath,
    error,
    setLoading,
    setError,
  } = useProofreadingCheckStore();

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
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={closeModal}
    >
      <div
        style={{ width: 400, maxHeight: '80vh', background: 'var(--bg-primary)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>校正チェック</span>
          <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-primary)' }}>
            <CloseIcon />
          </button>
        </div>

        <FolderBrowser />

        {error && (
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#f44336', borderTop: '1px solid var(--border-color)' }}>{error}</div>
        )}
      </div>
    </div>
  );
};
