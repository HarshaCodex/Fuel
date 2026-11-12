import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFoodByBarcode } from '@/api/food';
import { Button } from '@/components/Button';
import { KeyboardAvoider, useKeyboardHeight } from '@/components/KeyboardAvoider';
import { StateBlock } from '@/components/StateBlock';
import { TextField } from '@/components/TextField';
import { BARCODE_TYPES, normalizeBarcode } from '@/lib/barcode';
import { radius, sizing, space, type, useTheme } from '@/theme';

type Status = 'scanning' | 'looking' | 'notFound' | 'error';

export default function ScanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>('scanning');
  const [code, setCode] = useState('');
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  // Set synchronously: the camera reports the same code many times before React re-renders.
  const lockedRef = useRef(false);

  const lookup = useMutation({ mutationFn: (value: string) => getFoodByBarcode(value) });

  const run = (value: string) => {
    setCode(value);
    setStatus('looking');
    lookup.mutate(value, {
      onSuccess: (food) => {
        queryClient.setQueryData(foodKeys.detail(food.id), food);
        router.replace({ pathname: '/food-detail', params: { id: food.id } });
      },
      onError: (error) => {
        const unknown = error instanceof ApiError && (error.status === 404 || error.status === 400);
        setOffline(error instanceof NetworkError);
        setStatus(unknown ? 'notFound' : 'error');
      },
    });
  };

  const accept = (raw: string) => {
    const value = normalizeBarcode(raw);
    if (!value || lockedRef.current) return;
    lockedRef.current = true;
    run(value);
  };

  const submitManual = () => {
    if (!normalizeBarcode(manual)) {
      setManualError('Enter 8 to 14 digits');
      return;
    }
    accept(manual);
  };

  const scanAgain = () => {
    lockedRef.current = false;
    setStatus('scanning');
  };

  const manualField = (
    <View testID="manual-entry-field" style={[styles.manual, { paddingBottom: keyboardHeight > 0 ? space.lg : Math.max(insets.bottom, space.lg) }]}>
      <TextField
        label="Or type the barcode"
        value={manual}
        onChangeText={(text) => {
          setManual(text);
          setManualError(null);
          if (status !== 'looking') lockedRef.current = false;
        }}
        keyboardType="number-pad"
        maxLength={14}
        error={manualError}
        editable={status !== 'looking'}
        onSubmitEditing={submitManual}
      />
      <Button label="Look up" variant="secondary" onPress={submitManual} disabled={status === 'looking'} />
    </View>
  );

  const message = (title: string, text: string, button: { label: string; onPress: () => void }) => (
    <View style={styles.center}>
      <Ionicons name="camera-outline" size={64} color={colors.textTertiary} accessibilityElementsHidden importantForAccessibility="no" />
      <Text accessibilityRole="header" style={[type.title2, styles.text, { color: colors.text }]} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      <Text style={[type.body, styles.text, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {text}
      </Text>
      <Button label={button.label} onPress={button.onPress} />
    </View>
  );

  let body;
  if (status === 'notFound') {
    body = (
      <View style={styles.result}>
        <StateBlock
          variant="empty"
          title="No match for this barcode"
          message={`We couldn't find ${code}.`}
          actionLabel="Search by name"
          onAction={() => router.push('/search')}
        />
        <Button variant="secondary" label="Enter manually" onPress={() => router.push('/manual-entry')} />
        <Button variant="text" label="Scan again" onPress={scanAgain} />
      </View>
    );
  } else if (status === 'error') {
    body = (
      <StateBlock
        variant="error"
        title={offline ? "You're offline" : "Couldn't look this up"}
        message={offline ? 'Check your connection and try again.' : 'Something went wrong. Please try again.'}
        actionLabel="Retry"
        onAction={() => run(code)}
      />
    );
  } else if (!permission) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Checking camera access" color={colors.accent} />
      </View>
    );
  } else if (!permission.granted && permission.canAskAgain && permission.status === 'undetermined') {
    body = message('Scan with your camera', 'Fuel uses the camera only to read barcodes. Nothing is saved.', {
      label: 'Allow camera',
      onPress: () => void requestPermission(),
    });
  } else if (!permission.granted && permission.canAskAgain) {
    body = message('Camera access is off', 'Allow the camera to scan, or type the barcode below.', {
      label: 'Try again',
      onPress: () => void requestPermission(),
    });
  } else if (!permission.granted) {
    body = message('Allow camera in Settings', 'Camera access is blocked. Turn it on in Settings, or type the barcode below.', {
      label: 'Open settings',
      onPress: () => void Linking.openSettings(),
    });
  } else {
    body = (
      <View style={[styles.camera, { backgroundColor: colors.surfaceMuted }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={status === 'scanning' ? ({ data }) => accept(data) : undefined}
        />
        <View style={[styles.guide, { borderColor: colors.onAccent }]} />
        {status === 'scanning' ? (
          <View style={[styles.hint, { backgroundColor: colors.scrim }]}>
            <Text style={[type.callout, { color: colors.onAccent }]} maxFontSizeMultiplier={2}>
              Point at a barcode
            </Text>
          </View>
        ) : null}
        {status === 'looking' ? (
          <View accessibilityLiveRegion="polite" style={[styles.overlay, { backgroundColor: colors.scrim }]}>
            <ActivityIndicator accessibilityLabel="Looking up barcode" color={colors.onAccent} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
      </Pressable>
      <View style={styles.flex}>{body}</View>
      {manualField}
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { width: sizing.touchMin, height: sizing.touchMin, marginLeft: space.lg, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  text: { textAlign: 'center' },
  result: { flex: 1, padding: space.lg, gap: space.sm },
  camera: { flex: 1, margin: space.lg, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  guide: { width: '75%', height: 120, maxHeight: '60%', borderWidth: 2, borderRadius: radius.md },
  hint: { position: 'absolute', bottom: space.lg, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.md },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  manual: { padding: space.lg, gap: space.sm },
});
