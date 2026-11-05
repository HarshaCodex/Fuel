import { render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';

import { darkColors, lightColors } from '@/theme';

import { ScreenPlaceholder } from './ScreenPlaceholder';

describe('ScreenPlaceholder', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the title as a header with its purpose', async () => {
    await render(<ScreenPlaceholder title="Today" purpose="Show how today is going" />);
    expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Show how today is going')).toBeTruthy();
  });

  it('uses the light background by default', async () => {
    await render(<ScreenPlaceholder title="T" purpose="p" />);
    expect(screen.getByTestId('screen-placeholder')).toHaveStyle({ backgroundColor: lightColors.bg });
  });

  it('uses the dark background in the dark scheme', async () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
    await render(<ScreenPlaceholder title="T" purpose="p" />);
    expect(screen.getByTestId('screen-placeholder')).toHaveStyle({ backgroundColor: darkColors.bg });
  });
});
