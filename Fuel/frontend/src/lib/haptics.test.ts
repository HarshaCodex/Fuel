import * as Haptics from 'expo-haptics';

import { hapticLight, hapticSelect } from './haptics';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const impact = Haptics.impactAsync as jest.Mock;
const selection = Haptics.selectionAsync as jest.Mock;

describe('haptics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fires one light impact', async () => {
    impact.mockResolvedValue(undefined);
    hapticLight();
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith('light');
    expect(selection).not.toHaveBeenCalled();
  });

  it('fires one selection tick', () => {
    selection.mockResolvedValue(undefined);
    hapticSelect();
    expect(selection).toHaveBeenCalledTimes(1);
    expect(impact).not.toHaveBeenCalled();
  });

  it('does not throw when the haptic engine rejects', async () => {
    impact.mockRejectedValue(new Error('unavailable'));
    selection.mockRejectedValue(new Error('unavailable'));
    expect(() => {
      hapticLight();
      hapticSelect();
    }).not.toThrow();
    await Promise.resolve();
  });
});
