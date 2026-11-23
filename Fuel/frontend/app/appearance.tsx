import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormScreen } from '@/components/FormScreen';
import { OptionRow } from '@/components/OptionRow';
import { APPEARANCE_OPTIONS, getAppearance, setAppearance, type AppearanceChoice } from '@/lib/appearance';
import { sizing, space, type, useTheme } from '@/theme';

export default function AppearanceScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [choice, setChoice] = useState<AppearanceChoice>(getAppearance);

  function pick(value: AppearanceChoice) {
    setAppearance(value);
    setChoice(value);
  }

  return (
    <FormScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close} hitSlop={space.sm}>
          <Ionicons name="close" size={sizing.icon} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        Appearance
      </Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {APPEARANCE_OPTIONS.map((o) => (
          <OptionRow key={o.value} label={o.label} description={o.description} selected={choice === o.value} onPress={() => pick(o.value)} />
        ))}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  close: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  options: { gap: space.md },
});
