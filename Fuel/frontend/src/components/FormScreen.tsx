import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { space, useTheme } from '@/theme';

/** Shared scroll + keyboard-avoiding container for form screens. */
export function FormScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: space.lg, paddingTop: space.xxxl, gap: space.lg },
});
