import {
  BENEFIT_LIMITATION_MAX,
  LIMITATIONS_LABEL,
  NO_LIMITATIONS_LABEL,
  limitationScopeForDataType,
  type LimitationDto,
  type OptionFieldDataType,
} from '@aggregator/shared';
import { memo, useEffect, useRef, useState } from 'react';
import { Input, describeError, useToast } from '@/components/ui';
import {
  useCreateLimitation,
  useLimitations,
  useSavePlanOptionLimitations,
} from '@/features/insurance-data/insurance-data.api';
import { cn } from '@/lib/cn';

/**
 * The qualifications a benefit carries on ONE configuration.
 *
 * This is the box that replaced guesswork. A plan document says "800 EGP for
 * BASIC PROCEDURES" or "100% IN-NETWORK ONLY", and while that qualification sat
 * in a free-text note the comparison could not read it — two plans quoting 800
 * scored identically whether one paid for everything and the other only for
 * fillings. Ticking a record instead makes the difference rankable.
 *
 * NOTHING TICKED MEANS UNRESTRICTED, and the control says so rather than
 * looking unfilled: an employee must never wonder whether a blank box means
 * "covered in all cases" or "nobody got to this row".
 *
 * Saves itself, like every other control on this board.
 */
export const PlanOptionLimitations = memo(function PlanOptionLimitations({
  planOptionId,
  planConfigurationId,
  optionName,
  dataType,
  selected,
  disabled = false,
}: {
  planOptionId: string;
  planConfigurationId: string;
  optionName: string;
  /** The kind of value the benefit carries, which decides the list offered. */
  dataType: OptionFieldDataType | null;
  /** The saved limitations, in catalogue order. */
  selected: LimitationDto[];
  disabled?: boolean;
}) {
  const scope = limitationScopeForDataType(dataType);
  const catalogue = useLimitations(scope);
  const save = useSavePlanOptionLimitations();
  const { notify } = useToast();

  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selected.map((limitation) => limitation.id));

  // Clicking away puts the list back, exactly as a dropdown would.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function commit(limitationIds: string[]) {
    save.mutate(
      { planOptionId, planConfigurationId, limitationIds },
      {
        onError: (error) => notify(describeError(error, 'the limitations'), 'error'),
      },
    );
  }

  function toggle(limitation: LimitationDto) {
    const next = selectedIds.has(limitation.id)
      ? selected.filter((entry) => entry.id !== limitation.id).map((entry) => entry.id)
      : [...selected.map((entry) => entry.id), limitation.id];

    if (next.length > BENEFIT_LIMITATION_MAX) {
      notify(`A benefit may carry at most ${BENEFIT_LIMITATION_MAX} limitations.`, 'error');
      return;
    }
    commit(next);
  }

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={`${LIMITATIONS_LABEL} for ${optionName}`}
        className={cn(
          'flex w-fit max-w-full items-center gap-1.5 rounded-(--radius-control) px-1.5 py-0.5 text-left text-xs font-medium',
          selected.length > 0
            ? 'text-content-subtle hover:bg-surface-muted'
            : 'text-content-subtle hover:text-brand-strong hover:bg-brand-soft',
        )}
      >
        <span className="truncate">
          {selected.length === 0
            ? `+ ${LIMITATIONS_LABEL}`
            : selected.map((limitation) => limitation.name).join(' · ')}
        </span>
        {save.isPending ? <span className="shrink-0">Saving…</span> : null}
      </button>

      {open ? (
        <div className="border-border-subtle bg-surface shadow-(--shadow-raised) absolute z-20 mt-1 w-72 rounded-(--radius-card) border p-2">
          <p className="text-content-subtle px-1.5 pb-1.5 text-xs">
            {selected.length === 0 ? NO_LIMITATIONS_LABEL : `${LIMITATIONS_LABEL}:`}
          </p>

          <div className="max-h-64 overflow-y-auto">
            {catalogue.isPending ? (
              <p className="text-content-subtle px-1.5 py-2 text-xs">Loading…</p>
            ) : catalogue.data?.length ? (
              catalogue.data.map((limitation: LimitationDto) => (
                <label
                  key={limitation.id}
                  className="hover:bg-surface-muted flex cursor-pointer items-start gap-2 rounded-(--radius-control) px-1.5 py-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(limitation.id)}
                    onChange={() => toggle(limitation)}
                    disabled={disabled || save.isPending}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-content block">{limitation.name}</span>
                    {limitation.description ? (
                      <span className="text-content-subtle block">{limitation.description}</span>
                    ) : null}
                  </span>
                </label>
              ))
            ) : (
              <p className="text-content-subtle px-1.5 py-2 text-xs">
                No limitations have been added yet.
              </p>
            )}
          </div>

          <NewLimitation scope={scope} onCreated={(created) => toggle(created)} />
        </div>
      ) : null}
    </div>
  );
});

/**
 * Add a wording the catalogue does not have yet, without leaving the row.
 *
 * An employee meets an unlisted qualification exactly while entering the plan
 * that uses it. Sending them to another screen is how everything ended up in a
 * free-text note in the first place.
 *
 * The new entry is created UNWEIGHTED — it records the condition without
 * silently changing any ranking until somebody decides what it is worth. That
 * is the safe direction to be wrong in.
 */
function NewLimitation({
  scope,
  onCreated,
}: {
  scope: ReturnType<typeof limitationScopeForDataType>;
  onCreated: (limitation: LimitationDto) => void;
}) {
  const create = useCreateLimitation();
  const { notify } = useToast();
  const [name, setName] = useState('');

  function submit() {
    const trimmed = name.trim();
    if (trimmed === '') return;

    create.mutate(
      { name: trimmed, scope },
      {
        onSuccess: (created) => {
          setName('');
          onCreated(created);
        },
        onError: (error) => notify(describeError(error, 'the limitation'), 'error'),
      },
    );
  }

  return (
    <div className="border-border-subtle mt-1.5 flex items-center gap-1.5 border-t pt-1.5">
      <Input
        value={name}
        placeholder="Add a limitation…"
        aria-label="New limitation"
        disabled={create.isPending}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
        className="py-1 text-xs"
      />
      <button
        type="button"
        onClick={submit}
        disabled={create.isPending || name.trim() === ''}
        className="text-brand-strong hover:bg-brand-soft shrink-0 rounded-(--radius-control) px-2 py-1 text-xs font-semibold disabled:opacity-50"
      >
        {create.isPending ? 'Adding…' : 'Add'}
      </button>
    </div>
  );
}
