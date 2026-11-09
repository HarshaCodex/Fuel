import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Food } from '@/api/food';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

import { FoodRow } from './FoodRow';

type Props = { food: Food; onPress: () => void; onDelete: () => void; divider?: boolean };

/** A My Foods row: the shared FoodRow plus a 44pt menu button opening an action sheet. */
export function CustomFoodRow({ food, onPress, onDelete, divider = false }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.row, divider && { borderBottomWidth: sizing.border, borderColor: colors.border }]}>
      <View style={styles.food}>
        <FoodRow food={food} onPress={onPress} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${food.name}`}
        onPress={() => setOpen(true)}
        style={[styles.more, { backgroundColor: colors.surface }]}
      >
        <Ionicons name="ellipsis-horizontal" size={sizing.icon} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Close menu"
          onPress={() => setOpen(false)}
          style={[styles.scrim, { backgroundColor: colors.scrim }]}
        >
          <View
            accessibilityViewIsModal
            style={[styles.sheet, shadow.md, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[type.headline, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={2}>
              {food.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${food.name}`}
              onPress={() => {
                setOpen(false);
                onDelete();
              }}
              style={styles.action}
            >
              <Ionicons name="trash-outline" size={sizing.icon} color={colors.danger} />
              <Text style={[type.headline, { color: colors.danger }]} maxFontSizeMultiplier={2}>
                Delete
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => setOpen(false)} style={styles.action}>
              <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  food: { flex: 1 },
  more: { width: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end', padding: space.lg },
  sheet: { borderRadius: radius.lg, borderWidth: sizing.border, padding: space.lg, gap: space.sm },
  action: { minHeight: sizing.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
