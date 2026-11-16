import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { DayRing } from './DayRing';
import { darkColors, lightColors } from '@/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

const asNative = (c: string) => ({ payload: processColor(c), type: 0 });

beforeEach(() => mockScheme.mockReturnValue('light'));

describe('DayRing', () => {
  it('draws an accent arc for a day within goal', async () => {
    await render(<DayRing day={13} state="within" fraction={0.8} />);
    expect(screen.getByText('13')).toBeOnTheScreen();
    expect(screen.getByTestId('day-ring-arc').props.stroke).toEqual(asNative(lightColors.accent));
  });

  it('uses the protein colour when over goal', async () => {
    await render(<DayRing day={9} state="over" fraction={1} />);
    expect(screen.getByTestId('day-ring-arc').props.stroke).toEqual(asNative(lightColors.protein));
  });

  it('uses the tint for today in progress, in dark mode too', async () => {
    mockScheme.mockReturnValue('dark');
    await render(<DayRing day={15} state="todayInProgress" fraction={0.5} />);
    expect(screen.getByTestId('day-ring-arc').props.stroke).toEqual(asNative(darkColors.accentTint));
  });

  it.each(['empty', 'future', 'skeleton'] as const)('draws no arc when %s', async (state) => {
    await render(<DayRing day={2} state={state} fraction={0} />);
    expect(screen.queryByTestId('day-ring-arc')).toBeNull();
    expect(screen.getByText('2')).toBeOnTheScreen();
  });

  it('marks the skeleton variant', async () => {
    await render(<DayRing day={2} state="skeleton" fraction={0} />);
    expect(screen.getByTestId('day-ring-skeleton')).toBeOnTheScreen();
  });
});
