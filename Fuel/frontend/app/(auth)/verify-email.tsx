import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { resendVerification, verifyEmail } from '@/api/auth';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { clearPendingEmail, getPendingEmail } from '@/lib/pendingEmail';
import { formatCooldown, RESEND_COOLDOWN_SECONDS, useCooldown } from '@/lib/useCooldown';
import { useSession } from '@/session/SessionProvider';
import { space, type, useTheme } from '@/theme';

const CODE_MAX = 10;
const CODE_LETTER_SPACING = 4;
const CODE_REQUIRED = 'Enter the code.';
const CODE_REJECTED = "That code didn't work. Check it or request a new one.";
const VERIFY_ERROR = "Couldn't verify. Try again.";
const RESEND_ERROR = "Couldn't send a new code. Try again.";
const RESEND_OK = 'A new code is on its way.';
const OFFLINE_ERROR = "You're offline. Check your connection and try again.";

type Notice = { variant: 'caution' | 'info' | 'danger'; message: string; retry?: 'verify' | 'resend' };

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signIn } = useSession();
  // `unsent=1`: arrived from a blocked sign-in, so no code has been sent yet.
  const { unsent } = useLocalSearchParams<{ unsent?: string }>();
  const noCodeYet = unsent === '1';
  const [email] = useState(getPendingEmail);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // 429 on verify: locked for retryAfter seconds, or until the screen is reopened when unknown.
  const [lockedForever, setLockedForever] = useState(false);
  const resendCooldown = useCooldown(noCodeYet ? 0 : RESEND_COOLDOWN_SECONDS);
  const lock = useCooldown(0);
  const inFlight = useRef(false);
  const resendInFlight = useRef(false);
  const locked = lockedForever || lock.remaining > 0;

  useEffect(() => {
    if (!email) router.replace('/sign-in');
  }, [email, router]);

  if (!email) return null;

  async function verify() {
    if (inFlight.current || locked) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError(CODE_REQUIRED);
      return;
    }
    inFlight.current = true;
    setCodeError(null);
    setNotice(null);
    setLoading(true);
    try {
      const data = await verifyEmail(email!, trimmed);
      await signIn({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      clearPendingEmail();
      // The protected stack swaps to Today; this screen unmounts.
    } catch (e) {
      const { kind, retryAfter } = classifyAuthError(e);
      if (kind === 'unauthorized') setCodeError(CODE_REJECTED);
      else if (kind === 'offline') setNotice({ variant: 'caution', message: OFFLINE_ERROR, retry: 'verify' });
      else if (kind === 'rateLimited') {
        setNotice({ variant: 'danger', message: rateLimitMessage(retryAfter) });
        if (retryAfter && retryAfter > 0) lock.start(retryAfter);
        else setLockedForever(true);
      } else setNotice({ variant: 'danger', message: VERIFY_ERROR });
      setLoading(false);
    } finally {
      inFlight.current = false;
    }
  }

  async function resend() {
    if (resendInFlight.current || locked || resendCooldown.remaining > 0) return;
    resendInFlight.current = true;
    setNotice(null);
    setResending(true);
    try {
      await resendVerification(email!);
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
  const onVerify = () => {
    void verify();
  };
  const onResend = () => {
    void resend();
  };

  const waiting = resendCooldown.remaining > 0;
  const resendLabel = waiting ? `Resend in ${formatCooldown(resendCooldown.remaining)}` : 'Resend code';

  return (
    <FormScreen>
      <View style={styles.header}>
        <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
          Check your email
        </Text>
        <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          {noCodeYet ? `Verify ${email} to sign in. Request a code below.` : `We sent a code to ${email}`}
        </Text>
      </View>
      {notice ? (
        <Banner
          variant={notice.variant}
          message={notice.message}
          action={notice.retry ? { label: 'Retry', onPress: notice.retry === 'verify' ? onVerify : onResend } : undefined}
        />
      ) : null}
      <TextField
        label="Code"
        value={code}
        onChangeText={(v) => {
          setCode(v);
          if (codeError) setCodeError(null);
        }}
        error={codeError}
        editable={!loading}
        maxLength={CODE_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="go"
        onSubmitEditing={onVerify}
        style={[type.title1, styles.code]}
      />
      <Button label="Verify" loading={loading} disabled={locked} onPress={onVerify} />
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

const styles = StyleSheet.create({
  header: { gap: space.xs, marginBottom: space.lg },
  code: { textAlign: 'center', letterSpacing: CODE_LETTER_SPACING },
  links: { alignItems: 'center' },
});
