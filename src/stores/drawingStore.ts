import { create } from 'zustand';
import { DrawingState, PageState, Layer, Stroke, Shape, Point, ToolType, SelectionBounds, Annotation, TextElement, PdfAnnotationText, ImageElement, PdfPageInfo, HistoryState, StampType, ImageLink, FileMetadata } from '../types';
import { renderPdfPage } from '../utils/pdfRenderer';
import { imageCache } from '../utils/imageCache';
import type { PDFDocumentProxy } from 'pdfjs-dist';

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

const createDefaultPage = (pageNumber: number, backgroundImage: string, width: number, height: number, imageLink?: ImageLink): PageState => ({
  pageNumber,
  layers: [createDefaultLayer()],
  imageLink,
  backgroundImage,
  width,
  height,
});

interface DrawingStore extends DrawingState {
  // File operations
  loadDocument: (pages: { page_number: number; image_data: string; width: number; height: number }[]) => void;
  loadDocumentWithAnnotations: (
    pages: { page_number: number; image_data: string; width: number; height: number }[],
    annotations: PdfAnnotationText[][]
  ) => void;
  // Link-based loading (InDesign-like)
  loadDocumentWithLinks: (metadata: FileMetadata[]) => void;
  loadAllPageImages: (onProgress?: (current: number, total: number) => void) => Promise<void>;
  getPageImageAsync: (pageNumber: number) => Promise<string>;
  updatePageBackgroundImage: (pageNumber: number, imageData: string) => void;
  getImageLinks: () => (ImageLink | undefined)[];
  // PDF operations (on-demand rendering)
  loadPdfDocument: (
    pdfDocument: PDFDocumentProxy,
    pageInfos: PdfPageInfo[],
    annotations: PdfAnnotationText[][]
  ) => void;
  renderCurrentPdfPage: () => Promise<void>;
  clearDocument: () => void;

  // Document state restoration (for multi-tab support)
  restoreDocumentState: (state: {
    pages: PageState[];
    currentPage: number;
    currentLayerId: string;
    history: HistoryState[];
    historyIndex: number;
    pdfDocument: PDFDocumentProxy | null;
    pdfPageInfos: PdfPageInfo[];
    pdfAnnotations: PdfAnnotationText[][];
  }) => void;
  getDocumentState: () => {
    pages: PageState[];
    currentPage: number;
    currentLayerId: string;
    history: HistoryState[];
    historyIndex: number;
    pdfDocument: PDFDocumentProxy | null;
    pdfPageInfos: PdfPageInfo[];
    pdfAnnotations: PdfAnnotationText[][];
  };

  // Page navigation
  setCurrentPage: (page: number) => void;
  deleteCurrentPage: () => void;

  // Tool settings
  setTool: (tool: ToolType) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;

  // Layer operations
  addLayer: () => void;
  removeLayer: (layerId: string) => void;
  setCurrentLayer: (layerId: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;

  // Drawing operations
  addStroke: (stroke: Omit<Stroke, 'id' | 'layerId'>) => void;
  addShape: (shape: Omit<Shape, 'id' | 'layerId'>) => void;
  eraseAt: (point: Point, radius: number) => void;
  clearAllDrawings: () => void;

  // Selection operations
  selectStrokesInRect: (rect: SelectionBounds) => void;
  selectStrokeAtPoint: (point: Point, tolerance: number) => void;
  selectShapeAtPoint: (point: Point, tolerance: number) => Shape | null;
  selectShapesInRect: (rect: SelectionBounds) => void;
  setSelectedShapeIds: (ids: string[]) => void;
  clearSelection: () => void;
  deleteSelectedStrokes: () => void;
  moveSelectedStrokes: (dx: number, dy: number) => void;
  moveSelectedShapes: (dx: number, dy: number) => void;
  getSelectedStrokes: () => Stroke[];
  getSelectedShapes: () => Shape[];

  // Shape operations
  getAllShapes: () => Shape[];
  updateShapeAnnotation: (shapeId: string, annotation: Annotation) => void;
  updateShape: (shapeId: string, updates: Partial<Omit<Shape, 'id' | 'layerId'>>) => void;
  calculateShapeBounds: (shape: Shape) => SelectionBounds | null;

  // Annotation-only operations
  selectAnnotationAtPoint: (point: Point, tolerance: number) => { shapeId: string; hitType: 'text' | 'leaderEnd' } | null;
  moveAnnotationOnly: (shapeId: string, dx: number, dy: number, shapeStartPos: Point, shapeEndPos: Point, shapeType: string) => void;
  moveLeaderEnd: (shapeId: string, dx: number, dy: number, shapeStartPos: Point, shapeEndPos: Point, shapeType: string) => void;
  calculateAnnotationTextBounds: (annotation: Annotation) => SelectionBounds | null;
  getLeaderEndPos: (annotation: Annotation, shapeStartPos: Point) => Point;

  // Text operations
  addText: (text: Omit<TextElement, 'id' | 'layerId'>) => void;
  updateText: (textId: string, updates: Partial<Omit<TextElement, 'id' | 'layerId'>>) => void;
  deleteText: (textId: string) => void;
  selectTextAtPoint: (point: Point, tolerance: number) => TextElement | null;
  calculateTextBounds: (text: TextElement) => SelectionBounds;
  moveSelectedTexts: (dx: number, dy: number) => void;
  getSelectedTexts: () => TextElement[];
  getAllTexts: () => TextElement[];
  setSelectedTextIds: (ids: string[]) => void;

  // Image operations
  addImage: (image: Omit<ImageElement, 'id' | 'layerId'>) => void;
  deleteImage: (imageId: string) => void;
  selectImageAtPoint: (point: Point, tolerance: number) => ImageElement | null;
  selectImagesInRect: (rect: SelectionBounds) => void;
  calculateImageBounds: (image: ImageElement) => SelectionBounds;
  moveSelectedImages: (dx: number, dy: number) => void;
  getSelectedImages: () => ImageElement[];
  getAllImages: () => ImageElement[];
  setSelectedImageIds: (ids: string[]) => void;

  // Annotation selection (for color change)
  setSelectedAnnotationShapeId: (id: string | null) => void;

  // Color operations
  updateSelectedColor: (color: string) => void;
  hasSelection: () => boolean;

  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  clearHistory: () => void;

  // Export helpers
  getCurrentPageState: () => PageState | undefined;
  getAllStrokes: () => Stroke[];

  // Stamp operations
  setCurrentStampType: (stampType: StampType | null) => void;
  addStamp: (point: Point) => void;
}

export const useDrawingStore = create<DrawingStore>((set, get) => ({
  pages: [],
  currentPage: 0,
  currentLayerId: '',
  tool: 'pen',
  color: '#000000',
  strokeWidth: 3,
  history: [],
  historyIndex: -1,
  selectedStrokeIds: [],
  selectedShapeIds: [],
  selectedTextIds: [],
  selectedImageIds: [],
  selectedAnnotationShapeId: null,
  selectionBounds: null,
  // PDF関連
  pdfDocument: null,
  pdfPageInfos: [],
  pdfAnnotations: [],
  // スタンプ関連
  currentStampType: null,

  loadDocument: (pages) => {
    const pageStates = pages.map((p) =>
      createDefaultPage(p.page_number, p.image_data, p.width, p.height)
    );
    const firstLayerId = pageStates[0]?.layers[0]?.id || '';

    set({
      pages: pageStates,
      currentPage: 0,
      currentLayerId: firstLayerId,
      history: [],
      historyIndex: -1,
      // PDF関連をクリア
      pdfDocument: null,
      pdfPageInfos: [],
      pdfAnnotations: [],
    });
  },

  // リンク方式でドキュメントを読み込み（InDesignライク）
  loadDocumentWithLinks: (metadata) => {
    const pageStates = metadata.map((m, index) => {
      const imageLink: ImageLink = {
        type: 'file',
        filePath: m.file_path,
        mimeType: m.mime_type as 'image/jpeg' | 'image/png',
        width: m.width,
        height: m.height,
        modifiedAt: m.modified_at,
      };
      return createDefaultPage(index, '', m.width, m.height, imageLink);
    });
    const firstLayerId = pageStates[0]?.layers[0]?.id || '';

    set({
      pages: pageStates,
      currentPage: 0,
      currentLayerId: firstLayerId,
      history: [],
      historyIndex: -1,
      pdfDocument: null,
      pdfPageInfos: [],
      pdfAnnotations: [],
    });

    // 初期状態を履歴に保存
    get().saveToHistory();
  },

  // 全ページの画像を読み込む（保存前などに使用）
  loadAllPageImages: async (onProgress?: (current: number, total: number) => void) => {
    const state = get();
    const totalPages = state.pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = state.pages[i];

      // 既に画像がある場合はスキップ
      if (page.backgroundImage) {
        onProgress?.(i + 1, totalPages);
        continue;
      }

      // リンク方式の場合は読み込む
      if (page.imageLink?.type === 'file') {
        try {
          const imageData = await imageCache.getImage(page.imageLink);
          get().updatePageBackgroundImage(i, imageData);
        } catch (error) {
          console.error(`Failed to load image for page ${i}:`, error);
        }
      }

      onProgress?.(i + 1, totalPages);
    }
  },

  // キャッシュ経由で画像を取得
  getPageImageAsync: async (pageNumber) => {
    const state = get();
    const page = state.pages[pageNumber];
    if (!page) {
      throw new Error(`Page ${pageNumber} not found`);
    }

    // 既にbackgroundImageがある場合はそれを返す
    if (page.backgroundImage) {
      return page.backgroundImage;
    }

    // リンク方式の場合はキャッシュから取得
    if (page.imageLink?.type === 'file') {
      const imageData = await imageCache.getImage(page.imageLink);
      // 取得した画像をページに設定（キャッシュとして保持）
      get().updatePageBackgroundImage(pageNumber, imageData);
      return imageData;
    }

    throw new Error('No image source available');
  },

  // ページの背景画像を更新
  updatePageBackgroundImage: (pageNumber, imageData) => {
    const state = get();
    const updatedPages = [...state.pages];
    if (updatedPages[pageNumber]) {
      updatedPages[pageNumber] = {
        ...updatedPages[pageNumber],
        backgroundImage: imageData,
      };
      set({ pages: updatedPages });
    }
  },

  // すべてのImageLinkを取得
  getImageLinks: () => {
    const state = get();
    return state.pages.map(p => p.imageLink);
  },

  loadDocumentWithAnnotations: (pages, annotations) => {
    const pageStates = pages.map((p, pageIndex) => {
      const pageState = createDefaultPage(p.page_number, p.image_data, p.width, p.height);

      // PDF注釈をテキスト要素として追加
      const pageAnnotations = annotations[pageIndex] || [];
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
          // PDF注釈の種類を保持（表示/非表示フィルタリング用）
          pdfAnnotationSource: annot.pdfAnnotationSource,
        }));
      }

      return pageState;
    });
    const firstLayerId = pageStates[0]?.layers[0]?.id || '';

    set({
      pages: pageStates,
      currentPage: 0,
      currentLayerId: firstLayerId,
      history: [],
      historyIndex: -1,
      pdfDocument: null,
      pdfPageInfos: [],
      pdfAnnotations: [],
    });

    // 読み込んだ状態を履歴に保存
    get().saveToHistory();
  },

  // PDFオンデマンドレンダリング用
  loadPdfDocument: (pdfDocument, pageInfos, annotations) => {
    // ページステートを作成（背景画像は空、後でオンデマンドでレンダリング）
    const pageStates = pageInfos.map((info, pageIndex) => {
      const pageState = createDefaultPage(info.pageNumber, '', info.width, info.height);

      // PDF注釈をテキスト要素として追加
      const pageAnnotations = annotations[pageIndex] || [];
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
          // PDF注釈の種類を保持（表示/非表示フィルタリング用）
          pdfAnnotationSource: annot.pdfAnnotationSource,
        }));
      }

      return pageState;
    });
    const firstLayerId = pageStates[0]?.layers[0]?.id || '';

    set({
      pages: pageStates,
      currentPage: 0,
      currentLayerId: firstLayerId,
      history: [],
      historyIndex: -1,
      pdfDocument: pdfDocument,
      pdfPageInfos: pageInfos,
      pdfAnnotations: annotations,
    });

    // 最初のページをレンダリング
    get().renderCurrentPdfPage();
  },

  renderCurrentPdfPage: async () => {
    const state = get();
    const { pdfDocument, pdfPageInfos, currentPage, pages } = state;

    if (!pdfDocument || pdfPageInfos.length === 0) return;

    const pageInfo = pdfPageInfos[currentPage];
    if (!pageInfo || pageInfo.rendered) return;

    try {
      // ページをレンダリング
      const imageData = await renderPdfPage(pdfDocument as PDFDocumentProxy, currentPage);

      // ページ情報を更新
      const updatedPageInfos = [...pdfPageInfos];
      updatedPageInfos[currentPage] = {
        ...pageInfo,
        rendered: true,
        imageData,
      };

      // ページステートを更新
      const updatedPages = [...pages];
      updatedPages[currentPage] = {
        ...pages[currentPage],
        backgroundImage: imageData,
      };

      set({
        pdfPageInfos: updatedPageInfos,
        pages: updatedPages,
      });

      // 履歴に保存
      get().saveToHistory();
    } catch (error) {
      console.error('Failed to render PDF page:', error);
    }
  },

  clearDocument: () => set({
    pages: [],
    currentPage: 0,
    currentLayerId: '',
    history: [],
    historyIndex: -1,
    selectedStrokeIds: [],
    selectedShapeIds: [],
    selectedTextIds: [],
    selectedAnnotationShapeId: null,
    selectionBounds: null,
    pdfDocument: null,
    pdfPageInfos: [],
    pdfAnnotations: [],
  }),

  // ドキュメント状態を復元（マルチタブ対応用）
  restoreDocumentState: (docState) => {
    set({
      pages: docState.pages,
      currentPage: docState.currentPage,
      currentLayerId: docState.currentLayerId,
      history: docState.history,
      historyIndex: docState.historyIndex,
      pdfDocument: docState.pdfDocument as unknown,
      pdfPageInfos: docState.pdfPageInfos,
      pdfAnnotations: docState.pdfAnnotations,
      // 選択状態はクリア
      selectedStrokeIds: [],
      selectedShapeIds: [],
      selectedTextIds: [],
      selectedImageIds: [],
      selectedAnnotationShapeId: null,
      selectionBounds: null,
    });
  },

  // 現在のドキュメント状態を取得（マルチタブ対応用）
  getDocumentState: () => {
    const state = get();
    return {
      pages: state.pages,
      currentPage: state.currentPage,
      currentLayerId: state.currentLayerId,
      history: state.history,
      historyIndex: state.historyIndex,
      pdfDocument: state.pdfDocument as PDFDocumentProxy | null,
      pdfPageInfos: state.pdfPageInfos,
      pdfAnnotations: state.pdfAnnotations,
    };
  },

  setCurrentPage: (page) => {
    const state = get();
    if (page >= 0 && page < state.pages.length) {
      const targetPage = state.pages[page];
      set({
        currentPage: page,
        currentLayerId: targetPage.layers[0]?.id || '',
      });
      // PDFの場合、ページをオンデマンドでレンダリング
      if (state.pdfDocument) {
        get().renderCurrentPdfPage();
      }
      // リンク方式の場合、周辺ページをプリロード
      const imageLinks = state.pages.map(p => p.imageLink);
      if (imageLinks.some(link => link?.type === 'file')) {
        imageCache.preloadPages(page, state.pages.length, imageLinks);
      }
    }
  },

  deleteCurrentPage: () => {
    const state = get();
    // 1ページしかない場合は削除できない
    if (state.pages.length <= 1) return;

    const currentIndex = state.currentPage;
    const newPages = state.pages.filter((_, index) => index !== currentIndex);

    // 削除後のページ番号を調整
    const newPageNumbers = newPages.map((page, index) => ({
      ...page,
      pageNumber: index + 1,
    }));

    // 新しい現在ページを決定（最後のページを削除した場合は前のページへ）
    const newCurrentPage = currentIndex >= newPages.length ? newPages.length - 1 : currentIndex;
    const newCurrentLayerId = newPageNumbers[newCurrentPage]?.layers[0]?.id || '';

    // PDF関連の情報も更新
    const newPdfPageInfos = state.pdfPageInfos.filter((_, index) => index !== currentIndex);
    const newPdfAnnotations = state.pdfAnnotations.filter((_, index) => index !== currentIndex);

    set({
      pages: newPageNumbers,
      currentPage: newCurrentPage,
      currentLayerId: newCurrentLayerId,
      pdfPageInfos: newPdfPageInfos,
      pdfAnnotations: newPdfAnnotations,
      selectedStrokeIds: [],
      selectedShapeIds: [],
      selectedTextIds: [],
      selectedImageIds: [],
      selectionBounds: null,
    });

    get().saveToHistory();
  },

  setTool: (tool) => set({ tool, selectedStrokeIds: [], selectedShapeIds: [], selectedTextIds: [], selectedAnnotationShapeId: null, selectionBounds: null }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),

  addLayer: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const newLayer = createDefaultLayer();
    newLayer.name = `Layer ${currentPageState.layers.length + 1}`;

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: [...currentPageState.layers, newLayer],
    };

    set({
      pages: updatedPages,
      currentLayerId: newLayer.id,
    });
    get().saveToHistory();
  },

  removeLayer: (layerId) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState || currentPageState.layers.length <= 1) return;

    const newLayers = currentPageState.layers.filter((l) => l.id !== layerId);
    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: newLayers,
    };

    set({
      pages: updatedPages,
      currentLayerId: state.currentLayerId === layerId
        ? newLayers[newLayers.length - 1].id
        : state.currentLayerId,
    });
    get().saveToHistory();
  },

  setCurrentLayer: (layerId) => set({ currentLayerId: layerId }),

  toggleLayerVisibility: (layerId) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const updatedLayers = currentPageState.layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
  },

  setLayerOpacity: (layerId, opacity) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const updatedLayers = currentPageState.layers.map((l) =>
      l.id === layerId ? { ...l, opacity } : l
    );

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
  },

  addStroke: (strokeData) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const newStroke: Stroke = {
      ...strokeData,
      id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      layerId: state.currentLayerId,
    };

    const updatedLayers = currentPageState.layers.map((layer) =>
      layer.id === state.currentLayerId
        ? { ...layer, strokes: [...layer.strokes, newStroke] }
        : layer
    );

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  addShape: (shapeData) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const newShape: Shape = {
      ...shapeData,
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      layerId: state.currentLayerId,
    };

    const updatedLayers = currentPageState.layers.map((layer) =>
      layer.id === state.currentLayerId
        ? { ...layer, shapes: [...layer.shapes, newShape] }
        : layer
    );

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  clearAllDrawings: () => {
    const state = get();
    if (state.pages.length === 0) return;

    const updatedPages = state.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => ({
        ...layer,
        strokes: [],
        shapes: [],
        texts: [],
      })),
    }));

    set({
      pages: updatedPages,
      selectedStrokeIds: [],
      selectedShapeIds: [],
      selectedTextIds: [],
      selectionBounds: null,
    });
    get().saveToHistory();
  },

  eraseAt: (point, radius) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    let hasChanges = false;

    const updatedLayers = currentPageState.layers.map((layer) => {
      // Filter strokes
      const filteredStrokes = layer.strokes.filter((stroke) => {
        const shouldKeep = !stroke.points.some(
          (p) => Math.hypot(p.x - point.x, p.y - point.y) < radius
        );
        if (!shouldKeep) hasChanges = true;
        return shouldKeep;
      });

      // Filter shapes
      const filteredShapes = layer.shapes.filter((shape) => {
        // Check if point is near the shape outline
        const { startPos, endPos } = shape;
        const minX = Math.min(startPos.x, endPos.x);
        const maxX = Math.max(startPos.x, endPos.x);
        const minY = Math.min(startPos.y, endPos.y);
        const maxY = Math.max(startPos.y, endPos.y);

        // Check if point is within shape bounds (with radius tolerance)
        const isNearShape =
          point.x >= minX - radius &&
          point.x <= maxX + radius &&
          point.y >= minY - radius &&
          point.y <= maxY + radius;

        if (isNearShape) {
          // More precise check for outline proximity
          const onLeftEdge = Math.abs(point.x - minX) < radius && point.y >= minY && point.y <= maxY;
          const onRightEdge = Math.abs(point.x - maxX) < radius && point.y >= minY && point.y <= maxY;
          const onTopEdge = Math.abs(point.y - minY) < radius && point.x >= minX && point.x <= maxX;
          const onBottomEdge = Math.abs(point.y - maxY) < radius && point.x >= minX && point.x <= maxX;

          if (onLeftEdge || onRightEdge || onTopEdge || onBottomEdge) {
            hasChanges = true;
            return false;
          }
        }
        return true;
      });

      return { ...layer, strokes: filteredStrokes, shapes: filteredShapes };
    });

    if (hasChanges) {
      const updatedPages = [...state.pages];
      updatedPages[state.currentPage] = {
        ...currentPageState,
        layers: updatedLayers,
      };
      set({ pages: updatedPages });
    }
  },

  // Selection operations
  selectStrokesInRect: (rect) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const selectedIds: string[] = [];

    currentPageState.layers
      .filter((l) => l.visible)
      .forEach((layer) => {
        layer.strokes.forEach((stroke) => {
          // Check if any point of the stroke is within the rect
          const isInRect = stroke.points.some(
            (p) =>
              p.x >= rect.x &&
              p.x <= rect.x + rect.width &&
              p.y >= rect.y &&
              p.y <= rect.y + rect.height
          );
          if (isInRect) {
            selectedIds.push(stroke.id);
          }
        });
      });

    // Calculate bounds of selected strokes
    let bounds: SelectionBounds | null = null;
    if (selectedIds.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      currentPageState.layers.forEach((layer) => {
        layer.strokes
          .filter((s) => selectedIds.includes(s.id))
          .forEach((stroke) => {
            stroke.points.forEach((p) => {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
            });
          });
      });
      bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    set({ selectedStrokeIds: selectedIds, selectionBounds: bounds });
  },

  selectStrokeAtPoint: (point, tolerance) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    let foundStroke: Stroke | null = null;

    // Find stroke near the point
    currentPageState.layers
      .filter((l) => l.visible)
      .forEach((layer) => {
        if (foundStroke) return;
        layer.strokes.forEach((stroke) => {
          if (foundStroke) return;
          const isNear = stroke.points.some(
            (p) => Math.hypot(p.x - point.x, p.y - point.y) < tolerance
          );
          if (isNear) {
            foundStroke = stroke;
          }
        });
      });

    if (foundStroke) {
      // Calculate bounds
      const stroke = foundStroke as Stroke;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      stroke.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      set({ selectedStrokeIds: [stroke.id], selectionBounds: bounds });
    } else {
      set({ selectedStrokeIds: [], selectionBounds: null });
    }
  },

  clearSelection: () => set({ selectedStrokeIds: [], selectedShapeIds: [], selectedTextIds: [], selectedImageIds: [], selectedAnnotationShapeId: null, selectionBounds: null }),

  deleteSelectedStrokes: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState || (state.selectedStrokeIds.length === 0 && state.selectedShapeIds.length === 0 && state.selectedTextIds.length === 0 && state.selectedImageIds.length === 0)) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      strokes: layer.strokes.filter((s) => !state.selectedStrokeIds.includes(s.id)),
      shapes: layer.shapes.filter((s) => !state.selectedShapeIds.includes(s.id)),
      texts: layer.texts.filter((t) => !state.selectedTextIds.includes(t.id)),
      images: layer.images.filter((img) => !state.selectedImageIds.includes(img.id)),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages, selectedStrokeIds: [], selectedShapeIds: [], selectedTextIds: [], selectedImageIds: [], selectionBounds: null });
    get().saveToHistory();
  },

  moveSelectedStrokes: (dx, dy) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState || state.selectedStrokeIds.length === 0) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      strokes: layer.strokes.map((stroke) => {
        if (state.selectedStrokeIds.includes(stroke.id)) {
          return {
            ...stroke,
            points: stroke.points.map((p) => ({
              ...p,
              x: p.x + dx,
              y: p.y + dy,
            })),
          };
        }
        return stroke;
      }),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    // Update selection bounds
    const newBounds = state.selectionBounds
      ? {
          ...state.selectionBounds,
          x: state.selectionBounds.x + dx,
          y: state.selectionBounds.y + dy,
        }
      : null;

    set({ pages: updatedPages, selectionBounds: newBounds });
  },

  getSelectedStrokes: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    return currentPageState.layers
      .flatMap((l) => l.strokes)
      .filter((s) => state.selectedStrokeIds.includes(s.id));
  },

  getSelectedShapes: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    return currentPageState.layers
      .flatMap((l) => l.shapes)
      .filter((s) => state.selectedShapeIds.includes(s.id));
  },

  selectShapeAtPoint: (point, tolerance) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return null;

    let foundShape: Shape | null = null;

    // 図形を検索（後から追加されたものを優先するため逆順）
    const allShapes = currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.shapes)
      .reverse();

    for (const shape of allShapes) {
      const { startPos, endPos, type } = shape;
      const baseType = type.replace('Annotated', '') as 'rect' | 'ellipse' | 'line' | 'arrow' | 'doubleArrow' | 'polyline';
      const minX = Math.min(startPos.x, endPos.x);
      const maxX = Math.max(startPos.x, endPos.x);
      const minY = Math.min(startPos.y, endPos.y);
      const maxY = Math.max(startPos.y, endPos.y);

      let isHit = false;

      if (baseType === 'rect') {
        // 矩形の枠線上にあるかチェック
        const onLeftEdge = Math.abs(point.x - minX) < tolerance && point.y >= minY - tolerance && point.y <= maxY + tolerance;
        const onRightEdge = Math.abs(point.x - maxX) < tolerance && point.y >= minY - tolerance && point.y <= maxY + tolerance;
        const onTopEdge = Math.abs(point.y - minY) < tolerance && point.x >= minX - tolerance && point.x <= maxX + tolerance;
        const onBottomEdge = Math.abs(point.y - maxY) < tolerance && point.x >= minX - tolerance && point.x <= maxX + tolerance;
        isHit = onLeftEdge || onRightEdge || onTopEdge || onBottomEdge;
      } else if (baseType === 'ellipse') {
        // 楕円の周上にあるかチェック
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = (maxX - minX) / 2;
        const ry = (maxY - minY) / 2;
        if (rx > 0 && ry > 0) {
          const normalizedX = (point.x - cx) / rx;
          const normalizedY = (point.y - cy) / ry;
          const distFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
          isHit = Math.abs(distFromCenter - 1) < tolerance / Math.min(rx, ry);
        }
      } else if (baseType === 'line' || baseType === 'arrow' || baseType === 'doubleArrow') {
        // 直線/矢印上にあるかチェック
        const lineLength = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
        if (lineLength > 0) {
          const t = Math.max(0, Math.min(1, ((point.x - startPos.x) * (endPos.x - startPos.x) + (point.y - startPos.y) * (endPos.y - startPos.y)) / (lineLength * lineLength)));
          const projX = startPos.x + t * (endPos.x - startPos.x);
          const projY = startPos.y + t * (endPos.y - startPos.y);
          const distToLine = Math.hypot(point.x - projX, point.y - projY);
          isHit = distToLine < tolerance;
        }
      } else if (baseType === 'polyline') {
        // 折れ線の各線分上にあるかチェック
        const points = shape.points;
        if (points && points.length >= 2) {
          for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (segmentLength > 0) {
              const t = Math.max(0, Math.min(1, ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / (segmentLength * segmentLength)));
              const projX = p1.x + t * (p2.x - p1.x);
              const projY = p1.y + t * (p2.y - p1.y);
              const distToSegment = Math.hypot(point.x - projX, point.y - projY);
              if (distToSegment < tolerance) {
                isHit = true;
                break;
              }
            }
          }
        }
      }

      // アノテーションの引出線・テキストもチェック
      if (!isHit && shape.annotation) {
        const { leaderLine, x, y, fontSize, text, isVertical } = shape.annotation;
        // 引出線上にあるかチェック
        const leaderLength = Math.hypot(leaderLine.end.x - leaderLine.start.x, leaderLine.end.y - leaderLine.start.y);
        if (leaderLength > 0) {
          const t = Math.max(0, Math.min(1, ((point.x - leaderLine.start.x) * (leaderLine.end.x - leaderLine.start.x) + (point.y - leaderLine.start.y) * (leaderLine.end.y - leaderLine.start.y)) / (leaderLength * leaderLength)));
          const projX = leaderLine.start.x + t * (leaderLine.end.x - leaderLine.start.x);
          const projY = leaderLine.start.y + t * (leaderLine.end.y - leaderLine.start.y);
          const distToLeader = Math.hypot(point.x - projX, point.y - projY);
          if (distToLeader < tolerance) {
            isHit = true;
          }
        }
        // テキスト領域のチェック
        if (!isHit && text) {
          const lines = text.split('\n');
          const maxLineLength = Math.max(...lines.map(l => l.length));
          let textWidth: number, textHeight: number;
          if (isVertical) {
            textWidth = lines.length * fontSize * 1.1;
            textHeight = maxLineLength * fontSize;
          } else {
            textWidth = maxLineLength * fontSize * 0.6;
            textHeight = lines.length * fontSize * 1.2;
          }
          const textMinX = isVertical ? x - textWidth : x;
          const textMaxX = isVertical ? x : x + textWidth;
          const textMinY = y;
          const textMaxY = y + textHeight;
          if (point.x >= textMinX - tolerance && point.x <= textMaxX + tolerance &&
              point.y >= textMinY - tolerance && point.y <= textMaxY + tolerance) {
            isHit = true;
          }
        }
      }

      if (isHit) {
        foundShape = shape;
        break;
      }
    }

    if (foundShape) {
      // 選択範囲を計算
      const bounds = get().calculateShapeBounds(foundShape);
      set({ selectedShapeIds: [foundShape.id], selectedStrokeIds: [], selectionBounds: bounds });
    }

    return foundShape;
  },

  selectShapesInRect: (rect) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const selectedIds: string[] = [];

    currentPageState.layers
      .filter((l) => l.visible)
      .forEach((layer) => {
        layer.shapes.forEach((shape) => {
          const { startPos, endPos } = shape;
          const minX = Math.min(startPos.x, endPos.x);
          const maxX = Math.max(startPos.x, endPos.x);
          const minY = Math.min(startPos.y, endPos.y);
          const maxY = Math.max(startPos.y, endPos.y);

          // 図形が選択範囲と重なるかチェック
          const intersects = !(maxX < rect.x || minX > rect.x + rect.width ||
                              maxY < rect.y || minY > rect.y + rect.height);
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
      });

    // 選択された図形の範囲を計算
    let bounds: SelectionBounds | null = null;
    if (selectedIds.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      currentPageState.layers.forEach((layer) => {
        layer.shapes
          .filter((s) => selectedIds.includes(s.id))
          .forEach((shape) => {
            const shapeBounds = get().calculateShapeBounds(shape);
            if (shapeBounds) {
              minX = Math.min(minX, shapeBounds.x);
              minY = Math.min(minY, shapeBounds.y);
              maxX = Math.max(maxX, shapeBounds.x + shapeBounds.width);
              maxY = Math.max(maxY, shapeBounds.y + shapeBounds.height);
            }
          });
      });
      bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    // 既存のストローク選択と統合
    const currentStrokeIds = state.selectedStrokeIds;
    const currentBounds = state.selectionBounds;

    if (selectedIds.length > 0 || currentStrokeIds.length > 0) {
      let finalBounds = bounds;
      if (currentStrokeIds.length > 0 && currentBounds && bounds) {
        finalBounds = {
          x: Math.min(bounds.x, currentBounds.x),
          y: Math.min(bounds.y, currentBounds.y),
          width: Math.max(bounds.x + bounds.width, currentBounds.x + currentBounds.width) - Math.min(bounds.x, currentBounds.x),
          height: Math.max(bounds.y + bounds.height, currentBounds.y + currentBounds.height) - Math.min(bounds.y, currentBounds.y),
        };
      } else if (currentStrokeIds.length > 0 && currentBounds) {
        finalBounds = currentBounds;
      }
      set({ selectedShapeIds: selectedIds, selectionBounds: finalBounds });
    } else {
      set({ selectedShapeIds: [], selectionBounds: currentBounds });
    }
  },

  setSelectedShapeIds: (ids) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    if (ids.length === 0) {
      set({ selectedShapeIds: [], selectionBounds: null });
      return;
    }

    // 選択された図形の範囲を計算
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    currentPageState.layers.forEach((layer) => {
      layer.shapes
        .filter((s) => ids.includes(s.id))
        .forEach((shape) => {
          const bounds = get().calculateShapeBounds(shape);
          if (bounds) {
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
          }
        });
    });

    const bounds = minX < Infinity ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
    set({ selectedShapeIds: ids, selectedStrokeIds: [], selectionBounds: bounds });
  },

  moveSelectedShapes: (dx, dy) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState || state.selectedShapeIds.length === 0) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      shapes: layer.shapes.map((shape) => {
        if (state.selectedShapeIds.includes(shape.id)) {
          const newShape = {
            ...shape,
            startPos: { x: shape.startPos.x + dx, y: shape.startPos.y + dy },
            endPos: { x: shape.endPos.x + dx, y: shape.endPos.y + dy },
          };
          // アノテーションも移動
          if (shape.annotation) {
            newShape.annotation = {
              ...shape.annotation,
              x: shape.annotation.x + dx,
              y: shape.annotation.y + dy,
              leaderLine: {
                start: {
                  x: shape.annotation.leaderLine.start.x + dx,
                  y: shape.annotation.leaderLine.start.y + dy,
                },
                end: {
                  x: shape.annotation.leaderLine.end.x + dx,
                  y: shape.annotation.leaderLine.end.y + dy,
                },
              },
            };
          }
          return newShape;
        }
        return shape;
      }),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    // 選択範囲を更新
    const newBounds = state.selectionBounds
      ? {
          ...state.selectionBounds,
          x: state.selectionBounds.x + dx,
          y: state.selectionBounds.y + dy,
        }
      : null;

    set({ pages: updatedPages, selectionBounds: newBounds });
  },

  saveToHistory: () => {
    const state = get();
    const newHistoryEntry = {
      pages: JSON.parse(JSON.stringify(state.pages)),
      currentPage: state.currentPage,
    };

    const newHistory = [
      ...state.history.slice(0, state.historyIndex + 1),
      newHistoryEntry,
    ].slice(-50); // Keep last 50 states

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const prevState = state.history[state.historyIndex - 1];
      set({
        pages: JSON.parse(JSON.stringify(prevState.pages)),
        currentPage: prevState.currentPage,
        historyIndex: state.historyIndex - 1,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const nextState = state.history[state.historyIndex + 1];
      set({
        pages: JSON.parse(JSON.stringify(nextState.pages)),
        currentPage: nextState.currentPage,
        historyIndex: state.historyIndex + 1,
      });
    }
  },

  clearHistory: () => {
    const state = get();
    // 現在の状態のみを履歴として保持
    const currentHistoryEntry: HistoryState = {
      pages: JSON.parse(JSON.stringify(state.pages)),
      currentPage: state.currentPage,
    };
    set({
      history: [currentHistoryEntry],
      historyIndex: 0,
    });
  },

  getCurrentPageState: () => {
    const state = get();
    return state.pages[state.currentPage];
  },

  getAllStrokes: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    return currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.strokes);
  },

  getAllShapes: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    return currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.shapes);
  },

  updateShapeAnnotation: (shapeId, annotation) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      shapes: layer.shapes.map((shape) =>
        shape.id === shapeId ? { ...shape, annotation } : shape
      ),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  updateShape: (shapeId, updates) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      shapes: layer.shapes.map((shape) =>
        shape.id === shapeId ? { ...shape, ...updates } : shape
      ),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  calculateShapeBounds: (shape) => {
    const { startPos, endPos } = shape;
    let minX = Math.min(startPos.x, endPos.x);
    let maxX = Math.max(startPos.x, endPos.x);
    let minY = Math.min(startPos.y, endPos.y);
    let maxY = Math.max(startPos.y, endPos.y);

    // 折れ線の場合はpointsから範囲を計算
    if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
      shape.points.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
    }

    // アノテーションがある場合はその範囲も含める
    if (shape.annotation) {
      const { leaderLine, x, y, fontSize, text, isVertical } = shape.annotation;
      // 引出線の範囲
      minX = Math.min(minX, leaderLine.start.x, leaderLine.end.x);
      maxX = Math.max(maxX, leaderLine.start.x, leaderLine.end.x);
      minY = Math.min(minY, leaderLine.start.y, leaderLine.end.y);
      maxY = Math.max(maxY, leaderLine.start.y, leaderLine.end.y);

      // テキストの範囲
      if (text) {
        const lines = text.split('\n');
        const maxLineLength = Math.max(...lines.map(l => l.length));
        let textWidth: number, textHeight: number;
        if (isVertical) {
          textWidth = lines.length * fontSize * 1.1;
          textHeight = maxLineLength * fontSize;
        } else {
          textWidth = maxLineLength * fontSize * 0.6;
          textHeight = lines.length * fontSize * 1.2;
        }
        const textMinX = isVertical ? x - textWidth : x;
        const textMaxX = isVertical ? x : x + textWidth;
        minX = Math.min(minX, textMinX);
        maxX = Math.max(maxX, textMaxX);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + textHeight);
      }
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  },

  calculateAnnotationTextBounds: (annotation) => {
    const { x, y, fontSize, text, isVertical, align } = annotation;
    if (!text) return null;

    const lines = text.split('\n');
    let textWidth: number, textHeight: number;

    if (isVertical) {
      // 縦書きの場合
      const lineHeight = fontSize * 1.1;
      const charCounts = lines.map(line => Array.from(line).length);
      const maxCharsInLine = Math.max(...charCounts, 1);
      textHeight = maxCharsInLine * fontSize;
      textWidth = Math.max(lines.length, 1) * lineHeight;
    } else {
      // 横書きの場合 - 文字幅を正確に計算
      const lineHeight = fontSize * 1.2;
      const charWidths = lines.map(line => {
        let width = 0;
        for (const char of line) {
          if (char.charCodeAt(0) < 128) {
            width += fontSize * 0.6; // ASCII文字は狭い
          } else {
            width += fontSize; // 全角文字は通常幅
          }
        }
        return width;
      });
      textWidth = Math.max(...charWidths, fontSize);
      textHeight = lines.length * lineHeight;
    }

    let textMinX: number;
    if (isVertical) {
      textMinX = x - textWidth + fontSize / 2;
    } else if (align === 'right') {
      textMinX = x - textWidth;
    } else {
      textMinX = x;
    }

    return { x: textMinX, y: y, width: textWidth, height: textHeight };
  },

  getLeaderEndPos: (annotation, shapeStartPos) => {
    const bounds = get().calculateAnnotationTextBounds(annotation);
    if (!bounds) {
      return { x: annotation.x, y: annotation.y };
    }

    const margin = 6; // テキストとの間隔
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // テキストバウンディングボックスの4辺の中点を候補として用意
    const candidates = [
      { x: centerX, y: bounds.y - margin },           // 上
      { x: centerX, y: bounds.y + bounds.height + margin }, // 下
      { x: bounds.x - margin, y: centerY },           // 左
      { x: bounds.x + bounds.width + margin, y: centerY }, // 右
    ];

    // 図形の起点に最も近い点を選択
    let nearest = candidates[0];
    let minDist = Infinity;

    candidates.forEach(p => {
      const dist = Math.hypot(shapeStartPos.x - p.x, shapeStartPos.y - p.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    });

    return { x: nearest.x, y: nearest.y };
  },

  selectAnnotationAtPoint: (point, tolerance) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return null;

    // 全ての図形を逆順（後から追加されたものを優先）で検索
    const allShapes = currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.shapes)
      .reverse();

    for (const shape of allShapes) {
      if (!shape.annotation) continue;

      const { leaderLine, text } = shape.annotation;

      // 引出線の終点（テキスト側）の近くかチェック
      const distToLeaderEnd = Math.hypot(point.x - leaderLine.end.x, point.y - leaderLine.end.y);
      if (distToLeaderEnd < tolerance * 1.5) {
        return { shapeId: shape.id, hitType: 'leaderEnd' as const };
      }

      // テキスト領域のチェック
      if (text) {
        const textBounds = get().calculateAnnotationTextBounds(shape.annotation);
        if (textBounds) {
          if (point.x >= textBounds.x - tolerance && point.x <= textBounds.x + textBounds.width + tolerance &&
              point.y >= textBounds.y - tolerance && point.y <= textBounds.y + textBounds.height + tolerance) {
            return { shapeId: shape.id, hitType: 'text' as const };
          }
        }
      }
    }

    return null;
  },

  moveAnnotationOnly: (shapeId, dx, dy, shapeStartPos, shapeEndPos, shapeType) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    // 図形からアノテーションの引出線起点を再計算する関数
    const getLeaderStartPos = (baseType: string, startPos: Point, endPos: Point, targetPos: Point): Point => {
      if (baseType === 'rect') {
        const minX = Math.min(startPos.x, endPos.x);
        const maxX = Math.max(startPos.x, endPos.x);
        const minY = Math.min(startPos.y, endPos.y);
        const maxY = Math.max(startPos.y, endPos.y);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const candidates = [
          { x: centerX, y: minY },
          { x: centerX, y: maxY },
          { x: minX, y: centerY },
          { x: maxX, y: centerY },
        ];

        let nearest = candidates[0];
        let minDist = Infinity;
        candidates.forEach(p => {
          const dist = Math.hypot(targetPos.x - p.x, targetPos.y - p.y);
          if (dist < minDist) {
            minDist = dist;
            nearest = p;
          }
        });
        return nearest;
      } else if (baseType === 'ellipse') {
        const w = Math.abs(endPos.x - startPos.x);
        const h = Math.abs(endPos.y - startPos.y);
        const cx = startPos.x + (endPos.x - startPos.x) / 2;
        const cy = startPos.y + (endPos.y - startPos.y) / 2;
        const rx = w / 2;
        const ry = h / 2;
        const ddx = targetPos.x - cx;
        const ddy = targetPos.y - cy;
        const angle = Math.atan2(ddy, ddx);
        return {
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        };
      } else {
        return {
          x: (startPos.x + endPos.x) / 2,
          y: (startPos.y + endPos.y) / 2,
        };
      }
    };

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      shapes: layer.shapes.map((shape) => {
        if (shape.id === shapeId && shape.annotation) {
          // 移動後のアノテーション（テキスト位置を更新）
          const movedAnnotation: Annotation = {
            ...shape.annotation,
            x: shape.annotation.x + dx,
            y: shape.annotation.y + dy,
          };

          const baseType = shapeType.replace('Annotated', '');

          // ステップ1: 仮の終端位置から図形側起点を計算
          const tempEnd = {
            x: shape.annotation.leaderLine.end.x + dx,
            y: shape.annotation.leaderLine.end.y + dy,
          };
          let newStart = getLeaderStartPos(baseType, shapeStartPos, shapeEndPos, tempEnd);

          // ステップ2: 図形側起点からテキスト側終端を計算
          let newEnd = get().getLeaderEndPos(movedAnnotation, newStart);

          // ステップ3: 終端が変わった場合、起点を再計算（より正確な位置を求める）
          newStart = getLeaderStartPos(baseType, shapeStartPos, shapeEndPos, newEnd);

          // テキストの配置方向を決定
          const leaderDx = newEnd.x - newStart.x;
          const align: 'left' | 'right' = leaderDx >= 0 ? 'left' : 'right';

          return {
            ...shape,
            annotation: {
              ...movedAnnotation,
              align,
              leaderLine: {
                start: newStart,
                end: newEnd,
              },
            },
          };
        }
        return shape;
      }),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
  },

  moveLeaderEnd: (shapeId, dx, dy, shapeStartPos, shapeEndPos, shapeType) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    // 図形からアノテーションの引出線起点を再計算する関数
    const getLeaderStartPos = (baseType: string, startPos: Point, endPos: Point, targetPos: Point): Point => {
      if (baseType === 'rect') {
        const minX = Math.min(startPos.x, endPos.x);
        const maxX = Math.max(startPos.x, endPos.x);
        const minY = Math.min(startPos.y, endPos.y);
        const maxY = Math.max(startPos.y, endPos.y);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const candidates = [
          { x: centerX, y: minY },
          { x: centerX, y: maxY },
          { x: minX, y: centerY },
          { x: maxX, y: centerY },
        ];

        let nearest = candidates[0];
        let minDist = Infinity;
        candidates.forEach(p => {
          const dist = Math.hypot(targetPos.x - p.x, targetPos.y - p.y);
          if (dist < minDist) {
            minDist = dist;
            nearest = p;
          }
        });
        return nearest;
      } else if (baseType === 'ellipse') {
        const w = Math.abs(endPos.x - startPos.x);
        const h = Math.abs(endPos.y - startPos.y);
        const cx = startPos.x + (endPos.x - startPos.x) / 2;
        const cy = startPos.y + (endPos.y - startPos.y) / 2;
        const rx = w / 2;
        const ry = h / 2;
        const ddx = targetPos.x - cx;
        const ddy = targetPos.y - cy;
        const angle = Math.atan2(ddy, ddx);
        return {
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        };
      } else {
        return {
          x: (startPos.x + endPos.x) / 2,
          y: (startPos.y + endPos.y) / 2,
        };
      }
    };

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      shapes: layer.shapes.map((shape) => {
        if (shape.id === shapeId && shape.annotation) {
          // 新しい終端位置（元の位置 + 移動量）
          const newEnd = {
            x: shape.annotation.leaderLine.end.x + dx,
            y: shape.annotation.leaderLine.end.y + dy,
          };

          const baseType = shapeType.replace('Annotated', '');

          // 新しいターゲット位置に基づいて起点を再計算
          const newStart = getLeaderStartPos(baseType, shapeStartPos, shapeEndPos, newEnd);

          // テキスト位置も終端に合わせて更新（終端とテキストのオフセットを維持）
          const origTextOffsetX = shape.annotation.x - shape.annotation.leaderLine.end.x;
          const origTextOffsetY = shape.annotation.y - shape.annotation.leaderLine.end.y;

          // テキストの配置方向を決定
          const leaderDx = newEnd.x - newStart.x;
          const align: 'left' | 'right' = leaderDx >= 0 ? 'left' : 'right';

          return {
            ...shape,
            annotation: {
              ...shape.annotation,
              x: newEnd.x + origTextOffsetX,
              y: newEnd.y + origTextOffsetY,
              align,
              leaderLine: {
                start: newStart,
                end: newEnd,
              },
            },
          };
        }
        return shape;
      }),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
  },

  // Text operations
  addText: (textData) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const newText: TextElement = {
      ...textData,
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      layerId: state.currentLayerId,
    };

    const updatedLayers = currentPageState.layers.map((layer) =>
      layer.id === state.currentLayerId
        ? { ...layer, texts: [...layer.texts, newText] }
        : layer
    );

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  updateText: (textId, updates) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      texts: layer.texts.map((text) =>
        text.id === textId ? { ...text, ...updates } : text
      ),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  deleteText: (textId) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      texts: layer.texts.filter((text) => text.id !== textId),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages, selectedTextIds: state.selectedTextIds.filter(id => id !== textId) });
    get().saveToHistory();
  },

  calculateTextBounds: (text) => {
    const { x, y, fontSize, text: content, isVertical } = text;
    const lines = content.split('\n');

    let textWidth: number, textHeight: number;

    if (isVertical) {
      const lineHeight = fontSize * 1.1;
      const charCounts = lines.map(line => Array.from(line).length);
      const maxCharsInLine = Math.max(...charCounts, 1);
      textHeight = maxCharsInLine * fontSize;
      textWidth = Math.max(lines.length, 1) * lineHeight;
      // 縦書きは右から左に進むので、xは右端
      return { x: x - textWidth + fontSize / 2, y, width: textWidth, height: textHeight };
    } else {
      const lineHeight = fontSize * 1.2;
      const charWidths = lines.map(line => {
        let width = 0;
        for (const char of line) {
          if (char.charCodeAt(0) < 128) {
            width += fontSize * 0.6;
          } else {
            width += fontSize;
          }
        }
        return width;
      });
      textWidth = Math.max(...charWidths, fontSize);
      textHeight = lines.length * lineHeight;
      return { x, y, width: textWidth, height: textHeight };
    }
  },

  selectTextAtPoint: (point, tolerance) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return null;

    // 全てのテキストを逆順で検索（後から追加されたものを優先）
    const allTexts = currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.texts)
      .reverse();

    for (const text of allTexts) {
      const bounds = get().calculateTextBounds(text);
      if (
        point.x >= bounds.x - tolerance &&
        point.x <= bounds.x + bounds.width + tolerance &&
        point.y >= bounds.y - tolerance &&
        point.y <= bounds.y + bounds.height + tolerance
      ) {
        set({ selectedTextIds: [text.id], selectedStrokeIds: [], selectedShapeIds: [], selectionBounds: bounds });
        return text;
      }
    }

    return null;
  },

  moveSelectedTexts: (dx, dy) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState || state.selectedTextIds.length === 0) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      texts: layer.texts.map((text) => {
        if (state.selectedTextIds.includes(text.id)) {
          return {
            ...text,
            x: text.x + dx,
            y: text.y + dy,
          };
        }
        return text;
      }),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    const newBounds = state.selectionBounds
      ? {
          ...state.selectionBounds,
          x: state.selectionBounds.x + dx,
          y: state.selectionBounds.y + dy,
        }
      : null;

    set({ pages: updatedPages, selectionBounds: newBounds });
  },

  getSelectedTexts: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    return currentPageState.layers
      .flatMap((l) => l.texts)
      .filter((t) => state.selectedTextIds.includes(t.id));
  },

  getAllTexts: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    return currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.texts);
  },

  setSelectedTextIds: (ids) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    if (ids.length === 0) {
      set({ selectedTextIds: [], selectionBounds: null });
      return;
    }

    // 選択されたテキストの範囲を計算
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    currentPageState.layers.forEach((layer) => {
      layer.texts
        .filter((t) => ids.includes(t.id))
        .forEach((text) => {
          const bounds = get().calculateTextBounds(text);
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
        });
    });

    const bounds = minX < Infinity ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
    set({ selectedTextIds: ids, selectedStrokeIds: [], selectedShapeIds: [], selectedAnnotationShapeId: null, selectionBounds: bounds });
  },

  // アノテーション選択状態を設定
  setSelectedAnnotationShapeId: (id) => set({ selectedAnnotationShapeId: id }),

  // 選択されたオブジェクトの色を更新
  updateSelectedColor: (color) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const hasStrokes = state.selectedStrokeIds.length > 0;
    const hasShapes = state.selectedShapeIds.length > 0;
    const hasTexts = state.selectedTextIds.length > 0;
    const hasAnnotation = state.selectedAnnotationShapeId !== null;

    if (!hasStrokes && !hasShapes && !hasTexts && !hasAnnotation) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      strokes: layer.strokes.map((stroke) =>
        state.selectedStrokeIds.includes(stroke.id)
          ? { ...stroke, color }
          : stroke
      ),
      shapes: layer.shapes.map((shape) => {
        // 図形全体が選択されている場合
        if (state.selectedShapeIds.includes(shape.id)) {
          return {
            ...shape,
            color,
            annotation: shape.annotation
              ? { ...shape.annotation, color }
              : undefined,
          };
        }
        // アノテーションのみが選択されている場合（図形とアノテーションの両方の色を変更）
        if (shape.id === state.selectedAnnotationShapeId) {
          return {
            ...shape,
            color,
            annotation: shape.annotation
              ? { ...shape.annotation, color }
              : undefined,
          };
        }
        return shape;
      }),
      texts: layer.texts.map((text) =>
        state.selectedTextIds.includes(text.id)
          ? { ...text, color }
          : text
      ),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages, color });
    get().saveToHistory();
  },

  // 選択があるかどうか
  hasSelection: () => {
    const state = get();
    return state.selectedStrokeIds.length > 0 ||
           state.selectedShapeIds.length > 0 ||
           state.selectedTextIds.length > 0 ||
           state.selectedImageIds.length > 0 ||
           state.selectedAnnotationShapeId !== null;
  },

  // Image operations
  addImage: (image) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const currentLayer = currentPageState.layers.find((l) => l.id === state.currentLayerId);
    if (!currentLayer) return;

    const newImage: ImageElement = {
      id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      layerId: state.currentLayerId,
      ...image,
    };

    const updatedLayers = currentPageState.layers.map((layer) => {
      if (layer.id === state.currentLayerId) {
        return {
          ...layer,
          images: [...layer.images, newImage],
        };
      }
      return layer;
    });

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  deleteImage: (imageId) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      images: layer.images.filter((img) => img.id !== imageId),
    }));

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },

  selectImageAtPoint: (point, tolerance) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return null;

    // 画像を検索（後から追加されたものを優先するため逆順）
    const allImages = currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.images)
      .reverse();

    for (const image of allImages) {
      const { startPos, endPos } = image;
      const minX = Math.min(startPos.x, endPos.x);
      const maxX = Math.max(startPos.x, endPos.x);
      const minY = Math.min(startPos.y, endPos.y);
      const maxY = Math.max(startPos.y, endPos.y);

      // 画像の矩形内にあるかチェック
      if (point.x >= minX - tolerance && point.x <= maxX + tolerance &&
          point.y >= minY - tolerance && point.y <= maxY + tolerance) {
        // 選択状態を更新
        set({
          selectedImageIds: [image.id],
          selectedStrokeIds: [],
          selectedShapeIds: [],
          selectedTextIds: [],
          selectedAnnotationShapeId: null,
          selectionBounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        });
        return image;
      }
    }

    return null;
  },

  selectImagesInRect: (rect) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    const selectedIds: string[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    currentPageState.layers
      .filter((l) => l.visible)
      .forEach((layer) => {
        layer.images.forEach((image) => {
          const imgMinX = Math.min(image.startPos.x, image.endPos.x);
          const imgMaxX = Math.max(image.startPos.x, image.endPos.x);
          const imgMinY = Math.min(image.startPos.y, image.endPos.y);
          const imgMaxY = Math.max(image.startPos.y, image.endPos.y);

          // 画像が選択矩形に含まれるか
          if (imgMinX >= rect.x && imgMaxX <= rect.x + rect.width &&
              imgMinY >= rect.y && imgMaxY <= rect.y + rect.height) {
            selectedIds.push(image.id);
            minX = Math.min(minX, imgMinX);
            minY = Math.min(minY, imgMinY);
            maxX = Math.max(maxX, imgMaxX);
            maxY = Math.max(maxY, imgMaxY);
          }
        });
      });

    if (selectedIds.length > 0) {
      set((prevState) => ({
        selectedImageIds: [...prevState.selectedImageIds, ...selectedIds],
        selectionBounds: minX < Infinity
          ? {
              x: Math.min(minX, prevState.selectionBounds?.x ?? Infinity),
              y: Math.min(minY, prevState.selectionBounds?.y ?? Infinity),
              width: Math.max(maxX, (prevState.selectionBounds?.x ?? 0) + (prevState.selectionBounds?.width ?? 0)) - Math.min(minX, prevState.selectionBounds?.x ?? Infinity),
              height: Math.max(maxY, (prevState.selectionBounds?.y ?? 0) + (prevState.selectionBounds?.height ?? 0)) - Math.min(minY, prevState.selectionBounds?.y ?? Infinity),
            }
          : prevState.selectionBounds,
      }));
    }
  },

  calculateImageBounds: (image) => {
    const minX = Math.min(image.startPos.x, image.endPos.x);
    const maxX = Math.max(image.startPos.x, image.endPos.x);
    const minY = Math.min(image.startPos.y, image.endPos.y);
    const maxY = Math.max(image.startPos.y, image.endPos.y);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  },

  moveSelectedImages: (dx, dy) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState || state.selectedImageIds.length === 0) return;

    const updatedLayers = currentPageState.layers.map((layer) => ({
      ...layer,
      images: layer.images.map((image) => {
        if (state.selectedImageIds.includes(image.id)) {
          return {
            ...image,
            startPos: { x: image.startPos.x + dx, y: image.startPos.y + dy },
            endPos: { x: image.endPos.x + dx, y: image.endPos.y + dy },
          };
        }
        return image;
      }),
    }));

    // Update selection bounds
    const currentBounds = state.selectionBounds;
    const newBounds = currentBounds
      ? {
          x: currentBounds.x + dx,
          y: currentBounds.y + dy,
          width: currentBounds.width,
          height: currentBounds.height,
        }
      : null;

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages, selectionBounds: newBounds });
  },

  getSelectedImages: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    const selectedImages: ImageElement[] = [];
    currentPageState.layers.forEach((layer) => {
      layer.images.forEach((image) => {
        if (state.selectedImageIds.includes(image.id)) {
          selectedImages.push(image);
        }
      });
    });

    return selectedImages;
  },

  getAllImages: () => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return [];

    return currentPageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.images);
  },

  setSelectedImageIds: (ids) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState) return;

    if (ids.length === 0) {
      set({ selectedImageIds: [], selectionBounds: null });
      return;
    }

    // 選択された画像の範囲を計算
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    currentPageState.layers.forEach((layer) => {
      layer.images
        .filter((img) => ids.includes(img.id))
        .forEach((image) => {
          const imgMinX = Math.min(image.startPos.x, image.endPos.x);
          const imgMaxX = Math.max(image.startPos.x, image.endPos.x);
          const imgMinY = Math.min(image.startPos.y, image.endPos.y);
          const imgMaxY = Math.max(image.startPos.y, image.endPos.y);
          minX = Math.min(minX, imgMinX);
          minY = Math.min(minY, imgMinY);
          maxX = Math.max(maxX, imgMaxX);
          maxY = Math.max(maxY, imgMaxY);
        });
    });

    const bounds = minX < Infinity ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
    set({ selectedImageIds: ids, selectedStrokeIds: [], selectedShapeIds: [], selectedTextIds: [], selectedAnnotationShapeId: null, selectionBounds: bounds });
  },

  // Stamp operations
  setCurrentStampType: (stampType) => set({ currentStampType: stampType }),

  addStamp: (point) => {
    const state = get();
    const currentPageState = state.pages[state.currentPage];
    if (!currentPageState || !state.currentStampType) return;

    // スタンプのデフォルトサイズ
    const defaultSizes: Record<StampType, number> = {
      doneStamp: 28,
      rubyStamp: 14,
      toruStamp: 20,
      torutsumeStamp: 14,
      torumamaStamp: 14,
      zenkakuakiStamp: 14,
      hankakuakiStamp: 14,
      kaigyouStamp: 14,
      komojiStamp: 20,
    };

    const size = defaultSizes[state.currentStampType] || 20;

    // スタンプをshapeとして追加
    const newShape: Shape = {
      id: `stamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'stamp',
      startPos: { x: point.x, y: point.y },
      endPos: { x: point.x, y: point.y },
      color: state.color,
      width: 2,
      layerId: state.currentLayerId,
      stampType: state.currentStampType,
      size,
    };

    const updatedLayers = currentPageState.layers.map((layer) =>
      layer.id === state.currentLayerId
        ? { ...layer, shapes: [...layer.shapes, newShape] }
        : layer
    );

    const updatedPages = [...state.pages];
    updatedPages[state.currentPage] = {
      ...currentPageState,
      layers: updatedLayers,
    };

    set({ pages: updatedPages });
    get().saveToHistory();
  },
}));
