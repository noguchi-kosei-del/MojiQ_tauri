import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  progress: number;
  message: string;
  setLoading: (isLoading: boolean, message?: string) => void;
  setMessage: (message: string) => void;
  setProgress: (progress: number) => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  progress: 0,
  message: '',
  setLoading: (isLoading, message = '') => set({ isLoading, message, progress: isLoading ? 0 : 0 }),
  setMessage: (message) => set({ message }),
  setProgress: (progress) => set({ progress }),
}));
