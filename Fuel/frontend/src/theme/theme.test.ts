import { darkColors, lightColors, radius, sizing, space, type } from '@/theme';
import type { Colors } from '@/theme/colors';

describe('theme tokens', () => {
  it('uses the green accent in light and dark', () => {
    expect(lightColors.accent).toBe('#1F5C4A');
    expect(darkColors.accent).toBe('#6CC3A3');
  });

  it('uses a hairline instead of a solid border in dark', () => {
    expect(darkColors.divider).toBe('rgba(255,255,255,0.06)');
    expect(darkColors.border).toBe('rgba(255,255,255,0.06)');
  });

  it('gives every type token a Manrope family and no fontWeight', () => {
    for (const token of Object.values(type)) {
      expect(token.fontFamily).toMatch(/^Manrope_\d{3}/);
      expect(token).not.toHaveProperty('fontWeight');
    }
  });

  describe('contrast (WCAG)', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const textPairs: [keyof Colors, keyof Colors][] = [
      ['text', 'bg'],
      ['text', 'surface'],
      ['textSecondary', 'bg'],
      ['textSecondary', 'surface'],
      ['textTertiary', 'bg'],
      ['textTertiary', 'surface'],
      ['accentText', 'bg'],
      ['accentText', 'surface'],
      ['onAccent', 'accent'],
      ['verified', 'surface'],
      ['danger', 'bg'],
      ['caution', 'bg'],
    ];
    const graphics: (keyof Colors)[] = ['accent', 'protein', 'carbs', 'fat'];

    for (const [name, c] of [['light', lightColors], ['dark', darkColors]] as const) {
      it.each(textPairs)(`${name}: %s on %s is at least 4.5:1`, (fg, bg) => {
        expect(ratio(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
      });
      it(`${name}: onScrim is at least 4.5:1 over the scrim on black`, () => {
        expect(ratio(c.onScrim, '#000000')).toBeGreaterThanOrEqual(4.5);
      });
      it.each(graphics)(`${name}: %s on surface is at least 3:1`, (fg) => {
        expect(ratio(c[fg], c.surface)).toBeGreaterThanOrEqual(3);
        expect(ratio(c[fg], c.bg)).toBeGreaterThanOrEqual(3);
      });
    }
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
