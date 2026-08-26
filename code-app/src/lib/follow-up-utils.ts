import { format } from 'date-fns';

export type FollowUpOverdueInput = {
  dueDate?: string;
  statusKey?: string;
};

export const todayDateKey = () => format(new Date(), 'yyyy-MM-dd');

export const toDateKey = (value?: string | Date) => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return format(value, 'yyyy-MM-dd');
};
export const normalizeSharePointDateOnly = (value?: string | Date) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || new Date().getTimezoneOffset() <= 0) return dateKey;
  const localDate = dateKeyToLocalDate(dateKey);
  if (!localDate) return dateKey;
  localDate.setDate(localDate.getDate() + 1);
  return toDateKey(localDate);
};

export const dateKeyToLocalDate = (value?: string) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return undefined;
  const [year, month, day] = dateKey.split('-').map((part: string) => Number(part));
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

export const isFollowUpOverdue = (followUp: FollowUpOverdueInput) => {
  if (followUp.statusKey !== 'Open' || !followUp.dueDate) return false;
  return toDateKey(followUp.dueDate) <= todayDateKey();
};
