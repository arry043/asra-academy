import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CoursePriceDto } from '@asra/types';

import { loginHref } from '@/lib/auth/return-to';
import {
  formatAmount,
  ORDER_STATUS,
  PAYMENT_STATUS,
  priceParts,
  RAZORPAY_CHECKOUT_SRC,
} from '@/lib/payments';

const price = (overrides: Partial<CoursePriceDto> = {}): CoursePriceDto => ({
  currency: 'INR',
  listPriceMinor: 99_900,
  discountType: 'PERCENTAGE',
  discountValue: 10,
  discountMinor: 9_990,
  amountMinor: 89_910,
  isFree: false,
  payable: true,
  notPayableReason: null,
  ...overrides,
});

describe('payment display helpers (PHASE 10)', () => {
  it('formats integer paise as Indian rupees without rounding errors', () => {
    assert.equal(formatAmount(89_910, 'INR'), '₹899.10');
    assert.equal(formatAmount(1_00_00_000, 'INR'), '₹1,00,000.00');
    assert.equal(formatAmount(0, 'INR'), '₹0.00');
  });

  it('shows the server price and the struck-through list price only when discounted', () => {
    assert.deepEqual(priceParts(price()), { now: '₹899.10', was: '₹999.00' });
    assert.deepEqual(priceParts(price({ discountMinor: 0, amountMinor: 99_900 })), {
      now: '₹999.00',
      was: null,
    });
    assert.deepEqual(priceParts(price({ isFree: true })), { now: 'Free', was: null });
    assert.equal(priceParts(null), null);
  });

  it('never labels an unpaid order or attempt as successful', () => {
    for (const status of ['CREATED', 'PENDING', 'CANCELLED', 'EXPIRED'] as const) {
      assert.notEqual(ORDER_STATUS[status].tone, 'success');
    }
    for (const status of ['CREATED', 'AUTHORIZED', 'FAILED'] as const) {
      assert.notEqual(PAYMENT_STATUS[status].tone, 'success');
    }
  });

  it('loads Checkout only from Razorpay’s official origin', () => {
    assert.equal(new URL(RAZORPAY_CHECKOUT_SRC).origin, 'https://checkout.razorpay.com');
  });

  it('keeps only same-site return paths through sign-in (no open redirects)', () => {
    assert.equal(
      loginHref('/student/checkout/maths-10'),
      '/login?next=%2Fstudent%2Fcheckout%2Fmaths-10',
    );
    for (const unsafe of ['https://evil.example', '//evil.example', '/\\evil.example', '', null]) {
      assert.equal(loginHref(unsafe), '/login');
    }
  });
});
