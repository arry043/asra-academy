'use client';

import type {
  AdminOrderDetail,
  AdminOrderListItem,
  AdminPaymentListItem,
  AdminPaymentsConfigDto,
  AdminRefundDto,
  Paginated,
  PaymentMode,
  PaymentSummaryDto,
} from '@asra/types';
import { CreditCard, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/public/empty-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, SearchInput } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { parseMoneyInput } from '@/lib/admin/format';
import { formatDateTime } from '@/lib/format';
import {
  formatAmount,
  METHOD_LABEL,
  MODE_LABEL,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
} from '@/lib/payments';

import { CheckboxField, ConfirmDialog, ErrorPanel, LoadingPanel, SelectField } from './admin-ui';
import { errorMessage, useAdminApi, useApiResource } from './use-admin';

/**
 * Admin finance (PHASE 10, docs/PAYMENTS.md §13). Every figure comes from the API, which counts
 * only provider-confirmed rows and always ONE mode — the mode switch keeps test transactions out
 * of live revenue. Refund controls render only with `payments.refund`, and the API re-checks it.
 */

const crumbs = [{ label: 'Overview', href: '/admin' }];
const when = (value: string | null) => (value ? formatDateTime(value) : '—');

function usePaymentsConfig() {
  const api = useAdminApi();
  return useApiResource('/admin/payments/config', () =>
    api.get<AdminPaymentsConfigDto>('/admin/payments/config'),
  );
}

export function PaymentsAdmin() {
  const config = usePaymentsConfig();
  const [mode, setMode] = React.useState<PaymentMode | null>(null);
  const activeMode = mode ?? config.data?.activeMode ?? 'LIVE';

  if (config.error && !config.data)
    return <ErrorPanel message={errorMessage(config.error)} onRetry={config.reload} />;
  if (!config.data) return <LoadingPanel label="Loading payments…" />;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Orders, payments, refunds and revenue from verified Razorpay transactions."
        breadcrumbs={[...crumbs, { label: 'Payments' }]}
      />
      {!config.data.checkoutEnabled ? (
        <Alert tone="warning" title="Online checkout is disabled on this deployment">
          <p>
            Set RAZORPAY_MODE and the matching Razorpay keys on the API to enable it
            (docs/PAYMENTS.md).
          </p>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <SelectField
            id="payments-mode"
            label="Payment mode"
            value={activeMode}
            onValueChange={(value) => setMode(value as PaymentMode)}
            options={config.data.modes.map((m) => ({
              value: m.mode,
              label: `${MODE_LABEL[m.mode]}${m.mode === config.data!.activeMode ? ' (active)' : ''}`,
            }))}
          />
        </div>
        {activeMode === 'TEST' ? (
          <Badge variant="warning">Test transactions — not real revenue</Badge>
        ) : null}
      </div>
      <Summary mode={activeMode} />
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payments">Transactions</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersTable mode={activeMode} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTable mode={activeMode} />
        </TabsContent>
        <TabsContent value="refunds">
          <RefundsTable mode={activeMode} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Summary({ mode }: { mode: PaymentMode }) {
  const api = useAdminApi();
  const path = `/admin/payments/summary?mode=${mode}`;
  const summary = useApiResource(path, () => api.get<PaymentSummaryDto>(path));
  if (summary.error && !summary.data)
    return <ErrorPanel message={errorMessage(summary.error)} onRetry={summary.reload} />;
  if (!summary.data) return <LoadingPanel rows={1} />;
  const s = summary.data;
  const totals = s.totals.length
    ? s.totals
    : [
        {
          currency: 'INR',
          grossCapturedMinor: 0,
          refundedMinor: 0,
          netMinor: 0,
          capturedPaymentCount: 0,
        },
      ];
  const tiles: [string, string, string][] = [
    ...totals.flatMap((t): [string, string, string][] => [
      [
        'Gross collected',
        formatAmount(t.grossCapturedMinor, t.currency),
        `${t.capturedPaymentCount} captured payment(s), each counted once`,
      ],
      ['Refunded', formatAmount(t.refundedMinor, t.currency), 'Refunds processed by Razorpay'],
      [
        'Net collected',
        formatAmount(t.netMinor, t.currency),
        'Gross − refunded, before Razorpay fees',
      ],
    ]),
    ['Paid orders', String(s.paidOrderCount), 'Orders confirmed by a captured payment'],
    ['Awaiting payment', String(s.pendingOrderCount), 'Open orders not yet paid'],
    ['Failed attempts', String(s.failedPaymentCount), 'Payment attempts that failed'],
    ['Needs review', String(s.needsReviewCount), 'Captured payments needing an administrator'],
    ['Refunds in progress', String(s.openRefundCount), 'Requested or pending at Razorpay'],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map(([label, value, hint]) => (
        <Card key={label} className="gap-1">
          <dt className="type-caption text-muted-foreground">{label}</dt>
          <dd className="type-h3 text-heading tabular-nums">{value}</dd>
          <dd className="type-caption text-muted-foreground">{hint}</dd>
        </Card>
      ))}
    </dl>
  );
}

/** Filter bar + paginated table shared by the three lists. */
function useFinanceList<T>(base: string, mode: PaymentMode, status: string, q: string, extra = '') {
  const api = useAdminApi();
  // The page belongs to one set of filters: changing a filter starts again at page 1.
  const filters = `${mode}|${status}|${q}|${extra}`;
  const [paging, setPaging] = React.useState({ filters, page: 1 });
  const page = paging.filters === filters ? paging.page : 1;
  const setPage = (next: number) => setPaging({ filters, page: next });
  const params = new URLSearchParams({ mode, page: String(page), pageSize: '20' });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const path = `${base}?${params.toString()}${extra}`;
  const list = useApiResource(path, () => api.get<Paginated<T>>(path));
  return { list, setPage };
}

function Filters({
  idPrefix,
  status,
  setStatus,
  options,
  onSearch,
}: {
  idPrefix: string;
  status: string;
  setStatus: (value: string) => void;
  options: { value: string; label: string }[];
  onSearch: (q: string) => void;
}) {
  const [text, setText] = React.useState('');
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-52">
        <SelectField
          id={`${idPrefix}-status`}
          label="Status"
          value={status || 'ALL'}
          onValueChange={(value) => setStatus(value === 'ALL' ? '' : value)}
          options={[{ value: 'ALL', label: 'All' }, ...options]}
        />
      </div>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(text.trim());
        }}
      >
        <label htmlFor={`${idPrefix}-q`} className="sr-only">
          Search
        </label>
        <SearchInput
          id={`${idPrefix}-q`}
          placeholder="Student, email or reference"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
    </div>
  );
}

function ListState<T>({
  list,
  setPage,
  label,
  children,
}: {
  list: ReturnType<typeof useFinanceList<T>>['list'];
  setPage: (page: number) => void;
  label: string;
  children: (items: T[]) => React.ReactNode;
}) {
  if (list.error && !list.data)
    return <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />;
  if (!list.data) return <LoadingPanel />;
  if (list.data.items.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard />}
        title={`No ${label}`}
        description="Nothing matches these filters."
      />
    );
  }
  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-xl border bg-card">{children(list.data.items)}</div>
      {list.data.pagination.pageCount > 1 ? (
        <Pagination
          page={list.data.pagination.page}
          pageCount={list.data.pagination.pageCount}
          onPageChange={setPage}
          label={`${label} pages`}
        />
      ) : null}
    </div>
  );
}

function Student({ student }: { student: { fullName: string; email: string } }) {
  return (
    <span className="grid">
      <span className="font-medium">{student.fullName}</span>
      <span className="type-caption text-muted-foreground">{student.email}</span>
    </span>
  );
}

function OrdersTable({ mode }: { mode: PaymentMode }) {
  const [status, setStatus] = React.useState('');
  const [q, setQ] = React.useState('');
  const { list, setPage } = useFinanceList<AdminOrderListItem>(
    '/admin/payments/orders',
    mode,
    status,
    q,
  );
  return (
    <div className="grid gap-4">
      <Filters
        idPrefix="orders"
        status={status}
        setStatus={setStatus}
        onSearch={setQ}
        options={[
          { value: 'PAID', label: 'Paid' },
          { value: 'PENDING', label: 'Awaiting payment' },
          { value: 'EXPIRED', label: 'Expired' },
          { value: 'CANCELLED', label: 'Replaced' },
        ]}
      />
      <ListState list={list} setPage={setPage} label="orders">
        {(items) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/admin/payments/orders/${order.id}`}
                    >
                      {order.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Student student={order.student} />
                  </TableCell>
                  <TableCell>{order.course.title}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(order.amountMinor, order.currency)}
                    {order.refundedMinor > 0 ? (
                      <span className="block type-caption text-muted-foreground">
                        refunded {formatAmount(order.refundedMinor, order.currency)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ORDER_STATUS[order.status].tone}>
                      {ORDER_STATUS[order.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{when(order.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListState>
    </div>
  );
}

function PaymentsTable({ mode }: { mode: PaymentMode }) {
  const [status, setStatus] = React.useState('');
  const [q, setQ] = React.useState('');
  const review = status === 'REVIEW';
  const { list, setPage } = useFinanceList<AdminPaymentListItem>(
    '/admin/payments/transactions',
    mode,
    review ? '' : status,
    q,
    review ? '&needsReview=true' : '',
  );
  return (
    <div className="grid gap-4">
      <Filters
        idPrefix="payments"
        status={status}
        setStatus={setStatus}
        onSearch={setQ}
        options={[
          { value: 'CAPTURED', label: 'Successful' },
          { value: 'FAILED', label: 'Failed' },
          { value: 'AUTHORIZED', label: 'Processing' },
          { value: 'REVIEW', label: 'Needs review' },
        ]}
      />
      <ListState list={list} setPage={setPage} label="transactions">
        {(items) => <PaymentRows items={items} />}
      </ListState>
    </div>
  );
}

function PaymentRows({
  items,
  onRefund,
}: {
  items: AdminPaymentListItem[];
  onRefund?: (payment: AdminPaymentListItem) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Payment</TableHead>
          <TableHead>Student</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          {onRefund ? <TableHead className="text-right">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <span className="grid">
                <span className="font-mono text-xs">{p.providerPaymentId}</span>
                <Link
                  className="type-caption text-primary hover:underline"
                  href={`/admin/payments/orders/${p.orderId}`}
                >
                  {p.orderReference}
                </Link>
                {p.method ? (
                  <span className="type-caption text-muted-foreground">
                    {METHOD_LABEL[p.method] ?? p.method}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>
              <Student student={p.student} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(p.amountMinor, p.currency)}
              {p.refundedMinor > 0 ? (
                <span className="block type-caption text-muted-foreground">
                  refunded {formatAmount(p.refundedMinor, p.currency)}
                </span>
              ) : null}
            </TableCell>
            <TableCell>
              <span className="grid gap-1">
                <Badge variant={PAYMENT_STATUS[p.status].tone}>
                  {PAYMENT_STATUS[p.status].label}
                </Badge>
                {p.reviewReason ? <Badge variant="warning">Needs review</Badge> : null}
                {p.reviewReason ? (
                  <span className="max-w-64 type-caption text-muted-foreground">
                    {p.reviewReason}
                  </span>
                ) : null}
                {p.status === 'FAILED' && p.errorDescription ? (
                  <span className="max-w-64 type-caption text-muted-foreground">
                    {p.errorDescription}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>{when(p.capturedAt ?? p.failedAt ?? p.createdAt)}</TableCell>
            {onRefund ? (
              <TableCell className="text-right">
                {p.refundableMinor > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => onRefund(p)}>
                    Refund
                  </Button>
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RefundsTable({ mode }: { mode: PaymentMode }) {
  const [status, setStatus] = React.useState('');
  const [q, setQ] = React.useState('');
  const { list, setPage } = useFinanceList<AdminRefundDto>(
    '/admin/payments/refunds',
    mode,
    status,
    q,
  );
  return (
    <div className="grid gap-4">
      <Filters
        idPrefix="refunds"
        status={status}
        setStatus={setStatus}
        onSearch={setQ}
        options={Object.entries(REFUND_STATUS).map(([value, { label }]) => ({ value, label }))}
      />
      <ListState list={list} setPage={setPage} label="refunds">
        {(items) => <RefundRows items={items} />}
      </ListState>
    </div>
  );
}

function RefundRows({
  items,
  onReconcile,
}: {
  items: AdminRefundDto[];
  onReconcile?: (refund: AdminRefundDto) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Refund</TableHead>
          <TableHead>Student</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Requested</TableHead>
          {onReconcile ? <TableHead className="text-right">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <span className="grid">
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/admin/payments/orders/${r.orderId}`}
                >
                  {r.orderReference}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.providerRefundId ?? 'not yet at Razorpay'}
                </span>
                {r.reason ? (
                  <span className="max-w-64 type-caption text-muted-foreground">{r.reason}</span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>
              <Student student={r.student} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAmount(r.amountMinor, r.currency)}
            </TableCell>
            <TableCell>
              <span className="grid gap-1">
                <Badge variant={REFUND_STATUS[r.status].tone}>
                  {REFUND_STATUS[r.status].label}
                </Badge>
                {r.revokedAccess ? <Badge variant="secondary">Access revoked</Badge> : null}
                {r.failureReason ? (
                  <span className="max-w-64 type-caption text-muted-foreground">
                    {r.failureReason}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>
              <span className="grid">
                <span>{when(r.createdAt)}</span>
                <span className="type-caption text-muted-foreground">
                  {r.requestedBy ?? 'Razorpay Dashboard'}
                </span>
              </span>
            </TableCell>
            {onReconcile ? (
              <TableCell className="text-right">
                {r.status === 'REQUESTED' || r.status === 'PENDING' ? (
                  <Button size="sm" variant="ghost" onClick={() => onReconcile(r)}>
                    Check status
                  </Button>
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// --- Order detail ---------------------------------------------------------------------------

export function PaymentOrderDetail({ id }: { id: string }) {
  const api = useAdminApi();
  const config = usePaymentsConfig();
  const path = `/admin/payments/orders/${id}`;
  const detail = useApiResource(path, () => api.get<AdminOrderDetail>(path));
  const [refunding, setRefunding] = React.useState<AdminPaymentListItem | null>(null);
  const [reconciling, setReconciling] = React.useState(false);

  if (detail.error && !detail.data)
    return <ErrorPanel message={errorMessage(detail.error)} onRetry={detail.reload} />;
  if (!detail.data) return <LoadingPanel label="Loading order…" />;
  const order = detail.data;
  const canRefund = config.data?.canRefund ?? false;

  async function reconcile() {
    setReconciling(true);
    try {
      detail.replace(await api.post<AdminOrderDetail>(`/admin/payments/orders/${id}/reconcile`));
      toast.success('Order checked with Razorpay');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReconciling(false);
    }
  }

  const facts: [string, React.ReactNode][] = [
    [
      'Status',
      <Badge key="s" variant={ORDER_STATUS[order.status].tone}>
        {ORDER_STATUS[order.status].label}
      </Badge>,
    ],
    ['Mode', MODE_LABEL[order.mode]],
    ['Student', `${order.student.fullName} (${order.student.email})`],
    ['Course', order.course.title],
    ['Course fee', formatAmount(order.price.listPriceMinor, order.price.currency)],
    [
      'Discount',
      order.price.discountMinor > 0
        ? `− ${formatAmount(order.price.discountMinor, order.price.currency)}`
        : '—',
    ],
    ['Amount', formatAmount(order.amountMinor, order.currency)],
    ['Razorpay order', order.providerOrderId ?? 'Not created'],
    ['Created', when(order.createdAt)],
    ['Paid', when(order.paidAt)],
    ['Checkout window ends', when(order.expiresAt)],
    [
      'Enrolment',
      order.enrollment
        ? `${order.enrollment.status === 'ACTIVE' ? 'Active' : 'Cancelled'} (${order.enrollment.source.toLowerCase()})`
        : 'None',
    ],
    [
      'Confirmation email',
      order.confirmationEmailSentAt ? `Sent ${when(order.confirmationEmailSentAt)}` : 'Not sent',
    ],
    ['Last checked with Razorpay', when(order.lastReconciledAt)],
  ];

  return (
    <>
      <PageHeader
        title={`Order ${order.reference}`}
        breadcrumbs={[
          ...crumbs,
          { label: 'Payments', href: '/admin/payments' },
          { label: order.reference },
        ]}
        actions={
          <Button
            variant="outline"
            onClick={reconcile}
            loading={reconciling}
            loadingText="Checking…"
          >
            <RefreshCw aria-hidden /> Check with Razorpay
          </Button>
        }
      />
      {order.mode === 'TEST' ? (
        <Badge variant="warning">Test transaction — not real money</Badge>
      ) : null}
      {order.failureReason && order.status !== 'PAID' ? (
        <Alert tone="warning" title="Last problem">
          <p>{order.failureReason}</p>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <dl className="grid gap-2 type-body-sm sm:grid-cols-[14rem_1fr]">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <section className="grid gap-3" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="type-h2 text-heading">
          Payment attempts
        </h2>
        {order.payments.length === 0 ? (
          <p className="type-body-sm text-muted-foreground">
            No payment attempt has been recorded.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <PaymentRows
              items={order.payments}
              {...(canRefund ? { onRefund: setRefunding } : {})}
            />
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="refunds-heading">
        <h2 id="refunds-heading" className="type-h2 text-heading">
          Refunds
        </h2>
        {order.refunds.length === 0 ? (
          <p className="type-body-sm text-muted-foreground">No refunds.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <RefundRows
              items={order.refunds}
              onReconcile={async (refund) => {
                try {
                  await api.post(`/admin/payments/refunds/${refund.id}/reconcile`);
                  detail.reload();
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            />
          </div>
        )}
      </section>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle as="h2">History</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 type-body-sm">
            {order.audit.map((entry, index) => (
              <li key={index} className="flex flex-wrap gap-x-3">
                <span className="text-muted-foreground tabular-nums">{when(entry.createdAt)}</span>
                <span className="font-medium">{entry.action}</span>
                <span className="text-muted-foreground">{entry.actor ?? 'System'}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {refunding ? (
        <RefundDialog
          payment={refunding}
          onClose={() => setRefunding(null)}
          onDone={() => {
            setRefunding(null);
            detail.reload();
          }}
        />
      ) : null}
    </>
  );
}

function RefundDialog({
  payment,
  onClose,
  onDone,
}: {
  payment: AdminPaymentListItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const api = useAdminApi();
  // One key per dialog: a double click or a retried request returns the same refund.
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [revokeAccess, setRevokeAccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const max = formatAmount(payment.refundableMinor, payment.currency);

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Refund this payment?"
      description={`Up to ${max} can be refunded through Razorpay. The original payment record is kept.`}
      confirmLabel="Request refund"
      pendingLabel="Requesting…"
      destructive
      onConfirm={async () => {
        setError(null);
        const amountMinor = amount.trim() === '' ? undefined : parseMoneyInput(amount);
        if (amountMinor === null || (amount.trim() !== '' && amountMinor === undefined)) {
          setError(
            'Enter an amount such as 500 or 499.50, or leave it empty for the full balance.',
          );
          throw new Error('invalid');
        }
        try {
          const refund = await api.post<AdminRefundDto>(
            `/admin/payments/transactions/${payment.id}/refunds`,
            {
              ...(amountMinor === undefined ? {} : { amountMinor }),
              reason,
              revokeAccess,
              idempotencyKey,
            },
          );
          toast.success(`Refund ${REFUND_STATUS[refund.status].label.toLowerCase()}`);
          onDone();
        } catch (caught) {
          setError(errorMessage(caught));
          throw caught;
        }
      }}
    >
      <div className="grid gap-4">
        <Field
          id="refund-amount"
          label="Amount (₹)"
          hint={`Leave empty to refund the full remaining ${max}.`}
          optional
        >
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={max}
          />
        </Field>
        <Field id="refund-reason" label="Reason">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </Field>
        <CheckboxField
          id="refund-revoke"
          label="Also cancel the student's access to this course"
          checked={revokeAccess}
          onChange={setRevokeAccess}
          hint="A refund does not remove access by itself (refund policy pending, N-03)."
        />
        {error ? (
          <p role="alert" className="type-body-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
