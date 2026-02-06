import { create } from 'zustand';

// 見開きのマッピング情報
export interface SpreadMapping {
  spreadIndex: number;
  leftPage: number | null;  // null = 空白ページ
  rightPage: number | null; // null = 空白ページ
}

// 綴じ方向
export type BindingDirection = 'right' | 'left';

interface SpreadViewState {
  // 見開きモードかどうか
  isSpreadView: boolean;
  // 綴じ方向（右綴じ / 左綴じ）
  bindingDirection: BindingDirection;
  // 現在表示中の見開きインデックス
  currentSpreadIndex: number;
  // 見開きマッピング
  spreadMapping: SpreadMapping[];
  // 総見開き数
  totalSpreads: number;
}

interface SpreadViewActions {
  // 見開きモードを有効にする
  enableSpreadView: (totalPages: number) => void;
  // 見開きモードを無効にする
  disableSpreadView: () => void;
  // 綴じ方向を設定
  setBindingDirection: (direction: BindingDirection) => void;
  // 現在の見開きインデックスを設定
  setCurrentSpreadIndex: (index: number) => void;
  // ページ番号から見開きインデックスを取得
  getSpreadIndexForPage: (pageNumber: number) => number;
  // 見開きインデックスからページ番号のペアを取得
  getPagesForSpread: (spreadIndex: number) => { leftPage: number | null; rightPage: number | null };
  // 次の見開きに移動
  nextSpread: () => void;
  // 前の見開きに移動
  prevSpread: () => void;
  // 見開きマッピングを再生成
  regenerateMapping: (totalPages: number) => void;
}

type SpreadViewStore = SpreadViewState & SpreadViewActions;

/**
 * 見開きマッピングを生成する
 * 右綴じ（日本の漫画等）: 右から左に読む
 *   - 1ページ目は左側に表示、右側は白紙
 *   - 見開きでは [左=奇数, 右=偶数] の並び
 *   - 例: [1, 白紙], [3, 2], [5, 4], ...
 * 左綴じ（洋書等）: 左から右に読む
 *   - 1ページ目は右側に表示、左側は白紙
 *   - 見開きでは [左=偶数, 右=奇数] の並び
 *   - 例: [白紙, 1], [2, 3], [4, 5], ...
 */
const generateSpreadMapping = (totalPages: number, bindingDirection: BindingDirection): SpreadMapping[] => {
  const mapping: SpreadMapping[] = [];

  if (totalPages === 0) {
    return mapping;
  }

  if (bindingDirection === 'right') {
    // 右綴じ: 1ページ目は左側、右側は白紙
    // 見開き0: [左=1, 右=null]
    // 見開き1: [左=3, 右=2]
    // 見開き2: [左=5, 右=4]
    mapping.push({
      spreadIndex: 0,
      leftPage: 1,
      rightPage: null,
    });

    let pageNum = 2;
    let spreadIndex = 1;
    while (pageNum <= totalPages) {
      // 右綴じ: 左に大きい番号(奇数)、右に小さい番号(偶数)
      const leftP = pageNum + 1 <= totalPages ? pageNum + 1 : null;
      const rightP = pageNum;
      mapping.push({
        spreadIndex,
        leftPage: leftP,
        rightPage: rightP,
      });
      pageNum += 2;
      spreadIndex++;
    }
  } else {
    // 左綴じ: 1ページ目は右側、左側は白紙
    // 見開き0: [左=null, 右=1]
    // 見開き1: [左=2, 右=3]
    // 見開き2: [左=4, 右=5]
    mapping.push({
      spreadIndex: 0,
      leftPage: null,
      rightPage: 1,
    });

    let pageNum = 2;
    let spreadIndex = 1;
    while (pageNum <= totalPages) {
      mapping.push({
        spreadIndex,
        leftPage: pageNum,
        rightPage: pageNum + 1 <= totalPages ? pageNum + 1 : null,
      });
      pageNum += 2;
      spreadIndex++;
    }
  }

  return mapping;
};

export const useSpreadViewStore = create<SpreadViewStore>((set, get) => ({
  // 初期状態
  isSpreadView: false,
  bindingDirection: 'right',
  currentSpreadIndex: 0,
  spreadMapping: [],
  totalSpreads: 0,

  // 見開きモードを有効にする
  enableSpreadView: (totalPages: number) => {
    const { bindingDirection } = get();
    const mapping = generateSpreadMapping(totalPages, bindingDirection);
    set({
      isSpreadView: true,
      spreadMapping: mapping,
      totalSpreads: mapping.length,
      currentSpreadIndex: 0,
    });
  },

  // 見開きモードを無効にする
  disableSpreadView: () => {
    set({
      isSpreadView: false,
      spreadMapping: [],
      totalSpreads: 0,
      currentSpreadIndex: 0,
    });
  },

  // 綴じ方向を設定
  setBindingDirection: (direction: BindingDirection) => {
    const { isSpreadView, spreadMapping } = get();
    set({ bindingDirection: direction });

    // 見開きモード中なら再生成
    if (isSpreadView && spreadMapping.length > 0) {
      // 現在のページ数を計算
      let maxPage = 0;
      for (const spread of spreadMapping) {
        if (spread.leftPage && spread.leftPage > maxPage) maxPage = spread.leftPage;
        if (spread.rightPage && spread.rightPage > maxPage) maxPage = spread.rightPage;
      }
      get().regenerateMapping(maxPage);
    }
  },

  // 現在の見開きインデックスを設定
  setCurrentSpreadIndex: (index: number) => {
    const { totalSpreads } = get();
    if (index >= 0 && index < totalSpreads) {
      set({ currentSpreadIndex: index });
    }
  },

  // ページ番号から見開きインデックスを取得
  getSpreadIndexForPage: (pageNumber: number) => {
    const { spreadMapping } = get();
    for (const spread of spreadMapping) {
      if (spread.leftPage === pageNumber || spread.rightPage === pageNumber) {
        return spread.spreadIndex;
      }
    }
    return 0;
  },

  // 見開きインデックスからページ番号のペアを取得
  getPagesForSpread: (spreadIndex: number) => {
    const { spreadMapping } = get();
    const spread = spreadMapping.find(s => s.spreadIndex === spreadIndex);
    if (spread) {
      return { leftPage: spread.leftPage, rightPage: spread.rightPage };
    }
    return { leftPage: null, rightPage: null };
  },

  // 次の見開きに移動
  nextSpread: () => {
    const { currentSpreadIndex, totalSpreads, bindingDirection } = get();
    // 右綴じの場合は逆方向
    if (bindingDirection === 'right') {
      if (currentSpreadIndex > 0) {
        set({ currentSpreadIndex: currentSpreadIndex - 1 });
      }
    } else {
      if (currentSpreadIndex < totalSpreads - 1) {
        set({ currentSpreadIndex: currentSpreadIndex + 1 });
      }
    }
  },

  // 前の見開きに移動
  prevSpread: () => {
    const { currentSpreadIndex, totalSpreads, bindingDirection } = get();
    // 右綴じの場合は逆方向
    if (bindingDirection === 'right') {
      if (currentSpreadIndex < totalSpreads - 1) {
        set({ currentSpreadIndex: currentSpreadIndex + 1 });
      }
    } else {
      if (currentSpreadIndex > 0) {
        set({ currentSpreadIndex: currentSpreadIndex - 1 });
      }
    }
  },

  // 見開きマッピングを再生成
  regenerateMapping: (totalPages: number) => {
    const { bindingDirection, currentSpreadIndex } = get();
    const mapping = generateSpreadMapping(totalPages, bindingDirection);
    const newTotalSpreads = mapping.length;

    // 現在のインデックスが範囲外にならないように調整
    const newIndex = Math.min(currentSpreadIndex, newTotalSpreads - 1);

    set({
      spreadMapping: mapping,
      totalSpreads: newTotalSpreads,
      currentSpreadIndex: Math.max(0, newIndex),
    });
  },
}));
