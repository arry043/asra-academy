import type { CoursePriceDto, NotPayableReason } from '@asra/types';
import { MIN_PAYMENT_MINOR } from '@asra/validation';

/**
 * The single price calculation (docs/PAYMENTS.md §4). Integer minor units only — no floating
 * point touches an amount. The request never supplies any input to it: price, currency and
 * discount are read from the course row on the server, and the result is frozen on the order.
 *
 * Course-level discount (the only discount the platform stores; no coupon engine exists, M-06):
 *   PERCENTAGE p (1–100):  discount = ⌊price × p / 100⌋  (rounded DOWN, so it never exceeds p %)
 *   FIXED_AMOUNT v:        discount = min(v, price)
 *   payable = price − discount
 *
 * A course is payable online only when: price set, INR (M-03), payable ≥ ₹1 (Razorpay minimum).
 * A paid course discounted to 0 is NOT silently turned into a free enrolment (pending M-06/M-08).
 */

export const SUPPORTED_CURRENCIES = new Set(['INR']);

export interface PricingInput {
  priceMinor: number | null;
  currency: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null;
  discountValue: number | null;
}

export function priceCourse(course: PricingInput): CoursePriceDto | null {
  if (course.priceMinor === null) return null;
  const listPriceMinor = course.priceMinor;
  const currency = course.currency ?? 'INR';
  const base = {
    currency,
    listPriceMinor,
    discountType: course.discountType,
    discountValue: course.discountValue,
  };
  const notPayable = (reason: NotPayableReason, discountMinor = 0): CoursePriceDto => ({
    ...base,
    discountMinor,
    amountMinor: listPriceMinor - discountMinor,
    isFree: reason === 'FREE',
    payable: false,
    notPayableReason: reason,
  });

  if (!Number.isSafeInteger(listPriceMinor) || listPriceMinor < 0)
    return notPayable('INVALID_PRICE');
  if (listPriceMinor === 0) return notPayable('FREE');

  let discountMinor = 0;
  if (course.discountType !== null || course.discountValue !== null) {
    const value = course.discountValue;
    if (
      course.discountType === null ||
      value === null ||
      !Number.isSafeInteger(value) ||
      value < 1
    ) {
      return notPayable('INVALID_PRICE');
    }
    if (course.discountType === 'PERCENTAGE') {
      if (value > 100) return notPayable('INVALID_PRICE');
      discountMinor = Math.floor((listPriceMinor * value) / 100);
    } else {
      discountMinor = Math.min(value, listPriceMinor);
    }
  }
  const amountMinor = listPriceMinor - discountMinor;

  if (!SUPPORTED_CURRENCIES.has(currency)) return notPayable('UNSUPPORTED_CURRENCY', discountMinor);
  if (amountMinor === 0) return notPayable('ZERO_AFTER_DISCOUNT', discountMinor);
  if (amountMinor < MIN_PAYMENT_MINOR) return notPayable('BELOW_MINIMUM', discountMinor);

  return {
    ...base,
    discountMinor,
    amountMinor,
    isFree: false,
    payable: true,
    notPayableReason: null,
  };
}

export const NOT_PAYABLE_MESSAGES: Record<NotPayableReason, string> = {
  UNPRICED: 'The academy has not set a price for this course yet. Please contact the academy.',
  FREE: 'This course is free.',
  ZERO_AFTER_DISCOUNT:
    'This course is fully discounted. Please contact the academy to complete your enrolment.',
  BELOW_MINIMUM: 'This price cannot be paid online. Please contact the academy.',
  UNSUPPORTED_CURRENCY:
    'Online payment is only available in Indian Rupees. Please contact the academy.',
  INVALID_PRICE: 'This course cannot be bought online right now. Please contact the academy.',
};
