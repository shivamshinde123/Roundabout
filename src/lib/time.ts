const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536e6], ['month', 2_592e6], ['day', 864e5], ['hour', 36e5], ['minute', 6e4],
];

/** "4 minutes ago", "yesterday", "just now". */
export function ago(date: Date, now = Date.now()): string {
  const diff = date.getTime() - now;
  for (const [unit, ms] of steps) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}
