import { PERMISSIONS } from '@asra/types';
import {
  adminOrderListQuerySchema,
  adminPaymentListQuerySchema,
  adminRefundListQuerySchema,
  createOrderSchema,
  paymentSummaryQuerySchema,
  refundCreateSchema,
  studentOrderListQuerySchema,
  verifyPaymentSchema,
  type AdminOrderListQuery,
  type AdminPaymentListQuery,
  type AdminRefundListQuery,
  type PaymentSummaryQuery,
  type RefundCreateInput,
  type StudentOrderListQuery,
  type VerifyPaymentInput,
} from '@asra/validation';
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/authorize.js';
import { paymentRateLimit } from '../../middleware/rate-limit.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../utils/api-response.js';
import { idParamsSchema } from '../../validators/common.validators.js';
import { paymentsAdminService as admin } from './admin.service.js';
import { ordersService as orders } from './orders.service.js';
import { refundsService } from './refunds.service.js';
import { handleRazorpayWebhook } from './webhooks.js';

/**
 * PHASE 10 routes (docs/PAYMENTS.md §14):
 *   studentPaymentsRouter → mounted inside `/student` (STUDENT role, no-store) — checkout & history
 *   paymentsAdminRouter   → mounted inside `/admin` (authenticated, no-store) — finance views
 *   paymentWebhooksRouter → `/payments/webhooks`, mounted in app.ts BEFORE express.json so the
 *                           signature is computed over the raw bytes
 */

const id = (req: Request) => String(req.params.id);
const byId = validateRequest({ params: idParamsSchema });

// --- Student ------------------------------------------------------------------------------------

export const studentPaymentsRouter = Router();
const buyer = requirePermission(PERMISSIONS.PAYMENTS_MAKE_OWN);
const s = studentPaymentsRouter;

s.get(
  '/checkout/:slug',
  buyer,
  validateRequest({ params: z.object({ slug: z.string().min(1).max(220) }) }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await orders.quote(req.auth!, String(req.params.slug)));
  },
);

s.post(
  '/orders',
  buyer,
  paymentRateLimit('orderCreate'),
  validateRequest({ body: createOrderSchema }),
  async (req: Request, res: Response) => {
    const { courseId } = req.body as { courseId: string };
    sendSuccess(res, await orders.createOrder(req.auth!, courseId), 'Checkout ready', 201);
  },
);

s.get(
  '/orders',
  buyer,
  validateRequest({ query: studentOrderListQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await orders.list(req.auth!, req.query as unknown as StudentOrderListQuery));
  },
);

s.get('/orders/:id', buyer, byId, async (req: Request, res: Response) => {
  sendSuccess(res, await orders.get(req.auth!, id(req)));
});

s.post(
  '/orders/:id/verify',
  buyer,
  paymentRateLimit('verify'),
  validateRequest({ params: idParamsSchema, body: verifyPaymentSchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await orders.verify(req.auth!, id(req), req.body as VerifyPaymentInput));
  },
);

s.post(
  '/orders/:id/refresh',
  buyer,
  paymentRateLimit('refresh'),
  byId,
  async (req: Request, res: Response) => {
    sendSuccess(res, await orders.refresh(req.auth!, id(req)));
  },
);

s.get('/orders/:id/receipt', buyer, byId, async (req: Request, res: Response) => {
  sendSuccess(res, await orders.receipt(req.auth!, id(req)));
});

// --- Admin --------------------------------------------------------------------------------------

export const paymentsAdminRouter = Router();
const view = requirePermission(PERMISSIONS.PAYMENTS_VIEW);
const refund = requirePermission(PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.PAYMENTS_REFUND);
const a = paymentsAdminRouter;

a.get('/payments/config', view, (req: Request, res: Response) => {
  sendSuccess(res, admin.config(req.auth!));
});

a.get(
  '/payments/summary',
  view,
  validateRequest({ query: paymentSummaryQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await admin.summary(req.query as unknown as PaymentSummaryQuery));
  },
);

a.get(
  '/payments/orders',
  view,
  validateRequest({ query: adminOrderListQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await admin.orders(req.query as unknown as AdminOrderListQuery));
  },
);

a.get('/payments/orders/:id', view, byId, async (req: Request, res: Response) => {
  sendSuccess(res, await admin.order(id(req)));
});

a.post('/payments/orders/:id/reconcile', view, byId, async (req: Request, res: Response) => {
  sendSuccess(res, await admin.reconcile(req.auth!, id(req)), 'Order reconciled');
});

a.get(
  '/payments/transactions',
  view,
  validateRequest({ query: adminPaymentListQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await admin.payments(req.query as unknown as AdminPaymentListQuery));
  },
);

a.post(
  '/payments/transactions/:id/refunds',
  refund,
  paymentRateLimit('refund'),
  validateRequest({ params: idParamsSchema, body: refundCreateSchema }),
  async (req: Request, res: Response) => {
    const data = await refundsService.request(req.auth!, id(req), req.body as RefundCreateInput);
    sendSuccess(res, data, 'Refund requested', 201);
  },
);

a.get(
  '/payments/refunds',
  view,
  validateRequest({ query: adminRefundListQuerySchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await admin.refunds(req.query as unknown as AdminRefundListQuery));
  },
);

a.post('/payments/refunds/:id/reconcile', view, byId, async (req: Request, res: Response) => {
  sendSuccess(res, await refundsService.reconcile(id(req)), 'Refund reconciled');
});

// --- Webhooks (public, signature-verified) ------------------------------------------------------

export const paymentWebhooksRouter = Router();
// Raw bytes for the HMAC. Only application/json is accepted; anything else is rejected as empty.
paymentWebhooksRouter.use(express.raw({ type: 'application/json', limit: '512kb' }));
paymentWebhooksRouter.use(paymentRateLimit('webhook'));
paymentWebhooksRouter.post('/razorpay', handleRazorpayWebhook);
paymentWebhooksRouter.post('/razorpay/:mode', handleRazorpayWebhook);
