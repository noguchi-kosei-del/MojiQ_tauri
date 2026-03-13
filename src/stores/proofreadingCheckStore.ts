import { create } from 'zustand';
import { ProofreadingCheckData, ProofreadingCheckItem } from '../types';

export type ProofreadingTabType = 'comments' | 'correctness' | 'proposal';

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
