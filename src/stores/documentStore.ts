import { create } from 'zustand';
import { DocumentState, TabInfo, CreateDocumentOptions, DocumentFileType } from '../types/document';
import { PageState, HistoryState, PdfPageInfo, PdfAnnotationText } from '../types';
import { useZoomStore } from './zoomStore';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// メモリにフル保持するドキュメント数の上限
const MAX_LOADED_DOCUMENTS = 5;

/**
 * ユニークなドキュメントIDを生成
 */
const generateDocumentId = (): string => {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 新規ドキュメントの状態を作成
 */
const createEmptyDocumentState = (options: CreateDocumentOptions = {}): DocumentState => {
  return {
    id: generateDocumentId(),
    title: options.title || '新規ドキュメント',
    filePath: options.filePath || null,
    fileType: options.fileType || 'new',
    isModified: false,
    lastAccessedAt: Date.now(),
    pages: [],
    currentPage: 0,
    currentLayerId: '',
    history: [],
    historyIndex: -1,
    pdfDocument: null,
    pdfPageInfos: [],
    pdfAnnotations: [],
    zoom: 1,
  };
};

interface DocumentStore {
  // --- 状態 ---
  /** 全ドキュメントのマップ（ID -> DocumentState） */
  documents: Map<string, DocumentState>;
  /** アクティブなドキュメントのID */
  activeDocumentId: string | null;
  /** タブの表示順序（ドキュメントIDの配列） */
  tabOrder: string[];

  // --- タブ操作 ---
  /** 新規ドキュメントを作成 */
  createNewDocument: (options?: CreateDocumentOptions) => string;
  /** ドキュメントを閉じる（未保存の場合はfalseを返す可能性あり） */
  closeDocument: (id: string, force?: boolean) => boolean;
  /** ドキュメントを切り替え */
  switchDocument: (id: string) => void;
  /** タブの順序を変更（ドラッグ&ドロップ用） */
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // --- ドキュメント状態管理 ---
  /** アクティブなドキュメントを取得 */
  getActiveDocument: () => DocumentState | null;
  /** タブ情報の一覧を取得 */
  getTabInfoList: () => TabInfo[];
  /** ドキュメントの状態を更新 */
  updateDocument: (id: string, updates: Partial<DocumentState>) => void;
  /** ドキュメントを変更済みとしてマーク */
  markAsModified: (id: string) => void;
  /** ドキュメントを保存済みとしてマーク */
  markAsSaved: (id: string, filePath?: string) => void;

  // --- drawingStoreとの連携 ---
  /** drawingStoreの状態をアクティブドキュメントに保存 */
  syncFromDrawingStore: (state: {
    pages: PageState[];
    currentPage: number;
    currentLayerId: string;
    history: HistoryState[];
    historyIndex: number;
    pdfDocument: PDFDocumentProxy | null;
    pdfPageInfos: PdfPageInfo[];
    pdfAnnotations: PdfAnnotationText[][];
  }) => void;

  /** ドキュメントをdrawingStoreで使用できる形式で取得 */
  getDocumentForDrawingStore: (id: string) => {
    pages: PageState[];
    currentPage: number;
    currentLayerId: string;
    history: HistoryState[];
    historyIndex: number;
    pdfDocument: PDFDocumentProxy | null;
    pdfPageInfos: PdfPageInfo[];
    pdfAnnotations: PdfAnnotationText[][];
  } | null;

  // --- ファイル読み込み用 ---
  /** 読み込んだファイルをドキュメントとして登録 */
  registerLoadedDocument: (
    title: string,
    filePath: string | null,
    fileType: DocumentFileType,
    pages: PageState[],
    pdfDocument: PDFDocumentProxy | null,
    pdfPageInfos: PdfPageInfo[],
    pdfAnnotations: PdfAnnotationText[][]
  ) => string;

  /** アクティブなドキュメントにファイルを読み込む（空のタブに読み込む場合） */
  loadIntoActiveDocument: (
    title: string,
    filePath: string | null,
    fileType: DocumentFileType,
    pages: PageState[],
    pdfDocument: PDFDocumentProxy | null,
    pdfPageInfos: PdfPageInfo[],
    pdfAnnotations: PdfAnnotationText[][]
  ) => void;

  // --- メモリ管理 ---
  /** 古いドキュメントのリソースを解放 */
  unloadOldDocuments: () => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: new Map(),
  activeDocumentId: null,
  tabOrder: [],

  createNewDocument: (options = {}) => {
    const newDoc = createEmptyDocumentState(options);

    set((state) => {
      const newDocuments = new Map(state.documents);
      newDocuments.set(newDoc.id, newDoc);

      return {
        documents: newDocuments,
        tabOrder: [...state.tabOrder, newDoc.id],
        activeDocumentId: newDoc.id,
      };
    });

    return newDoc.id;
  },

  closeDocument: (id, force = false) => {
    const state = get();
    const doc = state.documents.get(id);

    if (!doc) return true;

    // 未保存の変更がある場合、forceでなければfalseを返す
    // （呼び出し側で確認ダイアログを表示する）
    if (doc.isModified && !force) {
      return false;
    }

    // PDFリソースを解放
    if (doc.pdfDocument) {
      doc.pdfDocument.destroy();
    }

    // ドキュメントを削除
    const newDocuments = new Map(state.documents);
    newDocuments.delete(id);

    // タブ順序から削除
    const newTabOrder = state.tabOrder.filter((tabId) => tabId !== id);

    // 新しいアクティブドキュメントを決定
    let newActiveId = state.activeDocumentId;
    if (state.activeDocumentId === id) {
      const closedIndex = state.tabOrder.indexOf(id);
      newActiveId = newTabOrder[Math.min(closedIndex, newTabOrder.length - 1)] || null;
    }

    set({
      documents: newDocuments,
      tabOrder: newTabOrder,
      activeDocumentId: newActiveId,
    });

    return true;
  },

  switchDocument: (targetId) => {
    const state = get();

    if (state.activeDocumentId === targetId) return;

    const targetDoc = state.documents.get(targetId);
    if (!targetDoc) return;

    // ズームレベルを復元
    useZoomStore.getState().setZoom(targetDoc.zoom);

    // アクティブドキュメントのlastAccessedAtを更新
    const newDocuments = new Map(state.documents);
    newDocuments.set(targetId, {
      ...targetDoc,
      lastAccessedAt: Date.now(),
    });

    set({
      documents: newDocuments,
      activeDocumentId: targetId,
    });

    // メモリ管理
    get().unloadOldDocuments();
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      const newOrder = [...state.tabOrder];
      const [movedId] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedId);
      return { tabOrder: newOrder };
    });
  },

  getActiveDocument: () => {
    const state = get();
    if (!state.activeDocumentId) return null;
    return state.documents.get(state.activeDocumentId) || null;
  },

  getTabInfoList: () => {
    const state = get();
    return state.tabOrder.map((id, index) => {
      const doc = state.documents.get(id);
      return {
        id,
        title: doc?.title || '不明',
        isModified: doc?.isModified || false,
        order: index,
      };
    });
  },

  updateDocument: (id, updates) => {
    set((state) => {
      const doc = state.documents.get(id);
      if (!doc) return state;

      const newDocuments = new Map(state.documents);
      newDocuments.set(id, { ...doc, ...updates });
      return { documents: newDocuments };
    });
  },

  markAsModified: (id) => {
    get().updateDocument(id, { isModified: true });
  },

  markAsSaved: (id, filePath) => {
    const updates: Partial<DocumentState> = { isModified: false };
    if (filePath) {
      updates.filePath = filePath;
      // ファイル名をタイトルに設定
      const fileName = filePath.split(/[/\\]/).pop() || '新規ドキュメント';
      updates.title = fileName;
    }
    get().updateDocument(id, updates);
  },

  syncFromDrawingStore: (drawingState) => {
    const state = get();
    if (!state.activeDocumentId) return;

    // ズームも保存
    const zoom = useZoomStore.getState().zoom;

    set((prevState) => {
      const doc = prevState.documents.get(prevState.activeDocumentId!);
      if (!doc) return prevState;

      const newDocuments = new Map(prevState.documents);
      newDocuments.set(prevState.activeDocumentId!, {
        ...doc,
        pages: drawingState.pages,
        currentPage: drawingState.currentPage,
        currentLayerId: drawingState.currentLayerId,
        history: drawingState.history,
        historyIndex: drawingState.historyIndex,
        pdfDocument: drawingState.pdfDocument,
        pdfPageInfos: drawingState.pdfPageInfos,
        pdfAnnotations: drawingState.pdfAnnotations,
        zoom,
        lastAccessedAt: Date.now(),
      });

      return { documents: newDocuments };
    });
  },

  getDocumentForDrawingStore: (id) => {
    const doc = get().documents.get(id);
    if (!doc) return null;

    return {
      pages: doc.pages,
      currentPage: doc.currentPage,
      currentLayerId: doc.currentLayerId,
      history: doc.history,
      historyIndex: doc.historyIndex,
      pdfDocument: doc.pdfDocument,
      pdfPageInfos: doc.pdfPageInfos,
      pdfAnnotations: doc.pdfAnnotations,
    };
  },

  registerLoadedDocument: (title, filePath, fileType, pages, pdfDocument, pdfPageInfos, pdfAnnotations) => {
    const newDoc: DocumentState = {
      id: generateDocumentId(),
      title,
      filePath,
      fileType,
      isModified: false,
      lastAccessedAt: Date.now(),
      pages,
      currentPage: 0,
      currentLayerId: pages[0]?.layers[0]?.id || '',
      history: [],
      historyIndex: -1,
      pdfDocument,
      pdfPageInfos,
      pdfAnnotations,
      zoom: 1,
    };

    set((state) => {
      const newDocuments = new Map(state.documents);
      newDocuments.set(newDoc.id, newDoc);

      return {
        documents: newDocuments,
        tabOrder: [...state.tabOrder, newDoc.id],
        activeDocumentId: newDoc.id,
      };
    });

    // メモリ管理
    get().unloadOldDocuments();

    return newDoc.id;
  },

  loadIntoActiveDocument: (title, filePath, fileType, pages, pdfDocument, pdfPageInfos, pdfAnnotations) => {
    const state = get();
    const activeId = state.activeDocumentId;

    if (!activeId) return;

    set((prevState) => {
      const newDocuments = new Map(prevState.documents);
      const existingDoc = newDocuments.get(activeId);

      if (!existingDoc) return prevState;

      newDocuments.set(activeId, {
        ...existingDoc,
        title,
        filePath,
        fileType,
        isModified: false,
        lastAccessedAt: Date.now(),
        pages,
        currentPage: 0,
        currentLayerId: pages[0]?.layers[0]?.id || '',
        history: [],
        historyIndex: -1,
        pdfDocument,
        pdfPageInfos,
        pdfAnnotations,
        zoom: 1,
      });

      return { documents: newDocuments };
    });

    // メモリ管理
    get().unloadOldDocuments();
  },

  unloadOldDocuments: () => {
    const state = get();

    // アクティブドキュメント以外で、フルロードされているドキュメントを取得
    const loadedDocs = Array.from(state.documents.values())
      .filter((doc) => doc.id !== state.activeDocumentId && doc.pages.length > 0)
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

    // MAX_LOADED_DOCUMENTS - 1 を超える分をアンロード（アクティブは除く）
    if (loadedDocs.length >= MAX_LOADED_DOCUMENTS) {
      const toUnload = loadedDocs.slice(MAX_LOADED_DOCUMENTS - 1);

      set((prevState) => {
        const newDocuments = new Map(prevState.documents);

        toUnload.forEach((doc) => {
          // PDFリソースを解放
          if (doc.pdfDocument) {
            doc.pdfDocument.destroy();
          }

          // ページの背景画像をクリア（メタデータは保持）
          const lightweightPages = doc.pages.map((page) => ({
            ...page,
            backgroundImage: '',
          }));

          newDocuments.set(doc.id, {
            ...doc,
            pages: lightweightPages,
            pdfDocument: null,
          });
        });

        return { documents: newDocuments };
      });
    }
  },
}));
