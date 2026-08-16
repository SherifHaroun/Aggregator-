import { useCallback, useMemo, useState } from 'react';
import {
  createEmptyComparisonCriteria,
  isCompleteComparisonCriteria,
  resolveComparisonCriteria,
  validateComparisonCriteria,
  type ComparisonCriteriaInput,
  type ResolvedComparisonCriteria,
} from '@aggregator/shared';

/**
 * Selection state for the comparison screen.
 *
 * All validation and rule resolution is delegated to `@aggregator/shared`, so
 * the client and the API can never disagree. No business rule is implemented
 * in this hook.
 */
export function useComparisonCriteria() {
  const [criteria, setCriteria] = useState<ComparisonCriteriaInput>(
    createEmptyComparisonCriteria,
  );
  const [showErrors, setShowErrors] = useState(false);

  const setField = useCallback(
    <TField extends keyof ComparisonCriteriaInput>(
      field: TField,
      value: ComparisonCriteriaInput[TField],
    ) => {
      setCriteria((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const reset = useCallback(() => {
    setCriteria(createEmptyComparisonCriteria());
    setShowErrors(false);
  }, []);

  const validation = useMemo(() => validateComparisonCriteria(criteria), [criteria]);

  const errorsByField = useMemo(() => {
    if (!showErrors) return {} as Partial<Record<keyof ComparisonCriteriaInput, string>>;
    const map: Partial<Record<keyof ComparisonCriteriaInput, string>> = {};
    for (const issue of validation.issues) {
      map[issue.field] ??= issue.message;
    }
    return map;
  }, [showErrors, validation]);

  const resolved: ResolvedComparisonCriteria | null = useMemo(
    () => (isCompleteComparisonCriteria(criteria) ? resolveComparisonCriteria(criteria) : null),
    [criteria],
  );

  return {
    criteria,
    setField,
    reset,
    isComplete: validation.valid,
    errorsByField,
    revealErrors: () => setShowErrors(true),
    resolved,
  };
}
