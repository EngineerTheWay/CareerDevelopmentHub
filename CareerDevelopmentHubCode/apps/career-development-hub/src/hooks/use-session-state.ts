import { useEffect, useState } from 'react';

const readSessionValue = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.sessionStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch (_error: unknown) {
    return fallback;
  }
};

const readSessionDate = (key: string, fallback: Date): Date => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.sessionStorage.getItem(key);
  if (!stored) return fallback;
  const parsed = new Date(stored);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

export const useSessionState = <T,>(key: string, fallback: T) => {
  const [value, setValue] = useState<T>(() => readSessionValue(key, fallback));

  useEffect(() => {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
};

export const useSessionDateState = (key: string, fallback: Date) => {
  const [value, setValue] = useState<Date>(() => readSessionDate(key, fallback));

  useEffect(() => {
    window.sessionStorage.setItem(key, value.toISOString());
  }, [key, value]);

  return [value, setValue] as const;
};
