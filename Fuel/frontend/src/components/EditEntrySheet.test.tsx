import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/errors';
import { getEntries, type CreatedEntry, type DashboardEntry } from '@/api/tracking';

import { EditEntrySheet } from './EditEntrySheet';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function Modal(props: { visible: boolean; children: unknown }) {
      return props.visible ? <View>{props.children as never}</View> : null;
    },
  };
});
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), getEntries: jest.fn() }));
const mockGet = jest.mocked(getEntries);

const row: DashboardEntry = {
  id: 'e1', foodName: 'Oat bowl', source: 'USDA', mealLabel: 'breakfast', calories: 200, protein: 10, carbs: 20, fat: 5, loggedAt: '2026-11-09T08:00:00Z',
};
const full: CreatedEntry = { ...row, foodId: 'f1', servingSize: 100, servingUnit: 'g', quantity: 1 };

async function setup(entry: DashboardEntry | null = row, date?: string) {
  const props = { onClose: jest.fn(), onMissing: jest.fn(), onSave: jest.fn() };
  const view = await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EditEntrySheet entry={entry} date={date} {...props} />
    </QueryClientProvider>,
  );
  return { ...props, view };
}
const save = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([full]);
});

describe('EditEntrySheet', () => {
  it('does not fetch or show anything while closed', async () => {
    await setup(null);
    expect(mockGet).not.toHaveBeenCalled();
    expect(screen.queryByText('Edit Oat bowl')).toBeNull();
  });

  it('shows a loading state, then the entry prefilled, with Save disabled until something changes', async () => {
    let resolve: (e: CreatedEntry[]) => void = () => {};
    mockGet.mockReturnValue(new Promise((r) => (resolve = r)));
    await setup();
    expect(screen.getByLabelText('Loading entry')).toBeTruthy();
    await act(async () => resolve([full]));
    expect(await screen.findByText('Edit Oat bowl')).toBeTruthy();
    expect(screen.getByDisplayValue('100')).toBeTruthy();
    expect(screen.getByText('g')).toBeTruthy();
    expect(save()).toBeDisabled();
  });

  it('fetches with the date when it is not today', async () => {
    await setup(row, '2026-11-08');
    await screen.findByText('Edit Oat bowl');
    expect(mockGet).toHaveBeenCalledWith('2026-11-08');
  });

  it('sends only the changed field', async () => {
    const { onSave } = await setup();
    await screen.findByText('Edit Oat bowl');
    await fireEvent.changeText(screen.getByDisplayValue('100'), '150');
    await fireEvent.press(save());
    expect(onSave).toHaveBeenCalledWith(full, { servingSize: 150 });
  });

  it('sends a changed quantity and meal together', async () => {
    const { onSave } = await setup();
    await screen.findByText('Edit Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
    await fireEvent.press(screen.getByText('Dinner'));
    await fireEvent.press(save());
    expect(onSave).toHaveBeenCalledWith(full, { quantity: 1.5, mealLabel: 'dinner' });
  });

  it('keeps Save off when the amount is typed back to the original', async () => {
    await setup();
    await screen.findByText('Edit Oat bowl');
    const field = screen.getByDisplayValue('100');
    await fireEvent.changeText(field, '120');
    expect(save()).toBeEnabled();
    await fireEvent.changeText(field, '100');
    expect(save()).toBeDisabled();
  });

  it.each(['0', '', '1.25', 'abc'])('blocks Save for the amount "%s" and explains', async (text) => {
    const { onSave } = await setup();
    await screen.findByText('Edit Oat bowl');
    const field = screen.getByDisplayValue('100');
    await fireEvent.changeText(field, text);
    await fireEvent(field, 'blur');
    expect(save()).toBeDisabled();
    expect(screen.getByText('Enter an amount above 0, with at most one decimal')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('leaves the meal unselected and out of the body when the entry has none', async () => {
    mockGet.mockResolvedValue([{ ...full, mealLabel: null }]);
    const { onSave } = await setup();
    await screen.findByText('Edit Oat bowl');
    await fireEvent.changeText(screen.getByDisplayValue('100'), '90');
    await fireEvent.press(save());
    expect(onSave).toHaveBeenCalledWith(expect.anything(), { servingSize: 90 });
  });

  it('Cancel closes without saving', async () => {
    const { onClose, onSave } = await setup();
    await screen.findByText('Edit Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reports a missing entry when the list no longer has the id', async () => {
    mockGet.mockResolvedValue([{ ...full, id: 'other' }]);
    const { onMissing } = await setup();
    await waitFor(() => expect(onMissing).toHaveBeenCalledTimes(1));
  });

  it('shows an error with Retry when the list cannot load, and recovers', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await setup();
    expect(await screen.findByText("Couldn't load this entry")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Edit Oat bowl')).toBeTruthy();
  });
});
