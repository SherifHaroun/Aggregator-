import { useCallback, useState } from 'react';
import { describeError } from '@/components/ui';
import { ApiError } from '@/lib/api-client';

/**
 * Shared form state for every management form.
 *
 * The API is the authority on validation, so instead of duplicating its rules
 * in the browser this maps a `VALIDATION_ERROR` response's `details` onto the
 * individual fields, and anything else onto a form-level message. The employee
 * never sees a raw technical error.
 */
export function useRecordForm<TValues extends object>(initialValues: TValues) {
  const [values, setValues] = useState<TValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof TValues & string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const setValue = useCallback(<TKey extends keyof TValues & string>(key: TKey, value: TValues[TKey]) => {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear the field's error as soon as the employee edits it.
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  /** Replace all values, e.g. once an existing record has loaded. */
  const reset = useCallback((next: TValues) => {
    setValues(next);
    setFieldErrors({});
    setFormError(null);
  }, []);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
  }, []);

  /** Turn a failed request into field-level and form-level messages. */
  const applyError = useCallback((error: unknown, subject: string) => {
    if (error instanceof ApiError && error.details) {
      const mapped: Record<string, string> = {};
      for (const [path, messages] of Object.entries(error.details)) {
        // Nested paths such as "fields.0.dataType" attach to their root field.
        const key = path.split('.')[0] ?? path;
        if (messages[0] && !mapped[key]) mapped[key] = messages[0];
      }
      setFieldErrors(mapped as Partial<Record<keyof TValues & string, string>>);
      setFormError(
        Object.keys(mapped).length > 0
          ? 'Please correct the highlighted fields.'
          : describeError(error, subject),
      );
      return;
    }
    setFieldErrors({});
    setFormError(describeError(error, subject));
  }, []);

  return { values, setValue, reset, fieldErrors, formError, applyError, clearErrors };
}
