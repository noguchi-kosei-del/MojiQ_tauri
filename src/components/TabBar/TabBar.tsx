import React, { useState, useCallback, useMemo } from 'react';
import { useDocumentStore } from '../../stores/documentStore';
import { useDrawingStore } from '../../stores/drawingStore';
import { Tab } from './Tab';
import { CloseConfirmDialog, CloseConfirmResult } from '../CloseConfirmDialog';
import './TabBar.css';

interface TabBarProps {
  onSwitchDocument?: (id: string) => void;
  onSaveAndClose?: (id: string) => Promise<void>;
}

export const TabBar: React.FC<TabBarProps> = ({ onSwitchDocument, onSaveAndClose }) => {
  const {
    activeDocumentId,
    closeDocument,
    reorderTabs,
    documents,
    tabOrder,
  } = useDocumentStore();

  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  // 閉じる確認ダイアログの状態
  const [closeConfirmState, setCloseConfirmState] = useState<{
    isOpen: boolean;
    docId: string | null;
    docTitle: string;
  }>({ isOpen: false, docId: null, docTitle: '' });

  // tabOrderとdocumentsの変更を検知するためにuseMemoを使用
  const tabs = useMemo(() => {
    return tabOrder.map((id, index) => {
      const doc = documents.get(id);
      return {
        id,
        title: doc?.title || '不明',
        isModified: doc?.isModified || false,
        order: index,
      };
    });
  }, [tabOrder, documents]);

  const handleActivate = useCallback((id: string) => {
    if (id !== activeDocumentId) {
      // onSwitchDocumentでdrawingStoreの状態復元とswitchDocumentを呼ぶ
      onSwitchDocument?.(id);
    }
  }, [activeDocumentId, onSwitchDocument]);

  const handleClose = useCallback(async (id: string, _e: React.MouseEvent) => {
    const doc = documents.get(id);

    if (doc?.isModified) {
      // カスタム確認ダイアログを表示
      setCloseConfirmState({
        isOpen: true,
        docId: id,
        docTitle: doc.title,
      });
      return;
    }

    // 変更がない場合は直接閉じる
    performClose(id);
  }, [documents]);

  // 実際に閉じる処理
  const performClose = useCallback((id: string) => {
    const wasActive = id === activeDocumentId;
    closeDocument(id, true);

    // 閉じたタブがアクティブだった場合、新しいアクティブドキュメントの状態を復元
    if (wasActive) {
      const { activeDocumentId: newActiveId } = useDocumentStore.getState();
      if (newActiveId) {
        onSwitchDocument?.(newActiveId);
      } else {
        // すべてのタブが閉じられた場合、drawingStoreをクリア
        useDrawingStore.getState().clearDocument();
      }
    }
  }, [closeDocument, activeDocumentId, onSwitchDocument]);

  // 閉じる確認ダイアログの結果処理
  const handleCloseConfirmResult = useCallback(async (result: CloseConfirmResult) => {
    const { docId } = closeConfirmState;
    setCloseConfirmState({ isOpen: false, docId: null, docTitle: '' });

    if (!docId) return;

    if (result === 'cancel') {
      return;
    }

    if (result === 'save') {
      // 保存してから閉じる
      if (onSaveAndClose) {
        try {
          await onSaveAndClose(docId);
          performClose(docId);
        } catch (error) {
          console.error('Failed to save before closing:', error);
          // 保存失敗時は閉じない
        }
      }
      return;
    }

    if (result === 'discard') {
      // 保存せずに閉じる
      performClose(docId);
    }
  }, [closeConfirmState, onSaveAndClose, performClose]);

  // ドラッグ&ドロップ処理
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedTabId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);

    // ドラッグ中のゴースト画像を設定
    const target = e.target as HTMLElement;
    if (target) {
      e.dataTransfer.setDragImage(target, target.offsetWidth / 2, target.offsetHeight / 2);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();

    if (draggedTabId && draggedTabId !== targetId) {
      const fromIndex = tabOrder.indexOf(draggedTabId);
      const toIndex = tabOrder.indexOf(targetId);

      if (fromIndex !== -1 && toIndex !== -1) {
        reorderTabs(fromIndex, toIndex);
      }
    }

    setDraggedTabId(null);
    setDragOverTabId(null);
  }, [draggedTabId, tabOrder, reorderTabs]);

  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  }, []);

  const handleDragOverTab = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedTabId && draggedTabId !== id) {
      setDragOverTabId(id);
    }
  }, [draggedTabId]);

  return (
    <>
      <div className="tab-bar">
        <div className="tabs-container">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tab.id}
              title={tab.title}
              isActive={tab.id === activeDocumentId}
              isModified={tab.isModified}
              onActivate={handleActivate}
              onClose={handleClose}
              onDragStart={handleDragStart}
              onDragOver={(e) => handleDragOverTab(e, tab.id)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragOver={tab.id === dragOverTabId}
            />
          ))}
        </div>
      </div>

      {/* 閉じる確認ダイアログ */}
      <CloseConfirmDialog
        isOpen={closeConfirmState.isOpen}
        title="確認"
        message={`「${closeConfirmState.docTitle}」への変更を保存しますか？`}
        onResult={handleCloseConfirmResult}
      />
    </>
  );
};
