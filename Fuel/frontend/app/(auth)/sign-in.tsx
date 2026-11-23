import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { login, oauthApple, oauthGoogle } from '@/api/auth';
import { isAppleSignInAvailable, isGoogleSignInAvailable, signInWithApple, signInWithGoogle } from '@/auth/oauthProviders';
import { AuthScreen } from '@/components/AuthScreen';
import { Banner } from '@/components/Banner';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { OAuthButtons } from '@/components/OAuthButtons';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { clearPendingEmail, getPendingEmail, setPendingEmail } from '@/lib/pendingEmail';
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
  const lastAction = useRef<'password' | 'google' | 'apple'>('password');
  const [showApple, setShowApple] = useState(false);

  useEffect(() => {
    let active = true;
    void isAppleSignInAvailable().then((ok) => {
      if (active) setShowApple(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  function showError(e: unknown, credentialsOnAuthFailure: boolean) {
    const { kind, retryAfter } = classifyAuthError(e);
    // Password sign-in 403 means the email is unverified: continue on the verify screen (it offers resend).
    if (credentialsOnAuthFailure && kind === 'forbidden') {
      setPendingEmail(email.trim());
      setPassword('');
      setLoading(false);
      router.push({ pathname: '/verify-email', params: { unsent: '1' } });
      return;
    }
    if (kind === 'offline') setFailure({ kind: 'offline', message: OFFLINE_ERROR });
    else if (kind === 'rateLimited') setFailure({ kind: 'rateLimited', message: rateLimitMessage(retryAfter) });
    else if (credentialsOnAuthFailure && kind === 'unauthorized') setFailure({ kind: 'credentials' });
    else setFailure({ kind: 'generic', message: GENERIC_ERROR });
    setLoading(false);
  }

  async function oauth(provider: 'google' | 'apple') {
    if (inFlight.current) return;
    inFlight.current = true;
    lastAction.current = provider;
    setFailure(null);
    setLoading(true);
    try {
      let data;
      if (provider === 'google') {
        const result = await signInWithGoogle();
        if (!result) {
          setLoading(false);
          return;
        }
        data = await oauthGoogle(result.idToken);
      } else {
        const result = await signInWithApple();
        if (!result) {
          setLoading(false);
          return;
        }
        data = await oauthApple(result);
      }
      await signIn({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    } catch (e) {
      showError(e, false);
    } finally {
      inFlight.current = false;
    }
  }

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
    lastAction.current = 'password';
    setFailure(null);
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      await signIn({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      // The protected stack swaps to the tabs; this screen unmounts, so nothing more to set.
    } catch (e) {
      showError(e, true);
    } finally {
      inFlight.current = false;
    }
  }

  // Handlers return void so the press is not tied to the request's lifetime.
  const onSubmit = () => {
    void submit();
  };
  const onGoogle = () => {
    void oauth('google');
  };
  const onApple = () => {
    void oauth('apple');
  };
  const onRetry = () => {
    if (lastAction.current === 'password') onSubmit();
    else void oauth(lastAction.current);
  };

  return (
    <AuthScreen
      centered
      footer={
        <View style={styles.footer}>
          <Text style={[type.tagline, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            New to Fuel?
          </Text>
          <Button pill variant="text" size="md" label="Create an account" onPress={() => router.push('/register')} />
        </View>
      }
    >
      <View style={styles.header}>
        <BrandMark />
      </View>
      {reset === '1' ? <Banner variant="info" message={RESET_DONE} /> : null}
      {failure?.kind === 'offline' ? (
        <Banner variant="caution" message={failure.message} action={{ label: 'Retry', onPress: onRetry }} />
      ) : null}
      {failure?.kind === 'rateLimited' || failure?.kind === 'generic' ? (
        <Banner variant="danger" message={failure.message} />
      ) : null}
      <TextField
        variant="pill"
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
        variant="pill"
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
      <View style={styles.forgot}>
        <Button pill variant="text" size="md" label="Forgot password?" onPress={() => router.push('/forgot-password')} />
      </View>
      <Button pill label="Sign in" loading={loading} onPress={onSubmit} />
      <OAuthButtons disabled={loading} showApple={showApple} showGoogle={isGoogleSignInAvailable()} onGoogle={onGoogle} onApple={onApple} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: space.lg },
  forgot: { alignSelf: 'flex-end' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
});
