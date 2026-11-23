import { msUntilNextMidnight, todayInTimezone } from './today';

const AKL = 'Pacific/Auckland';
const LA = 'America/Los_Angeles';
const H = 3600 * 1000;

describe('todayInTimezone', () => {
  it('gives different dates for the same instant in different zones', () => {
    const now = new Date('2026-11-19T12:00:00Z'); // 01:00 Nov 20 in Auckland, 04:00 Nov 19 in LA
    expect(todayInTimezone(AKL, now)).toBe('2026-11-20');
    expect(todayInTimezone(LA, now)).toBe('2026-11-19');
  });

  it('uses the profile zone even when it differs from the phone', () => {
    const now = new Date('2026-11-19T23:30:00Z');
    expect(todayInTimezone('Asia/Tokyo', now)).toBe('2026-11-20');
    expect(todayInTimezone('UTC', now)).toBe('2026-11-19');
  });

  it('flips one second either side of midnight in the profile zone', () => {
    expect(todayInTimezone(LA, new Date('2026-11-20T07:59:59Z'))).toBe('2026-11-19');
    expect(todayInTimezone(LA, new Date('2026-11-20T08:00:00Z'))).toBe('2026-11-20');
  });

  it('handles the daylight saving change day', () => {
    expect(todayInTimezone(LA, new Date('2026-11-01T08:59:59Z'))).toBe('2026-11-01');
    expect(todayInTimezone(LA, new Date('2026-11-02T07:59:59Z'))).toBe('2026-11-01');
    expect(todayInTimezone(LA, new Date('2026-11-02T08:00:00Z'))).toBe('2026-11-02');
  });

  it('falls back to the phone date for a missing or invalid zone', () => {
    const now = new Date(2026, 10, 19, 12, 0, 0);
    expect(todayInTimezone(undefined, now)).toBe('2026-11-19');
    expect(todayInTimezone('Not/AZone', now)).toBe('2026-11-19');
  });
});

describe('msUntilNextMidnight', () => {
  it('lands on midnight in the profile zone', () => {
    const now = new Date('2026-11-20T07:59:59Z'); // 23:59:59 in LA
    expect(msUntilNextMidnight(LA, now)).toBe(1000);
  });

  it('is a full day at exactly midnight and always positive and under 25 hours', () => {
    expect(msUntilNextMidnight(LA, new Date('2026-11-20T08:00:00Z'))).toBe(24 * H);
    for (let h = 0; h < 48; h += 1) {
      const ms = msUntilNextMidnight(AKL, new Date(Date.UTC(2026, 10, 19, 0, 0, 0) + h * H + 123));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(25 * H);
    }
  });

  it('adds up to the next date change', () => {
    const now = new Date('2026-11-19T10:00:00Z'); // 23:00 in Auckland
    expect(msUntilNextMidnight(AKL, now)).toBe(H);
    expect(todayInTimezone(AKL, new Date(now.getTime() + H))).toBe('2026-11-20');
  });
});
