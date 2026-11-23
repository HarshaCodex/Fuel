import type { ProfileInput, UserProfile } from '@/api/user';

export type ProfileForm = { name: string; timezone: string };
export type ProfileField = 'name' | 'timezone';

export const PROFILE_FIELDS: readonly ProfileField[] = ['name', 'timezone'];

export const PROFILE_MAX_NAME = 100;

export const PROFILE_MESSAGES = {
  nameRequired: 'Enter your name',
  nameTooLong: `Name must be ${PROFILE_MAX_NAME} characters or fewer`,
  timezoneRequired: 'Choose a timezone',
  unmatched: 'Some details were not accepted. Check your answers and try again.',
  offline: "You're offline. Check your connection and try again.",
  generic: "Couldn't save your profile. Try again.",
  notFound: 'This account no longer exists.',
  loadFailed: "Couldn't load your profile.",
} as const;

export const formFromProfile = (p: Pick<UserProfile, 'name' | 'timezone'>): ProfileForm => ({
  name: p.name,
  timezone: p.timezone,
});

/**
 * Trims the name and checks it. `input` holds only the fields that differ from `original`
 * (null when nothing changed), so an unchanged field is never sent.
 */
export function validateProfile(
  name: string,
  timezone: string,
  original?: ProfileForm,
): { errors: Partial<Record<ProfileField, string>>; input: ProfileInput | null } {
  const errors: Partial<Record<ProfileField, string>> = {};
  const trimmed = name.trim();
  if (!trimmed) errors.name = PROFILE_MESSAGES.nameRequired;
  else if (trimmed.length > PROFILE_MAX_NAME) errors.name = PROFILE_MESSAGES.nameTooLong;
  if (!timezone) errors.timezone = PROFILE_MESSAGES.timezoneRequired;
  if (Object.keys(errors).length > 0) return { errors, input: null };
  const input: ProfileInput = {};
  if (!original || trimmed !== original.name) input.name = trimmed;
  if (!original || timezone !== original.timezone) input.timezone = timezone;
  return { errors, input: Object.keys(input).length > 0 ? input : null };
}
