import { create } from 'zustand';

interface ModalOptions {
  title?: string;
  kind?: 'info' | 'warning' | 'error';
  okLabel?: string;
  cancelLabel?: string;
  confirmDanger?: boolean;
}

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  kind: 'info' | 'warning' | 'error';
  type: 'alert' | 'confirm';
  okLabel: string;
  cancelLabel: string;
  confirmDanger: boolean;
  resolve: ((value: boolean) => void) | null;

  showAlert: (message: string, options?: ModalOptions) => Promise<void>;
  showConfirm: (message: string, options?: ModalOptions) => Promise<boolean>;
  close: (result: boolean) => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  kind: 'info',
  type: 'alert',
  okLabel: 'OK',
  cancelLabel: 'キャンセル',
  confirmDanger: false,
  resolve: null,

  showAlert: (message, options = {}) => {
    return new Promise<void>((resolve) => {
      // 前のモーダルが開いている場合は先にクローズ
      const prev = get().resolve;
      if (prev) prev(false);

      set({
        isOpen: true,
        message,
        title: options.title || (options.kind === 'error' ? 'エラー' : options.kind === 'warning' ? '警告' : '情報'),
        kind: options.kind || 'info',
        type: 'alert',
        okLabel: options.okLabel || 'OK',
        cancelLabel: 'キャンセル',
        confirmDanger: false,
        resolve: () => resolve(),
      });
    });
  },

  showConfirm: (message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      const prev = get().resolve;
      if (prev) prev(false);

      set({
        isOpen: true,
        message,
        title: options.title || '確認',
        kind: options.kind || 'info',
        type: 'confirm',
        okLabel: options.okLabel || 'OK',
        cancelLabel: options.cancelLabel || 'キャンセル',
        confirmDanger: options.confirmDanger || false,
        resolve,
      });
    });
  },

  close: (result) => {
    const { resolve } = get();
    set({
      isOpen: false,
      resolve: null,
    });
    if (resolve) resolve(result);
  },
}));
