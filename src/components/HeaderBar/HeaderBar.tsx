import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useLoadingStore } from '../../stores/loadingStore';
import { useSpreadViewStore, BindingDirection } from '../../stores/spreadViewStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
import { useThemeStore } from '../../stores/themeStore';
import { useZoomStore } from '../../stores/zoomStore';
import { usePageNavStore } from '../../stores/pageNavStore';
import { open, save, ask, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LoadedDocument, PageState, Layer } from '../../types';
import { loadPdfDocument as loadPdfDocumentFromFile } from '../../utils/pdfRenderer';
import { HamburgerMenu } from '../HamburgerMenu';
import './HeaderBar.css';

// SVG Icons
const FileOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M12 18v-6"/>
    <path d="M9 15l3-3 3 3"/>
  </svg>
);

const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H6"/>
    <polyline points="8 11 4 7 8 3"/>
  </svg>
);

const RedoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h9"/>
    <polyline points="16 11 20 7 16 3"/>
  </svg>
);

const ClearAllIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
  </svg>
);

const HamburgerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

// Spread view icon (open book)
const SpreadViewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* 左ページ */}
    <path d="M12 5c-1.5-1-3.5-1.5-5.5-1.5S3 4 2 5v13c1-.8 2.5-1.2 4.5-1.2s4 .4 5.5 1.2"/>
    {/* 右ページ */}
    <path d="M12 5c1.5-1 3.5-1.5 5.5-1.5S21 4 22 5v13c-1-.8-2.5-1.2-4.5-1.2s-4 .4-5.5 1.2"/>
    {/* 中央の綴じ部分 */}
    <line x1="12" y1="5" x2="12" y2="18"/>
  </svg>
);

// 右綴じアイコン（旧MojiQ）
const BindingRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H5a2 2 0 00-2 2v8a2 2 0 002 2h9"/>
    <path d="M14 3v12"/>
    <path d="M7 9h4"/>
    <path d="M9 7l-2 2 2 2"/>
  </svg>
);

// 左綴じアイコン（旧MojiQ）
const BindingLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 3h9a2 2 0 012 2v8a2 2 0 01-2 2H4"/>
    <path d="M4 3v12"/>
    <path d="M7 9h4"/>
    <path d="M9 7l2 2-2 2"/>
  </svg>
);

// Check icon
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Viewer mode icon (monitor/presentation)
const ViewerModeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

// Page nav show icon
const PageNavShowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="10" width="18" height="4" rx="2"/>
    <circle cx="8" cy="12" r="1" fill="currentColor"/>
  </svg>
);

// Page nav hide icon
const PageNavHideIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="10" width="18" height="4" rx="2" strokeDasharray="3 2"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

// ページ削除アイコン
const DeletePageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

// ズームインアイコン
const ZoomInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7"/>
    <line x1="21" y1="21" x2="15" y2="15"/>
    <line x1="10" y1="7" x2="10" y2="13"/>
    <line x1="7" y1="10" x2="13" y2="10"/>
  </svg>
);

// ズームアウトアイコン
const ZoomOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7"/>
    <line x1="21" y1="21" x2="15" y2="15"/>
    <line x1="7" y1="10" x2="13" y2="10"/>
  </svg>
);

// ウィンドウコントロールアイコン
const MinimizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <line x1="2" y1="5" x2="8" y2="5"/>
  </svg>
);

const MaximizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="2" y="2" width="6" height="6"/>
  </svg>
);

const RestoreIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="1" y="3" width="5" height="5"/>
    <polyline points="3,3 3,1.5 8,1.5 8,6.5 6,6.5"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <line x1="2" y1="2" x2="8" y2="8"/>
    <line x1="8" y1="2" x2="2" y2="8"/>
  </svg>
);

// デフォルトレイヤーを作成するヘルパー関数
const createDefaultLayer = (): Layer => ({
  id: `layer-${Date.now()}`,
  name: 'Layer 1',
  visible: true,
  opacity: 1,
  strokes: [],
  shapes: [],
  texts: [],
  images: [],
});

// デフォルトページを作成するヘルパー関数
const createDefaultPage = (pageNumber: number, backgroundImage: string, width: number, height: number): PageState => ({
  pageNumber,
  layers: [createDefaultLayer()],
  backgroundImage,
  width,
  height,
});

export const HeaderBar: React.FC = () => {
  const { loadDocument, loadPdfDocument, getDocumentState, pages, currentPage, undo, redo, historyIndex, history, clearAllDrawings, deleteCurrentPage } = useDrawingStore();
  const {
    registerLoadedDocument,
    loadIntoActiveDocument,
    activeDocumentId,
    syncFromDrawingStore,
    markAsSaved,
    getActiveDocument,
  } = useDocumentStore();
  const { isLoading, setLoading, setProgress } = useLoadingStore();
  const {
    isSpreadView,
    bindingDirection,
    enableSpreadView,
    disableSpreadView,
    setBindingDirection,
  } = useSpreadViewStore();
  const { isActive: isViewerMode, enter: enterViewerMode, exit: exitViewerMode } = useViewerModeStore();
  const { theme, setTheme } = useThemeStore();
  const { zoom, setZoom, minZoom, maxZoom } = useZoomStore();
  const { isPageNavHidden, togglePageNavHidden } = usePageNavStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSpreadMenuOpen, setIsSpreadMenuOpen] = useState(false);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const spreadMenuRef = useRef<HTMLDivElement>(null);
  const spreadButtonRef = useRef<HTMLButtonElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // ウィンドウ最大化状態を監視
  useEffect(() => {
    const checkMaximized = async () => {
      const appWindow = getCurrentWindow();
      setIsMaximized(await appWindow.isMaximized());
    };
    checkMaximized();

    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // ウィンドウ操作ハンドラー
  const handleMinimize = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
  }, []);

  const handleClose = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  }, []);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSpreadMenuOpen &&
        spreadMenuRef.current &&
        !spreadMenuRef.current.contains(event.target as Node) &&
        spreadButtonRef.current &&
        !spreadButtonRef.current.contains(event.target as Node)
      ) {
        setIsSpreadMenuOpen(false);
      }
      if (
        isSaveMenuOpen &&
        saveMenuRef.current &&
        !saveMenuRef.current.contains(event.target as Node) &&
        saveButtonRef.current &&
        !saveButtonRef.current.contains(event.target as Node)
      ) {
        setIsSaveMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSpreadMenuOpen, isSaveMenuOpen]);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  const handleOpenFile = async () => {
    // ファイル読み込み時は単ページモードに戻す
    disableSpreadView();

    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Documents',
            extensions: ['pdf', 'jpg', 'jpeg', 'png'],
          },
        ],
      });

      if (selected) {
        setLoading(true, 'ファイルを読み込み中...');
        setProgress(5);

        // アクティブなドキュメントが空かどうかチェック
        const activeDoc = getActiveDocument();
        const isActiveDocEmpty = activeDoc && activeDoc.pages.length === 0;

        // 現在のドキュメント状態を保存（空でない場合のみ）
        if (activeDocumentId && pages.length > 0) {
          const currentState = getDocumentState();
          syncFromDrawingStore(currentState);
        }

        // 配列として扱う（単一選択でも配列になる）
        const paths = Array.isArray(selected) ? selected : [selected];

        // 画像ファイルとPDFを分離
        const imageExtensions = ['.jpg', '.jpeg', '.png'];
        const imagePaths = paths.filter(path =>
          imageExtensions.some(ext => path.toLowerCase().endsWith(ext))
        );
        const pdfPaths = paths.filter(path => path.toLowerCase().endsWith('.pdf'));

        // PDFが含まれている場合は最初のPDFを読み込む
        if (pdfPaths.length > 0) {
          setProgress(20);
          const filePath = pdfPaths[0];
          const fileName = filePath.split(/[/\\]/).pop() || 'PDF';
          const result = await invoke<LoadedDocument>('load_file', {
            path: filePath,
          });

          if (result.file_type === 'pdf' && result.pdf_data) {
            setLoading(true, 'PDFを読み込み中...');
            setProgress(40);
            const pdfResult = await loadPdfDocumentFromFile(result.pdf_data, (progress) => {
              // 40%〜90%の範囲でプログレスを表示
              setProgress(40 + (progress / 100) * 50);
            });
            setProgress(90);

            // ページステートを作成
            const pageStates = pdfResult.pageInfos.map((info, pageIndex) => {
              const pageState = createDefaultPage(info.pageNumber, '', info.width, info.height);
              const pageAnnotations = pdfResult.annotations[pageIndex] || [];
              if (pageAnnotations.length > 0 && pageState.layers[0]) {
                const layerId = pageState.layers[0].id;
                pageState.layers[0].texts = pageAnnotations.map((annot, idx) => ({
                  id: `pdf-annot-${pageIndex}-${idx}-${Date.now()}`,
                  text: annot.text,
                  x: annot.x,
                  y: annot.y,
                  color: annot.color,
                  fontSize: annot.fontSize,
                  isVertical: annot.isVertical,
                  layerId: layerId,
                }));
              }
              return pageState;
            });

            // アクティブなドキュメントが空の場合は既存タブに読み込む
            if (isActiveDocEmpty) {
              loadIntoActiveDocument(
                fileName,
                filePath,
                'pdf',
                pageStates,
                pdfResult.pdfDocument,
                pdfResult.pageInfos,
                pdfResult.annotations
              );
            } else {
              // 新規タブとしてドキュメントを登録
              registerLoadedDocument(
                fileName,
                filePath,
                'pdf',
                pageStates,
                pdfResult.pdfDocument,
                pdfResult.pageInfos,
                pdfResult.annotations
              );
            }

            // drawingStoreにも読み込み
            loadPdfDocument(pdfResult.pdfDocument, pdfResult.pageInfos, pdfResult.annotations);
            setProgress(100);
          }
        }
        // 複数の画像ファイルがある場合
        else if (imagePaths.length > 1) {
          // ファイル名でソート（自然順）
          const sortedPaths = [...imagePaths].sort((a, b) => {
            const nameA = a.split(/[/\\]/).pop() || '';
            const nameB = b.split(/[/\\]/).pop() || '';
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
          });

          setProgress(20);
          const result = await invoke<LoadedDocument>('load_files', {
            paths: sortedPaths,
          });
          setProgress(90);

          // ページステートを作成
          const pageStates = result.pages.map((p) =>
            createDefaultPage(p.page_number, p.image_data, p.width, p.height)
          );

          // フォルダ名またはファイル名をタイトルに
          const folderPath = sortedPaths[0].split(/[/\\]/);
          const title = folderPath.length > 1 ? folderPath[folderPath.length - 2] : '画像';

          // アクティブなドキュメントが空の場合は既存タブに読み込む
          if (isActiveDocEmpty) {
            loadIntoActiveDocument(
              title,
              sortedPaths[0],
              'images',
              pageStates,
              null,
              [],
              []
            );
          } else {
            // 新規タブとしてドキュメントを登録
            registerLoadedDocument(
              title,
              sortedPaths[0],
              'images',
              pageStates,
              null,
              [],
              []
            );
          }

          loadDocument(result.pages);
          setProgress(100);
          setLoading(false);
          return;
        }
        // 単一ファイルの場合
        else if (paths.length === 1) {
          setProgress(20);
          const filePath = paths[0];
          const fileName = filePath.split(/[/\\]/).pop() || 'ファイル';
          const result = await invoke<LoadedDocument>('load_file', {
            path: filePath,
          });

          if (result.file_type === 'pdf' && result.pdf_data) {
            setLoading(true, 'PDFを読み込み中...');
            setProgress(40);
            const pdfResult = await loadPdfDocumentFromFile(result.pdf_data, (progress) => {
              // 40%〜90%の範囲でプログレスを表示
              setProgress(40 + (progress / 100) * 50);
            });
            setProgress(90);

            // ページステートを作成
            const pageStates = pdfResult.pageInfos.map((info, pageIndex) => {
              const pageState = createDefaultPage(info.pageNumber, '', info.width, info.height);
              const pageAnnotations = pdfResult.annotations[pageIndex] || [];
              if (pageAnnotations.length > 0 && pageState.layers[0]) {
                const layerId = pageState.layers[0].id;
                pageState.layers[0].texts = pageAnnotations.map((annot, idx) => ({
                  id: `pdf-annot-${pageIndex}-${idx}-${Date.now()}`,
                  text: annot.text,
                  x: annot.x,
                  y: annot.y,
                  color: annot.color,
                  fontSize: annot.fontSize,
                  isVertical: annot.isVertical,
                  layerId: layerId,
                }));
              }
              return pageState;
            });

            // アクティブなドキュメントが空の場合は既存タブに読み込む
            if (isActiveDocEmpty) {
              loadIntoActiveDocument(
                fileName,
                filePath,
                'pdf',
                pageStates,
                pdfResult.pdfDocument,
                pdfResult.pageInfos,
                pdfResult.annotations
              );
            } else {
              // 新規タブとしてドキュメントを登録
              registerLoadedDocument(
                fileName,
                filePath,
                'pdf',
                pageStates,
                pdfResult.pdfDocument,
                pdfResult.pageInfos,
                pdfResult.annotations
              );
            }

            loadPdfDocument(pdfResult.pdfDocument, pdfResult.pageInfos, pdfResult.annotations);
            setProgress(100);
          } else {
            setProgress(90);

            // ページステートを作成
            const pageStates = result.pages.map((p) =>
              createDefaultPage(p.page_number, p.image_data, p.width, p.height)
            );

            // アクティブなドキュメントが空の場合は既存タブに読み込む
            if (isActiveDocEmpty) {
              loadIntoActiveDocument(
                fileName,
                filePath,
                'images',
                pageStates,
                null,
                [],
                []
              );
            } else {
              // 新規タブとしてドキュメントを登録
              registerLoadedDocument(
                fileName,
                filePath,
                'images',
                pageStates,
                null,
                [],
                []
              );
            }

            loadDocument(result.pages);
            setProgress(100);
          }
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      setLoading(false);
    }
  };

  // PDF保存の共通処理
  const savePdfToPath = async (savePath: string) => {
    setLoading(true, 'PDFを保存中...');
    setProgress(50);

    const state = useDrawingStore.getState();
    const pageDrawings = state.pages.map((page) => ({
      page_number: page.pageNumber,
      strokes: page.layers.flatMap((layer) =>
        layer.visible
          ? layer.strokes.map((stroke) => ({
              points: stroke.points.map((p) => [p.x, p.y] as [number, number]),
              color: stroke.color,
              width: stroke.width,
              pressure: stroke.points.map((p) => p.pressure || 0.5),
            }))
          : []
      ),
      width: page.width,
      height: page.height,
    }));

    const backgroundImages = state.pages.map((page) => page.backgroundImage);

    await invoke('save_pdf', {
      savePath,
      request: {
        original_path: null,
        pages: pageDrawings,
        background_images: backgroundImages,
      },
    });

    // ドキュメントを保存済みとしてマーク
    if (activeDocumentId) {
      markAsSaved(activeDocumentId, savePath);
    }

    setProgress(100);
    setLoading(false);
  };

  // 上書き保存
  const handleOverwriteSave = async () => {
    setIsSaveMenuOpen(false);
    const activeDoc = getActiveDocument();

    // 保存パスがない場合は名前を付けて保存
    if (!activeDoc?.filePath) {
      await handleSaveAs();
      return;
    }

    try {
      await savePdfToPath(activeDoc.filePath);
      await message('上書き保存しました', { title: '保存完了', kind: 'info' });
    } catch (error) {
      console.error('Failed to overwrite save PDF:', error);
      setLoading(false);
      await message('PDF保存に失敗しました: ' + error, { title: 'エラー', kind: 'error' });
    }
  };

  // 名前を付けて保存
  const handleSaveAs = async () => {
    setIsSaveMenuOpen(false);
    try {
      const activeDoc = getActiveDocument();
      const defaultFileName = activeDoc?.title?.replace(/\.[^/.]+$/, '') || 'output';

      const savePath = await save({
        filters: [
          {
            name: 'PDF',
            extensions: ['pdf'],
          },
        ],
        defaultPath: `${defaultFileName}.pdf`,
      });

      if (savePath) {
        await savePdfToPath(savePath);
        await message('PDFを保存しました', { title: '保存完了', kind: 'info' });
      }
    } catch (error) {
      console.error('Failed to save PDF:', error);
      setLoading(false);
      await message('PDF保存に失敗しました: ' + error, { title: 'エラー', kind: 'error' });
    }
  };

  // 保存ボタンクリック時（ドロップダウンを開く）
  const handleSaveMenuToggle = () => {
    setIsSaveMenuOpen(!isSaveMenuOpen);
  };

  // 外部からの保存リクエストをリッスン（「保存して閉じる」機能用）
  useEffect(() => {
    const handleSaveRequest = async (_e: Event) => {
      try {
        const activeDoc = getActiveDocument();
        if (activeDoc?.filePath) {
          // 上書き保存
          await savePdfToPath(activeDoc.filePath);
        } else {
          // 名前を付けて保存
          const defaultFileName = activeDoc?.title?.replace(/\.[^/.]+$/, '') || 'output';
          const savePath = await save({
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
            defaultPath: `${defaultFileName}.pdf`,
          });
          if (savePath) {
            await savePdfToPath(savePath);
          } else {
            // キャンセルされた場合
            window.dispatchEvent(new Event('mojiq-save-cancelled'));
            return;
          }
        }
        // 保存完了を通知
        window.dispatchEvent(new Event('mojiq-save-complete'));
      } catch (error) {
        console.error('Failed to save:', error);
        window.dispatchEvent(new Event('mojiq-save-cancelled'));
      }
    };

    window.addEventListener('mojiq-save-request', handleSaveRequest);
    return () => {
      window.removeEventListener('mojiq-save-request', handleSaveRequest);
    };
  }, [getActiveDocument, savePdfToPath]);

  const handleClearAllDrawings = async () => {
    if (pages.length > 0) {
      const confirmed = await ask('すべての描画を消去しますか？', {
        title: '確認',
        kind: 'warning',
      });
      if (confirmed) {
        clearAllDrawings();
      }
    }
  };

  // Check if there are any drawings
  const hasDrawings = pages.some(page =>
    page.layers.some(layer => layer.strokes.length > 0 || layer.shapes.length > 0)
  );

  // 見開きメニュートグル
  const handleSpreadMenuToggle = () => {
    setIsSpreadMenuOpen(!isSpreadMenuOpen);
  };

  // 見開き表示の有効化
  const handleEnableSpreadView = async (direction: BindingDirection) => {
    // 既に見開きモードの場合は確認なしで綴じ方向を変更
    if (isSpreadView) {
      setBindingDirection(direction);
      enableSpreadView(pages.length);
      setIsSpreadMenuOpen(false);
      return;
    }

    // 見開きモードでない場合は確認ダイアログを表示
    const directionName = direction === 'right' ? '右綴じ' : '左綴じ';
    const confirmed = await ask(
      `${directionName}に変更します。\n※単ページには戻せませんがよろしいですか？`,
      {
        title: '見開き表示',
        kind: 'warning',
        okLabel: '変更する',
        cancelLabel: 'キャンセル',
      }
    );

    if (confirmed) {
      setBindingDirection(direction);
      enableSpreadView(pages.length);
    }
    setIsSpreadMenuOpen(false);
  };

  // ページ削除
  const handleDeleteCurrentPage = async () => {
    if (pages.length <= 1) return;

    const confirmed = await ask(
      `現在のページ（${currentPage + 1}ページ目）を削除しますか？\nこの操作は元に戻せません。`,
      {
        title: 'ページ削除',
        kind: 'warning',
        okLabel: '削除',
        cancelLabel: 'キャンセル',
      }
    );

    if (confirmed) {
      deleteCurrentPage();
      setIsSpreadMenuOpen(false);
    }
  };

  // 閲覧モード切り替え
  const handleToggleViewerMode = () => {
    if (isViewerMode) {
      // 閲覧モード終了
      const { previousZoom, wasLightTheme } = exitViewerMode();
      if (wasLightTheme) {
        setTheme('light');
      }
      // アニメーション付きズーム
      const startZoom = zoom;
      const startTime = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / 300, 1);
        const easedProgress = easeOutCubic(progress);
        const currentZoom = startZoom + (previousZoom - startZoom) * easedProgress;
        setZoom(currentZoom);
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    } else {
      // 閲覧モード開始
      enterViewerMode(zoom, theme === 'light');
      if (theme === 'light') {
        setTheme('dark');
      }
      // zoomを1.0にリセット（CSSでフルスクリーンフィット）
      const startZoom = zoom;
      const targetZoom = 1.0;
      const startTime = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / 300, 1);
        const easedProgress = easeOutCubic(progress);
        const currentZoom = startZoom + (targetZoom - startZoom) * easedProgress;
        setZoom(currentZoom);
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      setTimeout(() => requestAnimationFrame(animate), 50);
    }
  };

  return (
    <>
      <div className="header-bar">
        <div className="header-hamburger">
          <button onClick={toggleMenu} title="メニュー" className="hamburger-btn">
            <HamburgerIcon />
          </button>
        </div>
        <div className="header-left">
          <button onClick={undo} disabled={historyIndex <= 0} title="元に戻す (Ctrl+Z)">
            <UndoIcon />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} title="やり直し (Ctrl+Y)">
            <RedoIcon />
          </button>
          <button onClick={handleClearAllDrawings} disabled={!hasDrawings || isLoading} title="描画を全消去 (Ctrl+Delete)" className="clear-all-btn">
            <ClearAllIcon />
          </button>
        </div>

        {/* ズームコントロール */}
        {pages.length > 0 && (
          <div className="header-zoom">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('canvas-zoom-out'))}
              disabled={zoom <= minZoom}
              title="ズームアウト (Ctrl+-)"
            >
              <ZoomOutIcon />
            </button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('canvas-zoom-in'))}
              disabled={zoom >= maxZoom}
              title="ズームイン (Ctrl++)"
            >
              <ZoomInIcon />
            </button>
          </div>
        )}

        <div className="header-right">
          <button onClick={handleOpenFile} disabled={isLoading} title="ファイルを開く">
            <FileOpenIcon />
          </button>
          {/* 保存ボタン */}
          <div className="save-container">
            <button
              ref={saveButtonRef}
              onClick={handleSaveMenuToggle}
              disabled={pages.length === 0 || isLoading}
              title="PDF保存"
            >
              <SaveIcon />
            </button>

            {(() => {
              const activeDoc = getActiveDocument();
              // 上書き保存が無効な条件: 保存パスがない、または変更がない
              const isOverwriteDisabled = !activeDoc?.filePath || !activeDoc?.isModified;
              return (
                <div className={`save-menu ${isSaveMenuOpen ? 'open' : ''}`} ref={saveMenuRef}>
                  <div className="save-menu-header">保存</div>
                  <button
                    className="save-menu-item"
                    onClick={handleOverwriteSave}
                    disabled={isOverwriteDisabled}
                  >
                    <SaveIcon />
                    <span>上書き保存</span>
                  </button>
                  <button
                    className="save-menu-item"
                    onClick={handleSaveAs}
                  >
                    <SaveIcon />
                    <span>名前を付けて保存</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* ページ編集ボタン */}
          <div className="spread-view-container">
            <button
              ref={spreadButtonRef}
              onClick={handleSpreadMenuToggle}
              title="ページ編集"
              disabled={pages.length === 0}
            >
              <SpreadViewIcon />
            </button>

            <div className={`spread-menu ${isSpreadMenuOpen ? 'open' : ''}`} ref={spreadMenuRef}>
              <div className="spread-menu-header">見開き表示</div>
              <button
                className={`spread-menu-item ${isSpreadView && bindingDirection === 'right' ? 'selected' : ''}`}
                onClick={() => handleEnableSpreadView('right')}
                disabled={pages.length < 2}
              >
                <BindingRightIcon />
                <span>右綴じ</span>
                {isSpreadView && bindingDirection === 'right' && <span className="spread-menu-check"><CheckIcon /></span>}
              </button>
              <button
                className={`spread-menu-item ${isSpreadView && bindingDirection === 'left' ? 'selected' : ''}`}
                onClick={() => handleEnableSpreadView('left')}
                disabled={pages.length < 2}
              >
                <BindingLeftIcon />
                <span>左綴じ</span>
                {isSpreadView && bindingDirection === 'left' && <span className="spread-menu-check"><CheckIcon /></span>}
              </button>
              <div className="spread-menu-divider"></div>
              <div className="spread-menu-header">ページ操作</div>
              <button
                className="spread-menu-item danger"
                onClick={handleDeleteCurrentPage}
                disabled={pages.length <= 1}
              >
                <DeletePageIcon />
                <span>表示ページ削除</span>
              </button>
            </div>
          </div>

          {/* 閲覧モードボタン */}
          <button
            onClick={handleToggleViewerMode}
            title="閲覧モード (F1)"
            disabled={pages.length === 0}
            className={isViewerMode ? 'active' : ''}
          >
            <ViewerModeIcon />
          </button>

          {/* ページバー表示/非表示ボタン */}
          {pages.length > 1 && (
            <button
              onClick={togglePageNavHidden}
              title={isPageNavHidden ? 'ページバーを表示' : 'ページバーを非表示'}
            >
              {isPageNavHidden ? <PageNavHideIcon /> : <PageNavShowIcon />}
            </button>
          )}
        </div>

        {/* ドラッグ領域（タイトルバー代わり） */}
        <div className="titlebar-drag-region" data-tauri-drag-region></div>

        {/* ウィンドウコントロール */}
        <div className="window-controls">
          <button
            className="window-control-btn minimize-btn"
            onClick={handleMinimize}
            title="最小化"
          >
            <MinimizeIcon />
          </button>
          <button
            className="window-control-btn maximize-btn"
            onClick={handleMaximize}
            title={isMaximized ? '元に戻す' : '最大化'}
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            className="window-control-btn close-btn"
            onClick={handleClose}
            title="閉じる"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <HamburgerMenu isOpen={isMenuOpen} onToggle={toggleMenu} />
    </>
  );
};
