import { render, screen } from '@testing-library/react-native';

import { BrandMark } from './BrandMark';

describe('BrandMark', () => {
  it('shows the wordmark as a header and the tagline', async () => {
    await render(<BrandMark />);
    expect(screen.getByRole('header', { name: 'Fuel' })).toBeTruthy();
    expect(screen.getByText('Track what you eat, simply.')).toBeTruthy();
  });
});
