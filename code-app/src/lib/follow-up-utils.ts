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
