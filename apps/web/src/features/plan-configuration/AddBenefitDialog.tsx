import { type InsuranceOptionDto } from '@aggregator/shared';
import { useMemo, useState } from 'react';
import { Button, Dialog, EmptyState, IconLayers, Input } from '@/components/ui';

/**
 * PICK FROM THE CATALOGUE THAT EXISTS.
 *
 * Adding an optional benefit attaches a record; it never creates one. The
 * catalogue is global and shared by every company, and a picker that could
 * invent an entry is how the same cover ends up filed twice under two spellings
 * with nothing able to compare them.
 *
 * Benefits already on this variant are not offered — the caller filters them
 * out — so the same benefit cannot be attached twice.
 */
export function AddBenefitDialog({
  available,
  onAdd,
  onClose,
}: {
  available: InsuranceOptionDto[];
  onAdd: (options: InsuranceOptionDto[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === '') return available;
    return available.filter((option) => option.name.toLowerCase().includes(needle));
  }, [available, search]);

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Add benefit"
      description="Chosen from the benefits that already exist. Nothing new is created here."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={picked.size === 0}
            onClick={() => {
              onAdd(available.filter((option) => picked.has(option.id)));
              onClose();
            }}
          >
            {picked.size <= 1 ? 'Add benefit' : `Add ${picked.size} benefits`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search benefits…"
          aria-label="Search benefits"
        />

        {available.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<IconLayers className="size-6" />}
            title="Nothing left to add"
            description="Every benefit in the catalogue is already on this variant, or is one of the core areas above."
          />
        ) : matches.length === 0 ? (
          <p className="text-content-muted py-6 text-center text-sm">
            No benefit matches “{search.trim()}”.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {matches.map((option) => (
              <li key={option.id}>
                <label className="hover:bg-surface-muted flex cursor-pointer items-center gap-3 rounded-(--radius-control) px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-brand size-4 shrink-0"
                    checked={picked.has(option.id)}
                    onChange={() => toggle(option.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-content block truncate text-sm font-medium">
                      {option.name}
                    </span>
                    {/* A group brings its members with it, which is worth
                        saying before it is added rather than after. */}
                    {option.isUmbrella ? (
                      <span className="text-content-subtle block truncate text-xs">
                        Group ·{' '}
                        {(option.children ?? []).map((child) => child.name).join(', ') ||
                          'no benefits in it yet'}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
