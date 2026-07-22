import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Custom hook for persisting React state in localStorage.
 * Standardizes single-value persisted state such as LogisticsManager's reservedBy
 * and ReverseTimeline filters.
 *
 * Note: BudgetExpenseTracker's multi-field autosave draft (with removeItem on submit)
 * is a deliberately different pattern and is not migrated onto this hook.
 *
 * @param key LocalStorage key name
 * @param defaultValue Default initial state if key is missing or unparseable
 */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
    } catch {
      // Fallback to default value if storage is unavailable or content is invalid JSON
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silently catch quota or permission errors to preserve in-memory state
    }
  }, [key, value]);

  return [value, setValue];
}
