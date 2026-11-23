import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { space, useTheme } from '@/theme';

/** Shared scroll + keyboard-avoiding container for form screens. */
export function FormScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: space.lg, paddingTop: space.xxxl, gap: space.lg },
});
