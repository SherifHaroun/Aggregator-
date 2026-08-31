import {
  DEFAULT_AGE_BANDS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  type PlanConfigurationDto,
} from '@aggregator/shared';
import { useState } from 'react';
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  IconAdd,
  IconTrash,
  Input,
  NumberInput,
  useToast,
} from '@/components/ui';
import { useSavePlanConfiguration } from '@/features/insurance-data/insurance-data.api';

interface BandDraft {
  /** Local only — a row has no server identity until it is saved. */
  key: string;
  from: string;
  to: string;
  premium: string;
}

let nextKey = 0;
const newKey = () => `band-${(nextKey += 1)}`;

function toDraft(band: { ageFrom: number; ageTo: number; annualPrice: number | null }): BandDraft {
  return {
    key: newKey(),
    from: String(band.ageFrom),
    to: String(band.ageTo),
    premium: band.annualPrice === null ? '' : String(band.annualPrice),
  };
}

/**
 * WHAT THIS VARIANT COSTS, AGE BAND BY AGE BAND.
 *
 * Health insurance is priced by age and nothing else moves between these rows —
 * the cover above them is identical for all of them. That is the whole reason
 * bands are rows here rather than variants of their own: thirty benefits are
 * entered once, not once per band.
 *
 * A band left without a premium is NOT COVERED. The legacy tables said so by
 * leaving the cell empty in one place and writing the words in another, and an
 * empty box says it once. It is never a price of zero.
 *
 * The table is saved WHOLE, so removing the 65+ row is how a plan stops being
 * sold at 65 — there is no separate act of deleting a band.
 */
export function AgePricingCard({ variant }: { variant: PlanConfigurationDto }) {
  const { notify } = useToast();
  const save = useSavePlanConfiguration(variant.id);

  const [bands, setBands] = useState<BandDraft[]>(() => variant.priceBands.map(toDraft));
  const [error, setError] = useState<string | null>(null);

  function update(key: string, patch: Partial<BandDraft>) {
    setError(null);
    setBands((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addBand() {
    setError(null);
    setBands((rows) => {
      /**
       * A new row starts where the last one ended, because a rate table is read
       * downwards and the next band almost always begins at the next year.
       */
      const last = rows[rows.length - 1];
      const suggestion = last
        ? { from: Number(last.to) + 1, to: Number(last.to) + 5 }
        : (DEFAULT_AGE_BANDS[0] ?? { from: MIN_INSURABLE_AGE, to: MIN_INSURABLE_AGE });
      const from = Math.min(suggestion.from, MAX_INSURABLE_AGE);
      return [
        ...rows,
        {
          key: newKey(),
          from: String(from),
          to: String(Math.min(Math.max(suggestion.to, from), MAX_INSURABLE_AGE)),
          premium: '',
        },
      ];
    });
  }

  /** The first thing wrong with the table, in the order an employee reads it. */
  function firstProblem(): string | null {
    for (const row of bands) {
      const from = Number(row.from);
      const to = Number(row.to);
      if (row.from.trim() === '' || row.to.trim() === '') return 'Every band needs both ages.';
      if (!Number.isInteger(from) || !Number.isInteger(to)) {
        return 'Enter whole numbers of years.';
      }
      if (from < MIN_INSURABLE_AGE || to > MAX_INSURABLE_AGE) {
        return `Ages run from ${MIN_INSURABLE_AGE} to ${MAX_INSURABLE_AGE}.`;
      }
      if (from > to) return `Ages ${from}–${to} run backwards.`;
    }

    const seen = new Set<string>();
    for (const row of bands) {
      const key = `${row.from}-${row.to}`;
      if (seen.has(key)) return `Ages ${row.from}–${row.to} are listed twice.`;
      seen.add(key);
    }
    return null;
  }

  function submit() {
    const problem = firstProblem();
    setError(problem);
    if (problem) return;

    save.mutate(
      {
        priceBands: bands.map((row) => ({
          ageFrom: Number(row.from),
          ageTo: Number(row.to),
          // Blank means "not sold at this age", which is a null and never a 0.
          annualPrice: row.premium.trim() === '' ? null : Number(row.premium),
        })),
      },
      {
        onSuccess: () => notify('The rate table was saved.'),
        onError: (saveError) =>
          setError(saveError instanceof Error ? saveError.message : 'Could not save the prices.'),
      },
    );
  }

  return (
    <Card>
      <CardHeader
        title="Age pricing"
        description="One premium per age band. The cover above is the same for all of them."
        action={
          <Button size="sm" variant="secondary" onClick={addBand}>
            <IconAdd className="size-4" />
            Add age band
          </Button>
        }
      />
      <CardBody className="space-y-4">
        {error ? (
          <Callout tone="danger" title="Check the rate table">
            {error}
          </Callout>
        ) : null}

        {bands.length === 0 ? (
          <p className="text-content-muted text-sm">
            No prices yet. Add the first age band this variant is sold at.
          </p>
        ) : (
          <ul className="space-y-2">
            {bands.map((row) => (
              <li key={row.key} className="flex items-end gap-2">
                <label className="w-20">
                  <span className="text-content-subtle text-xs font-medium">From</span>
                  <Input
                    type="number"
                    min={MIN_INSURABLE_AGE}
                    max={MAX_INSURABLE_AGE}
                    step={1}
                    value={row.from}
                    aria-label="Age from"
                    onChange={(event) => update(row.key, { from: event.target.value })}
                  />
                </label>
                <label className="w-20">
                  <span className="text-content-subtle text-xs font-medium">To</span>
                  <Input
                    type="number"
                    min={MIN_INSURABLE_AGE}
                    max={MAX_INSURABLE_AGE}
                    step={1}
                    value={row.to}
                    aria-label="Age to"
                    onChange={(event) => update(row.key, { to: event.target.value })}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <span className="text-content-subtle text-xs font-medium">Annual premium</span>
                  <NumberInput
                    suffix={variant.currency || ''}
                    value={row.premium}
                    aria-label={`Annual premium for ages ${row.from} to ${row.to}`}
                    onChange={(next) => update(row.key, { premium: next })}
                  />
                </div>
                {/* Blank is a statement, so it is labelled rather than left to
                    look like an unfinished row. */}
                <p className="text-content-subtle w-24 pb-2.5 text-xs">
                  {row.premium.trim() === '' ? 'Not covered' : ''}
                </p>
                <button
                  type="button"
                  aria-label={`Remove ages ${row.from} to ${row.to}`}
                  onClick={() => setBands((rows) => rows.filter((item) => item.key !== row.key))}
                  className="text-content-muted hover:bg-surface-muted hover:text-danger mb-1 rounded-(--radius-control) p-2"
                >
                  <IconTrash className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={() => {
              setError(null);
              setBands(variant.priceBands.map(toDraft));
            }}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save prices'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
