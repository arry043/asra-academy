/** Standard success envelope returned by every ASRA API endpoint. */
export interface ApiSuccessResponse<TData = unknown> {
  success: true;
  message: string;
  data: TData;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  details?: unknown;
}

/** Standard error envelope returned by every ASRA API endpoint. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  error: ApiErrorBody;
}

export type ApiResponse<TData = unknown> = ApiSuccessResponse<TData> | ApiErrorResponse;

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type AppEnvironment = 'development' | 'test' | 'production';

/** Payload of `GET /api/v1/health`. */
export interface HealthData {
  environment: AppEnvironment;
}

export type DependencyStatus = 'up' | 'down';

/** Payload of `GET /api/v1/health/ready`. */
export interface ReadinessData {
  environment: AppEnvironment;
  database: DependencyStatus;
  redis: DependencyStatus;
}
