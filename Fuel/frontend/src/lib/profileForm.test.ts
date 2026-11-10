import { PROFILE_MAX_NAME, PROFILE_MESSAGES, validateProfile } from './profileForm';

const ORIGINAL = { name: 'Sam', timezone: 'Europe/London' };

describe('validateProfile', () => {
  it('trims the name', () => {
    expect(validateProfile('  Sam K  ', 'Europe/London').input).toEqual({ name: 'Sam K', timezone: 'Europe/London' });
  });

  it('blocks a blank name', () => {
    expect(validateProfile('   ', 'Europe/London').errors.name).toBe(PROFILE_MESSAGES.nameRequired);
  });

  it('accepts 100 characters and rejects 101', () => {
    expect(validateProfile('a'.repeat(PROFILE_MAX_NAME), 'Europe/London').errors.name).toBeUndefined();
    expect(validateProfile('a'.repeat(PROFILE_MAX_NAME + 1), 'Europe/London').errors.name).toBe(PROFILE_MESSAGES.nameTooLong);
  });

  it('requires a timezone', () => {
    expect(validateProfile('Sam', '').errors.timezone).toBe(PROFILE_MESSAGES.timezoneRequired);
  });

  it('sends only the name when only the name changed', () => {
    expect(validateProfile('Sam K', 'Europe/London', ORIGINAL).input).toEqual({ name: 'Sam K' });
  });

  it('sends only the timezone when only the timezone changed', () => {
    expect(validateProfile('Sam', 'Asia/Tokyo', ORIGINAL).input).toEqual({ timezone: 'Asia/Tokyo' });
  });

  it('returns no input when nothing changed, even with stray spaces', () => {
    expect(validateProfile(' Sam ', 'Europe/London', ORIGINAL)).toEqual({ errors: {}, input: null });
  });
});
