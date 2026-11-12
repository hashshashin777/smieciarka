export interface AppError {
  code:
    | 'NETWORK'
    | 'AUTH'
    | 'VALIDATION'
    | 'NOT_FOUND'
    | 'UPLOAD'
    | 'NOT_CONFIGURED'
    | 'UNKNOWN';
  message: string;
  cause?: unknown;
}

export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export function ok<T>(data: T): AppResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: AppError['code'],
  message: string,
  cause?: unknown
): AppResult<T> {
  return { ok: false, error: { code, message, cause } };
}
