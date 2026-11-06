import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { putBodyStats, recalculateGoals } from '@/api/user';

import Onboarding from './onboarding';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), putBodyStats: jest.fn(), recalculateGoals: jest.fn() }));

const mockPut = jest.mocked(putBodyStats);
const mockRecalc = jest.mocked(recalculateGoals);
const GOALS = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70, isAutoCalculated: true, tdee: 2200, deficit: 0, formula: 'f', macroSplit: 'm' };

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const radio = (name: string | RegExp) => fireEvent.press(screen.getByRole('radio', { name }));

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <Onboarding />
    </QueryClientProvider>,
  );
}
async function toStep3() {
  await renderScreen();
  await fireEvent.changeText(screen.getByLabelText('Age'), '30');
  await radio('Male');
  await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '180');
  await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '80');
  await press('Next');
  await radio(/Moderately active/);
  await press('Next');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPut.mockResolvedValue({} as never);
  mockRecalc.mockResolvedValue(GOALS);
});

describe('Onboarding', () => {
  it('blocks step 1 until every field is valid', async () => {
    await renderScreen();
    await press('Next');
    expect(screen.getByText('Enter your age')).toBeTruthy();
    expect(screen.getByText('Choose one')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('requires an activity level on step 2', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Age'), '30');
    await radio('Male');
    await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '180');
    await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '80');
    await press('Next');
    await press('Next');
    expect(screen.getByText('Choose your activity level')).toBeTruthy();
  });

  it('saves stats, shows the calculated targets and finishes', async () => {
    await toStep3();
    await waitFor(() => expect(screen.getByText('2200 kcal a day')).toBeTruthy());
    expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({ age: 30, heightUnit: 'cm', weightUnit: 'kg', gender: 'MALE', activityLevel: 'MODERATE' }));
    expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'MAINTAIN' });
    await press('Start tracking');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('recalculates with the chosen deficit without re-saving stats', async () => {
    await toStep3();
    await waitFor(() => expect(screen.getByText('2200 kcal a day')).toBeTruthy());
    await radio('Lose');
    await waitFor(() => expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'LOSE', deficit: 500 }));
    await press('Increase Daily calorie change');
    await waitFor(() => expect(mockRecalc).toHaveBeenLastCalledWith({ goal: 'LOSE', deficit: 550 }));
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('offers Retry when offline and keeps the answers', async () => {
    mockRecalc.mockRejectedValueOnce(new NetworkError());
    await toStep3();
    await waitFor(() => expect(screen.getByText(/You're offline/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Start tracking' }).props.accessibilityState).toMatchObject({ disabled: true });
    await press('Retry');
    await waitFor(() => expect(screen.getByText('2200 kcal a day')).toBeTruthy());
  });

  it('returns to step 1 with the server message next to the field on a 400', async () => {
    mockPut.mockRejectedValueOnce(new ApiError(400, 'bad', [{ field: 'age', message: 'Age is not allowed' }]));
    await toStep3();
    await waitFor(() => expect(screen.getByText('Age is not allowed')).toBeTruthy());
    expect(screen.getByLabelText('Age').props.value).toBe('30');
  });

  it('sets up later without calling the API', async () => {
    await renderScreen();
    await press('Set up later');
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockPut).not.toHaveBeenCalled();
  });
});
