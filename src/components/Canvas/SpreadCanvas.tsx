import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { useZoomStore } from '../../stores/zoomStore';
import { useSpreadViewStore } from '../../stores/spreadViewStore';
import { usePageNavStore } from '../../stores/pageNavStore';
import { renderPdfPage } from '../../utils/pdfRenderer';
import { PageState, Shape } from '../../types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import './DrawingCanvas.css';
import '../PageNav/PageNav.css';

// SVG Icons for navigation
const PrevIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const NextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const FADE_DELAY_MS = 3000;

/**
 * 見開き表示用キャンバスコンポーネント
 * 2ページを横並びで表示する
 * 全ページをプリレンダリングしてスムーズなページ送りを実現
 */
export const SpreadCanvas: React.FC = () => {
  const { pages, pdfDocument, pdfPageInfos } = useDrawingStore();
  const { zoom, setZoom, minZoom, maxZoom, zoomStep } = useZoomStore();
  const {
    currentSpreadIndex,
    getPagesForSpread,
    bindingDirection,
    totalSpreads,
    setCurrentSpreadIndex,
  } = useSpreadViewStore();
  const { isPageNavHidden } = usePageNavStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [baseScale, setBaseScale] = useState(1);

  // フローティングバー用の状態
  const [isDragging, setIsDragging] = useState(false);
  const [sliderValue, setSliderValue] = useState(currentSpreadIndex + 1);
  const [isFadedOut, setIsFadedOut] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Page navigation debounce ref
  const lastSpreadChangeRef = useRef<number>(0);

  // スライダーバブルの位置を計算
  const getBubbleLeft = useCallback((value: number, maxSpreads: number): string => {
    const min = 1;
    const max = maxSpreads;
    if (max <= min) {
      return '50%';
    }
    // RTL slider: value=max → left end, value=1 → right end
    const t = (max - value) / (max - min);
    return `calc(${t * 100}% + ${16 - t * 32}px)`;
  }, []);

  // フェードタイマーをリセット
  const resetFadeTimer = useCallback(() => {
    if (totalSpreads === 0) return;

    setIsFadedOut(false);
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
    }

    fadeTimerRef.current = setTimeout(() => {
      setIsFadedOut(true);
    }, FADE_DELAY_MS);
  }, [totalSpreads]);

  // マウント時にバーを表示
  useEffect(() => {
    resetFadeTimer();
    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, [resetFadeTimer]);

  // スライダー値を現在の見開きインデックスに同期
  useEffect(() => {
    if (!isDragging) {
      setSliderValue(currentSpreadIndex + 1);
      resetFadeTimer();
    }
  }, [currentSpreadIndex, isDragging, resetFadeTimer]);

  // スライダー入力（ドラッグ中）
  const handleSliderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
    resetFadeTimer();
  };

  // スライダー変更（リリース時）
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setCurrentSpreadIndex(value - 1);
    resetFadeTimer();
  };

  // ドラッグ開始
  const handleDragStart = () => {
    setIsDragging(true);
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setIsDragging(false);
    setCurrentSpreadIndex(sliderValue - 1);
  };

  // 前へボタン（右綴じ: 前=+1, 左綴じ: 前=-1）
  const handlePrev = () => {
    if (bindingDirection === 'right') {
      if (currentSpreadIndex < totalSpreads - 1) {
        setCurrentSpreadIndex(currentSpreadIndex + 1);
      }
    } else {
      if (currentSpreadIndex > 0) {
        setCurrentSpreadIndex(currentSpreadIndex - 1);
      }
    }
  };

  // 次へボタン（右綴じ: 次=-1, 左綴じ: 次=+1）
  const handleNext = () => {
    if (bindingDirection === 'right') {
      if (currentSpreadIndex > 0) {
        setCurrentSpreadIndex(currentSpreadIndex - 1);
      }
    } else {
      if (currentSpreadIndex < totalSpreads - 1) {
        setCurrentSpreadIndex(currentSpreadIndex + 1);
      }
    }
  };

  // マウスエンター時にバーを表示
  const handleMouseEnter = () => {
    setIsFadedOut(false);
    resetFadeTimer();
  };

  // プリレンダリングされたページ画像のキャッシュ
  const pageImageCacheRef = useRef<Map<number, string>>(new Map());
  const preloadingRef = useRef<Set<number>>(new Set());

  // 現在の見開きのページ情報を取得
  const { leftPage, rightPage } = useMemo(() => {
    return getPagesForSpread(currentSpreadIndex);
  }, [currentSpreadIndex, getPagesForSpread]);

  // ページデータを取得（0-indexedに変換）
  const leftPageData = leftPage !== null && leftPage > 0 ? pages[leftPage - 1] : null;
  const rightPageData = rightPage !== null && rightPage > 0 ? pages[rightPage - 1] : null;

  // ページサイズを取得
  const pageWidth = leftPageData?.width || rightPageData?.width || 800;
  const pageHeight = leftPageData?.height || rightPageData?.height || 600;

  // 見開き全体のサイズ
  const spreadWidth = pageWidth * 2;
  const spreadHeight = pageHeight;

  // 単一ページをプリロード（キャッシュがなければ）
  const preloadPage = useCallback(async (pageNum: number): Promise<string | null> => {
    // 既にキャッシュにある
    if (pageImageCacheRef.current.has(pageNum)) {
      return pageImageCacheRef.current.get(pageNum) || null;
    }

    // 既にロード中
    if (preloadingRef.current.has(pageNum)) {
      return null;
    }

    const pageData = pages[pageNum - 1];
    if (!pageData) return null;

    preloadingRef.current.add(pageNum);

    try {
      let imageData: string | null = null;

      if (pageData.backgroundImage) {
        imageData = pageData.backgroundImage;
      } else if (pdfDocument && pdfPageInfos[pageNum - 1]) {
        imageData = await renderPdfPage(pdfDocument as PDFDocumentProxy, pageNum);
      }

      if (imageData) {
        pageImageCacheRef.current.set(pageNum, imageData);
      }

      return imageData;
    } catch (error) {
      console.error(`Failed to preload page ${pageNum}:`, error);
      return null;
    } finally {
      preloadingRef.current.delete(pageNum);
    }
  }, [pages, pdfDocument, pdfPageInfos]);

  // バックグラウンドで周辺ページをプリロード
  const preloadNearbyPages = useCallback(async () => {
    const pagesToPreload: number[] = [];

    // 現在表示中のページ + 前後2見開き分（最大8ページ）をプリロード
    for (let spreadOffset = -2; spreadOffset <= 2; spreadOffset++) {
      const targetSpreadIndex = currentSpreadIndex + spreadOffset;
      if (targetSpreadIndex < 0) continue;

      const { leftPage: lp, rightPage: rp } = getPagesForSpread(targetSpreadIndex);
      if (lp !== null && lp > 0 && lp <= pages.length) pagesToPreload.push(lp);
      if (rp !== null && rp > 0 && rp <= pages.length) pagesToPreload.push(rp);
    }

    // 重複を除去してプリロード
    const uniquePages = [...new Set(pagesToPreload)];
    for (const pageNum of uniquePages) {
      if (!pageImageCacheRef.current.has(pageNum)) {
        preloadPage(pageNum);
      }
    }
  }, [currentSpreadIndex, getPagesForSpread, pages.length, preloadPage]);

  // 見開きが変わったら周辺ページをプリロード
  useEffect(() => {
    preloadNearbyPages();
  }, [currentSpreadIndex, preloadNearbyPages]);

  // コンテナサイズに基づいてベーススケールを計算
  useEffect(() => {
    const updateBaseScale = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 40;
      const containerHeight = container.clientHeight - 40;

      const scaleX = containerWidth / spreadWidth;
      const scaleY = containerHeight / spreadHeight;
      const newScale = Math.min(scaleX, scaleY, 1);

      setBaseScale(newScale);
    };

    updateBaseScale();
    window.addEventListener('resize', updateBaseScale);
    return () => window.removeEventListener('resize', updateBaseScale);
  }, [spreadWidth, spreadHeight]);

  // シェイプの描画ヘルパー関数
  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const x = Math.min(shape.startPos.x, shape.endPos.x);
    const y = Math.min(shape.startPos.y, shape.endPos.y);
    const width = Math.abs(shape.endPos.x - shape.startPos.x);
    const height = Math.abs(shape.endPos.y - shape.startPos.y);

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shape.type === 'rect' || shape.type === 'rectAnnotated') {
      ctx.strokeRect(x, y, width, height);

      // フォントラベルを描画（フォント指定枠線の場合）
      if (shape.fontLabel) {
        const { fontName, textX, textY, textAlign } = shape.fontLabel;
        const labelFontSize = 12;
        ctx.font = `bold ${labelFontSize}px sans-serif`;
        ctx.fillStyle = shape.color;
        ctx.textAlign = textAlign;
        ctx.textBaseline = shape.endPos.y > shape.startPos.y ? 'top' : 'bottom';

        // 白い縁取り
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(fontName, textX, textY);
        ctx.restore();

        // テキスト本体
        ctx.fillText(fontName, textX, textY);
      }
    } else if (shape.type === 'ellipse' || shape.type === 'ellipseAnnotated') {
      ctx.beginPath();
      ctx.ellipse(
        x + width / 2,
        y + height / 2,
        Math.abs(width / 2),
        Math.abs(height / 2),
        0, 0, Math.PI * 2
      );
      ctx.stroke();
    } else if (shape.type === 'line' || shape.type === 'lineAnnotated') {
      ctx.beginPath();
      ctx.moveTo(shape.startPos.x, shape.startPos.y);
      ctx.lineTo(shape.endPos.x, shape.endPos.y);
      ctx.stroke();
    } else if (shape.type === 'arrow') {
      // 矢印を描画
      ctx.beginPath();
      ctx.moveTo(shape.startPos.x, shape.startPos.y);
      ctx.lineTo(shape.endPos.x, shape.endPos.y);
      ctx.stroke();

      // 矢印の先端
      const angle = Math.atan2(shape.endPos.y - shape.startPos.y, shape.endPos.x - shape.startPos.x);
      const arrowLength = 15;
      ctx.beginPath();
      ctx.moveTo(shape.endPos.x, shape.endPos.y);
      ctx.lineTo(
        shape.endPos.x - arrowLength * Math.cos(angle - Math.PI / 6),
        shape.endPos.y - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(shape.endPos.x, shape.endPos.y);
      ctx.lineTo(
        shape.endPos.x - arrowLength * Math.cos(angle + Math.PI / 6),
        shape.endPos.y - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    } else if (shape.type === 'doubleArrow') {
      // 両方向矢印を描画
      ctx.beginPath();
      ctx.moveTo(shape.startPos.x, shape.startPos.y);
      ctx.lineTo(shape.endPos.x, shape.endPos.y);
      ctx.stroke();

      const angle = Math.atan2(shape.endPos.y - shape.startPos.y, shape.endPos.x - shape.startPos.x);
      const arrowLength = 15;

      // 終点の矢印
      ctx.beginPath();
      ctx.moveTo(shape.endPos.x, shape.endPos.y);
      ctx.lineTo(
        shape.endPos.x - arrowLength * Math.cos(angle - Math.PI / 6),
        shape.endPos.y - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(shape.endPos.x, shape.endPos.y);
      ctx.lineTo(
        shape.endPos.x - arrowLength * Math.cos(angle + Math.PI / 6),
        shape.endPos.y - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();

      // 始点の矢印
      ctx.beginPath();
      ctx.moveTo(shape.startPos.x, shape.startPos.y);
      ctx.lineTo(
        shape.startPos.x + arrowLength * Math.cos(angle - Math.PI / 6),
        shape.startPos.y + arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(shape.startPos.x, shape.startPos.y);
      ctx.lineTo(
        shape.startPos.x + arrowLength * Math.cos(angle + Math.PI / 6),
        shape.startPos.y + arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    } else if (shape.type === 'polyline' && shape.points) {
      // 折れ線を描画
      if (shape.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      }
    }
  };

  // ページの描画オブジェクトを描画
  const drawPageObjects = (
    ctx: CanvasRenderingContext2D,
    pageData: PageState | null
  ) => {
    if (!pageData) return;

    // 各レイヤーを描画
    for (const layer of pageData.layers) {
      if (!layer.visible) continue;

      ctx.globalAlpha = layer.opacity;

      // ストロークを描画
      for (const stroke of layer.strokes) {
        if (stroke.points.length < 2) continue;

        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.isMarker) {
          ctx.globalAlpha = layer.opacity * (stroke.opacity || 0.5);
        }

        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();

        if (stroke.isMarker) {
          ctx.globalAlpha = layer.opacity;
        }
      }

      // シェイプを描画
      for (const shape of layer.shapes) {
        drawShape(ctx, shape);
      }

      // テキストを描画
      for (const text of layer.texts) {
        ctx.fillStyle = text.color;
        ctx.font = `${text.fontSize}px sans-serif`;
        ctx.textBaseline = 'top';

        if (text.isVertical) {
          // 縦書き
          const chars = text.text.split('');
          let y = text.y;
          for (const char of chars) {
            ctx.fillText(char, text.x, y);
            y += text.fontSize;
          }
        } else {
          ctx.fillText(text.text, text.x, text.y);
        }
      }

      ctx.globalAlpha = 1;
    }
  };

  // ページを描画（キャッシュがあれば使用、なければ直接レンダリング）
  const drawPage = useCallback(async (
    canvas: HTMLCanvasElement | null,
    pageNum: number | null,
    pageData: PageState | null
  ) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!pageData || pageNum === null) {
      // 空白ページ
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // キャッシュから画像を取得、なければプリロード
    let imageData = pageImageCacheRef.current.get(pageNum);

    if (!imageData) {
      // キャッシュにない場合は直接取得
      if (pageData.backgroundImage) {
        imageData = pageData.backgroundImage;
        pageImageCacheRef.current.set(pageNum, imageData);
      } else if (pdfDocument && pdfPageInfos[pageNum - 1]) {
        imageData = await renderPdfPage(pdfDocument as PDFDocumentProxy, pageNum);
        pageImageCacheRef.current.set(pageNum, imageData);
      }
    }

    if (imageData) {
      const img = new Image();
      img.src = imageData;
      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve();
        };
        img.onerror = () => resolve();
      });
    }

    // 描画オブジェクトを描画
    drawPageObjects(ctx, pageData);
  }, [pdfDocument, pdfPageInfos]);

  // ページ変更時に再描画
  useEffect(() => {
    drawPage(leftCanvasRef.current, leftPage, leftPageData);
    drawPage(rightCanvasRef.current, rightPage, rightPageData);
  }, [currentSpreadIndex, leftPage, rightPage, leftPageData, rightPageData, drawPage]);

  // 表示スケール
  const displayScale = baseScale * zoom;
  const displayWidth = spreadWidth * displayScale;
  const displayHeight = spreadHeight * displayScale;
  const singlePageDisplayWidth = pageWidth * displayScale;

  // マウス位置追跡
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // ホイールズームとページ移動
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl/Cmd + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      const scrollArea = scrollAreaRef.current;
      if (!scrollArea) return;

      const rect = scrollArea.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const contentX = pointerX + scrollArea.scrollLeft;
      const contentY = pointerY + scrollArea.scrollTop;

      const direction = e.deltaY < 0 ? 1 : -1;
      const oldZoom = zoom;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom + direction * zoomStep));

      if (newZoom === oldZoom) return;

      const zoomRatio = newZoom / oldZoom;
      setZoom(newZoom);

      requestAnimationFrame(() => {
        const newContentX = contentX * zoomRatio;
        const newContentY = contentY * zoomRatio;
        scrollArea.scrollLeft = newContentX - pointerX;
        scrollArea.scrollTop = newContentY - pointerY;
      });
      return;
    }

    // Normal wheel = spread navigation
    if (totalSpreads <= 1) return;

    // Debounce to prevent too fast spread changes (200ms minimum interval)
    const now = Date.now();
    if (now - lastSpreadChangeRef.current < 200) return;

    e.preventDefault();

    if (e.deltaY > 0) {
      // Scroll down = next spread
      if (currentSpreadIndex < totalSpreads - 1) {
        lastSpreadChangeRef.current = now;
        setCurrentSpreadIndex(currentSpreadIndex + 1);
        resetFadeTimer();
      }
    } else if (e.deltaY < 0) {
      // Scroll up = previous spread
      if (currentSpreadIndex > 0) {
        lastSpreadChangeRef.current = now;
        setCurrentSpreadIndex(currentSpreadIndex - 1);
        resetFadeTimer();
      }
    }
  }, [zoom, minZoom, maxZoom, zoomStep, setZoom, totalSpreads, currentSpreadIndex, setCurrentSpreadIndex, resetFadeTimer]);

  return (
    <div className="canvas-container spread-view" ref={containerRef}>
      <div
        className="canvas-scroll-area"
        ref={scrollAreaRef}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
      >
        <div className="canvas-scroll-inner">
          <div
            className="spread-wrapper"
            style={{
              width: displayWidth,
              height: displayHeight,
              display: 'flex',
              flexDirection: 'row',
            }}
          >
            {/* 左ページ */}
            <div className="spread-page" style={{ width: singlePageDisplayWidth, height: displayHeight }}>
              <canvas
                ref={leftCanvasRef}
                width={pageWidth}
                height={pageHeight}
                style={{
                  width: singlePageDisplayWidth,
                  height: displayHeight,
                }}
              />
            </div>

            {/* 右ページ */}
            <div className="spread-page" style={{ width: singlePageDisplayWidth, height: displayHeight }}>
              <canvas
                ref={rightCanvasRef}
                width={pageWidth}
                height={pageHeight}
                style={{
                  width: singlePageDisplayWidth,
                  height: displayHeight,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ページナビゲーションフローティングバー */}
      {totalSpreads > 1 && (
        <>
          {/* フェードアウト時のホバーエリア */}
          {!isPageNavHidden && (
            <div
              className="page-nav-hover-area"
              onMouseEnter={handleMouseEnter}
            />
          )}
          <div
            className={`page-nav-bar ${isFadedOut ? 'fade-out' : ''} ${isPageNavHidden ? 'hidden' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseMove={resetFadeTimer}
          >
            <div className="slider-container">
              <span
                className={`slider-bubble visible ${isDragging ? 'dragging' : ''}`}
                style={{
                  left: getBubbleLeft(sliderValue, totalSpreads)
                }}
              >
                {sliderValue}/{totalSpreads}
              </span>
              <input
                type="range"
                className="page-slider"
                min="1"
                max={totalSpreads}
                value={sliderValue}
                step="1"
                dir="rtl"
                onInput={handleSliderInput as React.FormEventHandler<HTMLInputElement>}
                onChange={handleSliderChange}
                onMouseDown={handleDragStart}
                onMouseUp={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchEnd={handleDragEnd}
              />
            </div>
            <div className="nav-buttons">
              <button
                onClick={handlePrev}
                disabled={bindingDirection === 'right' ? currentSpreadIndex >= totalSpreads - 1 : currentSpreadIndex <= 0}
                title="次のページ"
              >
                <PrevIcon />
              </button>
              <button
                onClick={handleNext}
                disabled={bindingDirection === 'right' ? currentSpreadIndex <= 0 : currentSpreadIndex >= totalSpreads - 1}
                title="前のページ"
              >
                <NextIcon />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
