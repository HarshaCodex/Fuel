import { validateEmail, validateLoginPassword } from './validation';

describe('validateEmail', () => {
  it('accepts a normal and a padded address', () => {
    expect(validateEmail('a.b+c@example.com')).toBeNull();
    expect(validateEmail('  a@b.io  ')).toBeNull();
  });
  it.each(['', '   ', 'abc', 'a@b', 'a@b.c', 'a b@c.com', `${'a'.repeat(250)}@b.com`])('rejects %j', (v) => {
    expect(validateEmail(v)).toBe('Enter a valid email address.');
  });
});

describe('validateLoginPassword', () => {
  it('requires a value of at most 128 characters and no complexity', () => {
    expect(validateLoginPassword('')).toBe('Enter your password.');
    expect(validateLoginPassword('a')).toBeNull();
    expect(validateLoginPassword('a'.repeat(128))).toBeNull();
    expect(validateLoginPassword('a'.repeat(129))).toBe('Enter your password.');
  });
});
