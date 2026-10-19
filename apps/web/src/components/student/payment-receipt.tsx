'use client';

import type { PaymentReceiptDto } from '@asra/types';
import { Printer } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiClientError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { formatAmount, METHOD_LABEL, REFUND_STATE_LABEL } from '@/lib/payments';

import { ErrorPanel, LoadingPanel } from './student-ui';
import { errorMessage, useApiResource, useStudentApi } from './use-student';

const crumbs = [
  { label: 'Dashboard', href: '/student/dashboard' },
  { label: 'Payments', href: '/student/payments' },
];

/**
 * Payment receipt (PHASE 10, docs/PAYMENTS.md §12): built only from the API's verified records,
 * for the signed-in student's own PAID order. "Save as PDF" uses the browser's print dialog.
 * It is deliberately NOT a GST tax invoice — no GSTIN, tax rate or address is printed until the
 * academy confirms them (CLIENT-CLARIFICATIONS M-04).
 */
export function PaymentReceipt({ orderId }: { orderId: string }) {
  const api = useStudentApi();
  const path = `/student/orders/${orderId}/receipt`;
  const receipt = useApiResource(path, () => api.get<PaymentReceiptDto>(path));

  if (receipt.error && !receipt.data) {
    const missing =
      receipt.error instanceof ApiClientError && [404, 422].includes(receipt.error.status);
    return (
      <>
        <PageHeader title="Receipt" breadcrumbs={[...crumbs, { label: 'Receipt' }]} />
        {missing ? (
          <p className="type-body text-muted-foreground">
            A receipt is available only for a confirmed payment.{' '}
            <Link
              className="text-primary underline-offset-2 hover:underline"
              href="/student/payments"
            >
              Back to payments
            </Link>
          </p>
        ) : (
          <ErrorPanel message={errorMessage(receipt.error)} onRetry={receipt.reload} />
        )}
      </>
    );
  }
  if (!receipt.data) return <LoadingPanel label="Loading receipt…" rows={4} />;

  const r = receipt.data;
  const money = (minor: number) => formatAmount(minor, r.currency);
  const refund = REFUND_STATE_LABEL[r.refundState];
  const rows: [string, string][] = [
    ['Receipt number', r.receiptNumber],
    ['Payment date', formatDateTime(r.paidAt) ? `${formatDateTime(r.paidAt)} IST` : '—'],
    ['Paid by', `${r.student.fullName} (${r.student.email})`],
    ['Course', r.course.title],
    ['Payment method', r.method ? (METHOD_LABEL[r.method] ?? r.method) : '—'],
    ['Payment reference', r.providerPaymentId],
  ];

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Payment receipt"
          breadcrumbs={[...crumbs, { label: 'Receipt' }]}
          actions={
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden /> Print or save as PDF
            </Button>
          }
        />
      </div>
      <Card className="max-w-2xl gap-6 print:border-0 print:shadow-none">
        <CardContent className="grid gap-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="type-h3 text-heading">{r.issuer.name}</p>
              <p className="type-body-sm text-muted-foreground">Payment receipt</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Paid</Badge>
              {refund ? <Badge variant="info">{refund}</Badge> : null}
              {r.mode === 'TEST' ? (
                <Badge variant="warning">Test mode — not a real payment</Badge>
              ) : null}
            </div>
          </header>
          <dl className="grid gap-2 type-body-sm sm:grid-cols-[12rem_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <dl className="grid gap-2 border-t pt-4 type-body-sm">
            <div className="flex justify-between gap-4">
              <dt>Course fee</dt>
              <dd className="tabular-nums">{money(r.listPriceMinor)}</dd>
            </div>
            {r.discountMinor > 0 ? (
              <div className="flex justify-between gap-4">
                <dt>Discount</dt>
                <dd className="tabular-nums">− {money(r.discountMinor)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 type-label text-heading">
              <dt>Amount paid</dt>
              <dd className="tabular-nums">{money(r.amountMinor)}</dd>
            </div>
            {r.refundedMinor > 0 ? (
              <div className="flex justify-between gap-4">
                <dt>Refunded</dt>
                <dd className="tabular-nums">− {money(r.refundedMinor)}</dd>
              </div>
            ) : null}
          </dl>
          <p className="type-caption text-muted-foreground">
            This is a payment receipt, not a tax invoice. Payment processed by Razorpay.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
