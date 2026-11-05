import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type Colors } from './colors';
import { motion } from './motion';
import { radius } from './radius';
import { shadow } from './shadow';
import { sizing } from './sizing';
import { space } from './space';
import { numeric, type } from './type';

export { darkColors, lightColors, type Colors, motion, radius, shadow, sizing, space, numeric, type };

export const theme = { space, radius, shadow, motion, sizing, type, numeric } as const;

/** Returns the palette for the OS colour scheme (light when unknown). */
export function useTheme(): { colors: Colors; scheme: 'light' | 'dark' } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: scheme === 'dark' ? darkColors : lightColors, scheme };
}
