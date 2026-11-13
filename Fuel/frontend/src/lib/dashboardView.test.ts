import {
  addDays,
  dateTitle,
  formatGrams,
  formatKcal,
  formatTime,
  isFutureDate,
  isoDate,
  longDateLabel,
  groupByMeal,
  macroLine,
  macroModel,
  ringModel,
  sourceLabel,
} from './dashboardView';

describe('ringModel', () => {
  it('shows remaining for a normal day', () => {
    const m = ringModel({ consumed: 1450, goal: 2200 });
    expect(m).toMatchObject({ over: false, centre: '750', caption: 'kcal left', eaten: '1,450 of 2,200 eaten' });
    expect(m.fraction).toBeCloseTo(1450 / 2200);
    expect(m.label).toBe('750 calories remaining. 1,450 of 2,200 eaten.');
  });
  it('has no arc on an empty day', () => {
    expect(ringModel({ consumed: 0, goal: 2200 })).toMatchObject({ fraction: 0, centre: '2,200', over: false });
  });
  it('is full but not over exactly at goal', () => {
    expect(ringModel({ consumed: 2200, goal: 2200 })).toMatchObject({ fraction: 1, over: false, centre: '0' });
  });
  it('shows the overage when over', () => {
    const m = ringModel({ consumed: 2520, goal: 2200 });
    expect(m).toMatchObject({ over: true, fraction: 1, centre: '320', caption: 'kcal over' });
    expect(m.label).toBe('320 calories over. 2,520 of 2,200 eaten.');
  });
  it('treats 1 kcal over as over', () => {
    expect(ringModel({ consumed: 2201, goal: 2200 })).toMatchObject({ over: true, centre: '1' });
  });
  it('handles goal 0 without NaN', () => {
    expect(ringModel({ consumed: 0, goal: 0 })).toMatchObject({ fraction: 0, over: false });
    expect(ringModel({ consumed: 50, goal: 0 })).toMatchObject({ fraction: 1, over: true });
  });
  it('rounds for display and uses the raw value for the arc', () => {
    const m = ringModel({ consumed: 1450.5, goal: 2200 });
    expect(m.eaten).toBe('1,451 of 2,200 eaten');
    expect(m.fraction).toBeCloseTo(1450.5 / 2200, 6);
  });
  it('formats large values with a comma', () => {
    expect(ringModel({ consumed: 12345, goal: 20000 }).centre).toBe('7,655');
  });
});

describe('macroModel', () => {
  it('builds a normal pill', () => {
    expect(macroModel('Protein', { consumed: 120, goal: 165 })).toMatchObject({
      value: '120',
      goal: '165',
      over: false,
      label: 'Protein, 120 of 165 grams',
    });
  });
  it('caps the bar and flags over', () => {
    expect(macroModel('Fat', { consumed: 80, goal: 60 })).toMatchObject({ fraction: 1, over: true });
  });
  it('handles goal 0', () => {
    expect(macroModel('Carbs', { consumed: 10, goal: 0 })).toMatchObject({ fraction: 0, over: false });
  });
  it('shows 0.04 g as 0', () => {
    expect(macroModel('Fat', { consumed: 0.04, goal: 60 }).value).toBe('0');
  });
});

describe('formatting', () => {
  it('formatKcal rounds and groups', () => {
    expect(formatKcal(1450.5)).toBe('1,451');
    expect(formatKcal(12345)).toBe('12,345');
  });
  it('formatGrams keeps one decimal and drops .0', () => {
    expect(formatGrams(12.34)).toBe('12.3');
    expect(formatGrams(12)).toBe('12');
    expect(formatGrams(12.04)).toBe('12');
    expect(formatGrams(-0.01)).toBe('0');
  });
});

describe('dates', () => {
  it('isoDate uses local Y-M-D', () => {
    expect(isoDate(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03');
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('addDays crosses month, year and leap boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('addDays never skips or repeats a date across DST', () => {
    let d = '2026-03-05';
    const seen = [d];
    for (let i = 0; i < 12; i++) seen.push((d = addDays(d, 1)));
    expect(new Set(seen).size).toBe(13);
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
  it('isFutureDate is false when equal', () => {
    expect(isFutureDate('2026-11-03', '2026-11-03')).toBe(false);
    expect(isFutureDate('2026-11-04', '2026-11-03')).toBe(true);
    expect(isFutureDate('2026-11-02', '2026-11-03')).toBe(false);
  });
  it('dateTitle names today, yesterday and other days', () => {
    expect(dateTitle('2026-11-03', '2026-11-03')).toBe('Today');
    expect(dateTitle('2026-11-02', '2026-11-03')).toBe('Yesterday');
    expect(dateTitle('2026-11-03', '2026-11-05')).toBe('Tue, Nov 3');
  });
});

describe('formatTime', () => {
  it('formats local time on a 12-hour clock with a plain space', () => {
    expect(formatTime(new Date(2026, 10, 3, 12, 30).toISOString())).toBe('12:30 PM');
    expect(formatTime(new Date(2026, 10, 3, 0, 5).toISOString())).toBe('12:05 AM');
    expect(formatTime(new Date(2026, 10, 3, 9, 7).toISOString())).toBe('9:07 AM');
    expect(formatTime(new Date(2026, 10, 3, 23, 59).toISOString())).toBe('11:59 PM');
  });
});

describe('macroLine and sourceLabel', () => {
  it('formats grams and names sources', () => {
    expect(macroLine(46, 0, 5.04)).toBe('P 46 · C 0 · F 5');
    expect(sourceLabel('USDA')).toBe('USDA Verified');
    expect(sourceLabel('OFF')).toBe('Manufacturer Label');
    expect(sourceLabel('USER')).toBe('You Entered');
  });
});

describe('groupByMeal', () => {
  const e = (id: string, mealLabel: string | null) => ({ id, mealLabel });
  it('orders groups, drops empty ones and keeps entry order', () => {
    const groups = groupByMeal([e('1', 'snack'), e('2', 'breakfast'), e('3', 'snack')]);
    expect(groups.map((g) => g.key)).toEqual(['breakfast', 'snack']);
    expect(groups.map((g) => g.title)).toEqual(['Breakfast', 'Snack']);
    expect(groups[1].entries.map((x) => x.id)).toEqual(['1', '3']);
  });
  it('matches case-insensitively after trim and sends unknown, empty and null to Other', () => {
    const groups = groupByMeal([e('1', ' LUNCH '), e('2', null), e('3', ''), e('4', 'brunch'), e('5', 'other')]);
    expect(groups.map((g) => g.title)).toEqual(['Lunch', 'Other']);
    expect(groups[1].entries.map((x) => x.id)).toEqual(['2', '3', '4', '5']);
  });
  it('returns nothing for no entries', () => {
    expect(groupByMeal([])).toEqual([]);
  });
});

describe('longDateLabel', () => {
  it('formats weekday, day and month in capitals with a comma', () => {
    expect(longDateLabel('2026-11-11')).toBe('WEDNESDAY, 11 NOVEMBER');
  });
  it('handles a month end and a past day', () => {
    expect(longDateLabel('2026-02-28')).toBe('SATURDAY, 28 FEBRUARY');
    expect(longDateLabel('2025-12-31')).toBe('WEDNESDAY, 31 DECEMBER');
  });
});
