// utils/format.js

/**
 * Currency helper. Uses Indian digit grouping, matching the rest of the app.
 */
export const formatCurrency = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return 'BDT0';
  return `BDT${amount.toLocaleString('en-IN')}`;
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a 'YYYY-MM-DD' value (or an ISO timestamp) for display.
 * Date-only strings are parsed as local dates so they never shift a day.
 */
export const formatDate = (value) => {
  if (!value) return '';

  const match = DATE_ONLY.exec(value);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Turns a 24-hour 'HH:MM' slot into a friendly '2:00 PM' label.
 */
export const formatTimeSlot = (time) => {
  if (!time) return '';

  const [hourPart, minutePart] = String(time).split(':');
  const hour = Number(hourPart);
  if (Number.isNaN(hour)) return String(time);

  const minutes = minutePart || '00';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${displayHour}:${minutes} ${suffix}`;
};

/**
 * Human readable scheduled slot, e.g. "20 Jan 2024 at 10:00 AM".
 * Falls back gracefully when a schedule is incomplete or missing.
 */
export const formatSchedule = (schedule) => {
  if (!schedule || (!schedule.date && !schedule.time)) {
    return 'Schedule to be confirmed';
  }

  const date = formatDate(schedule.date);
  const time = formatTimeSlot(schedule.time);

  if (date && time) return `${date} at ${time}`;
  return date || time;
};
