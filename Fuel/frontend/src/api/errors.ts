export type FieldError = { field: string; message: string };

/** A non-2xx response from the API. Never carries request bodies, tokens or emails. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];
  /** Seconds to wait before retrying (429 only). */
  readonly retryAfter?: number;

  constructor(status: number, message: string, fieldErrors: FieldError[] = [], retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryAfter = retryAfter;
  }
}

/** The request never got a response (offline, DNS, TLS). */
export class NetworkError extends Error {
  constructor() {
    super('Network request failed');
    this.name = 'NetworkError';
  }
}
