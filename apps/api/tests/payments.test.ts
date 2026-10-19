/**
 * PHASE 10 — Enrolment & payment through the real HTTP API and database. Razorpay is replaced
 * by the in-memory FakeRazorpay (tests/support/razorpay-fake.ts): no network, no credentials,
 * no real charges or refunds. Signatures are real HMACs with test-only secrets.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import type {
  AdminOrderDetail,
  AdminPaymentListItem,
  AdminRefundDto,
  CheckoutQuoteDto,
  CheckoutSessionDto,
  Paginated,
  PaymentReceiptDto,
  PaymentSummaryDto,
  StudentCourseOverview,
  StudentOrderDto,
} from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { setEmailTransport } from '../src/email/email.service.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { setPaymentAccountsForTests } from '../src/modules/payments/config.js';
import { sweepPayments } from '../src/modules/payments/worker.js';
import {
  login,
  outbox,
  provision,
  registerVerifiedStudent,
  resetAuthState,
} from './support/auth.js';
import {
  apiAs,
  createPublishableCourse,
  expectStatus,
  tokenFor,
  type Api,
} from './support/catalog.js';
import { startServer, TestClient } from './support/http.js';
import { FakeRazorpay } from './support/razorpay-fake.js';

const TEST_KEY = {
  keyId: 'rzp_test_FakeKey000001',
  keySecret: 'test-key-secret-never-real',
  webhookSecret: 'test-webhook-secret',
};
const LIVE_KEY = {
  keyId: 'rzp_live_FakeKey000001',
  keySecret: 'live-key-secret-never-real',
  webhookSecret: 'live-webhook-secret',
};

let baseUrl: string;
let close: () => Promise<void>;
let admin: Api;
let rzp: FakeRazorpay;

function useAccounts(options: {
  activeMode: 'TEST' | 'LIVE' | null;
  live?: FakeRazorpay;
  test?: FakeRazorpay | null;
}) {
  setPaymentAccountsForTests({
    activeMode: options.activeMode,
    accounts: {
      ...(options.test === null ? {} : { TEST: { ...TEST_KEY, gateway: options.test ?? rzp } }),
      ...(options.live ? { LIVE: { ...LIVE_KEY, gateway: options.live } } : {}),
    },
  });
}

before(async () => {
  ({ baseUrl, close } = await startServer(createApp()));
});
after(async () => {
  setPaymentAccountsForTests(null);
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});
beforeEach(async () => {
  await resetAuthState();
  rzp = new FakeRazorpay('TEST', TEST_KEY.keyId, TEST_KEY.keySecret, TEST_KEY.webhookSecret);
  useAccounts({ activeMode: 'TEST' });
  const client = new TestClient(baseUrl);
  admin = apiAs(client, await tokenFor(client, 'ADMIN'));
});

async function newStudent() {
  const client = new TestClient(baseUrl);
  const email = await registerVerifiedStudent(client);
  const session = await login(client, email);
  return { api: apiAs(client, session.accessToken), userId: session.user.id, email };
}

async function superAdmin(): Promise<Api> {
  const client = new TestClient(baseUrl);
  const user = await provision('SUPER_ADMIN');
  return apiAs(client, (await login(client, user.email)).accessToken);
}

/** Published course; default ₹999.00 with 10 % off (payable ₹899.10). */
async function paidCourse(overrides: Record<string, unknown> = {}) {
  const ids = await createPublishableCourse(admin, {
    priceMinor: 99_900,
    currency: 'INR',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    ...overrides,
  });
  expectStatus(await admin('POST', `/admin/courses/${ids.courseId}/publish`), 200);
  return ids;
}

async function checkout(student: Api, courseId: string) {
  const response = await student<CheckoutSessionDto>('POST', '/student/orders', { courseId });
  expectStatus(response, 201);
  return response.body.data;
}

async function postWebhook(
  hook: { body: string; signature?: string },
  options: { mode?: string; eventId?: string } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (hook.signature) headers['x-razorpay-signature'] = hook.signature;
  headers['x-razorpay-event-id'] = options.eventId ?? `evt_${randomUUID()}`;
  const response = await fetch(
    `${baseUrl}/api/v1/payments/webhooks/razorpay/${options.mode ?? 'test'}`,
    {
      method: 'POST',
      headers,
      body: hook.body,
    },
  );
  return {
    status: response.status,
    body: (await response.json()) as { data?: { duplicate?: boolean } },
  };
}

const confirmations = () => outbox().filter((m) => m.template === 'payment-confirmation');
const counts = async () => ({
  payments: await prisma.payment.count(),
  enrollments: await prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
  paidOrders: await prisma.order.count({ where: { status: 'PAID' } }),
});

describe('pricing, eligibility and order creation', () => {
  it('quotes and creates an order at the server price, ignoring any client-supplied amount', async () => {
    const course = await paidCourse();
    const { api: student, userId } = await newStudent();

    const overview = await student<StudentCourseOverview>(
      'GET',
      `/student/courses/${course.courseId}`,
    );
    assert.equal(overview.body.data.access, 'PURCHASE');
    assert.equal(overview.body.data.price?.amountMinor, 89_910);

    const quote = await student<CheckoutQuoteDto>('GET', `/student/checkout/${course.slug}`);
    expectStatus(quote, 200);
    assert.equal(quote.body.data.availability, 'PURCHASE');
    assert.equal(quote.body.data.mode, 'TEST');
    assert.deepEqual(
      [
        quote.body.data.price?.listPriceMinor,
        quote.body.data.price?.discountMinor,
        quote.body.data.price?.amountMinor,
      ],
      [99_900, 9_990, 89_910],
    );

    // Strict body: an amount, currency or status can never be posted.
    for (const extra of [
      { amountMinor: 100 },
      { currency: 'USD' },
      { userId },
      { status: 'PAID' },
    ]) {
      expectStatus(
        await student('POST', '/student/orders', { courseId: course.courseId, ...extra }),
        422,
      );
    }

    const session = await checkout(student, course.courseId);
    assert.equal(session.checkout.amountMinor, 89_910);
    assert.equal(session.checkout.currency, 'INR');
    assert.equal(session.checkout.keyId, TEST_KEY.keyId);
    assert.equal(session.order.status, 'PENDING');
    assert.equal(session.order.nextStep, 'PAY');
    assert.ok(!JSON.stringify(session).includes(TEST_KEY.keySecret));
    assert.ok(!JSON.stringify(session).includes(TEST_KEY.webhookSecret));

    const providerOrder = rzp.orders.get(session.checkout.providerOrderId)!;
    assert.equal(providerOrder.amountMinor, 89_910);
    assert.equal(providerOrder.receipt, session.order.reference);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: session.order.id } });
    assert.equal(row.mode, 'TEST');
    assert.equal(row.providerOrderId, session.checkout.providerOrderId);
    assert.equal(row.providerKeyId, TEST_KEY.keyId);
    assert.equal(row.userId, userId);

    // The snapshot is kept when the course price changes later.
    expectStatus(
      await admin('PATCH', `/admin/courses/${course.courseId}`, { priceMinor: 199_900 }),
      200,
    );
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: row.id } })).amountMinor,
      89_910,
    );
  });

  it('applies a fixed discount and refuses a course discounted to zero', async () => {
    const fixed = await paidCourse({ discountType: 'FIXED_AMOUNT', discountValue: 50_000 });
    const zero = await paidCourse({ discountType: 'PERCENTAGE', discountValue: 100 });
    const { api: student } = await newStudent();
    assert.equal((await checkout(student, fixed.courseId)).checkout.amountMinor, 49_900);

    const quote = await student<CheckoutQuoteDto>('GET', `/student/checkout/${zero.slug}`);
    assert.equal(quote.body.data.availability, 'NOT_PAYABLE');
    assert.equal(quote.body.data.price?.notPayableReason, 'ZERO_AFTER_DISCOUNT');
    expectStatus(await student('POST', '/student/orders', { courseId: zero.courseId }), 403);
    expectStatus(await student('POST', `/student/courses/${zero.courseId}/enroll`), 403);
    assert.equal(await prisma.order.count({ where: { courseId: zero.courseId } }), 0);
  });

  it('refuses unpublished, private, unpriced and free courses without creating chargeable orders', async () => {
    const draft = await createPublishableCourse(admin, { priceMinor: 50_000, currency: 'INR' });
    const privateCourse = await paidCourse({ visibility: 'PRIVATE' });
    const unpriced = await paidCourse({
      priceMinor: null,
      currency: null,
      discountType: null,
      discountValue: null,
    });
    const free = await paidCourse({ priceMinor: 0, discountType: null, discountValue: null });
    const { api: student, userId } = await newStudent();

    expectStatus(await student('POST', '/student/orders', { courseId: draft.courseId }), 404);
    expectStatus(await student('GET', `/student/checkout/${draft.slug}`), 404);
    expectStatus(
      await student('POST', '/student/orders', { courseId: privateCourse.courseId }),
      404,
    );
    expectStatus(await student('POST', '/student/orders', { courseId: unpriced.courseId }), 403);
    const freeOrder = await student('POST', '/student/orders', { courseId: free.courseId });
    expectStatus(freeOrder, 409);
    assert.deepEqual(freeOrder.body.error?.details, { reason: 'FREE_COURSE' });

    // Free enrolment works without any order or payment.
    expectStatus(await student('POST', `/student/courses/${free.courseId}/enroll`), 201);
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { userId, courseId: free.courseId },
    });
    assert.equal(enrollment.source, 'FREE');
    assert.equal(enrollment.orderId, null);
    assert.equal(await prisma.order.count(), 0);
    assert.equal(await prisma.payment.count(), 0);
    assert.equal(rzp.count('createOrder'), 0);
  });

  it('disables checkout safely when Razorpay is not configured (no fake success)', async () => {
    const course = await paidCourse();
    useAccounts({ activeMode: null });
    const { api: student } = await newStudent();
    const quote = await student<CheckoutQuoteDto>('GET', `/student/checkout/${course.slug}`);
    assert.equal(quote.body.data.availability, 'PAYMENTS_DISABLED');
    assert.equal(quote.body.data.mode, null);
    const overview = await student<StudentCourseOverview>(
      'GET',
      `/student/courses/${course.courseId}`,
    );
    assert.equal(overview.body.data.access, 'CONTACT_ACADEMY');
    expectStatus(await student('POST', '/student/orders', { courseId: course.courseId }), 503);
    const features = await student<{ payments: { available: boolean } }>(
      'GET',
      '/student/features',
    );
    assert.equal(features.body.data.payments.available, false);
    assert.equal(await prisma.order.count(), 0);
  });

  it('resolves concurrent checkouts (two tabs) to one open order', async () => {
    const course = await paidCourse();
    const { api: student, userId } = await newStudent();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        student<CheckoutSessionDto>('POST', '/student/orders', { courseId: course.courseId }),
      ),
    );
    responses.forEach((response) => expectStatus(response, 201));
    assert.equal(new Set(responses.map((r) => r.body.data.order.id)).size, 1);
    assert.equal(new Set(responses.map((r) => r.body.data.checkout.providerOrderId)).size, 1);
    assert.equal(
      await prisma.order.count({ where: { userId, status: { in: ['CREATED', 'PENDING'] } } }),
      1,
    );

    // Resuming later returns the same order.
    const again = await checkout(student, course.courseId);
    assert.equal(again.order.id, responses[0]!.body.data.order.id);
  });

  it('recovers from a provider failure during order creation without duplicating the order', async () => {
    const course = await paidCourse();
    const { api: student } = await newStudent();
    rzp.failNext('createOrder', 'TIMEOUT');
    expectStatus(await student('POST', '/student/orders', { courseId: course.courseId }), 503);
    const pending = await prisma.order.findFirstOrThrow({ where: { courseId: course.courseId } });
    assert.equal(pending.status, 'CREATED');
    assert.equal(pending.providerOrderId, null);

    const session = await checkout(student, course.courseId);
    assert.equal(session.order.id, pending.id);
    assert.equal(await prisma.order.count(), 1);
  });

  it('does not charge an already-enrolled student again', async () => {
    const course = await paidCourse();
    const { api: student, email } = await newStudent();
    expectStatus(
      await admin('POST', `/admin/courses/${course.courseId}/enrollments`, { email }),
      201,
    );
    const response = await student('POST', '/student/orders', { courseId: course.courseId });
    expectStatus(response, 409);
    assert.deepEqual(response.body.error?.details, { reason: 'ALREADY_ENROLLED' });
    const quote = await student<CheckoutQuoteDto>('GET', `/student/checkout/${course.slug}`);
    assert.equal(quote.body.data.availability, 'ENROLLED');
    assert.equal(await prisma.order.count(), 0);
  });
});

describe('payment verification and enrolment activation', () => {
  it('activates the enrolment only after verified, captured payment — exactly once', async () => {
    const course = await paidCourse();
    const student = await newStudent();
    const other = await newStudent();
    const session = await checkout(student.api, course.courseId);

    // Pending: no access yet.
    expectStatus(await student.api('GET', `/student/courses/${course.courseId}/curriculum`), 403);

    const { payment, signature } = rzp.pay(session.checkout.providerOrderId);
    const body = {
      razorpayOrderId: session.checkout.providerOrderId,
      razorpayPaymentId: payment.id,
      razorpaySignature: signature,
    };
    // Another student can neither verify nor read this order.
    expectStatus(await other.api('POST', `/student/orders/${session.order.id}/verify`, body), 404);
    expectStatus(await other.api('GET', `/student/orders/${session.order.id}`), 404);

    const verified = await student.api<StudentOrderDto>(
      'POST',
      `/student/orders/${session.order.id}/verify`,
      body,
    );
    expectStatus(verified, 200);
    assert.equal(verified.body.data.status, 'PAID');
    assert.equal(verified.body.data.enrollmentActive, true);
    assert.equal(verified.body.data.nextStep, 'OPEN_COURSE');
    assert.equal(verified.body.data.receiptAvailable, true);
    expectStatus(await student.api('GET', `/student/courses/${course.courseId}/curriculum`), 200);

    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { userId: student.userId, courseId: course.courseId },
    });
    assert.equal(enrollment.source, 'PAYMENT');
    assert.equal(enrollment.orderId, session.order.id);
    const row = await prisma.payment.findFirstOrThrow({ where: { providerPaymentId: payment.id } });
    assert.equal(row.status, 'CAPTURED');
    assert.ok(row.signatureVerifiedAt && row.appliedAt);

    // Duplicate callbacks change nothing and send no second email.
    const before = await counts();
    await Promise.all(
      [1, 2, 3].map(() => student.api('POST', `/student/orders/${session.order.id}/verify`, body)),
    );
    assert.deepEqual(await counts(), before);
    assert.deepEqual(before, { payments: 1, enrollments: 1, paidOrders: 1 });
    assert.equal(confirmations().length, 1);
    assert.equal(confirmations()[0]!.to, student.email);

    // History and receipt: own only.
    const history = await student.api<Paginated<StudentOrderDto>>('GET', '/student/orders');
    assert.equal(history.body.data.items.length, 1);
    assert.equal(history.body.data.items[0]!.status, 'PAID');
    assert.equal(
      (await other.api<Paginated<StudentOrderDto>>('GET', '/student/orders')).body.data.items
        .length,
      0,
    );
    const receipt = await student.api<PaymentReceiptDto>(
      'GET',
      `/student/orders/${session.order.id}/receipt`,
    );
    expectStatus(receipt, 200);
    assert.equal(receipt.body.data.amountMinor, 89_910);
    assert.equal(receipt.body.data.providerPaymentId, payment.id);
    assert.equal(receipt.body.data.isTaxInvoice, false);
    expectStatus(await other.api('GET', `/student/orders/${session.order.id}/receipt`), 404);
  });

  it('captures an authorised payment before activating', async () => {
    const course = await paidCourse();
    const { api: student } = await newStudent();
    const session = await checkout(student, course.courseId);
    const { payment, signature } = rzp.pay(session.checkout.providerOrderId, {
      status: 'authorized',
    });
    const verified = await student<StudentOrderDto>(
      'POST',
      `/student/orders/${session.order.id}/verify`,
      {
        razorpayOrderId: session.checkout.providerOrderId,
        razorpayPaymentId: payment.id,
        razorpaySignature: signature,
      },
    );
    assert.equal(verified.body.data.status, 'PAID');
    assert.equal(rzp.count('capturePayment'), 1);
    assert.equal(rzp.payments.get(payment.id)!.status, 'captured');
  });

  it('rejects forged, mismatched or foreign payments without changing state', async () => {
    const course = await paidCourse();
    const second = await paidCourse();
    const { api: student } = await newStudent();
    const session = await checkout(student, course.courseId);
    const otherSession = await checkout(student, second.courseId);
    const { payment } = rzp.pay(session.checkout.providerOrderId);
    const verify = (body: Record<string, string>) =>
      student('POST', `/student/orders/${session.order.id}/verify`, body);

    // Bad signature (e.g. computed by the attacker, or with the wrong secret).
    const forged = await verify({
      razorpayOrderId: session.checkout.providerOrderId,
      razorpayPaymentId: payment.id,
      razorpaySignature: rzp.checkoutSignature(
        session.checkout.providerOrderId,
        payment.id,
        'not-the-secret',
      ),
    });
    expectStatus(forged, 400);
    // Echoed order id is not ours.
    expectStatus(
      await verify({
        razorpayOrderId: otherSession.checkout.providerOrderId,
        razorpayPaymentId: payment.id,
        razorpaySignature: rzp.checkoutSignature(otherSession.checkout.providerOrderId, payment.id),
      }),
      400,
    );
    // Validly signed for our order id, but the payment actually belongs to another order.
    const foreign = rzp.pay(otherSession.checkout.providerOrderId);
    expectStatus(
      await verify({
        razorpayOrderId: session.checkout.providerOrderId,
        razorpayPaymentId: foreign.payment.id,
        razorpaySignature: rzp.checkoutSignature(
          session.checkout.providerOrderId,
          foreign.payment.id,
        ),
      }),
      400,
    );
    // Malformed input is a validation error.
    expectStatus(
      await verify({ razorpayOrderId: 'x', razorpayPaymentId: 'y', razorpaySignature: 'z' }),
      422,
    );

    assert.equal(await prisma.payment.count(), 0);
    assert.equal(await prisma.enrollment.count(), 0);
    assert.equal(await prisma.order.count({ where: { status: 'PAID' } }), 0);
    assert.equal(
      await prisma.paymentAuditLog.count({ where: { action: 'payment.verification_failed' } }),
      3,
    );
  });

  it('keeps a failed attempt, allows a retry on the same order, and never activates on failure', async () => {
    const course = await paidCourse();
    const { api: student } = await newStudent();
    const session = await checkout(student, course.courseId);
    rzp.pay(session.checkout.providerOrderId, {
      status: 'failed',
      errorDescription: 'Your bank declined the payment.',
    });

    const failed = await student<StudentOrderDto>(
      'POST',
      `/student/orders/${session.order.id}/refresh`,
    );
    expectStatus(failed, 200);
    assert.equal(failed.body.data.status, 'PENDING');
    assert.equal(failed.body.data.nextStep, 'PAY');
    assert.equal(failed.body.data.payments[0]!.status, 'FAILED');
    assert.equal(failed.body.data.failureReason, 'Your bank declined the payment.');
    assert.equal(failed.body.data.receiptAvailable, false);
    expectStatus(await student('GET', `/student/orders/${session.order.id}/receipt`), 404);
    assert.equal(await prisma.enrollment.count(), 0);

    // Retry (Checkout reopened on the same order).
    const retry = rzp.pay(session.checkout.providerOrderId);
    const paid = await student<StudentOrderDto>(
      'POST',
      `/student/orders/${session.order.id}/verify`,
      {
        razorpayOrderId: session.checkout.providerOrderId,
        razorpayPaymentId: retry.payment.id,
        razorpaySignature: retry.signature,
      },
    );
    assert.equal(paid.body.data.status, 'PAID');
    assert.equal(paid.body.data.payments.length, 2);
    assert.deepEqual(
      paid.body.data.payments.map((p) => p.status),
      ['FAILED', 'CAPTURED'],
    );
  });

  it('does not activate when Razorpay is unreachable during verification; a webhook settles it later', async () => {
    const course = await paidCourse();
    const { api: student } = await newStudent();
    const session = await checkout(student, course.courseId);
    const { payment, signature } = rzp.pay(session.checkout.providerOrderId);
    rzp.failNext('fetchPayment', 'TIMEOUT');
    const response = await student('POST', `/student/orders/${session.order.id}/verify`, {
      razorpayOrderId: session.checkout.providerOrderId,
      razorpayPaymentId: payment.id,
      razorpaySignature: signature,
    });
    expectStatus(response, 503);
    assert.equal(await prisma.enrollment.count(), 0);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: session.order.id } })).status,
      'PENDING',
    );

    // Browser closed: the signed webhook confirms the payment.
    assert.equal((await postWebhook(rzp.webhook('payment.captured', { payment }))).status, 200);
    const order = await student<StudentOrderDto>('GET', `/student/orders/${session.order.id}`);
    assert.equal(order.body.data.status, 'PAID');
    assert.equal(order.body.data.enrollmentActive, true);
  });

  it('the reconciliation sweep confirms a payment whose callback and webhook were both lost', async () => {
    const course = await paidCourse();
    const { api: student } = await newStudent();
    const session = await checkout(student, course.courseId);
    rzp.pay(session.checkout.providerOrderId);
    await prisma.order.update({
      where: { id: session.order.id },
      data: { createdAt: new Date(Date.now() - 10 * 60_000) },
    });
    await sweepPayments();
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: session.order.id } })).status,
      'PAID',
    );
    assert.equal(confirmations().length, 1);
    await sweepPayments();
    assert.equal(confirmations().length, 1);
  });

  it('a failing email never blocks the payment and is retried later', async () => {
    const course = await paidCourse();
    const { api: student } = await newStudent();
    const session = await checkout(student, course.courseId);
    const { payment, signature } = rzp.pay(session.checkout.providerOrderId);
    const previous = setEmailTransport({
      name: 'broken',
      send: async () => {
        throw new Error('down');
      },
    });
    try {
      const verified = await student<StudentOrderDto>(
        'POST',
        `/student/orders/${session.order.id}/verify`,
        {
          razorpayOrderId: session.checkout.providerOrderId,
          razorpayPaymentId: payment.id,
          razorpaySignature: signature,
        },
      );
      assert.equal(verified.body.data.status, 'PAID');
    } finally {
      setEmailTransport(previous);
    }
    assert.equal(confirmations().length, 0);
    await sweepPayments();
    assert.equal(confirmations().length, 1);
  });

  it('replaces an open order after a price change, and honours a late payment on the old one', async () => {
    const course = await paidCourse({ discountType: null, discountValue: null });
    const { api: student, userId } = await newStudent();
    const first = await checkout(student, course.courseId);
    expectStatus(
      await admin('PATCH', `/admin/courses/${course.courseId}`, { priceMinor: 149_900 }),
      200,
    );

    const second = await checkout(student, course.courseId);
    assert.notEqual(second.order.id, first.order.id);
    assert.equal(second.checkout.amountMinor, 149_900);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } })).status,
      'CANCELLED',
    );

    // The student had the old Checkout open and paid it anyway: the money is honoured.
    const late = rzp.pay(first.checkout.providerOrderId);
    assert.equal(
      (await postWebhook(rzp.webhook('payment.captured', { payment: late.payment }))).status,
      200,
    );
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } })).status,
      'PAID',
    );
    assert.equal(await prisma.enrollment.count({ where: { userId, status: 'ACTIVE' } }), 1);

    // Paying the second order too is recorded, flagged for refund, and grants nothing extra.
    const dup = rzp.pay(second.checkout.providerOrderId);
    assert.equal(
      (await postWebhook(rzp.webhook('payment.captured', { payment: dup.payment }))).status,
      200,
    );
    const flagged = await prisma.payment.findFirstOrThrow({
      where: { providerPaymentId: dup.payment.id },
    });
    assert.match(flagged.reviewReason ?? '', /already enrolled/);
    assert.equal(await prisma.enrollment.count({ where: { userId } }), 1);
  });
});

describe('webhooks', () => {
  async function pendingOrder() {
    const course = await paidCourse();
    const student = await newStudent();
    const session = await checkout(student.api, course.courseId);
    return { course, student, session };
  }

  it('processes a valid signed event and acknowledges duplicates idempotently', async () => {
    const { session } = await pendingOrder();
    const { payment } = rzp.pay(session.checkout.providerOrderId);
    const hook = rzp.webhook('payment.captured', { payment });
    const first = await postWebhook(hook, { eventId: 'evt_A1' });
    assert.equal(first.status, 200);
    const again = await postWebhook(hook, { eventId: 'evt_A1' });
    assert.equal(again.status, 200);
    assert.equal(again.body.data?.duplicate, true);
    // order.paid for the same payment (a different event) changes nothing either.
    assert.equal((await postWebhook(rzp.webhook('order.paid', { payment }))).status, 200);
    assert.deepEqual(await counts(), { payments: 1, enrollments: 1, paidOrders: 1 });
    assert.equal(confirmations().length, 1);

    // Only a sanitized extract is stored (no email/contact/VPA).
    const stored = await prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { eventId: 'evt_A1' },
    });
    assert.equal(stored.status, 'PROCESSED');
    assert.doesNotMatch(JSON.stringify(stored.data), /example\.test|\+91|@upi/);

    // Revenue counts the payment once.
    const sa = await superAdmin();
    const summary = await sa<PaymentSummaryDto>('GET', '/admin/payments/summary?mode=TEST');
    assert.equal(summary.body.data.totals[0]!.grossCapturedMinor, 89_910);
    assert.equal(summary.body.data.totals[0]!.capturedPaymentCount, 1);
  });

  it('handles concurrent duplicate deliveries with a single side effect', async () => {
    const { session } = await pendingOrder();
    const { payment } = rzp.pay(session.checkout.providerOrderId);
    const hook = rzp.webhook('payment.captured', { payment });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => postWebhook(hook, { eventId: 'evt_C1' })),
    );
    for (const result of results)
      assert.ok([200, 409].includes(result.status), String(result.status));
    assert.deepEqual(await counts(), { payments: 1, enrollments: 1, paidOrders: 1 });
    assert.equal(confirmations().length, 1);
    assert.equal(await prisma.paymentWebhookEvent.count(), 1);
  });

  it('rejects invalid, modified or unsigned bodies before touching any state', async () => {
    const { session } = await pendingOrder();
    const { payment } = rzp.pay(session.checkout.providerOrderId);
    const hook = rzp.webhook('payment.captured', { payment });
    assert.equal((await postWebhook({ body: hook.body, signature: '0'.repeat(64) })).status, 400);
    assert.equal(
      (
        await postWebhook({
          body: hook.body.replace('"captured"', '"captured" '),
          signature: hook.signature,
        })
      ).status,
      400,
    );
    assert.equal((await postWebhook({ body: hook.body })).status, 400);
    assert.equal(
      (await postWebhook(rzp.webhook('payment.captured', { payment }, 'wrong-secret'))).status,
      400,
    );
    assert.equal(await prisma.paymentWebhookEvent.count(), 0);
    assert.deepEqual(await counts(), { payments: 0, enrollments: 0, paidOrders: 0 });
  });

  it('never downgrades a captured payment and accepts capture after an earlier failure', async () => {
    const { session } = await pendingOrder();
    const { payment } = rzp.pay(session.checkout.providerOrderId, { status: 'failed' });
    assert.equal((await postWebhook(rzp.webhook('payment.failed', { payment }))).status, 200);
    assert.equal(await prisma.enrollment.count(), 0);
    // Razorpay may capture after a failure (UPI retry).
    const captured = rzp.setPaymentStatus(payment.id, 'captured');
    assert.equal(
      (await postWebhook(rzp.webhook('payment.captured', { payment: captured }))).status,
      200,
    );
    // A stale failure snapshot arriving later is ignored.
    assert.equal((await postWebhook(rzp.webhook('payment.failed', { payment }))).status, 200);
    const row = await prisma.payment.findFirstOrThrow({ where: { providerPaymentId: payment.id } });
    assert.equal(row.status, 'CAPTURED');
    assert.deepEqual(await counts(), { payments: 1, enrollments: 1, paidOrders: 1 });
  });

  it('ignores unknown orders and events of the other mode', async () => {
    const live = new FakeRazorpay(
      'LIVE',
      LIVE_KEY.keyId,
      LIVE_KEY.keySecret,
      LIVE_KEY.webhookSecret,
    );
    useAccounts({ activeMode: 'TEST', live });
    const { session } = await pendingOrder();
    const { payment } = rzp.pay(session.checkout.providerOrderId);

    // A TEST order's payment delivered (validly signed) to the LIVE endpoint.
    const crossMode = live.webhook('payment.captured', { payment });
    const response = await postWebhook(crossMode, { mode: 'live', eventId: 'evt_X1' });
    assert.equal(response.status, 200);
    const event = await prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { eventId: 'evt_X1' },
    });
    assert.equal(event.status, 'IGNORED');
    assert.equal(await prisma.enrollment.count(), 0);

    // An order this platform never created.
    const stranger = { ...payment, id: 'pay_StrangerPayment01', orderId: 'order_NotOursAtAll01' };
    const unknown = await postWebhook(rzp.webhook('payment.captured', { payment: stranger }), {
      eventId: 'evt_U1',
    });
    assert.equal(unknown.status, 200);
    assert.equal(
      (await prisma.paymentWebhookEvent.findFirstOrThrow({ where: { eventId: 'evt_U1' } })).status,
      'IGNORED',
    );
    assert.equal(await prisma.payment.count(), 0);

    // Unknown mode / unconfigured webhook.
    assert.equal(
      (await postWebhook(rzp.webhook('payment.captured', { payment }), { mode: 'staging' })).status,
      404,
    );
    useAccounts({ activeMode: 'TEST', test: rzp });
    setPaymentAccountsForTests({
      activeMode: 'TEST',
      accounts: { TEST: { keyId: TEST_KEY.keyId, keySecret: TEST_KEY.keySecret, gateway: rzp } },
    });
    assert.equal((await postWebhook(rzp.webhook('payment.captured', { payment }))).status, 503);
  });

  it('never activates a captured payment whose amount or currency differs from the order', async () => {
    const { session } = await pendingOrder();
    const short = rzp.pay(session.checkout.providerOrderId, { amountMinor: 100 });
    assert.equal(
      (await postWebhook(rzp.webhook('payment.captured', { payment: short.payment }))).status,
      200,
    );
    const usd = rzp.pay(session.checkout.providerOrderId, { currency: 'USD' });
    assert.equal(
      (await postWebhook(rzp.webhook('payment.captured', { payment: usd.payment }))).status,
      200,
    );
    const rows = await prisma.payment.findMany();
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.appliedAt, null);
      assert.match(row.reviewReason ?? '', /does not match/);
    }
    assert.equal(await prisma.enrollment.count(), 0);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: session.order.id } })).status,
      'PENDING',
    );
  });

  it('expires an unpaid order after its window and starts a fresh one on the next checkout', async () => {
    const { course, student, session } = await pendingOrder();
    await prisma.order.update({
      where: { id: session.order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const refreshed = await student.api<StudentOrderDto>(
      'POST',
      `/student/orders/${session.order.id}/refresh`,
    );
    assert.equal(refreshed.body.data.status, 'EXPIRED');
    assert.equal(refreshed.body.data.nextStep, 'NONE');
    const next = await checkout(student.api, course.courseId);
    assert.notEqual(next.order.id, session.order.id);
  });

  it('marks a failed processing attempt FAILED (non-2xx) and succeeds on redelivery', async () => {
    const { session } = await pendingOrder();
    const { payment } = rzp.pay(session.checkout.providerOrderId, { status: 'authorized' });
    const hook = rzp.webhook('payment.authorized', { payment });
    rzp.failNext('capturePayment', 'UNAVAILABLE');
    assert.equal((await postWebhook(hook, { eventId: 'evt_F1' })).status, 500);
    const failed = await prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { eventId: 'evt_F1' },
    });
    assert.equal(failed.status, 'FAILED');
    assert.equal(await prisma.enrollment.count(), 0);

    assert.equal((await postWebhook(hook, { eventId: 'evt_F1' })).status, 200);
    const done = await prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { eventId: 'evt_F1' },
    });
    assert.equal(done.status, 'PROCESSED');
    assert.equal(done.attempts, 2);
    assert.deepEqual(await counts(), { payments: 1, enrollments: 1, paidOrders: 1 });
  });
});

describe('test/live isolation', () => {
  it('verifies an order only with the credentials of the mode it was created in', async () => {
    const course = await paidCourse();
    const { api: student } = await newStudent();
    const session = await checkout(student, course.courseId);
    const { payment } = rzp.pay(session.checkout.providerOrderId);
    const live = new FakeRazorpay(
      'LIVE',
      LIVE_KEY.keyId,
      LIVE_KEY.keySecret,
      LIVE_KEY.webhookSecret,
    );

    // The deployment switched to LIVE and no longer has TEST keys: the TEST order cannot be
    // processed here (safe failure, not a live verification).
    useAccounts({ activeMode: 'LIVE', live, test: null });
    const switched = await student('POST', `/student/orders/${session.order.id}/verify`, {
      razorpayOrderId: session.checkout.providerOrderId,
      razorpayPaymentId: payment.id,
      razorpaySignature: live.checkoutSignature(session.checkout.providerOrderId, payment.id),
    });
    expectStatus(switched, 503);

    // Both configured: a signature made with the LIVE secret is rejected for a TEST order.
    useAccounts({ activeMode: 'LIVE', live });
    const wrongMode = await student('POST', `/student/orders/${session.order.id}/verify`, {
      razorpayOrderId: session.checkout.providerOrderId,
      razorpayPaymentId: payment.id,
      razorpaySignature: live.checkoutSignature(session.checkout.providerOrderId, payment.id),
    });
    expectStatus(wrongMode, 400);
    assert.equal(await prisma.payment.count(), 0);

    // Its own TEST signature still works, processed by the TEST account.
    const ok = await student<StudentOrderDto>(
      'POST',
      `/student/orders/${session.order.id}/verify`,
      {
        razorpayOrderId: session.checkout.providerOrderId,
        razorpayPaymentId: payment.id,
        razorpaySignature: rzp.checkoutSignature(session.checkout.providerOrderId, payment.id),
      },
    );
    assert.equal(ok.body.data.status, 'PAID');
    assert.equal(ok.body.data.mode, 'TEST');
    assert.equal(live.calls.length, 0);

    // Test money never appears in the live summary.
    const sa = await superAdmin();
    const liveSummary = await sa<PaymentSummaryDto>('GET', '/admin/payments/summary?mode=LIVE');
    assert.deepEqual(liveSummary.body.data.totals, []);
    const testSummary = await sa<PaymentSummaryDto>('GET', '/admin/payments/summary?mode=TEST');
    assert.equal(testSummary.body.data.totals[0]!.grossCapturedMinor, 89_910);
  });
});

describe('refunds and admin views', () => {
  async function paidOrder() {
    const course = await paidCourse();
    const student = await newStudent();
    const session = await checkout(student.api, course.courseId);
    const { payment, signature } = rzp.pay(session.checkout.providerOrderId);
    expectStatus(
      await student.api('POST', `/student/orders/${session.order.id}/verify`, {
        razorpayOrderId: session.checkout.providerOrderId,
        razorpayPaymentId: payment.id,
        razorpaySignature: signature,
      }),
      200,
    );
    const row = await prisma.payment.findFirstOrThrow({ where: { providerPaymentId: payment.id } });
    return { course, student, session, providerPayment: payment, paymentId: row.id };
  }

  it('restricts financial views and refunds to authorised roles', async () => {
    const { student, paymentId } = await paidOrder();
    expectStatus(await student.api('GET', '/admin/payments/orders'), 403);
    expectStatus(await admin('GET', '/admin/payments/orders'), 200);
    const body = { reason: 'Course cancelled', idempotencyKey: randomUUID() };
    expectStatus(
      await admin('POST', `/admin/payments/transactions/${paymentId}/refunds`, body),
      403,
    );
    const faculty = apiAs(
      new TestClient(baseUrl),
      await tokenFor(new TestClient(baseUrl), 'FACULTY'),
    );
    expectStatus(await faculty('GET', '/admin/payments/summary'), 403);
    const config = await admin<{ canRefund: boolean; activeMode: string }>(
      'GET',
      '/admin/payments/config',
    );
    assert.equal(config.body.data.canRefund, false);
    assert.equal(config.body.data.activeMode, 'TEST');
    assert.ok(!JSON.stringify(config.body).includes(TEST_KEY.keySecret));
    assert.equal(rzp.count('createRefund'), 0);
  });

  it('refunds fully and idempotently, keeps the payment record and does not revoke access by itself', async () => {
    const { student, session, paymentId, providerPayment } = await paidOrder();
    const sa = await superAdmin();
    const body = { reason: 'Requested by the student', idempotencyKey: randomUUID() };
    const [first, repeat] = await Promise.all([
      sa<AdminRefundDto>('POST', `/admin/payments/transactions/${paymentId}/refunds`, body),
      sa<AdminRefundDto>('POST', `/admin/payments/transactions/${paymentId}/refunds`, body),
    ]);
    expectStatus(first, 201);
    expectStatus(repeat, 201);
    assert.equal(first.body.data.id, repeat.body.data.id);
    assert.equal(first.body.data.amountMinor, 89_910);
    assert.equal(first.body.data.status, 'PENDING');
    assert.equal(rzp.refunds.size, 1);

    // Nothing left: a second refund is refused.
    expectStatus(
      await sa('POST', `/admin/payments/transactions/${paymentId}/refunds`, {
        reason: 'Again',
        idempotencyKey: randomUUID(),
      }),
      409,
    );

    // Provider confirms (webhook, delivered twice): one PROCESSED refund, one email.
    const processed = rzp.processRefund(first.body.data.providerRefundId!);
    const hook = rzp.webhook('refund.processed', {
      refund: processed,
      payment: rzp.payments.get(providerPayment.id),
    });
    assert.equal((await postWebhook(hook, { eventId: 'evt_R1' })).status, 200);
    assert.equal((await postWebhook(hook, { eventId: 'evt_R1' })).status, 200);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assert.equal(payment.status, 'CAPTURED');
    assert.equal(payment.refundedMinor, 89_910);
    assert.equal(outbox().filter((m) => m.template === 'refund-update').length, 1);

    const order = await student.api<StudentOrderDto>('GET', `/student/orders/${session.order.id}`);
    assert.equal(order.body.data.status, 'PAID');
    assert.equal(order.body.data.refundState, 'FULL');
    assert.equal(order.body.data.enrollmentActive, true); // N-03 pending: no implicit revocation

    const summary = await sa<PaymentSummaryDto>('GET', '/admin/payments/summary?mode=TEST');
    assert.deepEqual(
      [
        summary.body.data.totals[0]!.grossCapturedMinor,
        summary.body.data.totals[0]!.refundedMinor,
        summary.body.data.totals[0]!.netMinor,
      ],
      [89_910, 89_910, 0],
    );
  });

  it('supports partial refunds within the remaining balance and optional access revocation', async () => {
    const { student, course, session, paymentId } = await paidOrder();
    const sa = await superAdmin();
    rzp.refundInitialStatus = 'processed';
    const partial = await sa<AdminRefundDto>(
      'POST',
      `/admin/payments/transactions/${paymentId}/refunds`,
      {
        amountMinor: 40_000,
        reason: 'Partial goodwill refund',
        idempotencyKey: randomUUID(),
      },
    );
    expectStatus(partial, 201);
    assert.equal(partial.body.data.status, 'PROCESSED');

    const tooMuch = await sa('POST', `/admin/payments/transactions/${paymentId}/refunds`, {
      amountMinor: 49_911,
      reason: 'Exceeds',
      idempotencyKey: randomUUID(),
    });
    expectStatus(tooMuch, 422);
    expectStatus(
      await sa('POST', `/admin/payments/transactions/${paymentId}/refunds`, {
        amountMinor: 50,
        reason: 'Tiny',
        idempotencyKey: randomUUID(),
      }),
      422,
    );
    const order = await student.api<StudentOrderDto>('GET', `/student/orders/${session.order.id}`);
    assert.equal(order.body.data.refundState, 'PARTIAL');

    const rest = await sa<AdminRefundDto>(
      'POST',
      `/admin/payments/transactions/${paymentId}/refunds`,
      {
        reason: 'Withdrawn from course',
        revokeAccess: true,
        idempotencyKey: randomUUID(),
      },
    );
    expectStatus(rest, 201);
    assert.equal(rest.body.data.amountMinor, 49_910);
    assert.equal(rest.body.data.revokedAccess, true);
    expectStatus(await student.api('GET', `/student/courses/${course.courseId}/curriculum`), 403);
    assert.equal(
      await prisma.paymentAuditLog.count({ where: { action: 'enrollment.revoked_with_refund' } }),
      1,
    );

    const detail = await sa<AdminOrderDetail>('GET', `/admin/payments/orders/${session.order.id}`);
    assert.equal(detail.body.data.refunds.length, 2);
    assert.equal(detail.body.data.payments[0]!.refundableMinor, 0);
    assert.ok(detail.body.data.audit.some((entry) => entry.action === 'refund.requested'));
  });

  it('records provider refusals and recovers an unknown outcome by receipt', async () => {
    const { paymentId, providerPayment } = await paidOrder();
    const sa = await superAdmin();

    rzp.failNext('createRefund', 'REJECTED', 'Refund not allowed for this payment');
    const refused = await sa<AdminRefundDto>(
      'POST',
      `/admin/payments/transactions/${paymentId}/refunds`,
      {
        amountMinor: 10_000,
        reason: 'Refused case',
        idempotencyKey: randomUUID(),
      },
    );
    expectStatus(refused, 201);
    assert.equal(refused.body.data.status, 'FAILED');
    assert.equal(refused.body.data.failureReason, 'Refund not allowed for this payment');

    rzp.failNext('createRefund', 'TIMEOUT');
    const unknown = await sa<AdminRefundDto>(
      'POST',
      `/admin/payments/transactions/${paymentId}/refunds`,
      {
        amountMinor: 10_000,
        reason: 'Timeout case',
        idempotencyKey: randomUUID(),
      },
    );
    assert.equal(unknown.body.data.status, 'REQUESTED');
    // Still counted as in-flight: the refundable balance excludes it.
    const list = await sa<Paginated<AdminPaymentListItem>>(
      'GET',
      '/admin/payments/transactions?status=CAPTURED',
    );
    assert.equal(list.body.data.items[0]!.refundableMinor, 89_910 - 10_000);

    // Later reconciliation re-submits with the same receipt (cannot double refund).
    await prisma.refund.update({
      where: { id: unknown.body.data.id },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    });
    const reconciled = await sa<AdminRefundDto>(
      'POST',
      `/admin/payments/refunds/${unknown.body.data.id}/reconcile`,
    );
    assert.equal(reconciled.body.data.status, 'PENDING');
    assert.equal(
      [...rzp.refunds.values()].filter((r) => r.paymentId === providerPayment.id).length,
      1,
    );
    const again = await sa<AdminRefundDto>(
      'POST',
      `/admin/payments/refunds/${unknown.body.data.id}/reconcile`,
    );
    assert.equal(again.body.data.id, unknown.body.data.id);
    assert.equal(rzp.refunds.size, 1);
  });

  it('lists failed and pending payments and searches orders for administrators', async () => {
    const course = await paidCourse();
    const { api: student, email } = await newStudent();
    const session = await checkout(student, course.courseId);
    rzp.pay(session.checkout.providerOrderId, { status: 'failed' });
    await student('POST', `/student/orders/${session.order.id}/refresh`);

    const failed = await admin<Paginated<AdminPaymentListItem>>(
      'GET',
      '/admin/payments/transactions?status=FAILED',
    );
    assert.equal(failed.body.data.items.length, 1);
    const pending = await admin<Paginated<{ reference: string }>>(
      'GET',
      '/admin/payments/orders?status=PENDING',
    );
    assert.equal(pending.body.data.items.length, 1);
    const search = await admin<Paginated<{ reference: string }>>(
      'GET',
      `/admin/payments/orders?q=${encodeURIComponent(email)}`,
    );
    assert.equal(search.body.data.items[0]!.reference, session.order.reference);
    const summary = await admin<PaymentSummaryDto>('GET', '/admin/payments/summary');
    assert.equal(summary.body.data.failedPaymentCount, 1);
    assert.equal(summary.body.data.pendingOrderCount, 1);
    const reconciled = await admin<AdminOrderDetail>(
      'POST',
      `/admin/payments/orders/${session.order.id}/reconcile`,
    );
    expectStatus(reconciled, 200);
    assert.ok(reconciled.body.data.audit.some((entry) => entry.action === 'order.reconciled'));
  });
});
