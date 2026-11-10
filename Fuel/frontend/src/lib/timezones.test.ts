import { filterTimezones, orderTimezones, TIMEZONES } from './timezones';

describe('orderTimezones', () => {
  it('puts the device zone, then the current zone, then A to Z', () => {
    const out = orderTimezones('Asia/Tokyo', 'Europe/London');
    expect(out.slice(0, 2)).toEqual(['Asia/Tokyo', 'Europe/London']);
    const rest = out.slice(2);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    expect(out).toHaveLength(TIMEZONES.length);
  });

  it('does not repeat a zone that is both device and current', () => {
    const out = orderTimezones('Europe/London', 'Europe/London');
    expect(out.filter((z) => z === 'Europe/London')).toHaveLength(1);
  });

  it('keeps a current zone that is not in the bundled list', () => {
    expect(orderTimezones(undefined, 'Pacific/Chatham')[0]).toBe('Pacific/Chatham');
  });

  it('works with no device zone or current zone', () => {
    expect(orderTimezones()).toHaveLength(TIMEZONES.length);
  });
});

describe('filterTimezones', () => {
  it('matches case-insensitively across underscores', () => {
    expect(filterTimezones(TIMEZONES, 'new york')).toEqual(['America/New_York']);
  });

  it('returns everything for a blank query and nothing for no match', () => {
    expect(filterTimezones(TIMEZONES, '  ')).toHaveLength(TIMEZONES.length);
    expect(filterTimezones(TIMEZONES, 'zzzz')).toEqual([]);
  });
});
