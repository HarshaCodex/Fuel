import { fireEvent, render, screen } from '@testing-library/react-native';

import { Banner } from './Banner';

describe('Banner', () => {
  it('shows the message as a polite live region', async () => {
    await render(<Banner variant="info" message="Hello" />);
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.toJSON()).toMatchObject({ props: { accessibilityLiveRegion: 'polite' } });
  });
  it('runs the action', async () => {
    const onPress = jest.fn();
    await render(<Banner variant="caution" message="Offline" action={{ label: 'Retry', onPress }} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onPress).toHaveBeenCalled();
  });
  it.each(['caution', 'info', 'success', 'danger'] as const)('renders %s', async (v) => {
    await render(<Banner variant={v} message="m" />);
    expect(screen.getByText('m')).toBeTruthy();
  });
});
