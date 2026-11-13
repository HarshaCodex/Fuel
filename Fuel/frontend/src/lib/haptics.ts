import * as Haptics from 'expo-haptics';

// Haptics confirm an action only (log, delete, undo, pull-to-refresh). They never throw: web and jest have no motor.

/** Light tap for a confirmed action (log success, delete, undo). */
export const hapticLight = (): void => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Selection tick when pull-to-refresh triggers. */
export const hapticSelect = (): void => {
  void Haptics.selectionAsync().catch(() => {});
};
