import { ApiError, NetworkError } from '@/api/errors';
import { mapFieldErrors } from './fieldErrors';

const FIELDS = ['age', 'height'] as const;

describe('mapFieldErrors', () => {
  it('maps known fields', () => {
    const e = new ApiError(400, 'bad', [{ field: 'age', message: 'low' }]);
    expect(mapFieldErrors(e, FIELDS)).toEqual({ errors: { age: 'low' }, hasUnmatched: false });
  });

  it('keeps the first message for a field', () => {
    const e = new ApiError(400, 'bad', [
      { field: 'age', message: 'first' },
      { field: 'age', message: 'second' },
    ]);
    expect(mapFieldErrors(e, FIELDS).errors.age).toBe('first');
  });

  it('flags unknown fields and still maps known ones', () => {
    const e = new ApiError(400, 'bad', [
      { field: 'nope', message: 'x' },
      { field: 'height', message: 'h' },
    ]);
    expect(mapFieldErrors(e, FIELDS)).toEqual({ errors: { height: 'h' }, hasUnmatched: true });
  });

  it.each([
    ['non-400', new ApiError(500, 'x', [{ field: 'age', message: 'm' }])],
    ['empty errors', new ApiError(400, 'x', [])],
    ['network error', new NetworkError()],
    ['non-error', 'boom'],
  ])('returns an empty map for %s', (_n, e) => {
    expect(mapFieldErrors(e, FIELDS)).toEqual({ errors: {}, hasUnmatched: false });
  });
});
