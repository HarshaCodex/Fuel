/** Bundled because Intl.supportedValuesOf is not reliable on Hermes. The server accepts any IANA id. */
export const TIMEZONES: readonly string[] = [
  'UTC',
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Cairo', 'Africa/Casablanca',
  'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Tunis',
  'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Caracas', 'America/Chicago',
  'America/Denver', 'America/Edmonton', 'America/Halifax', 'America/Havana', 'America/Lima', 'America/Los_Angeles',
  'America/Mexico_City', 'America/Montevideo', 'America/New_York', 'America/Panama', 'America/Phoenix',
  'America/Puerto_Rico', 'America/Santiago', 'America/Sao_Paulo', 'America/St_Johns', 'America/Toronto',
  'America/Vancouver', 'America/Winnipeg',
  'Asia/Almaty', 'Asia/Baghdad', 'Asia/Bangkok', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Kolkata',
  'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Riyadh', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei',
  'Asia/Tashkent', 'Asia/Tehran', 'Asia/Tokyo', 'Asia/Yangon',
  'Atlantic/Azores', 'Atlantic/Reykjavik',
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin', 'Australia/Hobart', 'Australia/Melbourne',
  'Australia/Perth', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Bucharest',
  'Europe/Budapest', 'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Kyiv',
  'Europe/Lisbon', 'Europe/London', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris', 'Europe/Prague',
  'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Port_Moresby',
];

/** Device zone first, then the current one, then the rest A to Z. Unknown zones are kept so they stay selectable. */
export function orderTimezones(deviceTz?: string, current?: string): string[] {
  const head = [deviceTz, current].filter((z, i, all): z is string => !!z && all.indexOf(z) === i);
  const rest = TIMEZONES.filter((z) => !head.includes(z)).sort((a, b) => a.localeCompare(b));
  return [...head, ...rest];
}

/** Case-insensitive match; underscores and slashes count as spaces so "new york" finds America/New_York. */
export function filterTimezones(list: readonly string[], query: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[_/]/g, ' ');
  const q = norm(query.trim());
  return q ? list.filter((z) => norm(z).includes(q)) : [...list];
}

export const deviceTimezone = (): string | undefined => Intl.DateTimeFormat().resolvedOptions().timeZone;
