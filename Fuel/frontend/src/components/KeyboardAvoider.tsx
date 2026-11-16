import { useEffect, useState, type ReactNode } from 'react';
import { Dimensions, Keyboard, Platform, View, type KeyboardEvent, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Height of the on-screen keyboard. Read from the keyboard events directly because KeyboardAvoidingView
 * measures its own frame and mis-sizes the gap inside stack and modal screens (#215).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    // The gap from the window bottom to the keyboard top also covers the system inset that `height` omits on
    // edge-to-edge Android. iOS can change the keyboard height without hiding it, so follow the frame there.
    const gap = (e: KeyboardEvent) => Math.max(0, Dimensions.get('window').height - e.endCoordinates.screenY);
    const show = ios
      ? Keyboard.addListener('keyboardWillChangeFrame', (e) => setHeight(gap(e)))
      : Keyboard.addListener('keyboardDidShow', (e) => setHeight(Math.max(e.endCoordinates.height, gap(e))));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Fills its parent and lifts its content above the iOS keyboard. Place it so it reaches the screen's bottom edge.
 * Android resizes the window itself (modals, sheets), so it adds no padding there unless `avoidOnAndroid` is set,
 * which stack screens need because edge-to-edge windows do not resize for the keyboard.
 */
export function KeyboardAvoider({
  children,
  style,
  avoidOnAndroid = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  avoidOnAndroid?: boolean;
}) {
  const height = useKeyboardHeight();
  const pad = Platform.OS === 'ios' || avoidOnAndroid ? height : 0;
  return <View style={[{ flex: 1 }, style, { paddingBottom: pad }]}>{children}</View>;
}
