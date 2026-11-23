import { Redirect } from 'expo-router';

import { useSession } from '@/session/SessionProvider';

/** Signed-out visitors at `/` (cold start, old links) match no route because the tabs are guarded; send them to sign-in. */
export default function NotFound() {
  const { status } = useSession();
  return <Redirect href={status === 'signedIn' ? '/' : '/sign-in'} />;
}
