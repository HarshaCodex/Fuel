import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { BottomSheet } from './BottomSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
let mockReduce = false;
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function Modal(props: { visible: boolean; children: unknown; onRequestClose: () => void }) {
      return props.visible ? (
        <View testID="modal" onRequestClose={props.onRequestClose}>
          {props.children as never}
        </View>
      ) : null;
    },
  };
});

type Node = { props?: { accessibilityViewIsModal?: boolean; style?: unknown }; children?: Node[] | null };
const findSheet = (n: Node): Node | undefined =>
  n.props?.accessibilityViewIsModal ? n : (n.children ?? []).map((c) => (typeof c === 'object' ? findSheet(c) : undefined)).find(Boolean);
const sheetStyle = () => StyleSheet.flatten(findSheet(screen.toJSON() as unknown as Node)!.props!.style as object) as Record<string, unknown>;

describe('BottomSheet', () => {
  beforeEach(() => {
    mockReduce = false;
  });

  it('slides up by default (transform, no fade)', async () => {
    await render(<BottomSheet visible title="Age" onClose={jest.fn()}>{null}</BottomSheet>);
    expect(sheetStyle().transform).toBeDefined();
  });

  it('fades instead of sliding with Reduce Motion', async () => {
    mockReduce = true;
    await render(<BottomSheet visible title="Age" onClose={jest.fn()}>{null}</BottomSheet>);
    const style = sheetStyle();
    expect(style.transform).toBeUndefined();
    expect(style.opacity).toBeDefined();
  });

  it('renders the title as a header and its children', async () => {
    await render(
      <BottomSheet visible title="Age" onClose={jest.fn()}>
        <Text>body</Text>
      </BottomSheet>,
    );
    expect(screen.getByRole('header', { name: 'Age' })).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('renders nothing when hidden', async () => {
    await render(
      <BottomSheet visible={false} title="Age" onClose={jest.fn()}>
        <Text>body</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('Age')).toBeNull();
  });

  it('has no Done button unless asked', async () => {
    await render(<BottomSheet visible title="Sex" onClose={jest.fn()}>{null}</BottomSheet>);
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('disables Done when the prop says so and enables it otherwise', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <BottomSheet visible title="Age" onClose={jest.fn()} done={{ disabled: true, onPress }}>
        {null}
      </BottomSheet>,
    );
    await fireEvent.press(screen.getByText('Done'));
    expect(onPress).not.toHaveBeenCalled();
    await rerender(
      <BottomSheet visible title="Age" onClose={jest.fn()} done={{ onPress }}>
        {null}
      </BottomSheet>,
    );
    await fireEvent.press(screen.getByText('Done'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('closes on scrim tap', async () => {
    const onClose = jest.fn();
    await render(<BottomSheet visible title="Age" onClose={onClose}>{null}</BottomSheet>);
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Android back (Modal onRequestClose)', async () => {
    const onClose = jest.fn();
    await render(<BottomSheet visible title="Age" onClose={onClose}>{null}</BottomSheet>);
    screen.getByTestId('modal').props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
