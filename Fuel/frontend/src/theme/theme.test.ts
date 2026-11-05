import { darkColors, lightColors, radius, sizing, space } from '@/theme';

describe('theme tokens', () => {
  it('uses the indigo accent in light and dark', () => {
    expect(lightColors.accent).toBe('#4F46E5');
    expect(darkColors.accent).toBe('#5B52EC');
  });

  it('follows the 4pt spacing scale', () => {
    expect(space).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 });
  });

  it('exposes radius and touch target sizes', () => {
    expect(radius.md).toBe(12);
    expect(radius.lg).toBe(16);
    expect(sizing.touchMin).toBe(44);
  });

  it('keeps light and dark palettes in step with valid values', () => {
    expect(Object.keys(darkColors)).toEqual(Object.keys(lightColors));
    for (const value of [...Object.values(lightColors), ...Object.values(darkColors)]) {
      expect(value).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\(.+\))$/);
    }
  });
});
