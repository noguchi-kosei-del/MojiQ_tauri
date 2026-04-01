import { create } from 'zustand';
import { ProofreadingCheckData, ProofreadingCheckItem } from '../types';

export type ProofreadingTabType = 'comments' | 'correctness' | 'proposal';

/** チェック済み状態（永続化対象） */
export interface CheckedState {
  checkedComments: number[];           // チェック済みコメントインデックス
  checkedCorrectnessItems: string[];   // チェック済み正誤アイテムID
  checkedProposalItems: string[];      // チェック済み提案アイテムID
}

interface ProofreadingCheckState {
  // Modal state
  isModalOpen: boolean;

  // Path state
  basePath: string;
  currentPath: string;
  navigationStack: string[];

  // Data state
  currentData: ProofreadingCheckData | null;
  currentFileName: string;
  allItems: ProofreadingCheckItem[];
  currentTab: ProofreadingTabType;

  // チェック済み状態（永続化対象）
  checkedComments: Set<number>;
  checkedCorrectnessItems: Set<string>;
  checkedProposalItems: Set<string>;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

interface ProofreadingCheckActions {
  // Modal control
  openModal: () => void;
  closeModal: () => void;

  // Path navigation
  setBasePath: (path: string) => void;
  navigateToFolder: (path: string) => void;
  goBack: () => void;
  goToRoot: () => void;

  // Data management
  setCurrentData: (data: ProofreadingCheckData | null, fileName?: string) => void;
  setCurrentTab: (tab: ProofreadingTabType) => void;
  clearData: () => void;

  // チェック済み状態の操作
  toggleCheckedComment: (index: number) => boolean; // returns new checked state
  toggleCheckedCorrectnessItem: (itemId: string) => void;
  toggleCheckedProposalItem: (itemId: string) => void;
  toggleCheckedCorrectnessCategory: (itemIds: string[], checked: boolean) => void;
  toggleCheckedProposalCategory: (itemIds: string[], checked: boolean) => void;
  resetCheckedState: () => void;
  getCheckedState: () => CheckedState;
  restoreCheckedState: (state: CheckedState) => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Utility
  getFilteredItems: () => ProofreadingCheckItem[];
  hasCorrectnessItems: () => boolean;
  hasProposalItems: () => boolean;
}

export const useProofreadingCheckStore = create<ProofreadingCheckState & ProofreadingCheckActions>()(
  (set, get) => ({
    // Initial state
    isModalOpen: false,
    basePath: '',
    currentPath: '',
    navigationStack: [],
    currentData: null,
    currentFileName: '',
    allItems: [],
    currentTab: 'correctness',
    checkedComments: new Set(),
    checkedCorrectnessItems: new Set(),
    checkedProposalItems: new Set(),
    isLoading: false,
    error: null,

    // Actions
    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({
      isModalOpen: false,
      // データはクリアしない（パネルに表示し続けるため）
      error: null,
    }),

    setBasePath: (path) => set({
      basePath: path,
      currentPath: path,
      navigationStack: [],
    }),

    navigateToFolder: (path) => {
      const { currentPath, navigationStack } = get();
      set({
        navigationStack: [...navigationStack, currentPath],
        currentPath: path,
        currentData: null,
        currentFileName: '',
        allItems: [],
      });
    },

    goBack: () => {
      const { navigationStack, basePath } = get();
      if (navigationStack.length > 0) {
        const newStack = [...navigationStack];
        const prevPath = newStack.pop()!;
        set({
          navigationStack: newStack,
          currentPath: prevPath,
          currentData: null,
          currentFileName: '',
          allItems: [],
        });
      } else {
        set({ currentPath: basePath });
      }
    },

    goToRoot: () => {
      const { basePath } = get();
      set({
        navigationStack: [],
        currentPath: basePath,
        currentData: null,
        currentFileName: '',
        allItems: [],
      });
    },

    setCurrentData: (data, fileName = '') => {
      // Merge items from variation and simple (picked関係なくすべて表示)
      const items: ProofreadingCheckItem[] = [];
      if (data?.checks?.variation?.items) {
        items.push(...data.checks.variation.items);
      }
      if (data?.checks?.simple?.items) {
        items.push(...data.checks.simple.items);
      }

      // Determine default tab based on available items
      const hasCorrectness = items.some(i => i.checkKind === 'correctness');
      const hasProposal = items.some(i => i.checkKind === 'proposal');
      let defaultTab: ProofreadingTabType = 'correctness';
      if (hasCorrectness) {
        defaultTab = 'correctness';
      } else if (hasProposal) {
        defaultTab = 'proposal';
      }

      set({
        currentData: data,
        currentFileName: fileName,
        allItems: items,
        currentTab: defaultTab,
      });
    },

    setCurrentTab: (tab) => set({ currentTab: tab }),

    clearData: () => set({
      currentData: null,
      currentFileName: '',
      allItems: [],
      currentTab: 'correctness',
    }),

    // チェック済み状態の操作
    toggleCheckedComment: (index) => {
      const { checkedComments } = get();
      const next = new Set(checkedComments);
      const isNowChecked = !next.has(index);
      if (isNowChecked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      set({ checkedComments: next });
      return isNowChecked;
    },

    toggleCheckedCorrectnessItem: (itemId) => {
      const { checkedCorrectnessItems } = get();
      const next = new Set(checkedCorrectnessItems);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      set({ checkedCorrectnessItems: next });
    },

    toggleCheckedProposalItem: (itemId) => {
      const { checkedProposalItems } = get();
      const next = new Set(checkedProposalItems);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      set({ checkedProposalItems: next });
    },

    toggleCheckedCorrectnessCategory: (itemIds, checked) => {
      const { checkedCorrectnessItems } = get();
      const next = new Set(checkedCorrectnessItems);
      itemIds.forEach(id => { if (checked) next.add(id); else next.delete(id); });
      set({ checkedCorrectnessItems: next });
    },

    toggleCheckedProposalCategory: (itemIds, checked) => {
      const { checkedProposalItems } = get();
      const next = new Set(checkedProposalItems);
      itemIds.forEach(id => { if (checked) next.add(id); else next.delete(id); });
      set({ checkedProposalItems: next });
    },

    resetCheckedState: () => set({
      checkedComments: new Set(),
      checkedCorrectnessItems: new Set(),
      checkedProposalItems: new Set(),
    }),

    getCheckedState: () => {
      const { checkedComments, checkedCorrectnessItems, checkedProposalItems } = get();
      return {
        checkedComments: Array.from(checkedComments),
        checkedCorrectnessItems: Array.from(checkedCorrectnessItems),
        checkedProposalItems: Array.from(checkedProposalItems),
      };
    },

    restoreCheckedState: (state) => set({
      checkedComments: new Set(state.checkedComments),
      checkedCorrectnessItems: new Set(state.checkedCorrectnessItems),
      checkedProposalItems: new Set(state.checkedProposalItems),
    }),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    getFilteredItems: () => {
      const { allItems, currentTab } = get();
      if (currentTab === 'comments') {
        return []; // Comments tab shows PDF annotations, not check items
      }
      return allItems.filter(item => item.checkKind === currentTab);
    },

    hasCorrectnessItems: () => {
      const { allItems } = get();
      return allItems.some(i => i.checkKind === 'correctness');
    },

    hasProposalItems: () => {
      const { allItems } = get();
      return allItems.some(i => i.checkKind === 'proposal');
    },
  })
);
