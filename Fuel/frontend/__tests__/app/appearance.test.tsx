import { fireEvent, render, screen } from '@testing-library/react-native';

import * as appearance from '@/lib/appearance';

import AppearanceScreen from '../../app/appearance';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/lib/appearance', () => ({
  ...jest.requireActual('@/lib/appearance'),
  getAppearance: jest.fn(() => 'light'),
  setAppearance: jest.fn(),
}));

describe('AppearanceScreen', () => {
  it('shows three radios with the current choice selected', async () => {
    await render(<AppearanceScreen />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByLabelText('Light. Always light').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Dark. Always dark').props.accessibilityState.selected).toBe(false);
  });

  it('applies Dark when pressed and marks it selected', async () => {
    await render(<AppearanceScreen />);
    await fireEvent.press(screen.getByLabelText('Dark. Always dark'));
    expect(appearance.setAppearance).toHaveBeenCalledWith('dark');
    expect(screen.getByLabelText('Dark. Always dark').props.accessibilityState.selected).toBe(true);
  });
});
