const BACKEND_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const DEFAULT_TIMEZONE = 'Europe/Paris';

export const parseBackendDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = BACKEND_DATETIME_RE.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateTimeFr = (
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!value) {
    return '-';
  }

  const parsed = parseBackendDate(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
    ...options,
  });
};

export const formatDateFr = (
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!value) {
    return '-';
  }

  const parsed = parseBackendDate(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
    ...options,
  });
};
