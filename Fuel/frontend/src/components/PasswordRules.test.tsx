import { render, screen } from '@testing-library/react-native';

import { PasswordRules } from './PasswordRules';

it('always shows the rules summary and marks each rule not met when empty', async () => {
  await render(<PasswordRules value="" />);
  expect(screen.getByText('8+ characters with upper and lower case, a number and a symbol')).toBeTruthy();
  expect(screen.getAllByLabelText(/not met$/)).toHaveLength(5);
  expect(screen.queryAllByLabelText(/, met$/)).toHaveLength(0);
});

it('ticks rules as they are met', async () => {
  await render(<PasswordRules value="abc" />);
  expect(screen.getByLabelText('A lowercase letter, met')).toBeTruthy();
  expect(screen.getByLabelText('An uppercase letter, not met')).toBeTruthy();
});

it('shows all met for a strong password', async () => {
  await render(<PasswordRules value="Abcdef1!" />);
  expect(screen.getAllByLabelText(/, met$/)).toHaveLength(5);
});
