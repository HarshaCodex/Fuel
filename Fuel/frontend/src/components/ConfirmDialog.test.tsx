import { fireEvent, render, screen } from '@testing-library/react-native';

import { ConfirmDialog } from './ConfirmDialog';

const base = { title: 'Delete oats?', confirmLabel: 'Delete', onConfirm: jest.fn(), onCancel: jest.fn() };
beforeEach(() => jest.clearAllMocks());

describe('ConfirmDialog', () => {
  it.each([false, true])('shows the title and calls confirm and cancel (danger=%p)', async (danger) => {
    await render(<ConfirmDialog {...base} visible danger={danger} message="This cannot be undone." />);
    expect(screen.getByText('Delete oats?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(base.onConfirm).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(base.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when not visible', async () => {
    await render(<ConfirmDialog {...base} visible={false} />);
    expect(screen.queryByText('Delete oats?')).toBeNull();
  });

  it('blocks the buttons while loading', async () => {
    await render(<ConfirmDialog {...base} visible danger loading />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(base.onConfirm).not.toHaveBeenCalled();
  });
});
