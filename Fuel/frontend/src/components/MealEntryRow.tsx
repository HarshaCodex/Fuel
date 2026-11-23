import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { DashboardEntry } from '@/api/tracking';
import { sizing, space, type, useTheme } from '@/theme';

import { MealRow } from './MealRow';
import { PressableScale } from './PressableScale';
import { RowMenu, type RowMenuAction } from './RowMenu';

type Props = { entry: DashboardEntry; onDelete: () => void; onEdit?: () => void; scale?: boolean };

/**
 * A logged meal: the shared MealRow plus swipe left to delete and a 44pt menu button, which is the accessible path.
 * `scale` springs the row to 0.98 while pressed (Today). The swipe closes itself first, because the row leaves the list behind an undo toast.
 */
export function MealEntryRow({ entry, onDelete, onEdit, scale }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const swipe = useRef<SwipeableMethods>(null);
  const onSwipe = () => {
    swipe.current?.close();
    onDelete();
  };
  const Hold = scale ? PressableScale : Pressable;
  const actions: RowMenuAction[] = [];
  if (onEdit) actions.push({ label: 'Edit', icon: 'create-outline', onPress: onEdit });
  actions.push({ label: 'Delete', icon: 'trash-outline', danger: true, onPress: onDelete });

  return (
    <Swipeable
      ref={swipe}
      testID={`swipe-${entry.id}`}
      overshootRight={false}
      onSwipeableOpen={onSwipe}
      renderRightActions={() => (
        <View
          style={[styles.panel, { backgroundColor: colors.danger }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.panelInner}>
            <Ionicons name="trash-outline" size={sizing.icon} color={colors.onAccent} />
            <Text style={[type.callout, { color: colors.onAccent }]} maxFontSizeMultiplier={2}>
              Delete
            </Text>
          </View>
        </View>
      )}
    >
      <View style={[styles.row, { backgroundColor: colors.surface }]}>
        <Hold style={styles.meal} onLongPress={onEdit} accessible={false}>
          <MealRow
            name={entry.foodName}
            source={entry.source}
            loggedAt={entry.loggedAt}
            calories={entry.calories}
            protein={entry.protein}
            carbs={entry.carbs}
            fat={entry.fat}
            mealLabel={entry.mealLabel}
            accessibilityHint={onEdit ? 'Long press to edit' : undefined}
          />
        </Hold>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${entry.foodName}`}
          accessibilityActions={[
            { name: 'activate', label: 'Open menu' },
            ...(onEdit ? [{ name: 'edit', label: `Edit ${entry.foodName}` }] : []),
            { name: 'delete', label: `Delete ${entry.foodName}` },
          ]}
          onAccessibilityAction={(e) => {
            const name = e.nativeEvent.actionName;
            if (name === 'edit') onEdit?.();
            else if (name === 'delete') onDelete();
            else setOpen(true);
          }}
          onPress={() => setOpen(true)}
          style={styles.more}
        >
          <Ionicons name="ellipsis-horizontal" size={sizing.icon} color={colors.textSecondary} />
        </Pressable>
        <RowMenu visible={open} title={entry.foodName} actions={actions} onClose={() => setOpen(false)} />
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  meal: { flex: 1 },
  panel: { width: 84, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: space.lg },
  panelInner: { alignItems: 'center', gap: space.xs },
  more: { width: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
});
