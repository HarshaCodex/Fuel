import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { forgotPassword, resetPassword } from '@/api/auth';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { PasswordRules } from '@/components/PasswordRules';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { validateNewPassword } from '@/lib/passwordRules';
import { getPendingEmail, setPendingEmail } from '@/lib/pendingEmail';
import { formatCooldown, RESEND_COOLDOWN_SECONDS, useCooldown } from '@/lib/useCooldown';
import { validateEmail } from '@/lib/validation';
import { space, type, useTheme } from '@/theme';

const CODE_MAX = 10;
const CODE_LETTER_SPACING = 4;
const CODE_REQUIRED = 'Enter the code.';
const CODE_REJECTED = "That code didn't work. Request a new one.";
const RESET_ERROR = "Couldn't reset your password. Try again.";
const RESEND_ERROR = "Couldn't send a code. Try again.";
const RESEND_OK = 'If an account exists, a new code is on its way.';
const OFFLINE_ERROR = "You're offline. Check your connection and try again.";

type Field = 'email' | 'code' | 'password';
type Notice = { variant: 'caution' | 'info' | 'danger'; message: string; retry?: 'reset' | 'resend' };

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [pending] = useState(getPendingEmail);
  const [email, setEmail] = useState(pending ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<Field, string | null>>({ email: null, code: null, password: null });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // 429 on reset: locked for retryAfter seconds, or until the screen is reopened when unknown.
  const [lockedForever, setLockedForever] = useState(false);
  // A code was just requested on the previous screen, so start the wait there.
  const resendCooldown = useCooldown(pending ? RESEND_COOLDOWN_SECONDS : 0);
  const lock = useCooldown(0);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const inFlight = useRef(false);
  const resendInFlight = useRef(false);
  const locked = lockedForever || lock.remaining > 0;

  const setError = (field: Field, message: string | null) => setErrors((prev) => ({ ...prev, [field]: message }));

  async function reset() {
    if (inFlight.current || locked) return;
    const next: Record<Field, string | null> = {
      email: validateEmail(email),
      code: code.trim() ? null : CODE_REQUIRED,
      password: validateNewPassword(password),
    };
    setErrors(next);
    const firstInvalid = (['email', 'code', 'password'] as const).find((f) => next[f]);
    if (firstInvalid) {
      ({ email: emailRef, code: codeRef, password: passwordRef })[firstInvalid].current?.focus();
      return;
    }
    inFlight.current = true;
    setNotice(null);
    setLoading(true);
    try {
      const trimmed = email.trim();
      await resetPassword(trimmed, code.trim(), password);
      setPendingEmail(trimmed);
      setPassword('');
      setLoading(false);
      // The response has no tokens: the user signs in with the new password.
      router.replace({ pathname: '/sign-in', params: { reset: '1' } });
    } catch (e) {
      const { kind, retryAfter } = classifyAuthError(e);
      const mapped = kind === 'invalid' ? mapFieldErrors(e) : null;
      if (kind === 'unauthorized') setError('code', CODE_REJECTED);
      else if (kind === 'offline') setNotice({ variant: 'caution', message: OFFLINE_ERROR, retry: 'reset' });
      else if (kind === 'rateLimited') {
        setNotice({ variant: 'danger', message: rateLimitMessage(retryAfter) });
        if (retryAfter && retryAfter > 0) lock.start(retryAfter);
        else setLockedForever(true);
      } else if (mapped) setErrors((prev) => ({ ...prev, ...mapped }));
      else setNotice({ variant: 'danger', message: RESET_ERROR });
      setLoading(false);
    } finally {
      inFlight.current = false;
    }
  }

  async function resend() {
    if (resendInFlight.current || locked || resendCooldown.remaining > 0) return;
    const emailError = validateEmail(email);
    setError('email', emailError);
    if (emailError) {
      emailRef.current?.focus();
      return;
    }
    resendInFlight.current = true;
    setNotice(null);
    setResending(true);
    try {
      await forgotPassword(email.trim());
      resendCooldown.start(RESEND_COOLDOWN_SECONDS);
      setNotice({ variant: 'info', message: RESEND_OK });
    } catch (e) {
      const { kind, retryAfter } = classifyAuthError(e);
      if (kind === 'offline') setNotice({ variant: 'caution', message: OFFLINE_ERROR, retry: 'resend' });
      else if (kind === 'rateLimited') {
        resendCooldown.start(retryAfter && retryAfter > 0 ? retryAfter : RESEND_COOLDOWN_SECONDS);
        setNotice({ variant: 'danger', message: rateLimitMessage(retryAfter) });
      } else setNotice({ variant: 'danger', message: RESEND_ERROR });
    } finally {
      resendInFlight.current = false;
      setResending(false);
    }
  }

  // Handlers return void so the press is not tied to the request's lifetime.
  const onReset = () => {
    void reset();
  };
  const onResend = () => {
    void resend();
  };

  const waiting = resendCooldown.remaining > 0;
  const resendLabel = waiting ? `Send a new code in ${formatCooldown(resendCooldown.remaining)}` : 'Send a new code';

  return (
    <FormScreen>
      <View style={styles.header}>
        <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
          Choose a new password
        </Text>
      </View>
      {notice ? (
        <Banner
          variant={notice.variant}
          message={notice.message}
          action={notice.retry ? { label: 'Retry', onPress: notice.retry === 'reset' ? onReset : onResend } : undefined}
        />
      ) : null}
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
        onSubmitEditing={() => codeRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={codeRef}
        label="Code"
        value={code}
        onChangeText={(v) => {
          setCode(v);
          if (errors.code) setError('code', null);
        }}
        onBlur={() => code && setError('code', code.trim() ? null : CODE_REQUIRED)}
        error={errors.code}
        editable={!loading}
        maxLength={CODE_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        style={[type.title1, styles.code]}
      />
      <TextField
        ref={passwordRef}
        label="New password"
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
        onSubmitEditing={onReset}
      />
      <PasswordRules value={password} />
      <Button label="Reset password" loading={loading} disabled={locked} onPress={onReset} />
      <View style={styles.links}>
        <Button
          variant="text"
          size="md"
          label={resendLabel}
          disabled={waiting || locked || resending || loading}
          onPress={onResend}
        />
      </View>
    </FormScreen>
  );
}

/** Server validation text is user-safe; map only the fields this form has. */
function mapFieldErrors(e: unknown): Partial<Record<Field, string>> | null {
  const out: Partial<Record<Field, string>> = {};
  const list = (e as { fieldErrors?: { field: string; message: string }[] }).fieldErrors ?? [];
  for (const { field, message } of list) {
    const key = field === 'newPassword' ? 'password' : field === 'email' ? 'email' : null;
    if (key && !out[key]) out[key] = message;
  }
  return Object.keys(out).length > 0 ? out : null;
}

const styles = StyleSheet.create({
  header: { marginBottom: space.lg },
  code: { textAlign: 'center', letterSpacing: CODE_LETTER_SPACING },
  links: { alignItems: 'center' },
});
