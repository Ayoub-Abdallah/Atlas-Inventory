import type { ToastType } from '~/components/ui/Toast.vue';

interface ToastOptions {
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface Toast {
  add: (options: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  remove: (id: string) => void;
  clear: () => void;
  /**
   * Legacy helper — maps `showToast(message, type)` to the typed methods.
   * Keeps backward-compat with call sites that destructure `{ showToast }`.
   */
  showToast: (message: string, type?: ToastType | string) => string;
}

export function useToast(): Toast {
  // Try to get from injection first
  const injected = inject<Toast | null>('toast', null);

  // Resolve the base toast (injected → window fallback → no-op)
  let base: Omit<Toast, 'showToast'>;

  if (injected) {
    base = injected;
  } else if (import.meta.client && (window as any).$toast) {
    base = (window as any).$toast;
  } else {
    console.warn(
      'Toast system not initialized. Make sure UiToastContainer is in your app.'
    );
    base = {
      add: () => '',
      success: () => '',
      error: () => '',
      warning: () => '',
      info: () => '',
      remove: () => {},
      clear: () => {},
    };
  }

  // Build the legacy `showToast(message, type)` bridge
  function showToast(message: string, type?: ToastType | string): string {
    switch (type) {
      case 'error':
        return base.error(message);
      case 'warning':
        return base.warning(message);
      case 'info':
        return base.info(message);
      case 'success':
      default:
        return base.success(message);
    }
  }

  return { ...base, showToast };
}
