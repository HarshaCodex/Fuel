import { fireEvent, render, screen } from '@testing-library/react-native';

import { StateBlock } from './StateBlock';

const props = { title: 'Nothing here', message: 'Some cause', actionLabel: 'Go' };

describe('StateBlock', () => {
  it.each(['empty', 'error'] as const)('shows title, message and calls onAction for %s', async (variant) => {
    const onAction = jest.fn();
    await render(<StateBlock variant={variant} {...props} onAction={onAction} />);
    expect(screen.getByRole('header', { name: 'Nothing here' })).toBeOnTheScreen();
    expect(screen.getByText('Some cause')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('announces the error variant assertively', async () => {
    const { toJSON } = await render(<StateBlock variant="error" {...props} onAction={jest.fn()} />);
    expect((toJSON() as { props: { accessibilityLiveRegion?: string } }).props.accessibilityLiveRegion).toBe('assertive');
  });

  it('does not announce the empty variant', async () => {
    const { toJSON } = await render(<StateBlock variant="empty" {...props} onAction={jest.fn()} />);
    expect((toJSON() as { props: { accessibilityLiveRegion?: string } }).props.accessibilityLiveRegion).toBeUndefined();
  });
});
