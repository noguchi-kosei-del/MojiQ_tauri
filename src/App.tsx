import { useEffect, useCallback, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { setTheme as setTauriTheme } from '@tauri-apps/api/app';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { CloseConfirmDialog, CloseConfirmResult } from './components/CloseConfirmDialog';
import { SettingsModal } from './components/SettingsModal/SettingsModal';
import { ProofreadingCheckModal } from './components/ProofreadingCheckModal';
import { PageJumpDialog } from './components/PageJumpDialog';
import { DrawingCanvas, SpreadCanvas } from './components/Canvas';
import { DrawingToolbar } from './components/DrawingToolbar';
import { DrawingSettingsBar } from './components/DrawingSettingsBar';
import { RightToolbar } from './components/RightToolbar';
import { HeaderBar } from './components/HeaderBar';
import { TabBar } from './components/TabBar';
import { PageNav } from './components/PageNav';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ViewerModeOverlay } from './components/ViewerMode';
import { ProofreadingPanel } from './components/ProofreadingPanel';
import { ProofreadingToolbar } from './components/ProofreadingToolbar';
import { useDrawingStore } from './stores/drawingStore';
import { useDocumentStore } from './stores/documentStore';
import { useLoadingStore } from './stores/loadingStore';
import { useZoomStore } from './stores/zoomStore';
import { useThemeStore } from './stores/themeStore';
import { useViewerModeStore } from './stores/viewerModeStore';
import { useWorkspaceStore } from './stores/workspaceStore';
import { useSpreadViewStore } from './stores/spreadViewStore';
import { useCommentVisibilityStore } from './stores/commentVisibilityStore';
import { useTextLayerStore } from './stores/textLayerStore';
import { useModeStore } from './stores/modeStore';
import { useSidebarStore } from './stores/sidebarStore';
import { LoadedDocument, FileMetadata } from './types';
import { renderPdfToImages } from './utils/pdfRenderer';
import { preloadAllBackgroundImages, backgroundImageCache } from './utils/backgroundImageCache';
import { checkPageCount } from './utils/fileValidation';
import './App.css';

// 定数
const ZOOM_ANIMATION_DURATION = 300;
const NAVIGATE_COOLDOWN_MS = 150;

function App() {
  const { loadDocument, loadDocumentWithAnnotations, loadDocumentWithLinks, loadAllPageImages, undo, redo, pages, currentPage, setCurrentPage, tool, setTool, selectedStrokeIds, selectedShapeIds, selectedTextIds, selectedImageIds, deleteSelectedStrokes, clearAllDrawings, getDocumentState, restoreDocumentState, activeProofreadingText, clearActiveProofreadingText, copySelected, cutSelected, pasteClipboard, hasClipboard, selectAll } = useDrawingStore();
  const {
    activeDocumentId,
    syncFromDrawingStore,
    markAsModified,
    getTabInfoList,
    closeDocument,
    switchDocument,
    getDocumentForDrawingStore,
    updateDocument,
    createNewDocument,
  } = useDocumentStore();
  const { setLoading, setProgress } = useLoadingStore();
  const { zoom, resetZoom, setZoom } = useZoomStore();
  const { theme, setTheme } = useThemeStore();
  const { isActive: isViewerMode, enter: enterViewerMode, exit: exitViewerMode } = useViewerModeStore();
  const { isFlipped } = useWorkspaceStore();
  const { isSpreadView, nextSpread, prevSpread, bindingDirection, disableSpreadView } = useSpreadViewStore();
  const { toggle: toggleCommentVisibility } = useCommentVisibilityStore();
  const { toggle: toggleTextLayer } = useTextLayerStore();
  const { mode } = useModeStore();
  const { isProofreadingPanelCollapsed } = useSidebarStore();

  // モード切替アニメーション
  const [modeTransition, setModeTransition] = useState<'mode-transition-to-proofreading' | 'mode-transition-to-instruction' | ''>('');
  const prevModeRef = useRef(mode);

  useEffect(() => {
    if (prevModeRef.current !== mode && pages.length > 0) {
      const transitionClass = mode === 'proofreading'
        ? 'mode-transition-to-proofreading'
        : 'mode-transition-to-instruction';
      setModeTransition(transitionClass);
      const timer = setTimeout(() => setModeTransition(''), 200);
      prevModeRef.current = mode;
      return () => clearTimeout(timer);
    }
    prevModeRef.current = mode;
  }, [mode, pages.length]);

  // ページナビゲーション用の状態
  const isNavigatingRef = useRef(false);
  const lastNavigateTimeRef = useRef(0);
  const zoomAnimationRef = useRef<number | null>(null);

  // タブ切り替え時のレース条件防止用（非同期処理のキャンセルトークン）
  const switchDocumentRequestIdRef = useRef(0);

  // スペースキーパン用の状態
  const previousToolRef = useRef<string | null>(null);

  // 閉じる確認ダイアログの状態（Ctrl+W用）
  const [closeConfirmState, setCloseConfirmState] = useState<{
    isOpen: boolean;
    docId: string | null;
    docTitle: string;
  }>({ isOpen: false, docId: null, docTitle: '' });

  // ページジャンプダイアログの状態（Ctrl+J用）
  const [isPageJumpOpen, setIsPageJumpOpen] = useState(false);

  // Initialize theme on mount and sync with window title bar
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    // Tauriアプリ全体のテーマを同期（タイトルバーの色に影響）
    const syncWindowTheme = async () => {
      try {
        await setTauriTheme(theme === 'dark' ? 'dark' : 'light');
      } catch (e) {
        console.error('Failed to set app theme:', e);
      }
    };
    syncWindowTheme();
  }, [theme]);

  // drawingStoreの変更をdocumentStoreに同期し、変更済みとしてマーク
  const prevHistoryIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (!activeDocumentId) return;

    // ヒストリーインデックスが変わった場合（描画操作が行われた）
    const historyIndex = useDrawingStore.getState().historyIndex;
    if (historyIndex !== prevHistoryIndexRef.current && historyIndex > 0) {
      markAsModified(activeDocumentId);
    }
    prevHistoryIndexRef.current = historyIndex;
  }, [activeDocumentId, markAsModified, pages]);

  const handleFileDrop = useCallback(
    async (paths: string[]) => {
      if (paths.length > 0) {
        // ファイル読み込み時は単ページモードに戻す
        disableSpreadView();

        // 背景画像キャッシュをクリア（前のドキュメントの画像が表示されるのを防ぐ）
        backgroundImageCache.clear();

        // アクティブなドキュメントにページがある場合は新規タブを作成
        const existingDoc = useDocumentStore.getState().getActiveDocument();
        if (existingDoc && existingDoc.pages.length > 0) {
          // 既存ドキュメントにページがある場合は、新しいタブを作成
          createNewDocument({ title: '新規ドキュメント' });
        } else if (!useDocumentStore.getState().activeDocumentId) {
          // アクティブなドキュメントがない場合は新規作成
          createNewDocument({ title: '新規ドキュメント' });
        }
        // 空のアクティブドキュメントがある場合はそれを使用（何もしない）

        try {
          setLoading(true, 'ファイルを読み込み中...');
          setProgress(5);

          // 画像ファイルのみをフィルタリング
          const imageExtensions = ['.jpg', '.jpeg', '.png'];
          const imagePaths = paths.filter(path =>
            imageExtensions.some(ext => path.toLowerCase().endsWith(ext))
          );
          const pdfPaths = paths.filter(path => path.toLowerCase().endsWith('.pdf'));

          // PDFが含まれている場合は最初のPDFを読み込む
          if (pdfPaths.length > 0) {
            const filePath = pdfPaths[0];
            const fileName = filePath.split(/[/\\]/).pop() || 'PDF';

            setLoading(true, 'ファイルを読み込んでいます...');
            setProgress(10);

            let result: LoadedDocument;
            try {
              result = await invoke<LoadedDocument>('load_file', {
                path: filePath,
              });
            } catch (e) {
              console.error('[App drop 1] Failed to load file:', e);
              setLoading(false);
              await message(String(e), { title: 'エラー', kind: 'error' });
              return;
            }

            if (result.file_type === 'pdf' && result.pdf_data) {
              setLoading(true, 'PDFをレンダリング中...');
              const pdfResult = await renderPdfToImages(result.pdf_data, (progress) => {
                setProgress(30 + Math.floor(progress * 0.5)); // 30-80%をPDFレンダリングに使用
              });

              // ページ数チェック
              const pageValidation = checkPageCount(pdfResult.pages.length);
              if (!pageValidation.valid && pageValidation.error) {
                await ask(pageValidation.error, { title: 'エラー', kind: 'error' });
                setLoading(false);
                return;
              }
              if (pageValidation.warning) {
                const confirmed = await ask(pageValidation.warning, {
                  title: '確認',
                  kind: 'warning',
                });
                if (!confirmed) {
                  setLoading(false);
                  return;
                }
              }

              // 背景画像をHTMLImageElementとしてプリロード（ストア更新前に実行）
              setLoading(true, '画像をキャッシュ中...');
              await preloadAllBackgroundImages(
                (pageNumber) => pdfResult.pages[pageNumber]?.image_data || null,
                pdfResult.pages.length,
                (current, total) => {
                  setProgress(80 + Math.floor((current / total) * 20));
                }
              );

              // プリロード完了後にストアを更新
              loadDocumentWithAnnotations(pdfResult.pages, pdfResult.annotations);

              // アクティブなドキュメントのタイトルとファイル情報を更新
              const currentActiveId = useDocumentStore.getState().activeDocumentId;
              if (currentActiveId) {
                updateDocument(currentActiveId, {
                  title: fileName,
                  filePath: filePath,
                  fileType: 'pdf',
                });
                // ページサイズを含むドキュメント状態を同期
                const currentState = useDrawingStore.getState();
                syncFromDrawingStore({
                  pages: currentState.pages,
                  currentPage: currentState.currentPage,
                  currentLayerId: currentState.currentLayerId,
                  history: currentState.history,
                  historyIndex: currentState.historyIndex,
                  pdfDocument: currentState.pdfDocument,
                  pdfPageInfos: currentState.pdfPageInfos,
                  pdfAnnotations: currentState.pdfAnnotations,
                });
              }
            }
          }
          // 複数の画像ファイルがある場合（リンク方式で読み込み）
          else if (imagePaths.length > 1) {
            // ファイル名でソート（自然順）
            const sortedPaths = [...imagePaths].sort((a, b) => {
              const nameA = a.split(/[/\\]/).pop() || '';
              const nameB = b.split(/[/\\]/).pop() || '';
              return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // リンク方式: メタデータのみ取得（高速）
            setLoading(true, 'ファイル情報を取得中...');
            const metadata = await invoke<FileMetadata[]>('load_files_metadata', {
              paths: sortedPaths,
            });
            setProgress(20);
            loadDocumentWithLinks(metadata);

            // アクティブなドキュメントのタイトルとファイル情報を更新
            const folderPath = sortedPaths[0].split(/[/\\]/);
            const title = folderPath.length > 1 ? folderPath[folderPath.length - 2] : '画像';
            const currentActiveId = useDocumentStore.getState().activeDocumentId;
            if (currentActiveId) {
              updateDocument(currentActiveId, {
                title: title,
                filePath: sortedPaths[0],
                fileType: 'images',
              });
            }

            // 全ページの画像を読み込む
            setLoading(true, '画像を読み込み中...');
            await loadAllPageImages((current, total) => {
              setProgress(20 + Math.floor((current / total) * 60));
            });

            // 背景画像をHTMLImageElementとしてプリロード
            setLoading(true, '画像をキャッシュ中...');
            const loadedPages = useDrawingStore.getState().pages;
            await preloadAllBackgroundImages(
              (pageNumber) => loadedPages[pageNumber]?.backgroundImage || null,
              loadedPages.length,
              (current, total) => {
                setProgress(80 + Math.floor((current / total) * 20));
              }
            );

            // ページサイズを含むドキュメント状態を同期
            if (currentActiveId) {
              const currentState = useDrawingStore.getState();
              syncFromDrawingStore({
                pages: currentState.pages,
                currentPage: currentState.currentPage,
                currentLayerId: currentState.currentLayerId,
                history: currentState.history,
                historyIndex: currentState.historyIndex,
                pdfDocument: currentState.pdfDocument,
                pdfPageInfos: currentState.pdfPageInfos,
                pdfAnnotations: currentState.pdfAnnotations,
              });
            }

            setLoading(false);
            return;
          }
          // 単一ファイルの場合
          else if (paths.length === 1) {
            const filePath = paths[0];
            const fileName = filePath.split(/[/\\]/).pop() || 'ファイル';

            setLoading(true, 'ファイルを読み込んでいます...');
            setProgress(10);

            let result: LoadedDocument;
            try {
              result = await invoke<LoadedDocument>('load_file', {
                path: filePath,
              });
            } catch (e) {
              console.error('[App drop 2] Failed to load file:', e);
              setLoading(false);
              await message(String(e), { title: 'エラー', kind: 'error' });
              return;
            }

            if (result.file_type === 'pdf' && result.pdf_data) {
              setLoading(true, 'PDFをレンダリング中...');
              const pdfResult = await renderPdfToImages(result.pdf_data, (progress) => {
                setProgress(30 + Math.floor(progress * 0.5));
              });

              // ページ数チェック
              const pageValidation = checkPageCount(pdfResult.pages.length);
              if (!pageValidation.valid && pageValidation.error) {
                await ask(pageValidation.error, { title: 'エラー', kind: 'error' });
                setLoading(false);
                return;
              }
              if (pageValidation.warning) {
                const confirmed = await ask(pageValidation.warning, {
                  title: '確認',
                  kind: 'warning',
                });
                if (!confirmed) {
                  setLoading(false);
                  return;
                }
              }

              // 背景画像をHTMLImageElementとしてプリロード（ストア更新前に実行）
              setLoading(true, '画像をキャッシュ中...');
              await preloadAllBackgroundImages(
                (pageNumber) => pdfResult.pages[pageNumber]?.image_data || null,
                pdfResult.pages.length,
                (current, total) => {
                  setProgress(80 + Math.floor((current / total) * 20));
                }
              );

              // プリロード完了後にストアを更新
              loadDocumentWithAnnotations(pdfResult.pages, pdfResult.annotations);

              // アクティブなドキュメントのタイトルとファイル情報を更新
              const currentActiveId = useDocumentStore.getState().activeDocumentId;
              if (currentActiveId) {
                updateDocument(currentActiveId, {
                  title: fileName,
                  filePath: filePath,
                  fileType: 'pdf',
                });
                // ページサイズを含むドキュメント状態を同期
                const currentState = useDrawingStore.getState();
                syncFromDrawingStore({
                  pages: currentState.pages,
                  currentPage: currentState.currentPage,
                  currentLayerId: currentState.currentLayerId,
                  history: currentState.history,
                  historyIndex: currentState.historyIndex,
                  pdfDocument: currentState.pdfDocument,
                  pdfPageInfos: currentState.pdfPageInfos,
                  pdfAnnotations: currentState.pdfAnnotations,
                });
              }
            } else {
              // 背景画像をHTMLImageElementとしてプリロード（ストア更新前に実行）
              setLoading(true, '画像をキャッシュ中...');
              await preloadAllBackgroundImages(
                (pageNumber) => result.pages[pageNumber]?.image_data || null,
                result.pages.length,
                (current, total) => {
                  setProgress(80 + Math.floor((current / total) * 20));
                }
              );

              // プリロード完了後にストアを更新
              loadDocument(result.pages);

              // アクティブなドキュメントのタイトルとファイル情報を更新
              const currentActiveId = useDocumentStore.getState().activeDocumentId;
              if (currentActiveId) {
                updateDocument(currentActiveId, {
                  title: fileName,
                  filePath: filePath,
                  fileType: 'images',
                });
                // ページサイズを含むドキュメント状態を同期
                const currentState = useDrawingStore.getState();
                syncFromDrawingStore({
                  pages: currentState.pages,
                  currentPage: currentState.currentPage,
                  currentLayerId: currentState.currentLayerId,
                  history: currentState.history,
                  historyIndex: currentState.historyIndex,
                  pdfDocument: currentState.pdfDocument,
                  pdfPageInfos: currentState.pdfPageInfos,
                  pdfAnnotations: currentState.pdfAnnotations,
                });
              }
            }
          }
          setLoading(false);
        } catch (error) {
          console.error('Failed to load file:', error);
          setLoading(false);
        }
      }
    },
    [loadDocument, loadDocumentWithAnnotations, loadDocumentWithLinks, loadAllPageImages, setLoading, setProgress, updateDocument, disableSpreadView]
  );

  // ドキュメント切り替え時のハンドラー
  const handleSwitchDocument = useCallback(async (id: string) => {
    // レース条件防止: 新しいリクエストIDを生成
    const requestId = ++switchDocumentRequestIdRef.current;

    // 現在のドキュメント状態を保存（ドキュメントがまだ存在する場合のみ）
    const currentActiveId = useDocumentStore.getState().activeDocumentId;
    if (currentActiveId && useDocumentStore.getState().documents.has(currentActiveId)) {
      const currentState = getDocumentState();
      syncFromDrawingStore(currentState);
    }

    // documentStoreのアクティブドキュメントを切り替え
    switchDocument(id);

    // 新しいドキュメントの状態を復元
    const docState = getDocumentForDrawingStore(id);
    if (docState) {
      // 背景画像キャッシュをセットアップ（ドキュメントIDを設定し、異なるドキュメントなら自動クリア）
      backgroundImageCache.setDocumentId(id);

      restoreDocumentState(docState);

      // 背景画像キャッシュを再構築（ドキュメントごとに異なる画像を使用するため）
      if (docState.pages.length > 0) {
        await preloadAllBackgroundImages(
          (pageNumber) => docState.pages[pageNumber]?.backgroundImage || null,
          docState.pages.length,
          undefined,
          id  // ドキュメントIDを渡す
        );

        // レース条件チェック: 非同期処理中に別のタブに切り替えられた場合はキャッシュをクリア
        if (switchDocumentRequestIdRef.current !== requestId) {
          // 古いリクエストなので、このキャッシュは無効
          // 新しいリクエストが既にキャッシュをクリアしているはずなので何もしない
          return;
        }
      }
    }
  }, [getDocumentState, syncFromDrawingStore, switchDocument, getDocumentForDrawingStore, restoreDocumentState]);

  // タブを閉じる処理（Ctrl+W、タブ×ボタン共通）
  const performCloseDocument = useCallback((docId: string) => {
    closeDocument(docId, true);
    // 新しいアクティブドキュメントの状態を復元
    const newActiveId = useDocumentStore.getState().activeDocumentId;
    if (newActiveId) {
      // handleSwitchDocumentを使用（背景画像キャッシュの再構築も含む）
      handleSwitchDocument(newActiveId);
    } else {
      useDrawingStore.getState().clearDocument();
    }
  }, [closeDocument, handleSwitchDocument]);

  // 保存してから閉じる（カスタムイベントを発火してHeaderBarに通知）
  const handleSaveAndClose = useCallback(async (docId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // 保存完了を待つためのイベントリスナーを設定
      const handleSaveComplete = () => {
        window.removeEventListener('mojiq-save-complete', handleSaveComplete);
        window.removeEventListener('mojiq-save-cancelled', handleSaveCancelled);
        resolve();
      };
      const handleSaveCancelled = () => {
        window.removeEventListener('mojiq-save-complete', handleSaveComplete);
        window.removeEventListener('mojiq-save-cancelled', handleSaveCancelled);
        reject(new Error('Save cancelled'));
      };

      window.addEventListener('mojiq-save-complete', handleSaveComplete);
      window.addEventListener('mojiq-save-cancelled', handleSaveCancelled);

      // 保存リクエストイベントを発火（HeaderBarがリッスンする）
      window.dispatchEvent(new CustomEvent('mojiq-save-request', { detail: { docId } }));
    });
  }, []);

  // 閉じる確認ダイアログの結果処理（Ctrl+W用）
  const handleCloseConfirmResult = useCallback(async (result: CloseConfirmResult) => {
    const { docId } = closeConfirmState;
    setCloseConfirmState({ isOpen: false, docId: null, docTitle: '' });

    if (!docId) return;

    if (result === 'cancel') {
      return;
    }

    if (result === 'save') {
      // 保存してから閉じる
      try {
        await handleSaveAndClose(docId);
        performCloseDocument(docId);
      } catch (error) {
        console.error('Failed to save before closing:', error);
        // 保存失敗時は閉じない
      }
      return;
    }

    if (result === 'discard') {
      // 保存せずに閉じる
      performCloseDocument(docId);
    }
  }, [closeConfirmState, handleSaveAndClose, performCloseDocument]);

  // アニメーション付きズーム
  const animateZoom = useCallback((targetZoom: number, onComplete?: () => void) => {
    const startZoom = zoom;
    const startTime = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / ZOOM_ANIMATION_DURATION, 1);
      const easedProgress = easeOutCubic(progress);

      const currentZoom = startZoom + (targetZoom - startZoom) * easedProgress;
      setZoom(currentZoom);

      if (progress < 1) {
        zoomAnimationRef.current = requestAnimationFrame(step);
      } else {
        zoomAnimationRef.current = null;
        if (onComplete) onComplete();
      }
    };

    if (zoomAnimationRef.current) {
      cancelAnimationFrame(zoomAnimationRef.current);
    }
    zoomAnimationRef.current = requestAnimationFrame(step);
  }, [zoom, setZoom]);

  // 閲覧モード用: zoomを1.0にリセット（CSSでフィット処理）
  const resetZoomForViewerMode = useCallback(() => {
    animateZoom(1.0);
  }, [animateZoom]);

  // 閲覧モードに入る
  const handleEnterViewerMode = useCallback(() => {
    if (isViewerMode || pages.length === 0) return;

    enterViewerMode(zoom, theme === 'light');

    // ダークモードに変更
    if (theme === 'light') {
      setTheme('dark');
    }

    // zoomを1.0にリセット（CSSでフルスクリーンフィット）
    setTimeout(() => resetZoomForViewerMode(), 50);
  }, [isViewerMode, pages.length, zoom, theme, enterViewerMode, setTheme, resetZoomForViewerMode]);

  // 閲覧モードを終了
  const handleExitViewerMode = useCallback(() => {
    if (!isViewerMode) return;

    const { previousZoom, wasLightTheme } = exitViewerMode();

    // 元のテーマに戻す
    if (wasLightTheme) {
      setTheme('light');
    }

    // 元のズームに戻す
    animateZoom(previousZoom);
  }, [isViewerMode, exitViewerMode, setTheme, animateZoom]);

  // 閲覧モード時のページナビゲーション
  const navigatePageInViewerMode = useCallback((direction: number) => {
    const now = performance.now();
    if (now - lastNavigateTimeRef.current < NAVIGATE_COOLDOWN_MS) return;
    if (isNavigatingRef.current) return;

    const targetPage = currentPage + direction;
    if (targetPage < 0 || targetPage >= pages.length) return;

    lastNavigateTimeRef.current = now;
    isNavigatingRef.current = true;

    setCurrentPage(targetPage);

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, ZOOM_ANIMATION_DURATION + 50);
  }, [currentPage, pages.length, setCurrentPage]);

  // キーボードハンドラ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力欄にフォーカスがある場合はショートカットを無効化
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      if (isInputFocused) {
        // Escapeキーのみ処理（モーダルを閉じる等）
        if (e.key !== 'Escape') {
          return;
        }
      }

      // 閲覧モード時の処理
      if (isViewerMode) {
        // Escape: 閲覧モード終了
        if (e.key === 'Escape') {
          e.preventDefault();
          handleExitViewerMode();
          return;
        }

        // 矢印キー: ページ送り（右から左）
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigatePageInViewerMode(1); // 次のページ（右から左）
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigatePageInViewerMode(-1); // 前のページ
          return;
        }

        // Home/End キー
        if (e.key === 'Home') {
          e.preventDefault();
          setCurrentPage(pages.length - 1); // 最後のページ（右から左）
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          setCurrentPage(0); // 最初のページ（右から左）
          return;
        }

        // Ctrl+矢印: 最初/最後のページへジャンプ
        if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
          e.preventDefault();
          setCurrentPage(pages.length - 1);
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
          e.preventDefault();
          setCurrentPage(0);
          return;
        }

        // 閲覧モード中は他のキー操作を無効化
        return;
      }

      // Escape: 校正チェックテキストモードを解除
      if (e.key === 'Escape') {
        if (activeProofreadingText) {
          e.preventDefault();
          clearActiveProofreadingText();
          return;
        }
      }

      // F1: 閲覧モード開始
      if (e.key === 'F1') {
        e.preventDefault();
        handleEnterViewerMode();
        return;
      }

      // Space: 一時的にパンツールに切り替え
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat && tool !== 'pan') {
          previousToolRef.current = tool;
          setTool('pan');
        }
        return;
      }

      // Tool shortcuts (without modifier)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          setTool('select');
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setTool('pen');
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setTool('eraser');
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          setTool('marker');
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          setTool('rect');
        } else if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();
          setTool('ellipse');
        } else if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          setTool('line');
        } else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          setTool('arrow');
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          setTool('doubleArrow');
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          setTool('polyline');
        } else if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          setTool('text');
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          setTool('image');
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
          if (selectedStrokeIds.length > 0 || selectedTextIds.length > 0) {
            e.preventDefault();
            deleteSelectedStrokes();
          }
        }
        // Arrow keys for page navigation
        // 右綴じ: 左矢印で前のページ（小さい番号）、右矢印で次のページ（大きい番号）
        // 左綴じ: 右矢印で次のページ（大きい番号）、左矢印で前のページ（小さい番号）
        else if (e.key === 'ArrowLeft' && pages.length > 1) {
          e.preventDefault();
          if (isSpreadView) {
            if (bindingDirection === 'right') {
              // 右綴じ: 左矢印で前の見開きへ（小さいページ番号方向）
              prevSpread();
            } else {
              // 左綴じ: 左矢印で前の見開きへ（小さいページ番号方向）
              prevSpread();
            }
          } else if (currentPage < pages.length - 1) {
            setCurrentPage(currentPage + 1);
          }
        } else if (e.key === 'ArrowRight' && pages.length > 1) {
          e.preventDefault();
          if (isSpreadView) {
            if (bindingDirection === 'right') {
              // 右綴じ: 右矢印で次の見開きへ（大きいページ番号方向）
              nextSpread();
            } else {
              // 左綴じ: 右矢印で次の見開きへ（大きいページ番号方向）
              nextSpread();
            }
          } else if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
          }
        }
      }

      if (e.ctrlKey || e.metaKey) {
        // Undo/Redo
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
        // Copy: Ctrl+C
        else if (e.key === 'c') {
          if (selectedStrokeIds.length > 0 || selectedShapeIds.length > 0 || selectedTextIds.length > 0 || selectedImageIds.length > 0) {
            e.preventDefault();
            copySelected();
          }
        }
        // Cut: Ctrl+X
        else if (e.key === 'x') {
          if (selectedStrokeIds.length > 0 || selectedShapeIds.length > 0 || selectedTextIds.length > 0 || selectedImageIds.length > 0) {
            e.preventDefault();
            cutSelected();
          }
        }
        // Paste: Ctrl+V
        else if (e.key === 'v') {
          if (hasClipboard()) {
            e.preventDefault();
            pasteClipboard();
          }
        }
        // Select All: Ctrl+A
        else if (e.key === 'a') {
          e.preventDefault();
          selectAll();
        }
        // Ctrl+T: PDFテキストレイヤー表示/非表示 + コメントテキスト表示/非表示
        else if (e.key === 't') {
          e.preventDefault();
          toggleTextLayer();
          toggleCommentVisibility();
        }
        // Zoom In: Ctrl + + or Ctrl + =
        else if (e.key === '+' || e.key === '=' || e.key === ';') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('canvas-zoom-in'));
        }
        // Zoom Out: Ctrl + -
        else if (e.key === '-') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('canvas-zoom-out'));
        }
        // Reset Zoom: Ctrl + 0
        else if (e.key === '0') {
          e.preventDefault();
          resetZoom();
        }
        // Clear all drawings: Ctrl + Delete
        else if (e.key === 'Delete') {
          e.preventDefault();
          const hasDrawings = pages.some(page =>
            page.layers.some(layer => layer.strokes.length > 0 || layer.shapes.length > 0)
          );
          if (hasDrawings) {
            ask('すべての描画を消去しますか？', {
              title: '確認',
              kind: 'warning',
            }).then((confirmed) => {
              if (confirmed) {
                clearAllDrawings();
              }
            });
          }
        }
        // Print: Ctrl + P
        else if (e.key === 'p') {
          e.preventDefault();
          if (pages.length > 0) {
            window.dispatchEvent(new CustomEvent('mojiq-print'));
          }
        }
        // Page Jump: Ctrl + J
        else if (e.key === 'j') {
          e.preventDefault();
          if (pages.length > 1) {
            setIsPageJumpOpen(true);
          }
        }
        // Tab shortcuts
        // Ctrl+W: 現在のタブを閉じる
        else if (e.key === 'w') {
          e.preventDefault();
          if (activeDocumentId) {
            const doc = useDocumentStore.getState().documents.get(activeDocumentId);
            if (doc?.isModified) {
              // カスタム確認ダイアログを表示
              setCloseConfirmState({
                isOpen: true,
                docId: activeDocumentId,
                docTitle: doc.title,
              });
            } else {
              closeDocument(activeDocumentId, true);
              // 新しいアクティブドキュメントの状態を復元
              const newActiveId = useDocumentStore.getState().activeDocumentId;
              if (newActiveId) {
                // handleSwitchDocumentを使用（背景画像キャッシュの再構築も含む）
                handleSwitchDocument(newActiveId);
              } else {
                useDrawingStore.getState().clearDocument();
              }
            }
          }
        }
        // Ctrl+Tab / Ctrl+Shift+Tab: タブ切り替え
        else if (e.key === 'Tab') {
          e.preventDefault();
          const tabs = getTabInfoList();
          if (tabs.length > 1 && activeDocumentId) {
            const currentIndex = tabs.findIndex(t => t.id === activeDocumentId);
            let nextIndex: number;
            if (e.shiftKey) {
              // 前のタブ
              nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
            } else {
              // 次のタブ
              nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
            }
            const nextId = tabs[nextIndex].id;

            // handleSwitchDocumentを使用（背景画像キャッシュの再構築も含む）
            handleSwitchDocument(nextId);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Space: 元のツールに戻す
      if (e.code === 'Space') {
        e.preventDefault();
        if (previousToolRef.current) {
          setTool(previousToolRef.current as 'pen' | 'eraser' | 'select' | 'rect' | 'ellipse' | 'line' | 'rectAnnotated' | 'ellipseAnnotated' | 'lineAnnotated' | 'marker' | 'pan' | 'text' | 'arrow' | 'doubleArrow' | 'polyline' | 'image');
          previousToolRef.current = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, resetZoom, tool, setTool, selectedStrokeIds, selectedShapeIds, selectedTextIds, selectedImageIds, deleteSelectedStrokes, pages, currentPage, setCurrentPage, isViewerMode, handleEnterViewerMode, handleExitViewerMode, navigatePageInViewerMode, clearAllDrawings, activeDocumentId, getDocumentState, syncFromDrawingStore, closeDocument, getTabInfoList, switchDocument, getDocumentForDrawingStore, restoreDocumentState, isSpreadView, nextSpread, prevSpread, bindingDirection, toggleCommentVisibility, handleSwitchDocument, copySelected, cutSelected, pasteClipboard, hasClipboard, selectAll]);

  // ホイールスクロールでページ送り（閲覧モード時）
  useEffect(() => {
    if (!isViewerMode) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (isNavigatingRef.current) return;

      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 10) return;

      // 下スクロール = 次ページ（右から左の場合は正方向）
      const direction = delta > 0 ? 1 : -1;
      navigatePageInViewerMode(direction);
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [isViewerMode, navigatePageInViewerMode]);

  useEffect(() => {
    const setupDragDrop = async () => {
      const unlisten = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        handleFileDrop(event.payload.paths);
      });
      return unlisten;
    };

    const unlistenPromise = setupDragDrop();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [handleFileDrop]);

  return (
    <div className={`app ${isViewerMode ? 'viewer-mode' : ''} ${isFlipped ? 'workspace-flipped' : ''} ${mode === 'proofreading' ? 'proofreading-mode' : ''} ${mode === 'proofreading' && isProofreadingPanelCollapsed ? 'proofreading-panel-collapsed' : ''} ${modeTransition}`}>
      <LoadingOverlay />
      <ViewerModeOverlay onExit={handleExitViewerMode} />
      <HeaderBar />
      <TabBar
        onSwitchDocument={handleSwitchDocument}
        onSaveAndClose={handleSaveAndClose}
      />
      {pages.length === 0 ? (
        // ホーム画面
        <div className="home-screen">
          <div className="home-content">
            <DrawingCanvas />
          </div>
        </div>
      ) : (
        // 編集画面
        <>
          <div className="app-body">
            {!isSpreadView && mode === 'instruction' && <DrawingSettingsBar />}
            {!isSpreadView && mode === 'instruction' && <DrawingToolbar />}
            <div className="main-content">
              <div className="canvas-area">
                {isSpreadView ? <SpreadCanvas /> : <DrawingCanvas />}
              </div>
            </div>
            {!isSpreadView && mode === 'instruction' && <RightToolbar />}
            {!isSpreadView && mode === 'proofreading' && <ProofreadingToolbar />}
            {!isSpreadView && mode === 'proofreading' && <ProofreadingPanel />}
          </div>
          {!isSpreadView && pages.length > 1 && <PageNav />}
        </>
      )}

      {/* 閉じる確認ダイアログ（Ctrl+W用） */}
      <CloseConfirmDialog
        isOpen={closeConfirmState.isOpen}
        title="確認"
        message={`「${closeConfirmState.docTitle}」への変更を保存しますか？`}
        onResult={handleCloseConfirmResult}
      />

      {/* 環境設定モーダル */}
      <SettingsModal />

      {/* ページジャンプダイアログ */}
      <PageJumpDialog
        isOpen={isPageJumpOpen}
        onClose={() => setIsPageJumpOpen(false)}
      />

      {/* 校正チェックモーダル */}
      <ProofreadingCheckModal />
    </div>
  );
}

export default App;
