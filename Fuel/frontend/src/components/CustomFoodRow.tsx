import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Food } from '@/api/food';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

import { FoodRow } from './FoodRow';

type Props = { food: Food; onPress: () => void; onEdit: () => void; onDelete: () => void; divider?: boolean };

/**
 * A My Foods row: the shared FoodRow plus a 44pt menu button opening an action sheet.
 * Swipe right to edit, left to delete; the row snaps back and the screen confirms. The menu stays the accessible path.
 */
export function CustomFoodRow({ food, onPress, onEdit, onDelete, divider = false }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const swipe = useRef<SwipeableMethods>(null);
  const after = useRef<(() => void) | null>(null);

  const runAfter = () => {
    const fn = after.current;
    after.current = null;
    fn?.();
  };
  // iOS cannot present a Modal while another is still dismissing, so wait for onDismiss there.
  const choose = (fn: () => void) => {
    after.current = fn;
    setOpen(false);
    if (Platform.OS !== 'ios') runAfter();
  };
  const onSwipe = (direction: SwipeDirection) => {
    swipe.current?.close();
    (direction === SwipeDirection.RIGHT ? onEdit : onDelete)();
  };
  const panel = (label: string, icon: 'create-outline' | 'trash-outline', bg: string, align: 'flex-start' | 'flex-end') => (
    <View style={[styles.panel, { backgroundColor: bg, alignItems: align }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.panelInner}>
        <Ionicons name={icon} size={sizing.icon} color={colors.onAccent} />
        <Text style={[type.callout, { color: colors.onAccent }]} maxFontSizeMultiplier={2}>
          {label}
        </Text>
      </View>
    </View>
  );
  return (
    <Swipeable
      ref={swipe}
      testID={`swipe-${food.id}`}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={onSwipe}
      renderLeftActions={() => panel('Edit', 'create-outline', colors.accent, 'flex-start')}
      renderRightActions={() => panel('Delete', 'trash-outline', colors.danger, 'flex-end')}
    >
    <View style={[styles.row, { backgroundColor: colors.surface }, divider && { borderBottomWidth: sizing.border, borderColor: colors.border }]}>
      <View style={styles.food}>
        <FoodRow food={food} onPress={onPress} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${food.name}`}
        accessibilityActions={[
          { name: 'activate', label: 'Open menu' },
          { name: 'edit', label: `Edit ${food.name}` },
          { name: 'delete', label: `Delete ${food.name}` },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'edit') onEdit();
          else if (e.nativeEvent.actionName === 'delete') onDelete();
          else setOpen(true);
        }}
        onPress={() => setOpen(true)}
        style={[styles.more, { backgroundColor: colors.surface }]}
      >
        <Ionicons name="ellipsis-horizontal" size={sizing.icon} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} onDismiss={runAfter}>
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
              accessibilityLabel={`Edit ${food.name}`}
              onPress={() => choose(onEdit)}
              style={styles.action}
            >
              <Ionicons name="create-outline" size={sizing.icon} color={colors.text} />
              <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>
                Edit
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${food.name}`}
              onPress={() => choose(onDelete)}
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
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  food: { flex: 1 },
  panel: { width: 96, justifyContent: 'center', paddingHorizontal: space.lg },
  panelInner: { alignItems: 'center', gap: space.xs },
  more: { width: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end', padding: space.lg },
  sheet: { borderRadius: radius.lg, borderWidth: sizing.border, padding: space.lg, gap: space.sm },
  action: { minHeight: sizing.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
