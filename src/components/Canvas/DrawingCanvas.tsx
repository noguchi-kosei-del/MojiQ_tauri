import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useDrawingStore } from '../../stores/drawingStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useLoadingStore } from '../../stores/loadingStore';
import { useZoomStore } from '../../stores/zoomStore';
import { useViewerModeStore } from '../../stores/viewerModeStore';
import { useBgOpacityStore } from '../../stores/bgOpacityStore';
import { useModeStore } from '../../stores/modeStore';
import { AnnotationModal } from '../AnnotationModal';
import { open, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { LoadedDocument } from '../../types';
import { loadPdfDocument as loadPdfDocumentFromFile } from '../../utils/pdfRenderer';
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
    backgroundCanvasRef,
    selectionCanvasRef,
    redrawCanvas,
    drawBackground,
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
  } = useCanvas();

  // 画像ファイル入力用のref
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { getCurrentPageState, tool, pages, currentPage, setCurrentPage, addShape, color, strokeWidth, loadPdfDocument } = useDrawingStore();
  const { registerLoadedDocument } = useDocumentStore();
  const { setLoading, setProgress } = useLoadingStore();
  const { zoom, setZoom, minZoom, maxZoom, zoomStep } = useZoomStore();
  const { isActive: isViewerMode } = useViewerModeStore();
  const { bgOpacity } = useBgOpacityStore();
  const { mode } = useModeStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState(1);

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
      setTimeout(() => {
        labelInputRef.current?.focus();
        labelInputRef.current?.select();
      }, 50);
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
        setProgress(20);
        const filePath = pdfPaths[0];
        const fileName = filePath.split(/[/\\]/).pop() || 'PDF';
        const result = await invoke<LoadedDocument>('load_file', { path: filePath });

        if (result.file_type === 'pdf' && result.pdf_data) {
          setLoading(true, 'PDFを読み込み中...');
          setProgress(40);
          const pdfResult = await loadPdfDocumentFromFile(result.pdf_data, (progress) => {
            setProgress(40 + (progress / 100) * 50);
          });
          setProgress(90);

          loadPdfDocument(pdfResult.pdfDocument, pdfResult.pageInfos, pdfResult.annotations);
          registerLoadedDocument(
            fileName,
            filePath,
            'pdf',
            [],
            pdfResult.pdfDocument,
            pdfResult.pageInfos,
            pdfResult.annotations
          );
        }
      } else if (imagePaths.length > 0) {
        // 画像ファイルのみの場合
        setProgress(30);
        const result = await invoke<LoadedDocument>('load_files', { paths: imagePaths });
        setProgress(80);

        if (result.pages && result.pages.length > 0) {
          const { loadDocumentWithAnnotations } = useDrawingStore.getState();
          loadDocumentWithAnnotations(result.pages, []);
          const fileName = imagePaths.length === 1
            ? imagePaths[0].split(/[/\\]/).pop() || '画像'
            : `${imagePaths.length}枚の画像`;
          // PageDataをPageStateとして扱うため、loadDocumentWithAnnotationsで変換済みのpagesを使用
          const loadedPages = useDrawingStore.getState().pages;
          registerLoadedDocument(fileName, imagePaths[0], 'images', loadedPages, null, [], []);
        }
      }

      setProgress(100);
      setLoading(false);
    } catch (e) {
      console.error('Failed to open file:', e);
      setLoading(false);
      message(`ファイルを開けませんでした: ${e}`, { title: 'エラー', kind: 'error' });
    }
  }, [setLoading, setProgress, loadPdfDocument, registerLoadedDocument]);

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

  // Redraw when page changes
  useEffect(() => {
    drawBackground();
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pages.length, drawBackground, redrawCanvas, originalWidth, originalHeight]);

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

  // アノテーションモード時のヒントメッセージ
  const getAnnotationHint = () => {
    if (annotationState === 2) {
      return '引出線を描画してください（ドラッグしてテキストを配置する位置を指定）';
    }
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
            <canvas
              ref={backgroundCanvasRef}
              width={originalWidth}
              height={originalHeight}
              className="background-canvas"
              style={{
                width: displayWidth,
                height: displayHeight,
                opacity: bgOpacity / 100,
              }}
            />
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

      {/* アノテーションモード/折れ線モードのヒント */}
      {(annotationState === 2 || isDrawingPolyline) && (
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
