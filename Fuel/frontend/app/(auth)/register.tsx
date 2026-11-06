import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { register } from '@/api/auth';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { PasswordRules } from '@/components/PasswordRules';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { validateNewPassword } from '@/lib/passwordRules';
import { setPendingEmail } from '@/lib/pendingEmail';
import { validateEmail } from '@/lib/validation';
import { space, type, useTheme } from '@/theme';

const NAME_MAX = 100;
const NAME_ERROR = 'Enter your name.';
const GENERIC_ERROR = "Couldn't create your account. Try again.";
const OFFLINE_ERROR = "You're offline. Check your connection and try again.";

type Failure = { kind: 'offline' | 'rateLimited' | 'generic'; message: string };
type Field = 'name' | 'email' | 'password';

const validateName = (v: string) => (v.trim().length >= 1 && v.trim().length <= NAME_MAX ? null : NAME_ERROR);

export default function RegisterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<Field, string | null>>({ name: null, email: null, password: null });
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const inFlight = useRef(false);

  const setError = (field: Field, message: string | null) => setErrors((prev) => ({ ...prev, [field]: message }));

  async function submit() {
    if (inFlight.current) return;
    const next: Record<Field, string | null> = {
      name: validateName(name),
      email: validateEmail(email),
      password: validateNewPassword(password),
    };
    setErrors(next);
    const firstInvalid = (['name', 'email', 'password'] as const).find((f) => next[f]);
    if (firstInvalid) {
      const target = { name: nameRef, email: emailRef, password: passwordRef }[firstInvalid];
      target.current?.focus();
      return;
    }
    inFlight.current = true;
    setFailure(null);
    setLoading(true);
    try {
      const trimmed = email.trim();
      await register({
        email: trimmed,
        password,
        name: name.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setPendingEmail(trimmed);
      setPassword('');
      setLoading(false);
      router.push('/verify-email');
    } catch (e) {
      const { kind, retryAfter } = classifyAuthError(e);
      const mapped = kind === 'invalid' ? mapFieldErrors(e) : null;
      if (kind === 'offline') setFailure({ kind: 'offline', message: OFFLINE_ERROR });
      else if (kind === 'rateLimited') setFailure({ kind: 'rateLimited', message: rateLimitMessage(retryAfter) });
      else if (mapped) setErrors((prev) => ({ ...prev, ...mapped }));
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

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/sign-in');
  }

  return (
    <FormScreen>
      <View style={styles.header}>
        <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
          Create your account
        </Text>
      </View>
      {failure?.kind === 'offline' ? (
        <Banner variant="caution" message={failure.message} action={{ label: 'Retry', onPress: onSubmit }} />
      ) : null}
      {failure?.kind === 'rateLimited' || failure?.kind === 'generic' ? (
        <Banner variant="danger" message={failure.message} />
      ) : null}
      <TextField
        ref={nameRef}
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (errors.name) setError('name', validateName(v));
        }}
        onBlur={() => name && setError('name', validateName(name))}
        error={errors.name}
        editable={!loading}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errors.email) setError('email', validateEmail(v));
        }}
        onBlur={() => email && setError('email', validateEmail(email))}
        error={errors.email}
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
          if (errors.password) setError('password', validateNewPassword(v));
        }}
        onBlur={() => password && setError('password', validateNewPassword(password))}
        error={errors.password}
        editable={!loading}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <PasswordRules value={password} />
      <Button label="Create account" loading={loading} onPress={onSubmit} />
      <View style={styles.links}>
        <Button variant="text" size="md" label="Back to sign in" onPress={goBack} />
      </View>
    </FormScreen>
  );
}

/** Server validation text is user-safe; map only the fields this form has. */
function mapFieldErrors(e: unknown): Partial<Record<Field, string>> | null {
  const out: Partial<Record<Field, string>> = {};
  const list = (e as { fieldErrors?: { field: string; message: string }[] }).fieldErrors ?? [];
  for (const { field, message } of list) {
    if ((field === 'name' || field === 'email' || field === 'password') && !out[field]) out[field] = message;
  }
  return Object.keys(out).length > 0 ? out : null;
}

const styles = StyleSheet.create({
  header: { marginBottom: space.lg },
  links: { alignItems: 'center' },
});
