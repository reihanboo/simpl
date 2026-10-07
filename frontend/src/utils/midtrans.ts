export interface MidtransPaymentCallbacks {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
}

export interface MidtransSnap {
  pay: (token: string, callbacks: MidtransPaymentCallbacks) => void;
}

declare global {
  interface Window {
    snap?: MidtransSnap;
  }
}

let snapPromise: Promise<MidtransSnap> | null = null;

export function loadMidtransSnap(): Promise<MidtransSnap> {
  if (window.snap) return Promise.resolve(window.snap);
  if (snapPromise) return snapPromise;

  const script = document.createElement('script');
  script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
  script.async = true;
  script.dataset.clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '';

  snapPromise = new Promise<MidtransSnap>((resolve, reject) => {
    script.onload = () => {
      if (window.snap) {
        resolve(window.snap);
      } else {
        reject(new Error('Midtrans Snap did not initialize.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Midtrans Snap.'));
    document.head.appendChild(script);
  });

  void snapPromise.catch(() => {
    snapPromise = null;
    script.remove();
  });

  return snapPromise;
}
