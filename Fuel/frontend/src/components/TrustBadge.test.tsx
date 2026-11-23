import { render, screen } from '@testing-library/react-native';

import { lightColors } from '@/theme';

import { TrustBadge } from './TrustBadge';

// Render the icon as a probe so the test can read the name, colour and size it was given.
jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual('react-native');
  return { Ionicons: (p: { name: string }) => <Text testID="icon" {...p} /> };
});

describe('TrustBadge', () => {
  it.each([
    ['USDA', 'USDA Verified', 'checkmark-circle', lightColors.success, lightColors.successSoft],
    ['OFF', 'Manufacturer Label', 'pricetag', lightColors.info, lightColors.infoSoft],
    ['USER', 'You Entered', 'pencil', lightColors.accentText, lightColors.accentSoft],
  ] as const)('shows %s as text, icon and colours', async (source, text, icon, fg, bg) => {
    await render(<TrustBadge source={source} />);
    const label = screen.getByText(text);
    expect(label.props.maxFontSizeMultiplier).toBe(1.3);
    expect(label).toHaveStyle({ color: fg });
    expect(label.parent).toHaveStyle({ backgroundColor: bg });
    const glyph = screen.getByTestId('icon', { includeHiddenElements: true });
    expect(glyph.props.name).toBe(icon);
    expect(glyph.props.color).toBe(fg);
    expect(glyph.props.size).toBe(16);
    expect(glyph.props.accessibilityElementsHidden).toBe(true);
  });
});
