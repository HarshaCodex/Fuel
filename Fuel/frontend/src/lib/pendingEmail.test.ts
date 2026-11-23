import { clearPendingEmail, getPendingEmail, setPendingEmail } from './pendingEmail';

it('holds the email in memory until cleared', () => {
  expect(getPendingEmail()).toBeNull();
  setPendingEmail('a@b.co');
  expect(getPendingEmail()).toBe('a@b.co');
  clearPendingEmail();
  expect(getPendingEmail()).toBeNull();
});
