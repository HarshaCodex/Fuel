import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { forgotPassword } from '@/api/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { setPendingEmail } from '@/lib/pendingEmail';
import { validateEmail } from '@/lib/validation';

const GENERIC_ERROR = "Couldn't send a code. Try again.";
const OFFLINE_ERROR = "You're offline. Check your connection and try again.";
// Identical for every address: the screen must not reveal whether an account exists.
const SENT_MESSAGE = 'If an account exists, a code is on its way';

type Failure = { kind: 'offline' | 'rateLimited' | 'generic'; message: string };

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    const err = validateEmail(email);
    setEmailError(err);
    if (err) {
      emailRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setFailure(null);
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      const { kind, retryAfter } = classifyAuthError(e);
      if (kind === 'offline') setFailure({ kind: 'offline', message: OFFLINE_ERROR });
      else if (kind === 'rateLimited') setFailure({ kind: 'rateLimited', message: rateLimitMessage(retryAfter) });
      else setFailure({ kind: 'generic', message: GENERIC_ERROR });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  // Handlers return void so the press is not tied to the request's lifetime.
  const onSubmit = () => {
    void submit();
  };

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/sign-in');
  }

  function enterCode() {
    setPendingEmail(email.trim());
    router.push('/reset-password');
  }

  const backButton = (
    <View style={styles.links}>
      <Button pill variant="text" size="md" label="Back to sign in" onPress={goBack} />
    </View>
  );

  if (sent) {
    return (
      <AuthScreen onBack={goBack} title="Reset your password" subtitle={SENT_MESSAGE} subtitleLive>
        <Button pill label="Enter code" onPress={enterCode} />
        {backButton}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen onBack={goBack} title="Reset your password" subtitle="Enter your email and we'll send a code">
      {failure?.kind === 'offline' ? (
        <Banner variant="caution" message={failure.message} action={{ label: 'Retry', onPress: onSubmit }} />
      ) : null}
      {failure && failure.kind !== 'offline' ? <Banner variant="danger" message={failure.message} /> : null}
      <TextField
        variant="pill"
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (emailError) setEmailError(validateEmail(v));
        }}
        onBlur={() => email && setEmailError(validateEmail(email))}
        error={emailError}
        editable={!loading}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Button pill label="Send code" loading={loading} onPress={onSubmit} />
      {backButton}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  links: { alignItems: 'center' },
});
