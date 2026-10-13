import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@asra/validation';
import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import { requireTrustedOrigin } from '../middleware/trusted-origin.js';
import { validateRequest } from '../middleware/validate-request.js';

/**
 * `/api/v1/auth`. Order per route: rate limit → body validation → controller, so malformed or
 * throttled requests never reach Argon2 or the database. No route accepts a role.
 */
export const authRouter = Router();

// Responses may carry access tokens or account state — never cache them.
authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
// CSRF defence for every state-changing auth request (the refresh cookie is scoped here).
authRouter.use(requireTrustedOrigin);

authRouter.post(
  '/register',
  authRateLimit('register'),
  validateRequest({ body: registerSchema }),
  authController.register,
);
authRouter.post(
  '/login',
  authRateLimit('login'),
  validateRequest({ body: loginSchema }),
  authController.login,
);
authRouter.post('/refresh', authRateLimit('refresh'), authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.post('/logout-all', authenticate, authController.logoutAll);
authRouter.get('/me', authenticate, authController.me);
authRouter.post(
  '/forgot-password',
  authRateLimit('forgotPassword'),
  validateRequest({ body: emailOnlySchema }),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  authRateLimit('resetPassword'),
  validateRequest({ body: resetPasswordSchema }),
  authController.resetPassword,
);
authRouter.post(
  '/verify-email',
  authRateLimit('verifyEmail'),
  validateRequest({ body: verifyEmailSchema }),
  authController.verifyEmail,
);
authRouter.post(
  '/resend-verification',
  authRateLimit('resendVerification'),
  validateRequest({ body: emailOnlySchema }),
  authController.resendVerification,
);
