import {
  SME_AGE_BRACKETS,
  describeEmployeeCountProblem,
  totalSmeEmployees,
  type SmeEmployeeCounts,
} from '@aggregator/shared';
import { useId, useState } from 'react';
import { Button, IconChevronRight, NumberInput } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * HOW MANY EMPLOYEES ARE IN EACH AGE GROUP.
 *
 * A business does not have an age. Asking for one per employee is asking for
 * the one thing a broker does not have in front of them; asking for a headcount
 * per age group is reading straight off the staff list, and it is how every
 * insurer's SME rate table is laid out anyway.
 *
 * FOLDED AWAY BY DEFAULT. Twelve boxes is the truth of the question but it is
 * also most of a screen, and this sits among five other questions. The summary
 * line carries what matters — how many employees the comparison is about — and
 * opens to the detail when somebody wants to change it.
 *
 * The brackets, their labels and what counts as a valid headcount all come from
 * `@aggregator/shared`. Nothing about an age group is decided here, so the
 * boxes on this screen and the arithmetic that prices them can never disagree.
 */
export function SmeEmployeeAges({
  counts,
  onChange,
  error,
}: {
  counts: SmeEmployeeCounts;
  onChange: (next: SmeEmployeeCounts) => void;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const total = totalSmeEmployees(counts);

  const setCount = (bracketId: string, value: string) => {
    const trimmed = value.trim();
    onChange({ ...counts, [bracketId]: trimmed === '' ? 0 : Number(trimmed) });
  };

  return (
    <fieldset>
      <legend className="text-content mb-2 text-sm font-medium">
        Employee ages
        <span className="text-danger ml-0.5">*</span>
      </legend>

      <div
        className={cn(
          'border-border-subtle rounded-(--radius-control) border',
          error && 'border-danger',
        )}
      >
        {/* The summary: the one number somebody scanning the form needs. */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* One text node, so the headcount reads as one phrase to anything
              reading the page rather than as a number beside a word. */}
          <p className="text-content text-sm font-semibold">
            {`${total} ${total === 1 ? 'employee' : 'employees'}`}
            {total === 0 ? (
              <span className="text-content-subtle font-normal"> — nobody entered yet</span>
            ) : null}
          </p>
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? 'Done' : 'Edit ages'}
            <IconChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
          </Button>
        </div>

        {open ? (
          <div id={panelId} className="border-border-subtle border-t px-4 py-3">
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {SME_AGE_BRACKETS.map((bracket) => {
                const value = counts[bracket.id] ?? 0;
                const problem = describeEmployeeCountProblem(value);
                return (
                  <div key={bracket.id} className="flex items-center justify-between gap-3">
                    <span className="text-content-muted text-sm tabular-nums">{bracket.label}</span>
                    <div className="w-24">
                      <NumberInput
                        value={String(value)}
                        aria-label={`Employees aged ${bracket.label}`}
                        aria-invalid={problem ? true : undefined}
                        onChange={(next) => setCount(bracket.id, next)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="border-border-subtle text-content mt-3 border-t pt-3 text-sm font-medium">
              {`Total: ${total} ${total === 1 ? 'employee' : 'employees'}`}
            </p>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-danger mt-1.5 text-xs">{error}</p> : null}
    </fieldset>
  );
}
