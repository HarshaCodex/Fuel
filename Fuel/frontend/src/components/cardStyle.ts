import { shadow, useTheme } from '@/theme';

/** Soft depth: a shadow in light mode; no shadow and a 1px hairline in dark mode (ui.md 1.4). */
export function useCardStyle() {
  const { colors, scheme } = useTheme();
  return scheme === 'dark'
    ? ({ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } as const)
    : ({ backgroundColor: colors.surface, ...shadow.md } as const);
}
