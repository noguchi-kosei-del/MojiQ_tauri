import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  progress: number;
  message: string;
  /** 圧縮処理中フラグ */
  isCompressing: boolean;
  /** 圧縮進捗 (0-100) */
  compressionProgress: number;
  /** 圧縮メッセージ */
  compressionMessage: string;
  setLoading: (isLoading: boolean, message?: string) => void;
  setMessage: (message: string) => void;
  setProgress: (progress: number) => void;
  /** 圧縮状態を設定 */
  setCompressing: (isCompressing: boolean, message?: string) => void;
  /** 圧縮進捗を設定 */
  setCompressionProgress: (progress: number) => void;
  /** 圧縮メッセージを設定 */
  setCompressionMessage: (message: string) => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  progress: 0,
  message: '',
  isCompressing: false,
  compressionProgress: 0,
  compressionMessage: '',
  setLoading: (isLoading, message = '') => set({ isLoading, message, progress: isLoading ? 0 : 0 }),
  setMessage: (message) => set({ message }),
  setProgress: (progress) => set({ progress }),
  setCompressing: (isCompressing, message = '') =>
    set({
      isCompressing,
      compressionMessage: message,
      compressionProgress: isCompressing ? 0 : 0,
    }),
  setCompressionProgress: (compressionProgress) => set({ compressionProgress }),
  setCompressionMessage: (compressionMessage) => set({ compressionMessage }),
}));
