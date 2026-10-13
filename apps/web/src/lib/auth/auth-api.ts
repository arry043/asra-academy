import type { AuthSessionData, AuthUser } from '@asra/types';
import type {
  EmailOnlyInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@asra/validation';
import { apiRequest } from '@/lib/api';

/**
 * Typed calls to `/api/v1/auth/*`. The refresh token travels only in the HttpOnly cookie that
 * the browser attaches automatically — this module never sees it.
 */
export const authApi = {
  register: (input: RegisterInput) =>
    apiRequest<null>('/auth/register', { method: 'POST', body: input }),
  login: (input: LoginInput) =>
    apiRequest<AuthSessionData>('/auth/login', { method: 'POST', body: input }),
  refresh: () => apiRequest<AuthSessionData>('/auth/refresh', { method: 'POST' }),
  logout: () => apiRequest<null>('/auth/logout', { method: 'POST' }),
  logoutAll: (accessToken: string) =>
    apiRequest<{ revokedSessions: number }>('/auth/logout-all', { method: 'POST', accessToken }),
  me: (accessToken: string) => apiRequest<AuthUser>('/auth/me', { accessToken }),
  forgotPassword: (input: EmailOnlyInput) =>
    apiRequest<null>('/auth/forgot-password', { method: 'POST', body: input }),
  resetPassword: (input: ResetPasswordInput) =>
    apiRequest<null>('/auth/reset-password', { method: 'POST', body: input }),
  verifyEmail: (input: VerifyEmailInput) =>
    apiRequest<{ status: 'verified' | 'already-verified' }>('/auth/verify-email', {
      method: 'POST',
      body: input,
    }),
  resendVerification: (input: EmailOnlyInput) =>
    apiRequest<null>('/auth/resend-verification', { method: 'POST', body: input }),
};
