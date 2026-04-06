import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useDrawingStore } from '../../stores/drawingStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useLoadingStore } from '../../stores/loadingStore';
import { useZoomStore } from '../../stores/zoomStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
import { useBgOpacityStore } from '../../stores/bgOpacityStore';
import { useModeStore } from '../../stores/modeStore';
import { useDisplayScaleStore } from '../../stores/displayScaleStore';
import { AnnotationModal } from '../AnnotationModal';
import { open, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { LoadedDocument } from '../../types';
import { renderPdfToImages, extractPdfTextContent } from '../../utils/pdfRenderer';
import { backgroundImageCache, preloadAllBackgroundImages } from '../../utils/backgroundImageCache';
import { useTextLayerStore, PdfTextItem } from '../../stores/textLayerStore';
import './DrawingCanvas.css';

// モードアイコン（指示入れモード）- HeaderBarと同じ
const InstructionModeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

// モードアイコン（校正チェックモード）- HeaderBarと同じ
const ProofreadingModeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

// ファイルを開くアイコン
const FileOpenIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M12 18v-6"/>
    <path d="M9 15l3-3 3 3"/>
  </svg>
);

export const DrawingCanvas: React.FC = () => {
  const {
    canvasRef,
    selectionCanvasRef,
    scrollAreaRef: canvasScrollAreaRef,
    redrawCanvas,
    showAnnotationModal,
    handleAnnotationSubmit,
    handleAnnotationCancel,
    annotationState,
    getEditingAnnotation,
    hoverAnnotationType,
    isDraggingAnnotation,
    isDraggingLeaderEnd,
    // テキストモーダル関連
    showTextModal,
    handleTextSubmit,
    handleTextCancel,
    getEditingText,
    // 折れ線関連
    isDrawingPolyline,
    // 画像関連
    showImageInput,
    loadImageFile,
    placeImageAtCenter,
    cancelImageInput,
    // labeledRect（小文字指定）関連
    showLabelInputModal,
    pendingLabeledRect,
    setShowLabelInputModal,
    setPendingLabeledRect,
    // リサイズカーソル
    resizeCursor,
  } = useCanvas();

  // 画像ファイル入力用のref
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { getCurrentPageState, tool, pages, currentPage, setCurrentPage, addShape, color, strokeWidth } = useDrawingStore();
  const { loadIntoActiveDocument, createNewDocument } = useDocumentStore();
  const { setLoading, setProgress } = useLoadingStore();
  const { zoom, setZoom, minZoom, maxZoom, zoomStep } = useZoomStore();
  const { isActive: isViewerMode } = useViewerModeStore();
  const { bgOpacity } = useBgOpacityStore();
  const { mode } = useModeStore();
  const { setDisplayScale } = useDisplayScaleStore();
  const { isVisible: isTextLayerVisible, getPageTextItems, setPageTextItems, setExtracting } = useTextLayerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const [baseScale, setBaseScale] = useState(1);

  // ビューポートカリング用: useCanvasのscrollAreaRefにDOM要素を同期
  useEffect(() => {
    if (scrollAreaRef.current) {
      (canvasScrollAreaRef as React.MutableRefObject<HTMLDivElement | null>).current = scrollAreaRef.current;
    }
  });

  // 前回のページ情報を保持（サイズ変更時の再描画判定用）
  const prevPageRef = useRef<{ page: number; width: number; height: number } | null>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const scrollStartRef = useRef<{ left: number; top: number } | null>(null);

  // Track mouse position for keyboard zoom
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Page navigation debounce ref
  const lastPageChangeRef = useRef<number>(0);

  // 一文字入力モーダル用
  const [labelInput, setLabelInput] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Track mouse position
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // 一文字入力モーダルが開いたときにフォーカスとデフォルト値を設定
  useEffect(() => {
    if (showLabelInputModal) {
      setLabelInput('小'); // デフォルト値
      const timeoutId = setTimeout(() => {
        labelInputRef.current?.focus();
        labelInputRef.current?.select();
      }, 50);
      // クリーンアップ：コンポーネントアンマウントやモーダル閉じ時にタイムアウトをクリア
      return () => clearTimeout(timeoutId);
    }
  }, [showLabelInputModal]);

  // 一文字入力モーダルの確定
  const handleLabelInputSubmit = useCallback(() => {
    if (!pendingLabeledRect || !labelInput.trim()) {
      setShowLabelInputModal(false);
      setPendingLabeledRect(null);
      return;
    }

    const label = labelInput.charAt(0); // 最初の1文字のみ
    addShape({
      type: 'labeledRect',
      startPos: pendingLabeledRect.rectStart,
      endPos: pendingLabeledRect.rectEnd,
      color,
      width: strokeWidth,
      label,
      leaderLine: {
        start: pendingLabeledRect.leaderStart,
        end: pendingLabeledRect.leaderEnd,
      },
    });

    setShowLabelInputModal(false);
    setPendingLabeledRect(null);
    setLabelInput('');
  }, [pendingLabeledRect, labelInput, addShape, color, strokeWidth, setShowLabelInputModal, setPendingLabeledRect]);

  // 一文字入力モーダルのキャンセル
  const handleLabelInputCancel = useCallback(() => {
    setShowLabelInputModal(false);
    setPendingLabeledRect(null);
    setLabelInput('');
  }, [setShowLabelInputModal, setPendingLabeledRect]);

  // プレースホルダークリックでファイルを開く
  const handlePlaceholderClick = useCallback(async () => {
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

      if (!selected) return;

      // 背景画像キャッシュをクリア（前のドキュメントの画像が表示されるのを防ぐ）
      backgroundImageCache.clear();

      // アクティブなドキュメントがない場合は先に作成
      if (!useDocumentStore.getState().activeDocumentId) {
        createNewDocument({ title: '新規ドキュメント' });
      }

      setLoading(true, 'ファイルを読み込み中...');
      setProgress(5);

      const paths = Array.isArray(selected) ? selected : [selected];

      // 画像ファイルとPDFを分離
      const imageExtensions = ['.jpg', '.jpeg', '.png'];
      const imagePaths = paths.filter(path =>
        imageExtensions.some(ext => path.toLowerCase().endsWith(ext))
      );
      const pdfPaths = paths.filter(path => path.toLowerCase().endsWith('.pdf'));

      // PDFが含まれている場合は最初のPDFを読み込む
      if (pdfPaths.length > 0) {
        setProgress(10);
        const filePath = pdfPaths[0];
        const fileName = filePath.split(/[/\\]/).pop() || 'PDF';
        const result = await invoke<LoadedDocument>('load_file', { path: filePath });

        if (result.file_type === 'pdf' && result.pdf_data) {
          setLoading(true, 'PDFをレンダリング中...');
          const pdfResult = await renderPdfToImages(result.pdf_data, (progress) => {
            setProgress(20 + Math.floor(progress * 0.5));
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
          const { loadDocumentWithAnnotations } = useDrawingStore.getState();
          loadDocumentWithAnnotations(pdfResult.pages, pdfResult.annotations);

          // ホーム画面からの読み込みは常にアクティブなタブに読み込む
          const loadedPages = useDrawingStore.getState().pages;
          loadIntoActiveDocument(
            fileName,
            filePath,
            'pdf',
            loadedPages,
            null,
            [],
            pdfResult.annotations
          );
        }
      } else if (imagePaths.length > 0) {
        // 画像ファイルのみの場合
        setProgress(30);
        const result = await invoke<LoadedDocument>('load_files', { paths: imagePaths });
        setProgress(50);

        if (result.pages && result.pages.length > 0) {
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
          const { loadDocumentWithAnnotations } = useDrawingStore.getState();
          loadDocumentWithAnnotations(result.pages, []);
          const fileName = imagePaths.length === 1
            ? imagePaths[0].split(/[/\\]/).pop() || '画像'
            : `${imagePaths.length}枚の画像`;
          // PageDataをPageStateとして扱うため、loadDocumentWithAnnotationsで変換済みのpagesを使用
          const loadedPages = useDrawingStore.getState().pages;
          // ホーム画面からの読み込みは常にアクティブなタブに読み込む
          loadIntoActiveDocument(fileName, imagePaths[0], 'images', loadedPages, null, [], []);
        }
      }

      setProgress(100);
      setLoading(false);
    } catch (e) {
      console.error('Failed to open file:', e);
      setLoading(false);
      message(`ファイルを開けませんでした: ${e}`, { title: 'エラー', kind: 'error' });
    }
  }, [setLoading, setProgress, loadIntoActiveDocument, createNewDocument]);

  const pageState = getCurrentPageState();
  const originalWidth = pageState?.width || 800;
  const originalHeight = pageState?.height || 600;

  // Calculate base scale to fit container (or screen in viewer mode)
  useEffect(() => {
    const updateBaseScale = () => {
      if (!pageState) return;

      let containerWidth: number;
      let containerHeight: number;

      if (isViewerMode) {
        // 閲覧モード時は画面サイズの95%にフィット
        containerWidth = window.innerWidth * 0.95;
        containerHeight = window.innerHeight * 0.95;
      } else {
        if (!containerRef.current) return;
        const container = containerRef.current;
        containerWidth = container.clientWidth - 40; // padding
        containerHeight = container.clientHeight - 40;
      }

      const scaleX = containerWidth / originalWidth;
      const scaleY = containerHeight / originalHeight;
      const newScale = isViewerMode
        ? Math.min(scaleX, scaleY) // 閲覧モードでは拡大も許可
        : Math.min(scaleX, scaleY, 1); // 通常モードでは縮小のみ

      setBaseScale(newScale);
    };

    updateBaseScale();
    window.addEventListener('resize', updateBaseScale);
    return () => window.removeEventListener('resize', updateBaseScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalWidth, originalHeight, isViewerMode, pages.length, currentPage]);

  // 背景キャンバスを直接更新（Reactのレンダリングサイクルから独立）
  // useLayoutEffectを使用して、画面描画前にキャンバスを更新
  useLayoutEffect(() => {
    const bgCanvas = backgroundCanvasRef.current;
    console.log('[BG Debug] useLayoutEffect called', {
      currentPage,
      hasCanvas: !!bgCanvas,
      hasPageState: !!pageState,
      cacheSize: backgroundImageCache.size,
      hasCache: backgroundImageCache.has(currentPage),
    });

    if (!bgCanvas || !pageState) {
      console.log('[BG Debug] Early return - no canvas or pageState');
      return;
    }

    const ctx = bgCanvas.getContext('2d');
    if (!ctx) {
      console.log('[BG Debug] Early return - no context');
      return;
    }

    const prev = prevPageRef.current;
    const needsResize = !prev || prev.width !== originalWidth || prev.height !== originalHeight;

    console.log('[BG Debug] State check', {
      prev,
      needsResize,
      originalWidth,
      originalHeight,
      canvasWidth: bgCanvas.width,
      canvasHeight: bgCanvas.height,
    });

    // サイズが変わる場合のみリサイズ（キャンバスがクリアされる）
    if (needsResize) {
      console.log('[BG Debug] Resizing canvas');
      bgCanvas.width = originalWidth;
      bgCanvas.height = originalHeight;
    }

    // 前回と同じページの場合はスキップ（既に描画済み）
    if (prev && prev.page === currentPage && !needsResize) {
      console.log('[BG Debug] Skip - same page, no resize needed');
      return;
    }

    // 現在のページ情報を保存
    prevPageRef.current = { page: currentPage, width: originalWidth, height: originalHeight };

    // キャッシュから即座に描画
    if (backgroundImageCache.has(currentPage)) {
      const cachedImg = backgroundImageCache.get(currentPage);
      if (cachedImg) {
        console.log('[BG Debug] Drawing from cache', {
          imgType: cachedImg instanceof ImageBitmap ? 'ImageBitmap' : 'HTMLImageElement',
        });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cachedImg, 0, 0, originalWidth, originalHeight);
        console.log('[BG Debug] Draw complete from cache');
        return;
      }
    }

    // キャッシュにない場合は白背景を描画
    console.log('[BG Debug] No cache - drawing white background');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, originalWidth, originalHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pages.length, originalWidth, originalHeight]);

  // キャッシュにない場合は非同期でロードして描画
  useEffect(() => {
    const loadAndDrawBackground = async () => {
      const bgCanvas = backgroundCanvasRef.current;
      if (!bgCanvas || !pageState) return;

      // 既にキャッシュにある場合はスキップ（useLayoutEffectで描画済み）
      if (backgroundImageCache.has(currentPage)) {
        return;
      }

      const ctx = bgCanvas.getContext('2d');
      if (!ctx) return;

      // 背景画像のソースを決定
      let imageSource: string | null = null;

      if (pageState.backgroundImage) {
        imageSource = pageState.backgroundImage;
      } else if (pageState.imageLink?.type === 'file') {
        try {
          const { getPageImageAsync } = useDrawingStore.getState();
          imageSource = await getPageImageAsync(currentPage);
        } catch (error) {
          console.error('Failed to load linked image:', error);
          return;
        }
      }

      if (!imageSource) return;

      // 画像をロードしてキャッシュに保存、描画
      try {
        await backgroundImageCache.preloadImage(currentPage, imageSource);
        const cachedImg = backgroundImageCache.get(currentPage);
        if (cachedImg && bgCanvas.width === originalWidth && bgCanvas.height === originalHeight) {
          ctx.clearRect(0, 0, originalWidth, originalHeight);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(cachedImg, 0, 0, originalWidth, originalHeight);
        }
      } catch (error) {
        console.error('Failed to load background image:', error);
      }
    };
    loadAndDrawBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pages.length, originalWidth, originalHeight]);

  // 描画キャンバスの再描画（ページ変更時）
  useEffect(() => {
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pages.length, redrawCanvas, originalWidth, originalHeight]);

  // ビューポートカリング: スクロール時に再描画して画面外オブジェクトをスキップ
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    let rafId = 0;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        redrawCanvas();
      });
    };
    scrollArea.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollArea.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [redrawCanvas]);

  // PDFテキストレイヤー: テキストコンテンツをオンデマンドで抽出
  const [textLayerItems, setTextLayerItems] = useState<PdfTextItem[]>([]);
  useEffect(() => {
    if (!isTextLayerVisible) {
      setTextLayerItems([]);
      return;
    }
    const pdfDoc = useDrawingStore.getState().pdfDocument;
    if (!pdfDoc) {
      setTextLayerItems([]);
      return;
    }
    // キャッシュがあればそれを使う
    const cached = getPageTextItems(currentPage);
    if (cached) {
      setTextLayerItems(cached);
      return;
    }
    // 非同期で抽出
    let cancelled = false;
    setExtracting(true);
    extractPdfTextContent(pdfDoc, currentPage).then(items => {
      if (!cancelled) {
        setPageTextItems(currentPage, items as PdfTextItem[]);
        setTextLayerItems(items as PdfTextItem[]);
      }
    }).catch(err => {
      console.warn('テキストレイヤー抽出に失敗:', err);
    }).finally(() => {
      if (!cancelled) setExtracting(false);
    });
    return () => { cancelled = true; };
  }, [isTextLayerVisible, currentPage, getPageTextItems, setPageTextItems, setExtracting]);

  // Open file dialog when showImageInput becomes true
  useEffect(() => {
    if (showImageInput && imageInputRef.current) {
      imageInputRef.current.click();
    }
  }, [showImageInput]);

  // Handle image file selection
  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      cancelImageInput();
      return;
    }

    const fileType = file.type;

    // Check supported file types
    const isImage = fileType.startsWith('image/');
    if (!isImage) {
      await message('対応形式: JPEG, PNG, GIF, WebP', { title: '非対応形式', kind: 'warning' });
      cancelImageInput();
      e.target.value = '';
      return;
    }

    try {
      await loadImageFile(file);
      // 画像を中央に配置
      placeImageAtCenter();
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      await message('ファイルの読み込みに失敗しました', { title: 'エラー', kind: 'error' });
      cancelImageInput();
    }

    e.target.value = '';
  }, [loadImageFile, placeImageAtCenter, cancelImageInput]);

  // Combined scale: base scale * user zoom
  const displayScale = baseScale * zoom;
  const displayWidth = originalWidth * displayScale;
  const displayHeight = originalHeight * displayScale;

  // displayScaleをストアに保存（useCanvasで使用）
  useEffect(() => {
    setDisplayScale(displayScale);
  }, [displayScale, setDisplayScale]);

  // Pan handlers
  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (tool !== 'pan') return;

    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    scrollStartRef.current = { left: scrollArea.scrollLeft, top: scrollArea.scrollTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [tool]);

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current || !scrollStartRef.current) return;

    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;

    scrollArea.scrollLeft = scrollStartRef.current.left - dx;
    scrollArea.scrollTop = scrollStartRef.current.top - dy;
  }, [isPanning]);

  const handlePanEnd = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;

    setIsPanning(false);
    panStartRef.current = null;
    scrollStartRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, [isPanning]);

  // Pointer-centered zoom function (used by both wheel and keyboard)
  const zoomAtPointer = useCallback((direction: number) => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const rect = scrollArea.getBoundingClientRect();
    const mousePos = mousePositionRef.current;

    // Check if mouse is within the scroll area
    const isMouseInScrollArea =
      mousePos.x >= rect.left &&
      mousePos.x <= rect.right &&
      mousePos.y >= rect.top &&
      mousePos.y <= rect.bottom;

    // If mouse is outside, zoom centered on viewport
    const pointerX = isMouseInScrollArea
      ? mousePos.x - rect.left
      : rect.width / 2;
    const pointerY = isMouseInScrollArea
      ? mousePos.y - rect.top
      : rect.height / 2;

    // Calculate position within the content (including scroll offset)
    const contentX = pointerX + scrollArea.scrollLeft;
    const contentY = pointerY + scrollArea.scrollTop;

    // Calculate new zoom
    const oldZoom = zoom;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom + direction * zoomStep));

    if (newZoom === oldZoom) return;

    // Calculate zoom ratio
    const zoomRatio = newZoom / oldZoom;

    // Update zoom
    setZoom(newZoom);

    // Adjust scroll position to keep pointer position stable
    requestAnimationFrame(() => {
      const newContentX = contentX * zoomRatio;
      const newContentY = contentY * zoomRatio;

      scrollArea.scrollLeft = newContentX - pointerX;
      scrollArea.scrollTop = newContentY - pointerY;
    });
  }, [zoom, minZoom, maxZoom, zoomStep, setZoom]);

  // Listen for keyboard zoom events
  useEffect(() => {
    const handleZoomIn = () => zoomAtPointer(1);
    const handleZoomOut = () => zoomAtPointer(-1);

    window.addEventListener('canvas-zoom-in', handleZoomIn);
    window.addEventListener('canvas-zoom-out', handleZoomOut);

    return () => {
      window.removeEventListener('canvas-zoom-in', handleZoomIn);
      window.removeEventListener('canvas-zoom-out', handleZoomOut);
    };
  }, [zoomAtPointer]);

  // Wheel handler - zoom (with Ctrl) or page navigation (without Ctrl)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl/Cmd + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      const scrollArea = scrollAreaRef.current;
      if (!scrollArea) return;

      // Get pointer position relative to scroll area
      const rect = scrollArea.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      // Calculate position within the content (including scroll offset)
      const contentX = pointerX + scrollArea.scrollLeft;
      const contentY = pointerY + scrollArea.scrollTop;

      // Calculate new zoom
      const direction = e.deltaY < 0 ? 1 : -1;
      const oldZoom = zoom;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom + direction * zoomStep));

      if (newZoom === oldZoom) return;

      // Calculate zoom ratio
      const zoomRatio = newZoom / oldZoom;

      // Update zoom
      setZoom(newZoom);

      // Adjust scroll position to keep pointer position stable
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        const newContentX = contentX * zoomRatio;
        const newContentY = contentY * zoomRatio;

        scrollArea.scrollLeft = newContentX - pointerX;
        scrollArea.scrollTop = newContentY - pointerY;
      });
      return;
    }

    // Normal wheel = page navigation
    if (pages.length <= 1) return;

    // Debounce to prevent too fast page changes (200ms minimum interval)
    const now = Date.now();
    if (now - lastPageChangeRef.current < 200) return;

    e.preventDefault();

    if (e.deltaY > 0) {
      // Scroll down = next page
      if (currentPage < pages.length - 1) {
        lastPageChangeRef.current = now;
        setCurrentPage(currentPage + 1);
      }
    } else if (e.deltaY < 0) {
      // Scroll up = previous page
      if (currentPage > 0) {
        lastPageChangeRef.current = now;
        setCurrentPage(currentPage - 1);
      }
    }
  }, [zoom, minZoom, maxZoom, zoomStep, setZoom, pages.length, currentPage, setCurrentPage]);

  // Determine cursor based on tool
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    switch (tool) {
      case 'select':
        // アノテーション移動中はmoveカーソル
        if (isDraggingAnnotation) return 'move';
        if (isDraggingLeaderEnd) return 'crosshair';
        // リサイズカーソル
        if (resizeCursor) return resizeCursor;
        // ホバー時のカーソル変更
        if (hoverAnnotationType === 'text') return 'move';
        if (hoverAnnotationType === 'leaderEnd') return 'crosshair';
        return 'default';
      case 'eraser':
        return 'crosshair';
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'rectAnnotated':
      case 'ellipseAnnotated':
      case 'lineAnnotated':
      case 'arrow':
      case 'doubleArrow':
      case 'polyline':
      case 'image':
        return 'crosshair';
      case 'pan':
        return 'grab';
      case 'pen':
      case 'marker':
      case 'text':
      default:
        return 'crosshair';
    }
  };

  // 折れ線モード時のヒントメッセージ
  const getAnnotationHint = () => {
    if (isDrawingPolyline) {
      return '折れ線描画中: クリックで頂点追加、ダブルクリックで確定';
    }
    return null;
  };

  return (
    <div className="canvas-container" ref={containerRef}>
      {pageState ? (
        <div
          className="canvas-scroll-area"
          ref={scrollAreaRef}
          onPointerDown={tool === 'pan' ? handlePanStart : undefined}
          onPointerMove={tool === 'pan' ? handlePanMove : undefined}
          onPointerUp={tool === 'pan' ? handlePanEnd : undefined}
          onPointerLeave={tool === 'pan' ? handlePanEnd : undefined}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          style={{ cursor: tool === 'pan' ? getCursor() : undefined }}
        >
          <div className="canvas-scroll-inner">
            <div
              className="canvas-wrapper"
              style={{
                width: displayWidth,
                height: displayHeight,
              }}
            >
            {/* 背景キャンバス: useLayoutEffectで直接制御（サイズ変更によるクリアを防ぐ） */}
            <canvas
              ref={backgroundCanvasRef}
              className="background-canvas"
              style={{
                width: displayWidth,
                height: displayHeight,
                opacity: bgOpacity / 100,
              }}
            />
            {/* PDFテキストレイヤーオーバーレイ */}
            {isTextLayerVisible && textLayerItems.length > 0 && (
              <div
                className="pdf-text-layer"
                style={{ width: displayWidth, height: displayHeight }}
              >
                {textLayerItems.map((item, i) => {
                  const scale = displayWidth / originalWidth;
                  const left = item.x * scale;
                  const top = item.y * scale;
                  const fontSize = item.fontSize * scale;
                  const transform = item.angle !== 0
                    ? `rotate(${item.angle}rad)`
                    : undefined;
                  return (
                    <span
                      key={i}
                      style={{
                        left,
                        top,
                        fontSize,
                        transform,
                      }}
                    >
                      {item.str}
                    </span>
                  );
                })}
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={originalWidth}
              height={originalHeight}
              className="drawing-canvas"
              style={{
                cursor: getCursor(),
                width: displayWidth,
                height: displayHeight,
                pointerEvents: tool === 'pan' ? 'none' : 'auto',
              }}
            />
            <canvas
              ref={selectionCanvasRef}
              width={originalWidth}
              height={originalHeight}
              className="selection-canvas"
              style={{
                width: displayWidth,
                height: displayHeight,
              }}
            />
          </div>
          </div>
        </div>
      ) : (
        <div className="canvas-placeholder" onClick={handlePlaceholderClick} style={{ cursor: 'pointer' }}>
          <div className={`current-mode-label ${mode === 'proofreading' ? 'proofreading' : ''}`}>
            {mode === 'proofreading' ? <ProofreadingModeIcon /> : <InstructionModeIcon />}
            <span>{mode === 'proofreading' ? '校正チェックモード' : '指示入れモード'}</span>
          </div>
          <div className="placeholder-icon">
            <FileOpenIcon />
          </div>
          <p>ファイルを開いてください</p>
          <p className="hint">クリックまたはドラッグ&ドロップ</p>
        </div>
      )}

      {/* 折れ線モードのヒント */}
      {isDrawingPolyline && (
        <div className="annotation-hint">
          {getAnnotationHint()}
        </div>
      )}

      {/* アノテーション入力モーダル */}
      <AnnotationModal
        isOpen={showAnnotationModal}
        onClose={handleAnnotationCancel}
        onSubmit={handleAnnotationSubmit}
        initialAnnotation={getEditingAnnotation()}
      />

      {/* テキスト入力モーダル */}
      <AnnotationModal
        isOpen={showTextModal}
        onClose={handleTextCancel}
        onSubmit={handleTextSubmit}
        initialAnnotation={getEditingText() ? {
          text: getEditingText()!.text,
          x: getEditingText()!.x,
          y: getEditingText()!.y,
          color: getEditingText()!.color,
          fontSize: getEditingText()!.fontSize,
          isVertical: getEditingText()!.isVertical,
          align: 'left',
          leaderLine: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        } : null}
      />

      {/* 画像ファイル入力（非表示） */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFileChange}
      />

      {/* 一文字入力モーダル（小文字指定用） */}
      {showLabelInputModal && (
        <div className="label-input-modal-overlay" onClick={handleLabelInputCancel}>
          <div className="label-input-modal" onClick={(e) => e.stopPropagation()}>
            <div className="label-input-modal-header">文字を入力</div>
            <div className="label-input-modal-body">
              <input
                ref={labelInputRef}
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLabelInputSubmit();
                  } else if (e.key === 'Escape') {
                    handleLabelInputCancel();
                  }
                }}
                maxLength={1}
                className="label-input-field"
                placeholder="小"
              />
            </div>
            <div className="label-input-modal-footer">
              <button className="label-input-btn label-input-btn-cancel" onClick={handleLabelInputCancel}>
                キャンセル
              </button>
              <button className="label-input-btn label-input-btn-ok" onClick={handleLabelInputSubmit}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
