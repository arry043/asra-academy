import type { ApiErrorCode, ApiErrorResponse, ApiSuccessResponse } from '@asra/types';
import type { Response } from 'express';

export function sendSuccess<TData>(
  res: Response,
  data: TData,
  message = 'OK',
  statusCode = 200,
): Response<ApiSuccessResponse<TData>> {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): Response<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    message,
    error: details === undefined ? { code } : { code, details },
  };
  return res.status(statusCode).json(body);
}
