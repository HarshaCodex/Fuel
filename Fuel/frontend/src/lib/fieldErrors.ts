import { ApiError } from '@/api/errors';

export type FieldErrorMap<F extends string> = {
  errors: Partial<Record<F, string>>;
  /** True when the server flagged a field the screen has no input for; show a generic banner. */
  hasUnmatched: boolean;
};

const EMPTY = { errors: {}, hasUnmatched: false };

/** Maps a 400 validation response to per-field messages. The first message per field wins. */
export function mapFieldErrors<F extends string>(e: unknown, fields: readonly F[]): FieldErrorMap<F> {
  if (!(e instanceof ApiError) || e.status !== 400 || e.fieldErrors.length === 0) return { ...EMPTY };
  const errors: Partial<Record<F, string>> = {};
  let hasUnmatched = false;
  for (const { field, message } of e.fieldErrors) {
    const known = fields.find((f) => f === field);
    if (!known) hasUnmatched = true;
    else if (errors[known] === undefined) errors[known] = message;
  }
  return { errors, hasUnmatched };
}
