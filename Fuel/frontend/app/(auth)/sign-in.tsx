import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { login } from '@/api/auth';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { clearPendingEmail, getPendingEmail } from '@/lib/pendingEmail';
import { validateEmail, validateLoginPassword } from '@/lib/validation';
import { useSession } from '@/session/SessionProvider';
import { space, type, useTheme } from '@/theme';

const CREDENTIALS_ERROR = 'Email or password is incorrect';
const GENERIC_ERROR = "Couldn't sign in. Try again.";
const RESET_DONE = 'Password updated. Sign in with your new password.';
const OFFLINE_ERROR = "You're offline. Check your connection and try again.";

type Failure = { kind: 'offline' | 'rateLimited' | 'generic'; message: string } | { kind: 'credentials' };

export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signIn } = useSession();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  // Prefill once from the register/reset flows, then forget it.
  const [email, setEmail] = useState(() => {
    const pending = getPendingEmail() ?? '';
    clearPendingEmail();
    return pending;
  });
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    const eErr = validateEmail(email);
    const pErr = validateLoginPassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) {
      (eErr ? emailRef : passwordRef).current?.focus();
      return;
    }
    inFlight.current = true;
    setFailure(null);
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      await signIn({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      // The protected stack swaps to the tabs; this screen unmounts, so nothing more to set.
    } catch (e) {
      const { kind, retryAfter } = classifyAuthError(e);
      if (kind === 'offline') setFailure({ kind: 'offline', message: OFFLINE_ERROR });
      else if (kind === 'rateLimited') setFailure({ kind: 'rateLimited', message: rateLimitMessage(retryAfter) });
      // 403 (unverified email) deliberately looks the same as a wrong password.
      else if (kind === 'unauthorized' || kind === 'forbidden') setFailure({ kind: 'credentials' });
      else setFailure({ kind: 'generic', message: GENERIC_ERROR });
      setLoading(false);
    } finally {
      inFlight.current = false;
    }
  }

  // Handlers return void so the press is not tied to the request's lifetime.
  const onSubmit = () => {
    void submit();
  };

  return (
    <FormScreen>
      <View style={styles.header}>
        <Text style={[type.title1, { color: colors.accentText }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
          Fuel
        </Text>
        <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          Track what you eat, simply.
        </Text>
      </View>
      {reset === '1' ? <Banner variant="info" message={RESET_DONE} /> : null}
      {failure?.kind === 'offline' ? (
        <Banner variant="caution" message={failure.message} action={{ label: 'Retry', onPress: onSubmit }} />
      ) : null}
      {failure?.kind === 'rateLimited' || failure?.kind === 'generic' ? (
        <Banner variant="danger" message={failure.message} />
      ) : null}
      <TextField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        onBlur={() => email && setEmailError(validateEmail(email))}
        error={emailError}
        editable={!loading}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (passwordError) setPasswordError(validateLoginPassword(v));
        }}
        onBlur={() => password && setPasswordError(validateLoginPassword(password))}
        error={passwordError ?? (failure?.kind === 'credentials' ? CREDENTIALS_ERROR : null)}
        editable={!loading}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Button label="Sign in" loading={loading} onPress={onSubmit} />
      <View style={styles.links}>
        <Button variant="text" size="md" label="Forgot password?" onPress={() => router.push('/forgot-password')} />
        <Button variant="text" size="md" label="Create an account" onPress={() => router.push('/register')} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs, marginBottom: space.lg },
  links: { alignItems: 'center' },
});
