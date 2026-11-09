import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFoodByBarcode, type Food } from '@/api/food';

import Scan from './scan';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/api/food', () => ({ ...jest.requireActual('@/api/food'), getFoodByBarcode: jest.fn() }));

let mockCameraProps: { onBarcodeScanned?: (r: { data: string; type: string }) => void } = {};
const mockPermission = jest.fn();
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => mockPermission(),
  CameraView: (props: typeof mockCameraProps) => {
    mockCameraProps = props;
    return null;
  },
}));

const lookup = jest.mocked(getFoodByBarcode);
const request = jest.fn();
const granted = { granted: true, canAskAgain: true, status: 'granted' };
const food: Food = {
  id: 'f1',
  name: 'Oats',
  brand: null,
  source: 'USDA',
  servingSize: 40,
  servingUnit: 'g',
  calories: 150,
  protein: 5,
  carbs: 27,
  fat: 3,
};

let client: QueryClient;
async function renderScreen(permission: unknown = granted) {
  mockPermission.mockReturnValue([permission, request]);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <Scan />
    </QueryClientProvider>,
  );
}
const scan = async (data: string) => {
  await act(async () => mockCameraProps.onBarcodeScanned?.({ data, type: 'ean13' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  lookup.mockReset();
  mockCameraProps = {};
});

describe('permission states', () => {
  it('shows a spinner while the permission is unknown', async () => {
    await renderScreen(null);
    expect(screen.getByLabelText('Checking camera access')).toBeTruthy();
  });

  it('asks before using the camera', async () => {
    await renderScreen({ granted: false, canAskAgain: true, status: 'undetermined' });
    expect(screen.getByText('Fuel uses the camera only to read barcodes. Nothing is saved.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Allow camera'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('offers another try when denied but askable', async () => {
    await renderScreen({ granted: false, canAskAgain: true, status: 'denied' });
    expect(screen.getByText('Camera access is off')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Try again'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('opens settings when blocked', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderScreen({ granted: false, canAskAgain: false, status: 'denied' });
    expect(screen.getByText('Allow camera in Settings')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open settings'));
    expect(open).toHaveBeenCalled();
  });

  it('shows the camera when granted', async () => {
    await renderScreen();
    expect(screen.getByText('Point at a barcode')).toBeTruthy();
    expect(mockCameraProps.onBarcodeScanned).toBeDefined();
  });

  it('keeps manual entry usable without the camera', async () => {
    lookup.mockResolvedValue(food);
    await renderScreen({ granted: false, canAskAgain: false, status: 'denied' });
    await fireEvent.changeText(screen.getByLabelText('Or type the barcode'), '0123456789012');
    await fireEvent.press(screen.getByLabelText('Look up'));
    expect(lookup).toHaveBeenCalledWith('0123456789012');
  });

  it('goes back', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('scanning', () => {
  it('looks up the same code once, seeds the cache and opens the food', async () => {
    lookup.mockResolvedValue(food);
    await renderScreen();
    for (let i = 0; i < 5; i++) await scan('0123456789012');
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup.mock.calls[0][0]).toBe('0123456789012');
    expect(client.getQueryData(foodKeys.detail('f1'))).toEqual(food);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/food-detail', params: { id: 'f1' } });
  });

  it('calls the lookup once even when scans arrive in the same tick', async () => {
    lookup.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await act(async () => {
      for (let i = 0; i < 5; i++) mockCameraProps.onBarcodeScanned?.({ data: '12345678', type: 'ean8' });
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(screen.getAllByLabelText('Looking up barcode').length).toBeGreaterThan(0);
  });

  it.each(['https://x.test', '1234567', '123456789012345', 'abcdefgh'])('ignores %p', async (data) => {
    await renderScreen();
    await scan(data);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('shows not found for 404 with working actions, then scans a new code', async () => {
    lookup.mockRejectedValueOnce(new ApiError(404, 'Not found')).mockResolvedValueOnce(food);
    await renderScreen();
    await scan('0123456789012');
    await scan('0123456789012');
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No match for this barcode')).toBeTruthy();
    expect(screen.getByText(/0123456789012/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Search by name'));
    expect(mockPush).toHaveBeenCalledWith('/search');
    await fireEvent.press(screen.getByLabelText('Enter manually'));
    expect(mockPush).toHaveBeenCalledWith('/manual-entry');
    await fireEvent.press(screen.getByLabelText('Scan again'));
    await scan('9876543210987');
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenLastCalledWith('9876543210987');
  });

  it('treats 400 as not found', async () => {
    lookup.mockRejectedValue(new ApiError(400, 'Bad'));
    await renderScreen();
    await scan('12345678');
    expect(screen.getByText('No match for this barcode')).toBeTruthy();
  });

  it('shows offline and retries the same code once', async () => {
    lookup.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(food);
    await renderScreen();
    await scan('12345678');
    expect(screen.getByText("You're offline")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenLastCalledWith('12345678');
    expect(mockReplace).toHaveBeenCalled();
  });

  it('shows a generic error for other failures', async () => {
    lookup.mockRejectedValue(new ApiError(503, 'Down'));
    await renderScreen();
    await scan('12345678');
    expect(screen.getByText("Couldn't look this up")).toBeTruthy();
  });
});

describe('manual code', () => {
  it('rejects letters and short codes without a request', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Or type the barcode'), '12ab');
    await fireEvent.press(screen.getByLabelText('Look up'));
    expect(screen.getByText('Enter 8 to 14 digits')).toBeTruthy();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('trims spaces and sends once on double submit', async () => {
    lookup.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Or type the barcode'), ' 00123456 ');
    await fireEvent.press(screen.getByLabelText('Look up'));
    await fireEvent.press(screen.getByLabelText('Look up'));
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('00123456');
  });

  it('allows a new typed code after not found', async () => {
    lookup.mockRejectedValueOnce(new ApiError(404, 'Not found')).mockResolvedValueOnce(food);
    await renderScreen();
    await scan('12345678');
    await fireEvent.changeText(screen.getByLabelText('Or type the barcode'), '87654321');
    await fireEvent.press(screen.getByLabelText('Look up'));
    expect(lookup).toHaveBeenLastCalledWith('87654321');
  });
});
