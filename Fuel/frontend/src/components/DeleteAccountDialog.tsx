import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/errors';
import { deleteAccount, type AuthProvider, type DeleteConfirmation } from '@/api/user';
import { signInWithApple, signInWithGoogle } from '@/auth/oauthProviders';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { DELETE_MESSAGES } from '@/lib/deleteAccount';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

type Props = {
  visible: boolean;
  /** The provider the user registered with. It decides how they confirm. */
  provider: AuthProvider;
  onClose: () => void;
  /** Called once after the server accepts the deletion. */
  onDeleted: () => void;
};

/** Permanent-deletion confirmation. The password lives only in this component and is cleared on close. */
export function DeleteAccountDialog({ visible, provider, onClose, onDeleted }: Props) {
  const { colors, scheme } = useTheme();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const reset = () => {
    setPassword('');
    setFieldError(null);
    setMessage(null);
  };
  const close = () => {
    if (inFlight.current) return;
    reset();
    onClose();
  };

  const describe = (e: unknown): string => {
    const c = classifyAuthError(e);
    if (c.kind === 'offline') return DELETE_MESSAGES.offline;
    if (c.kind === 'rateLimited') return rateLimitMessage(c.retryAfter);
    if (c.kind === 'unauthorized') return provider === 'EMAIL' ? DELETE_MESSAGES.wrongPassword : DELETE_MESSAGES.wrongIdentity;
    if (e instanceof ApiError && e.status === 404) return DELETE_MESSAGES.notFound;
    if (c.kind === 'invalid' && e instanceof ApiError && e.message) return e.message;
    return DELETE_MESSAGES.generic;
  };

  const submit = async (build: () => Promise<DeleteConfirmation | null>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFieldError(null);
    setMessage(null);
    try {
      const confirmation = await build();
      if (!confirmation) return; // the user cancelled the provider sheet
      await deleteAccount(confirmation);
      reset();
      onDeleted();
    } catch (e) {
      const text = describe(e);
      if (provider === 'EMAIL' && classifyAuthError(e).kind === 'unauthorized') setFieldError(text);
      else setMessage(text);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const confirmPassword = () => {
    if (!password) {
      setFieldError(DELETE_MESSAGES.passwordRequired);
      return;
    }
    void submit(async () => ({ password }));
  };

  const confirmProvider = () =>
    submit(async () => {
      if (provider === 'GOOGLE') {
        const r = await signInWithGoogle();
        return r ? { googleIdToken: r.idToken } : null;
      }
      const r = await signInWithApple();
      if (!r) return null;
      if (!r.authorizationCode) throw new Error('Apple did not return an authorization code');
      return { appleIdentityToken: r.identityToken, appleAuthorizationCode: r.authorizationCode };
    });

  const name = provider === 'APPLE' ? 'Apple' : 'Google';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View accessibilityViewIsModal style={[styles.card, shadow.md, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text accessibilityRole="header" style={[type.title2, { color: colors.text }]} maxFontSizeMultiplier={2}>
            {DELETE_MESSAGES.title}
          </Text>
          <Text style={[type.body, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {DELETE_MESSAGES.body}
          </Text>
          {message ? <Banner variant="danger" message={message} /> : null}
          {provider === 'EMAIL' ? (
            <TextField
              label="Password"
              secure
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setFieldError(null);
              }}
              error={fieldError}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={confirmPassword}
            />
          ) : null}
          <View style={styles.actions}>
            <Button variant="secondary" label="Cancel" onPress={close} disabled={busy} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={provider === 'EMAIL' ? 'Delete account' : `Confirm with ${name} and delete`}
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={provider === 'EMAIL' ? confirmPassword : () => void confirmProvider()}
              style={({ pressed }) => [styles.danger, { backgroundColor: colors.danger, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
            >
              <Text style={[type.headline, { color: scheme === 'dark' ? colors.bg : colors.onAccent }]} maxFontSizeMultiplier={2}>
                {provider === 'EMAIL' ? 'Delete account' : `Confirm with ${name} and delete`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.lg, borderWidth: sizing.border, padding: space.xl, gap: space.md },
  actions: { gap: space.sm, marginTop: space.sm },
  danger: { minHeight: sizing.buttonLg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: space.xl },
});
