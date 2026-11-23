import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Food } from '@/api/food';
import { sizing, space, type, useTheme } from '@/theme';

import { FoodRow } from './FoodRow';
import { RowMenu } from './RowMenu';

type Props = { food: Food; onPress: () => void; onEdit: () => void; onDelete: () => void; divider?: boolean };

/**
 * A My Foods row: the shared FoodRow plus a 44pt menu button opening an action sheet.
 * Swipe right to edit, left to delete; the row snaps back and the screen confirms. The menu stays the accessible path.
 */
export function CustomFoodRow({ food, onPress, onEdit, onDelete, divider = false }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const swipe = useRef<SwipeableMethods>(null);
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
        <FoodRow food={food} onPress={onPress} chevron={false} />
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
      <RowMenu
        visible={open}
        title={food.name}
        onClose={() => setOpen(false)}
        actions={[
          { label: 'Edit', icon: 'create-outline', onPress: onEdit },
          { label: 'Delete', icon: 'trash-outline', danger: true, onPress: onDelete },
        ]}
      />
    </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  food: { flex: 1 },
  panel: { width: 84, justifyContent: 'center', paddingHorizontal: space.lg },
  panelInner: { alignItems: 'center', gap: space.xs },
  more: { width: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
});
