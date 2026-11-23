export const type = {
  display: { fontSize: 44, lineHeight: 48, fontFamily: 'Manrope_800ExtraBold' },
  title1: { fontSize: 28, lineHeight: 34, fontFamily: 'Manrope_700Bold' },
  title2: { fontSize: 22, lineHeight: 28, fontFamily: 'Manrope_600SemiBold' },
  headline: { fontSize: 17, lineHeight: 24, fontFamily: 'Manrope_600SemiBold' },
  body: { fontSize: 17, lineHeight: 24, fontFamily: 'Manrope_400Regular' },
  callout: { fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_400Regular' },
  label: { fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_600SemiBold' },
  value: { fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_700Bold' },
  action: { fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_700Bold' },
  /** Small uppercase section label, 0.06em tracking. */
  eyebrow: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_700Bold', letterSpacing: 0.78, textTransform: 'uppercase' },
  /** Small bold line under a tile's amount. */
  tileCaption: { fontSize: 12, lineHeight: 16, fontFamily: 'Manrope_600SemiBold' },
  /** The number in an amount field. */
  amount: { fontSize: 22, lineHeight: 28, fontFamily: 'Manrope_700Bold' },
  /** Auth screen title. */
  authTitle: { fontSize: 30, lineHeight: 36, fontFamily: 'Manrope_700Bold' },
  /** The "Fuel" wordmark on sign-in. */
  brand: { fontSize: 34, lineHeight: 40, fontFamily: 'Manrope_800ExtraBold' },
  /** One-line promise under the wordmark. */
  tagline: { fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_500Medium' },
  /** Small label inside a pill field. */
  fieldLabel: { fontSize: 12, lineHeight: 16, fontFamily: 'Manrope_700Bold' },
  /** Text button such as "Forgot password?". */
  link: { fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_700Bold' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_500Medium' },
} as const;

/** Tabular figures for every number (ui.md 1.2). */
export const numeric = { fontVariant: ['tabular-nums'] } as const;
