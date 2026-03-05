import { createContext, useContext, useState, useCallback } from 'react';

const TimezoneContext = createContext({
  timezone:      'UTC',
  setTimezone:   () => {},
  formatDate:    () => '—',
  formatDateTime:() => '—',
  formatTime:    () => '—',
  todayString:   () => '',
});

/** Returns the common list of IANA timezones with readable labels. */
export const TIMEZONE_OPTIONS = (() => {
  // Preferred / most-common timezones shown first
  const preferred = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Amsterdam',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Istanbul',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland',
    'UTC',
  ];
  // Build label from IANA id + current UTC offset
  return preferred.map(tz => {
    try {
      const now    = new Date();
      const parts  = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, timeZoneName: 'short',
      }).formatToParts(now);
      const tzName = parts.find(p => p.type === 'timeZoneName')?.value || tz;
      // Human-readable city name
      const city   = tz.split('/').pop().replace(/_/g, ' ');
      return { value: tz, label: `${city} (${tzName})` };
    } catch {
      return { value: tz, label: tz };
    }
  });
})();

export function TimezoneProvider({ children }) {
  const [timezone, _setTimezone] = useState(
    () => localStorage.getItem('tether_timezone')
         || Intl.DateTimeFormat().resolvedOptions().timeZone
         || 'UTC'
  );

  const setTimezone = useCallback((tz) => {
    localStorage.setItem('tether_timezone', tz);
    _setTimezone(tz);
  }, []);

  /** Format a timestamp to a date string in the user's timezone. */
  const formatDate = useCallback((ts, opts = {}) => {
    if (!ts) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'short', day: 'numeric', year: 'numeric',
        ...opts,
      }).format(new Date(ts));
    } catch { return '—'; }
  }, [timezone]);

  /** Format a timestamp to date + time in the user's timezone. */
  const formatDateTime = useCallback((ts) => {
    if (!ts) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(ts));
    } catch { return '—'; }
  }, [timezone]);

  /** Format a timestamp to time only in the user's timezone. */
  const formatTime = useCallback((ts) => {
    if (!ts) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).format(new Date(ts));
    } catch { return ''; }
  }, [timezone]);

  /**
   * Returns today's date as a YYYY-MM-DD string in the user's timezone.
   * Used for "Today" date filter presets so they match the user's local day.
   */
  const todayString = useCallback(() => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).formatToParts(new Date());
      return parts.map(p => p.value).join(''); // en-CA gives YYYY-MM-DD naturally
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }, [timezone]);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, formatDate, formatDateTime, formatTime, todayString }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export const useTimezone = () => useContext(TimezoneContext);
