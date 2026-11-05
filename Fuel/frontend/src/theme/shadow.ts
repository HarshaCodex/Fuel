const shadowColor = '#1F1B16';

export const shadow = {
  sm: { shadowColor, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, shadowOpacity: 0.06, elevation: 1 },
  md: { shadowColor, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.08, elevation: 3 },
  lg: { shadowColor, shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, shadowOpacity: 0.14, elevation: 8 },
} as const;
