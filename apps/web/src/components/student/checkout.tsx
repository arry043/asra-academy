'use client';

import type { CheckoutQuoteDto, CheckoutSessionDto, StudentOrderDto } from '@asra/types';
import { CheckCircle2, Clock, CreditCard, ShieldCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { siteConfig } from '@/config/site';
import { ApiClientError } from '@/lib/api';
import { formatAmount, MODE_LABEL, openRazorpayCheckout } from '@/lib/payments';
import { courseHref } from '@/lib/student/learning';

import { EnrolButton } from './student-courses';
import { ErrorPanel, LoadingPanel } from './student-ui';
import { errorMessage, useApiResource, useStudentApi } from './use-student';

const crumbs = [
  { label: 'Dashboard', href: '/student/dashboard' },
  { label: 'Payments', href: '/student/payments' },
];

/**
 * `/student/checkout/[slug]` (PHASE 10, docs/PAYMENTS.md §5). The page only DISPLAYS the server's
 * price and the server's order state: it never sends an amount, and it shows "payment successful"
 * only after the API has verified the payment with Razorpay and activated the enrolment.
 */
/** The UI state for an order as the SERVER reports it. */
function phaseFor(order: StudentOrderDto): Phase {
  if (order.status === 'PAID') return { kind: 'paid', order };
  if (order.nextStep === 'WAIT') {
    return { kind: 'pending', order, message: 'Your bank is still confirming the payment.' };
  }
  if (order.nextStep === 'NONE') {
    return {
      kind: 'failed',
      order: null,
      message: 'This checkout has expired. Start a new payment below.',
    };
  }
  const last = order.payments.at(-1);
  if (last?.status === 'FAILED') {
    return {
      kind: 'failed',
      order,
      message: last.failureMessage ?? 'The payment did not go through.',
    };
  }
  return { kind: 'dismissed', order };
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'paying' }
  | { kind: 'verifying' }
  | { kind: 'dismissed'; order: StudentOrderDto }
  | { kind: 'failed'; order: StudentOrderDto | null; message: string }
  | { kind: 'pending'; order: StudentOrderDto; message?: string }
  | { kind: 'paid'; order: StudentOrderDto };

export function Checkout({ slug }: { slug: string }) {
  const api = useStudentApi();
  const path = `/student/checkout/${encodeURIComponent(slug)}`;
  const quote = useApiResource(path, () => api.get<CheckoutQuoteDto>(path));
  const [phase, setPhase] = React.useState<Phase>({ kind: 'idle' });
  const busy = React.useRef(false);

  async function pay(courseId: string) {
    if (busy.current) return; // no duplicate orders or overlapping Checkout windows
    busy.current = true;
    try {
      setPhase({ kind: 'creating' });
      let session: CheckoutSessionDto;
      try {
        session = await api.post<CheckoutSessionDto>('/student/orders', { courseId });
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 409) quote.reload();
        setPhase({ kind: 'failed', order: null, message: errorMessage(error) });
        return;
      }
      if (session.order.status === 'PAID') {
        setPhase({ kind: 'paid', order: session.order });
        return;
      }
      setPhase({ kind: 'paying' });
      let outcome;
      try {
        outcome = await openRazorpayCheckout(session.checkout, siteConfig.colors.green);
      } catch (error) {
        setPhase({ kind: 'failed', order: session.order, message: errorMessage(error) });
        return;
      }
      if (outcome.kind === 'success') {
        setPhase({ kind: 'verifying' });
        try {
          const order = await api.post<StudentOrderDto>(
            `/student/orders/${session.order.id}/verify`,
            {
              razorpayOrderId: outcome.response.razorpay_order_id,
              razorpayPaymentId: outcome.response.razorpay_payment_id,
              razorpaySignature: outcome.response.razorpay_signature,
            },
          );
          setPhase(order.status === 'PAID' ? { kind: 'paid', order } : { kind: 'pending', order });
        } catch (error) {
          // Network loss or provider delay: the payment may still succeed — never say "failed".
          setPhase({
            kind: 'pending',
            order: session.order,
            message: `${errorMessage(error)} You will not be charged twice — check the status below.`,
          });
        }
        return;
      }
      // Closed or failed inside Checkout: ask the server what actually happened.
      const order = await api
        .post<StudentOrderDto>(`/student/orders/${session.order.id}/refresh`)
        .catch(() => session.order);
      if (order.status === 'PAID') setPhase({ kind: 'paid', order });
      else if (outcome.kind === 'failed')
        setPhase({ kind: 'failed', order, message: outcome.message });
      else setPhase({ kind: 'dismissed', order });
    } finally {
      busy.current = false;
    }
  }

  async function checkStatus(orderId: string) {
    if (busy.current) return;
    busy.current = true;
    setPhase({ kind: 'verifying' });
    try {
      setPhase(phaseFor(await api.post<StudentOrderDto>(`/student/orders/${orderId}/refresh`)));
    } catch (error) {
      setPhase({ kind: 'failed', order: null, message: errorMessage(error) });
    } finally {
      busy.current = false;
    }
  }

  if (quote.error && !quote.data) {
    const missing =
      quote.error instanceof ApiClientError && [404, 422].includes(quote.error.status);
    return (
      <>
        <PageHeader
          title={missing ? 'Course not found' : 'Checkout'}
          breadcrumbs={[...crumbs, { label: 'Checkout' }]}
        />
        {missing ? (
          <div className="grid justify-items-start gap-3">
            <p className="type-body text-muted-foreground">
              This course does not exist or is not available to buy.
            </p>
            <Button asChild variant="outline">
              <Link href="/student/courses?tab=catalog">Browse courses</Link>
            </Button>
          </div>
        ) : (
          <ErrorPanel message={errorMessage(quote.error)} onRetry={quote.reload} />
        )}
      </>
    );
  }
  if (!quote.data) return <LoadingPanel label="Loading course and price…" rows={4} />;

  const data = quote.data;
  const price = data.price;
  const openOrder = phase.kind === 'idle' ? data.openOrder : null;

  return (
    <>
      <PageHeader
        title="Checkout"
        description={data.course.title}
        breadcrumbs={[...crumbs, { label: 'Checkout' }]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="checkout-status" className="grid content-start gap-4">
          <h2 id="checkout-status" className="sr-only">
            Status
          </h2>
          <CheckoutStatus
            data={data}
            phase={phase}
            openOrder={openOrder}
            onPay={() => pay(data.course.id)}
            onCheck={checkStatus}
            onEnrolled={quote.reload}
          />
        </section>
        <Card className="h-fit gap-4">
          <CardHeader className="gap-1">
            <CardTitle as="h2">{data.course.title}</CardTitle>
            {data.course.summary ? (
              <p className="type-body-sm text-muted-foreground">{data.course.summary}</p>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            {price ? (
              <dl className="grid gap-2 type-body-sm">
                {price.isFree ? (
                  <div className="flex justify-between">
                    <dt>Price</dt>
                    <dd className="type-label">Free</dd>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt>Course fee</dt>
                      <dd className="tabular-nums">
                        {formatAmount(price.listPriceMinor, price.currency)}
                      </dd>
                    </div>
                    {price.discountMinor > 0 ? (
                      <div className="flex justify-between gap-4 text-success">
                        <dt>
                          Discount
                          {price.discountType === 'PERCENTAGE' ? ` (${price.discountValue}%)` : ''}
                        </dt>
                        <dd className="tabular-nums">
                          − {formatAmount(price.discountMinor, price.currency)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-4 border-t pt-2 type-label text-heading">
                      <dt>Total</dt>
                      <dd className="tabular-nums">
                        {formatAmount(price.amountMinor, price.currency)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            ) : (
              <p className="type-body-sm text-muted-foreground">Price not set.</p>
            )}
            {data.mode === 'TEST' ? (
              <Badge variant="warning" className="justify-self-start">
                {MODE_LABEL.TEST} — no real money is charged
              </Badge>
            ) : null}
            <p className="flex items-start gap-2 type-caption text-muted-foreground">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              Payments are processed by Razorpay. ASRA Academy never sees or stores your card or UPI
              details.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CheckoutStatus({
  data,
  phase,
  openOrder,
  onPay,
  onCheck,
  onEnrolled,
}: {
  data: CheckoutQuoteDto;
  phase: Phase;
  openOrder: StudentOrderDto | null;
  onPay: () => void;
  onCheck: (orderId: string) => void;
  onEnrolled: () => void;
}) {
  const course = data.course;
  const openCourse = (
    <Button asChild>
      <Link href={courseHref(course.id)}>Go to the course</Link>
    </Button>
  );

  if (phase.kind === 'paid') {
    return (
      <Alert tone="success" title="Payment successful — you are enrolled">
        <p>
          We have confirmed your payment of{' '}
          {formatAmount(phase.order.price.amountMinor, phase.order.price.currency)} (order{' '}
          {phase.order.reference}). The course is now open.
        </p>
        <div className="flex flex-wrap gap-2">
          {openCourse}
          {phase.order.receiptAvailable ? (
            <Button asChild variant="outline">
              <Link href={`/student/payments/${phase.order.id}/receipt`}>View receipt</Link>
            </Button>
          ) : null}
        </div>
      </Alert>
    );
  }

  if (data.availability === 'ENROLLED') {
    return (
      <Alert tone="success" title="You are already enrolled in this course">
        <p>There is nothing to pay. Continue learning from your courses.</p>
        <div>{openCourse}</div>
      </Alert>
    );
  }
  if (data.availability === 'FREE') {
    return (
      <Alert tone="info" title="This course is free">
        <p>No payment is needed. Enrol to open the lessons.</p>
        <div>
          <EnrolButton
            courseId={course.id}
            title={course.title}
            onEnrolled={onEnrolled}
            size="default"
          />
        </div>
      </Alert>
    );
  }
  if (data.availability !== 'PURCHASE') {
    return (
      <Alert
        tone={data.availability === 'PAYMENTS_DISABLED' ? 'warning' : 'info'}
        title={
          data.availability === 'PAYMENTS_DISABLED'
            ? 'Online payment is not available'
            : 'This course cannot be bought online'
        }
      >
        <p>{data.message}</p>
        <div>
          <Button asChild size="sm" variant="outline">
            <Link href="/contact?topic=admission">Contact the academy</Link>
          </Button>
        </div>
      </Alert>
    );
  }

  const working =
    phase.kind === 'creating' || phase.kind === 'paying' || phase.kind === 'verifying';
  const workingLabel =
    phase.kind === 'creating'
      ? 'Preparing your order…'
      : phase.kind === 'paying'
        ? 'Complete the payment in the Razorpay window…'
        : 'Confirming your payment…';
  const order = 'order' in phase && phase.order ? phase.order : openOrder;

  return (
    <div className="grid gap-4">
      {phase.kind === 'failed' ? (
        <Alert tone="error" title="Payment not completed">
          <p>{phase.message}</p>
          <p>
            No money has been taken for this attempt unless your bank shows a debit — if it does, it
            will be confirmed or refunded automatically.
          </p>
        </Alert>
      ) : null}
      {phase.kind === 'dismissed' ? (
        <Alert tone="warning" title="The payment window was closed">
          <p>
            If you completed the payment, it can take a moment to be confirmed. Check the status, or
            pay now to try again.
          </p>
        </Alert>
      ) : null}
      {phase.kind === 'pending' ? (
        <Alert tone="info" title="Payment being confirmed">
          <p>{phase.message ?? 'Your payment is being confirmed by the bank.'}</p>
          <p>
            Your course opens as soon as the payment is confirmed. You can safely leave this page;
            it also appears under Payments.
          </p>
        </Alert>
      ) : null}
      {openOrder && phase.kind === 'idle' ? (
        <Alert tone="info" title="You have an unfinished checkout">
          <p>
            Order {openOrder.reference} is waiting for payment. Paying now continues the same order.
          </p>
        </Alert>
      ) : null}

      <Card className="gap-4">
        <CardContent className="grid gap-4">
          <p className="flex items-center gap-2 type-body">
            {working ? (
              <Clock aria-hidden className="size-5 text-info" />
            ) : phase.kind === 'failed' ? (
              <XCircle aria-hidden className="size-5 text-destructive" />
            ) : phase.kind === 'pending' ? (
              <Clock aria-hidden className="size-5 text-info" />
            ) : (
              <CreditCard aria-hidden className="size-5 text-primary" />
            )}
            <span role="status" aria-live="polite">
              {working
                ? workingLabel
                : `Pay ${data.price ? formatAmount(data.price.amountMinor, data.price.currency) : ''} securely with UPI, card, net banking or wallet.`}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onPay}
              loading={working}
              loadingText={workingLabel}
              disabled={working || phase.kind === 'pending'}
            >
              {phase.kind === 'failed' || phase.kind === 'dismissed' ? 'Try again' : 'Pay now'}
            </Button>
            {order &&
            (phase.kind === 'pending' || phase.kind === 'dismissed' || phase.kind === 'failed') ? (
              <Button variant="outline" onClick={() => onCheck(order.id)} disabled={working}>
                <CheckCircle2 aria-hidden /> Check payment status
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
