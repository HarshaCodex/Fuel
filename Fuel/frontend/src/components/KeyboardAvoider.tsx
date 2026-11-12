import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Height of the on-screen keyboard on iOS, 0 elsewhere. Read from the keyboard events directly because
 * KeyboardAvoidingView measures its own frame and mis-sizes the gap inside stack and modal screens (#215).
 * Android resizes the window itself, so it needs nothing.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** Fills its parent and lifts its content above the iOS keyboard. Place it so it reaches the screen's bottom edge. */
export function KeyboardAvoider({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const height = useKeyboardHeight();
  return <View style={[{ flex: 1 }, style, { paddingBottom: height }]}>{children}</View>;
}
