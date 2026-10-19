import type {
  CoursePriceDto,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  RazorpayCheckoutOptions,
  RefundState,
  RefundStatus,
} from '@asra/types';

/**
 * Display helpers and the Razorpay Checkout loader (PHASE 10, docs/PAYMENTS.md §5).
 *
 * The browser never computes a price or decides a payment outcome: amounts come from the API in
 * integer paise and are only FORMATTED here; Checkout's success callback is forwarded to the API
 * for verification and the UI shows success only when the API says the order is PAID.
 */

export const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** "₹1,499.00" (en-IN grouping). Unlike `formatMoney`, 0 is shown as an amount, not "Free". */
export function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100);
}

/** Price line for a course card: "₹899.10" (+ "₹999.00" struck through when discounted). */
export function priceParts(price: CoursePriceDto | null) {
  if (!price) return null;
  if (price.isFree) return { now: 'Free', was: null };
  return {
    now: formatAmount(price.amountMinor, price.currency),
    was: price.discountMinor > 0 ? formatAmount(price.listPriceMinor, price.currency) : null,
  };
}

type Tone = 'success' | 'warning' | 'info' | 'destructive' | 'secondary';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  CREATED: { label: 'Awaiting payment', tone: 'warning' },
  PENDING: { label: 'Awaiting payment', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  CANCELLED: { label: 'Replaced', tone: 'secondary' },
  EXPIRED: { label: 'Expired', tone: 'secondary' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  CREATED: { label: 'Started', tone: 'secondary' },
  AUTHORIZED: { label: 'Processing', tone: 'info' },
  CAPTURED: { label: 'Successful', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'destructive' },
};

export const REFUND_STATUS: Record<RefundStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'Requested', tone: 'info' },
  PENDING: { label: 'Processing', tone: 'info' },
  PROCESSED: { label: 'Refunded', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'destructive' },
};

export const REFUND_STATE_LABEL: Record<RefundState, string | null> = {
  NONE: null,
  PARTIAL: 'Partially refunded',
  FULL: 'Refunded',
};

export const MODE_LABEL: Record<PaymentMode, string> = { TEST: 'Test mode', LIVE: 'Live' };

export const METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  emi: 'EMI',
  paylater: 'Pay later',
};

// --- Razorpay Checkout ------------------------------------------------------------------------

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error: {
    code?: string;
    description?: string;
    reason?: string;
    metadata?: { payment_id?: string };
  };
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: RazorpayFailure) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

/** Loads Razorpay's official Checkout script once (from its own origin, as Razorpay requires). */
export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (typeof window === 'undefined')
    return Promise.reject(new Error('Checkout runs in the browser'));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Checkout did not load'));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(
        new Error('The payment window could not be loaded. Check your connection and try again.'),
      );
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Opens Checkout for a server-created order. Resolves with the outcome the browser saw — which
 * the caller must send to the API for verification (`success`) or treat as unconfirmed.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
  brandColor: string,
): Promise<
  | { kind: 'success'; response: RazorpaySuccess }
  | { kind: 'dismissed' }
  | { kind: 'failed'; message: string }
> {
  const Razorpay = await loadRazorpayCheckout();
  return new Promise((resolve) => {
    let failure: string | null = null;
    const instance = new Razorpay({
      key: options.keyId,
      order_id: options.providerOrderId,
      amount: options.amountMinor,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      notes: options.notes,
      theme: { color: brandColor },
      handler: (response: RazorpaySuccess) => resolve({ kind: 'success', response }),
      modal: {
        // Closing the window is NOT proof of failure: the provider may still confirm a payment.
        ondismiss: () =>
          resolve(failure ? { kind: 'failed', message: failure } : { kind: 'dismissed' }),
      },
    });
    instance.on('payment.failed', (response) => {
      // Checkout lets the student retry inside the window; remember the reason for the UI.
      failure = response.error.description ?? 'The payment did not go through.';
    });
    instance.open();
  });
}
