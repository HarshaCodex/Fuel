import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { putBodyStats, recalculateGoals } from '@/api/user';

import { setOnboardingSkipped } from '@/lib/tokenStorage';

import Onboarding from '../../app/onboarding';

jest.mock('@/lib/tokenStorage');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), putBodyStats: jest.fn(), recalculateGoals: jest.fn() }));

const mockPut = jest.mocked(putBodyStats);
const mockRecalc = jest.mocked(recalculateGoals);
const mockSkip = jest.mocked(setOnboardingSkipped);
const GOALS = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70, isAutoCalculated: true, tdee: 2200, deficit: 0, formula: 'f', macroSplit: 'm' };
const BANNER = 'Some details were not accepted. Check your answers and try again.';

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const radio = (name: string | RegExp) => fireEvent.press(screen.getByRole('radio', { name }));

let client: QueryClient;
async function renderScreen() {
  client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <Onboarding />
    </QueryClientProvider>,
  );
}

/** Opens a stat row, types into its sheet field and presses Done. */
async function setStat(row: string, field: string, text: string) {
  await press(new RegExp(`^${row},`));
  await fireEvent.changeText(screen.getByLabelText(field), text);
  await press('Done');
}
async function fillAll() {
  await setStat('Age', 'Age', '30');
  await press(/^Sex,/);
  await radio('Male');
  await setStat('Height', 'Height', '180');
  await setStat('Weight', 'Weight', '80');
  await press(/^Activity,/);
  await radio(/Moderately active/);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPut.mockResolvedValue({} as never);
  mockRecalc.mockResolvedValue(GOALS);
  mockSkip.mockResolvedValue(undefined as never);
});

describe('Setup page', () => {
  it('shows empty rows, the empty panel and a disabled Start until all five are valid', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Age, not set')).toBeTruthy();
    expect(screen.getAllByText('Add')).toHaveLength(5);
    expect(screen.getByLabelText('Fill in the details above to see your goal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start tracking' }).props.accessibilityState).toMatchObject({ disabled: true });
    await setStat('Age', 'Age', '30');
    expect(screen.getByLabelText('Age, 30')).toBeTruthy();
    expect(mockRecalc).not.toHaveBeenCalled();
  });

  it('saves stats, calculates once all five are filled and finishes', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(screen.getByLabelText(/Daily goal 2,?200 calories/)).toBeTruthy());
    expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({ age: 30, heightUnit: 'cm', weightUnit: 'kg', gender: 'MALE', activityLevel: 'MODERATE' }));
    expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'MAINTAIN' });
    await press('Start tracking');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('invalidates the profile queries when starting', async () => {
    await renderScreen();
    const spy = jest.spyOn(client, 'invalidateQueries');
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start tracking' }).props.accessibilityState).toMatchObject({ disabled: false }));
    await press('Start tracking');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('hides the change tiles for Maintain and shows them with 500 selected for Lose and Gain', async () => {
    await renderScreen();
    expect(screen.queryByLabelText('Daily calorie change')).toBeNull();
    await radio('Lose');
    expect(screen.getByRole('radio', { name: '500 calories a day, steady' }).props.accessibilityState).toMatchObject({ selected: true });
    await radio('Gain');
    expect(screen.getByLabelText('Daily calorie change')).toBeTruthy();
    await radio('Maintain');
    expect(screen.queryByLabelText('Daily calorie change')).toBeNull();
  });

  it('recalculates on goal and tile changes without re-saving unchanged stats', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalledTimes(1));
    await radio('Lose');
    await waitFor(() => expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'LOSE', deficit: 500 }));
    await radio('750 calories a day, faster');
    await waitFor(() => expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'LOSE', deficit: 750 }));
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('saves again after a body stat is edited', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalledTimes(1));
    await setStat('Weight', 'Weight', '75');
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2));
    expect(mockPut).toHaveBeenLastCalledWith(expect.objectContaining({ weight: 75 }));
  });

  it('does not save or recalculate when a sheet is closed with Done and nothing changed', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalledTimes(1));
    await press(/^Age,/);
    await press('Done');
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockRecalc).toHaveBeenCalledTimes(1);
  });

  it('reverts a sheet edit when it is closed without Done', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalledTimes(1));
    await press(/^Age,/);
    await fireEvent.changeText(screen.getByLabelText('Age'), '999');
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
    expect(screen.getByLabelText('Age, 30')).toBeTruthy();
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockRecalc).toHaveBeenCalledTimes(1);
  });

  it('disables Done for an invalid age', async () => {
    await renderScreen();
    await press(/^Age,/);
    await fireEvent.changeText(screen.getByLabelText('Age'), '5');
    expect(screen.getByRole('button', { name: 'Done' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('accepts custom changes of 100 and 1000 and rejects 75 and 1050', async () => {
    await renderScreen();
    await radio('Lose');
    const custom = async (text: string) => {
      await radio(/^Custom/);
      await fireEvent.changeText(screen.getByLabelText('Calories per day'), text);
    };
    await custom('75');
    expect(screen.getByRole('button', { name: 'Done' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Calories per day'), '1050');
    expect(screen.getByRole('button', { name: 'Done' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Calories per day'), '100');
    expect(screen.getByRole('button', { name: 'Done' }).props.accessibilityState).toMatchObject({ disabled: false });
    await press('Done');
    expect(screen.getByRole('radio', { name: 'Custom amount, 100 calories a day' })).toBeTruthy();
    await custom('1000');
    await press('Done');
    expect(screen.getByRole('radio', { name: 'Custom amount, 1000 calories a day' })).toBeTruthy();
  });

  it('applies only the latest response when answers change quickly', async () => {
    let resolveFirst: (g: typeof GOALS) => void = () => {};
    mockRecalc.mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));
    await renderScreen();
    await fillAll();
    await radio('Lose');
    mockRecalc.mockResolvedValueOnce({ ...GOALS, calorieGoal: 1700 });
    await radio('750 calories a day, faster');
    await waitFor(() => expect(screen.getByLabelText(/Daily goal 1,?700 calories/)).toBeTruthy());
    resolveFirst({ ...GOALS, calorieGoal: 9999 });
    await waitFor(() => expect(screen.getByLabelText(/Daily goal 1,?700 calories/)).toBeTruthy());
    expect(screen.queryByLabelText(/9,?999/)).toBeNull();
  });

  it('sends feet and pounds after switching to imperial', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalledTimes(1));
    await radio('Imperial');
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2));
    expect(mockPut).toHaveBeenLastCalledWith(expect.objectContaining({ heightUnit: 'ft', weightUnit: 'lbs' }));
  });

  it('offers Retry when offline and keeps the answers', async () => {
    mockRecalc.mockRejectedValueOnce(new NetworkError());
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(screen.getByText(/You're offline/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Start tracking' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByLabelText('Age, 30')).toBeTruthy();
    await press('Retry');
    await waitFor(() => expect(screen.getByLabelText(/Daily goal 2,?200 calories/)).toBeTruthy());
  });

  it('marks the rejected row and shows the banner on a 400', async () => {
    mockPut.mockRejectedValueOnce(new ApiError(400, 'bad', [{ field: 'age', message: 'Age is not allowed' }]));
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(screen.getByText(BANNER)).toBeTruthy());
    expect(screen.getByLabelText('Age, 30. Age is not allowed')).toBeTruthy();
    expect(mockRecalc).not.toHaveBeenCalled();
  });

  it('records the skip and leaves without any API call when Later is pressed', async () => {
    await renderScreen();
    await press('Later');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockSkip).toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockRecalc).not.toHaveBeenCalled();
  });

  it('still leaves when the skip cannot be stored', async () => {
    mockSkip.mockRejectedValueOnce(new Error('storage'));
    await renderScreen();
    await press('Later');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('leaves without saving when Later is pressed after partial entry', async () => {
    await renderScreen();
    await setStat('Age', 'Age', '30');
    await press('Later');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockRecalc).not.toHaveBeenCalled();
  });

  it('leaves once when Start tracking is pressed twice quickly', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start tracking' }).props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start tracking' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start tracking' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('leaves once when Later is pressed twice quickly', async () => {
    await renderScreen();
    await press('Later');
    await press('Later');
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('saves the newer age when it is edited while the first save is still pending', async () => {
    let releasePut: () => void = () => {};
    mockPut.mockReturnValueOnce(new Promise((r) => (releasePut = () => r({} as never))));
    await renderScreen();
    await fillAll();
    await press(/^Age,/);
    await fireEvent.changeText(screen.getByLabelText('Age'), '41');
    releasePut();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalled());
    await press('Done');
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2));
    expect(mockPut).toHaveBeenLastCalledWith(expect.objectContaining({ age: 41 }));
  });

  it('does not re-save after picking the same Sex and then a goal', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalledTimes(1));
    await press(/^Sex,/);
    await radio('Male');
    await radio('Lose');
    await waitFor(() => expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'LOSE', deficit: 500 }));
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('keeps Start disabled while a recalculation is loading', async () => {
    await renderScreen();
    await fillAll();
    await waitFor(() => expect(mockRecalc).toHaveBeenCalledTimes(1));
    mockRecalc.mockReturnValueOnce(new Promise(() => {}));
    await radio('Lose');
    expect(screen.getByRole('button', { name: 'Start tracking' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('recalculates with the custom amount when its sheet is done', async () => {
    await renderScreen();
    await fillAll();
    await radio('Lose');
    await radio(/^Custom/);
    await fireEvent.changeText(screen.getByLabelText('Calories per day'), '100');
    await press('Done');
    await waitFor(() => expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'LOSE', deficit: 100 }));
  });
});
