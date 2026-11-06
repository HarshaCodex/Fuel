import { checkPassword, PASSWORD_RULES, validateNewPassword } from './passwordRules';

const GOOD = 'Abcdef1!';
const MSG = 'Choose a password that meets all the rules.';

describe('validateNewPassword', () => {
  it('accepts a password meeting every rule', () => {
    expect(validateNewPassword(GOOD)).toBeNull();
  });
  it.each([
    ['too short (7)', 'Abcde1!'],
    ['no lowercase', 'ABCDEF1!'],
    ['no uppercase', 'abcdef1!'],
    ['no digit', 'Abcdefg!'],
    ['no symbol', 'Abcdefg1'],
    ['empty', ''],
  ])('rejects %s', (_n, v) => {
    expect(validateNewPassword(v)).toBe(MSG);
  });
  it('enforces 8 to 64 characters', () => {
    expect(validateNewPassword('Aa1!' + 'a'.repeat(4))).toBeNull();
    expect(validateNewPassword('Aa1!' + 'a'.repeat(60))).toBeNull();
    expect(validateNewPassword('Aa1!' + 'a'.repeat(61))).toBe(MSG);
  });
  it('counts a non-ASCII character as a symbol', () => {
    expect(validateNewPassword('Abcdefg1é')).toBeNull();
  });
  it('rejects more than 72 UTF-8 bytes even within 64 characters', () => {
    const v = 'Aa1' + '€'.repeat(30); // 33 chars, 93 bytes
    expect(validateNewPassword(v)).toBe('Use at most 72 bytes.');
    expect(checkPassword(v).bytesExceeded).toBe(true);
  });
  it('exposes a tick row for each of the five rules', () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual(['length', 'lower', 'upper', 'digit', 'symbol']);
  });
});
