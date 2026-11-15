import * as Haptics from 'expo-haptics';

// Haptics confirm an action or a choice (log, delete, undo, pull-to-refresh,
// portion and meal changes). They never throw: web and jest have no motor.

/** Light tap for a confirmed action (log success, delete, undo). */
export const hapticLight = (): void => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Selection tick when pull-to-refresh triggers or a portion or meal choice changes. */
export const hapticSelect = (): void => {
  void Haptics.selectionAsync().catch(() => {});
};
