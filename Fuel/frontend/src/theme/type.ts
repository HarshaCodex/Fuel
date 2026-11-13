export const type = {
  display: { fontSize: 44, lineHeight: 48, fontFamily: 'Manrope_800ExtraBold' },
  title1: { fontSize: 28, lineHeight: 34, fontFamily: 'Manrope_700Bold' },
  title2: { fontSize: 22, lineHeight: 28, fontFamily: 'Manrope_600SemiBold' },
  headline: { fontSize: 17, lineHeight: 24, fontFamily: 'Manrope_600SemiBold' },
  body: { fontSize: 17, lineHeight: 24, fontFamily: 'Manrope_400Regular' },
  callout: { fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_400Regular' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_500Medium' },
} as const;

/** Tabular figures for every number (ui.md 1.2). */
export const numeric = { fontVariant: ['tabular-nums'] } as const;
