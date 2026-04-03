import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useLoadingStore } from '../../stores/loadingStore';
import { useSpreadViewStore, BindingDirection } from '../../stores/spreadViewStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
import { useThemeStore } from '../../stores/themeStore';
import { useZoomStore } from '../../stores/zoomStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useModeStore } from '../../stores/modeStore';
import { open, save, ask, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LoadedDocument } from '../../types';
import { renderPdfToImages, renderPdfPage } from '../../utils/pdfRenderer';
import { renderPageDrawingsToCanvas, hasDrawings } from '../../utils/drawingRenderer';
import {
  prepareExportData,
  exportDataToJson,
  getDrawingJsonPath,
  parseImportJson,
  scaleImportData,
  applyImportDataToPages,
} from '../../utils/drawingExportImport';
import { HamburgerMenu } from '../HamburgerMenu';
import { backgroundImageCache, preloadAllBackgroundImages } from '../../utils/backgroundImageCache';
import { acquireSaveLock, releaseSaveLock } from '../../utils/saveLock';
import { useProofreadingCheckStore } from '../../stores/proofreadingCheckStore';
import { useCommentVisibilityStore } from '../../stores/commentVisibilityStore';
import MojiQLogo from '../../../logo/MojiQ_icon.png';
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

// 描画データ読み込みアイコン（鉛筆＋上矢印）
const ImportDrawingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5a2.12 2.12 0 1 1 3 3L6.5 19.5 2 21l1.5-4.5L15 5z"/>
    <path d="M18 22v-8"/>
    <path d="M14 18l4-4 4 4"/>
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

// モード切替アイコン
const InstructionModeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const ProofreadingModeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
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

// Print icon (printer)
const PrintIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* プリンター本体 */}
    <path d="M4 15V10a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5"/>
    {/* 上部の用紙トレイ */}
    <path d="M6 9V4h12v5"/>
    {/* 下部の出力用紙 */}
    <rect x="6" y="15" width="12" height="6" rx="0.5"/>
    {/* 本体右側のボタン */}
    <circle cx="17" cy="12" r="0.5" fill="currentColor"/>
  </svg>
);

// ページ挿入アイコン
const InsertPageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
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
export const HeaderBar: React.FC = () => {
  const { loadDocument, loadDocumentWithAnnotations, getDocumentState, pages, currentPage, undo, redo, historyIndex, history, clearAllDrawings, deleteCurrentPage, insertBlankPage, setPages } = useDrawingStore();
  const {
    registerLoadedDocument,
    loadIntoActiveDocument,
    activeDocumentId,
    syncFromDrawingStore,
    markAsSaved,
    getActiveDocument,
    switchDocument,
    createNewDocument,
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
  const { getExportDrawingWithPdf, setExportDrawingWithPdf } = useSettingsStore();
  const exportDrawingWithPdf = getExportDrawingWithPdf();
  const { mode, setMode } = useModeStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSpreadMenuOpen, setIsSpreadMenuOpen] = useState(false);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
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

    // 背景画像キャッシュをクリア（前のドキュメントの画像が表示されるのを防ぐ）
    backgroundImageCache.clear();

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

        // アクティブなドキュメントがない場合は新規作成
        let currentActiveId = useDocumentStore.getState().activeDocumentId;
        if (!currentActiveId) {
          currentActiveId = createNewDocument({ title: '新規ドキュメント' });
        }

        // アクティブなドキュメントが空かどうかチェック
        // - アクティブドキュメントが空の場合: 既存タブに読み込む
        // - アクティブドキュメントにコンテンツがある場合: 新規タブを作成
        const currentPages = useDrawingStore.getState().pages || [];
        const shouldLoadIntoExisting = currentPages.length === 0;

        // 現在のドキュメント状態を保存（空でない場合のみ）
        if (activeDocumentId && currentPages.length > 0) {
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

        // 同一ファイルが既に開かれているかチェックする関数
        const findExistingDocumentByPath = (targetPath: string): string | null => {
          const docs = useDocumentStore.getState().documents;
          for (const [id, doc] of docs) {
            if (doc.filePath === targetPath) {
              return id;
            }
          }
          return null;
        };

        // PDFが含まれている場合は最初のPDFを読み込む
        if (pdfPaths.length > 0) {
          setProgress(5);
          const filePath = pdfPaths[0];
          const fileName = filePath.split(/[/\\]/).pop() || 'PDF';

          // 同一ファイルが既に開かれているかチェック
          const existingDocId = findExistingDocumentByPath(filePath);
          let loadIntoExistingDoc = false;
          if (existingDocId) {
            const confirmed = await ask(
              '同一のファイル名ですが読み込みますか？（描画はリセットされます）',
              { title: '確認', kind: 'warning' }
            );
            if (!confirmed) {
              setLoading(false);
              return;
            }
            loadIntoExistingDoc = true;
            // 既存のタブに切り替え
            switchDocument(existingDocId);
          }

          setLoading(true, 'ファイルを読み込んでいます...');
          setProgress(10);

          let result: LoadedDocument;
          try {
            result = await invoke<LoadedDocument>('load_file', {
              path: filePath,
            });
          } catch (e) {
            console.error('[HeaderBar openFile] Failed to load file:', e);
            setLoading(false);
            await message(String(e), { title: 'エラー', kind: 'error' });
            return;
          }

          if (result.file_type === 'pdf' && result.pdf_data) {
            setLoading(true, 'PDFをレンダリング中...');
            const pdfResult = await renderPdfToImages(result.pdf_data, (progress) => {
              // 30%〜70%の範囲でプログレスを表示
              setProgress(30 + Math.floor(progress * 0.4));
            });
            setProgress(70);

            // 背景画像をプリロード（ストア更新前に実行）
            setLoading(true, '画像をキャッシュ中...');
            await preloadAllBackgroundImages(
              (pageNumber) => pdfResult.pages[pageNumber]?.image_data || null,
              pdfResult.pages.length,
              (current, total) => {
                setProgress(70 + Math.floor((current / total) * 25));
              }
            );
            setProgress(95);

            // プリロード完了後にストアを更新
            loadDocumentWithAnnotations(pdfResult.pages, pdfResult.annotations);

            // 読み込み後のページ状態を取得
            const loadedPages = useDrawingStore.getState().pages;

            // 既存タブに読み込む条件: 空のタブ、または同一ファイルの上書き
            if (shouldLoadIntoExisting || loadIntoExistingDoc) {
              loadIntoActiveDocument(
                fileName,
                filePath,
                'pdf',
                loadedPages,
                null,
                [],
                pdfResult.annotations
              );
            } else {
              // 新規タブとしてドキュメントを登録
              registerLoadedDocument(
                fileName,
                filePath,
                'pdf',
                loadedPages,
                null,
                [],
                pdfResult.annotations
              );
            }
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

          // 同一ファイルが既に開かれているかチェック
          const existingDocId = findExistingDocumentByPath(sortedPaths[0]);
          let loadIntoExistingDoc = false;
          if (existingDocId) {
            const confirmed = await ask(
              '同一のファイル名ですが読み込みますか？（描画はリセットされます）',
              { title: '確認', kind: 'warning' }
            );
            if (!confirmed) {
              setLoading(false);
              return;
            }
            loadIntoExistingDoc = true;
            switchDocument(existingDocId);
          }

          setProgress(20);
          const result = await invoke<LoadedDocument>('load_files', {
            paths: sortedPaths,
          });
          setProgress(50);

          // 背景画像をプリロード（ストア更新前に実行）
          setLoading(true, '画像をキャッシュ中...');
          await preloadAllBackgroundImages(
            (pageNumber) => result.pages[pageNumber]?.image_data || null,
            result.pages.length,
            (current, total) => {
              setProgress(50 + Math.floor((current / total) * 40));
            }
          );
          setProgress(90);

          // プリロード完了後にストアを更新
          loadDocument(result.pages);

          // 読み込み後のページ状態を取得
          const loadedPages = useDrawingStore.getState().pages;

          // フォルダ名またはファイル名をタイトルに
          const folderPath = sortedPaths[0].split(/[/\\]/);
          const title = folderPath.length > 1 ? folderPath[folderPath.length - 2] : '画像';

          // 既存タブに読み込む条件: 空のタブ、または同一ファイルの上書き
          if (shouldLoadIntoExisting || loadIntoExistingDoc) {
            loadIntoActiveDocument(
              title,
              sortedPaths[0],
              'images',
              loadedPages,
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
              loadedPages,
              null,
              [],
              []
            );
          }

          setProgress(100);
          setLoading(false);
          return;
        }
        // 単一ファイルの場合
        else if (paths.length === 1) {
          setProgress(5);
          const filePath = paths[0];
          const fileName = filePath.split(/[/\\]/).pop() || 'ファイル';

          // 同一ファイルが既に開かれているかチェック
          const existingDocId = findExistingDocumentByPath(filePath);
          let loadIntoExistingDoc = false;
          if (existingDocId) {
            const confirmed = await ask(
              '同一のファイル名ですが読み込みますか？（描画はリセットされます）',
              { title: '確認', kind: 'warning' }
            );
            if (!confirmed) {
              setLoading(false);
              return;
            }
            loadIntoExistingDoc = true;
            switchDocument(existingDocId);
          }

          setLoading(true, 'ファイルを読み込んでいます...');
          setProgress(10);

          let result: LoadedDocument;
          try {
            result = await invoke<LoadedDocument>('load_file', {
              path: filePath,
            });
          } catch (e) {
            console.error('[HeaderBar loadIntoActive] Failed to load file:', e);
            setLoading(false);
            await message(String(e), { title: 'エラー', kind: 'error' });
            return;
          }

          if (result.file_type === 'pdf' && result.pdf_data) {
            setLoading(true, 'PDFをレンダリング中...');
            const pdfResult = await renderPdfToImages(result.pdf_data, (progress) => {
              // 30%〜70%の範囲でプログレスを表示
              setProgress(30 + Math.floor(progress * 0.4));
            });
            setProgress(70);

            // 背景画像をプリロード（ストア更新前に実行）
            setLoading(true, '画像をキャッシュ中...');
            await preloadAllBackgroundImages(
              (pageNumber) => pdfResult.pages[pageNumber]?.image_data || null,
              pdfResult.pages.length,
              (current, total) => {
                setProgress(70 + Math.floor((current / total) * 25));
              }
            );
            setProgress(95);

            // プリロード完了後にストアを更新
            loadDocumentWithAnnotations(pdfResult.pages, pdfResult.annotations);

            // 読み込み後のページ状態を取得
            const loadedPages = useDrawingStore.getState().pages;

            // 既存タブに読み込む条件: 空のタブ、または同一ファイルの上書き
            if (shouldLoadIntoExisting || loadIntoExistingDoc) {
              loadIntoActiveDocument(
                fileName,
                filePath,
                'pdf',
                loadedPages,
                null,
                [],
                pdfResult.annotations
              );
            } else {
              // 新規タブとしてドキュメントを登録
              registerLoadedDocument(
                fileName,
                filePath,
                'pdf',
                loadedPages,
                null,
                [],
                pdfResult.annotations
              );
            }
            setProgress(100);
          } else {
            setProgress(50);

            // 背景画像をプリロード（ストア更新前に実行）
            setLoading(true, '画像をキャッシュ中...');
            await preloadAllBackgroundImages(
              (pageNumber) => result.pages[pageNumber]?.image_data || null,
              result.pages.length,
              (current, total) => {
                setProgress(50 + Math.floor((current / total) * 40));
              }
            );
            setProgress(90);

            // プリロード完了後にストアを更新
            loadDocument(result.pages);

            // 読み込み後のページ状態を取得
            const loadedPages = useDrawingStore.getState().pages;

            // 既存タブに読み込む条件: 空のタブ、または同一ファイルの上書き
            if (shouldLoadIntoExisting || loadIntoExistingDoc) {
              loadIntoActiveDocument(
                fileName,
                filePath,
                'images',
                loadedPages,
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
                loadedPages,
                null,
                [],
                []
              );
            }
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
    // ファイルロック: 保存中の競合防止
    const { pages: pagesForLock } = useDrawingStore.getState();
    const totalObjects = pagesForLock.reduce((sum, page) =>
      sum + page.layers.reduce((s, l) => s + l.strokes.length + l.shapes.length + l.texts.length + l.images.length, 0), 0);
    if (!acquireSaveLock(pagesForLock.length, totalObjects)) {
      await message('現在保存処理中です。完了までお待ちください。', { title: '処理中', kind: 'info' });
      return;
    }

    try {
      // ディスク容量チェック: 保存前にディスクの空き容量を確認
      // 背景画像のBase64データ量から必要バイト数を概算（Base64 → バイナリは約75%）
      const estimatedBytes = pagesForLock.reduce((sum, page) => {
        const bgSize = page.backgroundImage ? page.backgroundImage.length * 0.75 : 0;
        const drawingSize = page.layers.reduce((s, l) => s + JSON.stringify(l).length, 0);
        return sum + bgSize + drawingSize;
      }, 0);

      try {
        const diskResult = await invoke<{ free_space: number; is_enough: boolean }>('check_disk_space', {
          filePath: savePath,
          requiredBytes: Math.ceil(estimatedBytes),
        });
        if (!diskResult.is_enough) {
          const freeMB = Math.floor(diskResult.free_space / (1024 * 1024));
          const requiredMB = Math.ceil(estimatedBytes * 1.5 / (1024 * 1024));
          releaseSaveLock();
          await message(
            `ディスクの空き容量が不足しています。\n空き容量: ${freeMB} MB / 必要容量（目安）: ${requiredMB} MB\n不要なファイルを削除してから再度お試しください。`,
            { title: 'ディスク容量不足', kind: 'error' }
          );
          return;
        }
      } catch (diskError) {
        // ディスク容量チェック失敗時はスキップして保存を続行
        console.warn('ディスク容量チェックに失敗:', diskError);
      }

      setLoading(true, 'PDFを保存中...');
      setProgress(10);

      const { pages, getPageImageAsync } = useDrawingStore.getState();
      const totalPages = pages.length;

      // 1. 背景画像を読み込む
      const backgroundImages: string[] = [];
      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        let imageData = page.backgroundImage;

        // backgroundImageが空でリンク方式の場合は読み込む
        if (!imageData && page.imageLink?.type === 'file') {
          try {
            setLoading(true, `画像を読み込み中... (${i + 1}/${totalPages})`);
            imageData = await getPageImageAsync(i);
          } catch (error) {
            console.error(`Failed to load image for page ${i}:`, error);
            imageData = '';
          }
        }
        backgroundImages.push(imageData);

        // 進捗更新
        setProgress(10 + Math.floor((i / totalPages) * 20));
      }

      // 2. 描画データをPNGオーバーレイとしてレンダリング
      setLoading(true, '描画データをレンダリング中...');
      const pageDrawingsV2: Array<{
        page_number: number;
        drawing_overlay: string;
        width: number;
        height: number;
      }> = [];

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        setLoading(true, `描画をレンダリング中... (${i + 1}/${totalPages})`);

        let overlayPng = '';
        if (hasDrawings(page)) {
          try {
            // PDF注釈テキストは非表示にして保存（元PDFに既にテキストがあるため重複を避ける）
            overlayPng = await renderPageDrawingsToCanvas(page, { hideComments: true });
          } catch (error) {
            console.error(`Failed to render drawings for page ${i}:`, error);
          }
        }

        pageDrawingsV2.push({
          page_number: page.pageNumber,
          drawing_overlay: overlayPng,
          width: page.width,
          height: page.height,
        });

        // 進捗更新
        setProgress(30 + Math.floor((i / totalPages) * 40));
      }

      // 3. PDFを生成
      setLoading(true, 'PDFを生成中...');
      setProgress(70);

      await invoke('save_pdf_v2', {
        savePath,
        request: {
          pages: pageDrawingsV2,
          background_images: backgroundImages,
        },
      });

      // 4. 描画データJSONを自動エクスポート（設定が有効な場合）
      const exportWithPdf = useSettingsStore.getState().getExportDrawingWithPdf();
      if (exportWithPdf) {
        try {
          // チェック済み状態もエクスポートに含める
          const checkedState = useProofreadingCheckStore.getState().getCheckedState();
          const exportData = prepareExportData(pages, checkedState);
          if (exportData.pageCount > 0) {
            const jsonString = exportDataToJson(exportData);
            const jsonPath = getDrawingJsonPath(savePath);
            await invoke('save_drawing_json', { path: jsonPath, data: jsonString });
          }
        } catch (error) {
          console.error('Failed to auto-export drawing data:', error);
          // 描画データのエクスポート失敗はPDF保存の失敗とはみなさない
        }
      }

      // PDF注釈由来テキストを非表示状態にしてUIボタンにも反映
      // （元PDFに既にテキストがあるため、保存後は非表示のままにする）
      useCommentVisibilityStore.getState().hide();

      // ドキュメントを保存済みとしてマーク
      if (activeDocumentId) {
        markAsSaved(activeDocumentId, savePath);
      }

      setProgress(100);
    } catch (error) {
      console.error('Failed to save PDF:', error);
      // エラーを再スローして呼び出し元に通知
      throw error;
    } finally {
      releaseSaveLock();
      setLoading(false);
    }
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
      // setLoading(false)はsavePdfToPathのfinallyで呼ばれるので不要
      const errorMessage = error instanceof Error ? error.message : String(error);
      await message('PDF保存に失敗しました: ' + errorMessage, { title: 'エラー', kind: 'error' });
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
      // setLoading(false)はsavePdfToPathのfinallyで呼ばれるので不要
      const errorMessage = error instanceof Error ? error.message : String(error);
      await message('PDF保存に失敗しました: ' + errorMessage, { title: 'エラー', kind: 'error' });
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

  // Ctrl+S保存リクエストをリッスン
  useEffect(() => {
    const handleSaveShortcut = async () => {
      const activeDoc = getActiveDocument();

      // 保存パスがない場合は名前を付けて保存
      if (!activeDoc?.filePath) {
        try {
          const defaultFileName = activeDoc?.title?.replace(/\.[^/.]+$/, '') || 'output';
          const savePath = await save({
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
            defaultPath: `${defaultFileName}.pdf`,
          });
          if (savePath) {
            await savePdfToPath(savePath);
            await message('PDFを保存しました', { title: '保存完了', kind: 'info' });
          }
        } catch (error) {
          console.error('Failed to save PDF:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          await message('PDF保存に失敗しました: ' + errorMessage, { title: 'エラー', kind: 'error' });
        }
      } else {
        try {
          await savePdfToPath(activeDoc.filePath);
          await message('上書き保存しました', { title: '保存完了', kind: 'info' });
        } catch (error) {
          console.error('Failed to overwrite save PDF:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          await message('PDF保存に失敗しました: ' + errorMessage, { title: 'エラー', kind: 'error' });
        }
      }
    };

    window.addEventListener('mojiq-save', handleSaveShortcut);
    return () => {
      window.removeEventListener('mojiq-save', handleSaveShortcut);
    };
  }, [getActiveDocument, savePdfToPath]);

  // 印刷リクエストをリッスン（Ctrl+P）
  useEffect(() => {
    const handlePrintRequest = () => {
      handlePrint();
    };

    window.addEventListener('mojiq-print', handlePrintRequest);
    return () => {
      window.removeEventListener('mojiq-print', handlePrintRequest);
    };
  }, []);

  const handleClearAllDrawings = () => {
    if (pages.length > 0) {
      setIsClearConfirmOpen(true);
    }
  };

  const handleClearConfirm = useCallback(() => {
    setIsClearConfirmOpen(false);
    clearAllDrawings();
  }, [clearAllDrawings]);

  const handleClearCancel = useCallback(() => {
    setIsClearConfirmOpen(false);
  }, []);

  // Ctrl+Delete全消去リクエストをリッスン
  useEffect(() => {
    const handleClearRequest = () => {
      setIsClearConfirmOpen(true);
    };
    window.addEventListener('mojiq-clear-all', handleClearRequest);
    return () => {
      window.removeEventListener('mojiq-clear-all', handleClearRequest);
    };
  }, []);

  // Check if there are any drawings in the document
  const documentHasDrawings = pages.some(page =>
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

  // 印刷処理
  const handlePrint = async () => {
    if (pages.length === 0 || isLoading) return;

    try {
      setLoading(true, '印刷用PDFを準備中...');
      setProgress(10);

      const { pages, getPageImageAsync, pdfDocument } = useDrawingStore.getState();
      const pageDrawings = pages.map((page) => ({
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

      // 背景画像を取得
      const backgroundImages: string[] = [];
      const totalPages = pages.length;
      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        let imageData = page.backgroundImage;

        // backgroundImageが空の場合
        if (!imageData) {
          // リンク方式の場合
          if (page.imageLink?.type === 'file') {
            try {
              setLoading(true, `画像を読み込み中... (${i + 1}/${totalPages})`);
              imageData = await getPageImageAsync(i);
            } catch (error) {
              console.error(`Failed to load image for page ${i}:`, error);
              imageData = '';
            }
          }
          // PDFドキュメントの場合
          else if (pdfDocument) {
            try {
              setLoading(true, `PDFページをレンダリング中... (${i + 1}/${totalPages})`);
              imageData = await renderPdfPage(pdfDocument, i);
            } catch (error) {
              console.error(`Failed to render PDF page ${i}:`, error);
              imageData = '';
            }
          }
        }
        backgroundImages.push(imageData);

        // 進捗更新
        setProgress(10 + Math.floor((i / totalPages) * 40));
      }

      setLoading(true, '印刷ダイアログを開いています...');
      setProgress(60);

      await invoke('print_pdf', {
        request: {
          original_path: null,
          pages: pageDrawings,
          background_images: backgroundImages,
        },
      });

      setProgress(100);
    } catch (error) {
      console.error('Failed to print:', error);
      await message('印刷に失敗しました: ' + error, { title: 'エラー', kind: 'error' });
    } finally {
      setLoading(false);
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

  // 描画データ読み込み
  const handleImportDrawingData = async () => {
    if (pages.length === 0) {
      await message('先にPDFまたは画像を読み込んでください', { title: 'エラー', kind: 'error' });
      return;
    }

    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'MojiQ Pro Drawing Data',
            extensions: ['mojiq.json', 'json'],
          },
        ],
      });

      if (!selected) return;

      setLoading(true, '描画データを読み込み中...');
      setProgress(20);

      const filePath = Array.isArray(selected) ? selected[0] : selected;
      const jsonData = await invoke<string>('load_drawing_json', { path: filePath });
      setProgress(50);

      const importData = parseImportJson(jsonData);
      if (!importData) {
        setLoading(false);
        await message('描画データの形式が不正です', { title: 'エラー', kind: 'error' });
        return;
      }

      // ページ数チェック
      if (importData.pageCount !== pages.length) {
        const confirmed = await ask(
          `描画データのページ数（${importData.pageCount}ページ）と現在のドキュメント（${pages.length}ページ）が一致しません。\n\n続行すると、対応するページにのみ描画が適用されます。続行しますか？`,
          {
            title: '確認',
            kind: 'warning',
            okLabel: '続行',
            cancelLabel: 'キャンセル',
          }
        );
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }

      setProgress(70);

      // 座標スケーリング
      const scaledData = scaleImportData(importData, pages);

      // 描画データを適用
      const newPages = applyImportDataToPages(scaledData, pages);
      setPages(newPages);

      // チェック済み状態を復元（v1.2以降のデータに含まれる場合）
      if (importData.checkedState) {
        useProofreadingCheckStore.getState().restoreCheckedState(importData.checkedState);
      }

      setProgress(100);
      setLoading(false);
      await message('描画データを読み込みました', { title: '完了', kind: 'info' });
    } catch (error) {
      console.error('Failed to import drawing data:', error);
      setLoading(false);
      await message('描画データの読み込みに失敗しました: ' + error, { title: 'エラー', kind: 'error' });
    }
  };

  return (
    <>
      <div className="header-bar">
        <div className="header-logo">
          <img src={MojiQLogo} alt="MojiQ Pro" className="header-logo-img" />
        </div>
        <div className="header-hamburger">
          <button onClick={toggleMenu} title="メニュー" className="hamburger-btn">
            <HamburgerIcon />
          </button>
        </div>
        {/* モード切替トグル */}
        <div className="header-mode-toggle">
          <button
            className={`mode-toggle-btn instruction ${mode === 'instruction' ? 'active' : ''}`}
            onClick={() => setMode('instruction')}
            title="指示入れモード"
          >
            <InstructionModeIcon />
          </button>
          <button
            className={`mode-toggle-btn proofreading ${mode === 'proofreading' ? 'active' : ''}`}
            onClick={() => setMode('proofreading')}
            title="校正チェックモード"
          >
            <ProofreadingModeIcon />
          </button>
        </div>
        {/* アンドゥ・リドゥ・全消去 */}
        {pages.length > 0 && (
          <>
            <span className="header-divider" />
            <div className="header-left">
              <button onClick={undo} disabled={historyIndex <= 0} title="元に戻す (Ctrl+Z)">
                <UndoIcon />
              </button>
              <button onClick={redo} disabled={historyIndex >= history.length - 1} title="やり直し (Ctrl+Y)">
                <RedoIcon />
              </button>
              <button onClick={handleClearAllDrawings} disabled={!documentHasDrawings || isLoading} title="描画を全消去 (Ctrl+Delete)" className="clear-all-btn">
                <ClearAllIcon />
              </button>
            </div>
          </>
        )}

        {/* ズームコントロール */}
        {pages.length > 0 && (
          <div className="header-zoom">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('canvas-zoom-in'))}
              disabled={zoom >= maxZoom}
              title="ズームイン (Ctrl++)"
            >
              <ZoomInIcon />
            </button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('canvas-zoom-out'))}
              disabled={zoom <= minZoom}
              title="ズームアウト (Ctrl+-)"
            >
              <ZoomOutIcon />
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
                  <div
                    className="save-menu-checkbox"
                    onClick={() => setExportDrawingWithPdf(!exportDrawingWithPdf)}
                  >
                    <input
                      type="checkbox"
                      id="export-drawing-checkbox"
                      checked={exportDrawingWithPdf}
                      onChange={(e) => {
                        e.stopPropagation();
                        setExportDrawingWithPdf(e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor="export-drawing-checkbox">描画データを保存</label>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 描画データ読み込みボタン */}
          <button
            onClick={handleImportDrawingData}
            disabled={pages.length === 0 || isLoading}
            title="描画データを読み込み"
          >
            <ImportDrawingIcon />
          </button>

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
                className="spread-menu-item"
                onClick={() => { insertBlankPage('before'); setIsSpreadMenuOpen(false); }}
                disabled={pages.length === 0}
              >
                <InsertPageIcon />
                <span>前に空白ページ挿入</span>
              </button>
              <button
                className="spread-menu-item"
                onClick={() => { insertBlankPage('after'); setIsSpreadMenuOpen(false); }}
                disabled={pages.length === 0}
              >
                <InsertPageIcon />
                <span>後に空白ページ挿入</span>
              </button>
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

          {/* 印刷ボタン */}
          <button
            onClick={handlePrint}
            title="印刷 (Ctrl+P)"
            disabled={pages.length === 0 || isLoading}
          >
            <PrintIcon />
          </button>
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

      {/* 全消去確認モーダル */}
      {isClearConfirmOpen && (
        <div className="clear-confirm-overlay" onClick={handleClearCancel}>
          <div className="clear-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="clear-confirm-header">
              <span className="clear-confirm-title">確認</span>
            </div>
            <div className="clear-confirm-body">
              <p>すべての描画を消去しますか？</p>
              <p>この操作は元に戻せません。</p>
            </div>
            <div className="clear-confirm-actions">
              <button className="clear-confirm-btn cancel" onClick={handleClearCancel}>
                キャンセル
              </button>
              <button className="clear-confirm-btn confirm" onClick={handleClearConfirm}>
                全消去
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
