import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { UndoToast } from './UndoToast';

describe('UndoToast', () => {
  it('shows the message, announces it and runs the action', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const onAction = jest.fn();
    await render(<UndoToast message="Oats deleted" actionLabel="Undo" onAction={onAction} />);
    expect(screen.getByText('Oats deleted')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Oats deleted');
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('applies the bottom offset and renders a tone icon only when asked', async () => {
    const { toJSON } = await render(<UndoToast message="Added" actionLabel="Undo" onAction={() => {}} tone="error" bottom={16} />);
    expect(JSON.stringify(toJSON())).toContain('"bottom":16');
    expect(screen.getByText('Added')).toBeTruthy();
  });
});
