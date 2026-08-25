import { format } from 'date-fns';
import { dateKeyToLocalDate } from '@/lib/follow-up-utils';

export const displayDateFormat = 'MMM dd, yyyy';

export const formatDisplayDate = (value?: string | Date): string => {
  if (!value) return '—';
  const date = value instanceof Date ? value : dateKeyToLocalDate(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return format(date, displayDateFormat);
};
