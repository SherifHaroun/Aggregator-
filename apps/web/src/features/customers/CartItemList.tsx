import { formatMoney, type CustomerCartItemDto } from '@aggregator/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDialog,
  IconCheck,
  IconChevronRight,
  IconEdit,
  IconTrash,
  Textarea,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { comparisonRequestParams } from '@/features/comparison/comparison-request';
import { cn } from '@/lib/cn';
import { useRemoveCartItem, useUpdateCartItem } from './customers.api';

/** "12 Sept 2026, 14:03" — when the comparison was kept. */
export function formatCartDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The results, exactly as they were when this entry was kept. */
export function cartItemResultsUrl(item: CustomerCartItemDto): string {
  return `${ROUTES.comparison.results}?${comparisonRequestParams(item.criteria).toString()}`;
}

/**
 * A CUSTOMER'S CART: the comparisons kept for them, first to last.
 *
 * Each entry is numbered down the left and named as the system named it —
 * "Arope SME 1" — with the date it was kept, the plan and premium it was
 * kept with, and whatever the employee wrote underneath. The green button
 * marks the one the customer settled on; there is only ever one, so
 * choosing another moves the tick.
 *
 * `compact` is the cart button's dropdown: the same list, less room.
 */
export function CartItemList({
  customerId,
  customerName,
  items,
  compact = false,
}: {
  customerId: string;
  customerName: string;
  items: CustomerCartItemDto[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-6 text-center text-sm">
        Nothing kept yet. Run a comparison and press “Add to customer cart”.
      </p>
    );
  }

  return (
    <ol aria-label={`${customerName}’s cart`} className={cn(compact ? 'space-y-2' : 'space-y-3')}>
      {items.map((item, index) => (
        <CartItemRow
          key={item.id}
          customerId={customerId}
          item={item}
          position={index + 1}
          compact={compact}
        />
      ))}
    </ol>
  );
}

function CartItemRow({
  customerId,
  item,
  position,
  compact,
}: {
  customerId: string;
  item: CustomerCartItemDto;
  position: number;
  compact: boolean;
}) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const { notify } = useToast();

  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(item.note ?? '');
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function saveNote() {
    update.mutate(
      { customerId, itemId: item.id, note: note.trim() || null },
      {
        onSuccess: () => setEditingNote(false),
        onError: (error) => notify(describeError(error, 'the note'), 'error'),
      },
    );
  }

  function setChosen(chosen: boolean) {
    update.mutate(
      { customerId, itemId: item.id, chosen },
      {
        onSuccess: () =>
          notify(chosen ? `${item.name} is now linked to the customer.` : `${item.name} unlinked.`),
        onError: (error) => notify(describeError(error, 'the cart'), 'error'),
      },
    );
  }

  function removeItem() {
    remove.mutate(
      { customerId, itemId: item.id },
      {
        onSuccess: () => notify(`${item.name} was removed from the cart.`),
        onError: (error) => notify(describeError(error, 'the cart'), 'error'),
        onSettled: () => setConfirmingRemove(false),
      },
    );
  }

  return (
    <li
      className={cn(
        'border-border-subtle bg-surface flex gap-3 rounded-(--radius-card) border',
        compact ? 'p-3' : 'p-4',
        item.isChosen && 'border-success bg-success-soft/40',
      )}
    >
      {/* The number down the left: the order the comparisons were run in. */}
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums',
          compact ? 'size-7 text-xs' : 'size-9 text-sm',
          item.isChosen ? 'bg-success text-content-inverted' : 'bg-brand-soft text-brand-strong',
        )}
      >
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-content font-semibold">
            <span className="sr-only">Comparison {position}: </span>
            {item.name}
          </p>
          {item.isChosen ? (
            <Badge tone="success">
              <IconCheck className="mr-1 size-3.5" />
              Linked to customer
            </Badge>
          ) : null}
          <span className="text-content-subtle text-xs">{formatCartDate(item.createdAt)}</span>
        </div>

        <p className="text-content-muted mt-0.5 text-sm">
          {item.planName} · {item.companyName} ·{' '}
          <span className="text-content font-medium tabular-nums">
            {formatMoney(item.annualPrice, item.currency)}
          </span>
          {item.annualPrice !== null ? ' / year' : ''}
          {item.planConfigurationId === null ? (
            <span className="text-warning"> · plan no longer on sale</span>
          ) : null}
        </p>

        {/* The note under the name — read here, edited in place. */}
        {editingNote ? (
          <div className="mt-2 space-y-2">
            <Textarea
              aria-label={`Note for ${item.name}`}
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Wants a private room; call back Thursday."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNote} disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save note'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNote(item.note ?? '');
                  setEditingNote(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : item.note ? (
          <p className="text-content-muted mt-1.5 text-sm whitespace-pre-line italic">
            {item.note}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.isChosen ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setChosen(false)}
              disabled={update.isPending}
            >
              Unlink
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-success hover:bg-success hover:opacity-90"
              onClick={() => setChosen(true)}
              disabled={update.isPending}
            >
              <IconCheck className="size-4" />
              Link to customer
            </Button>
          )}
          {!editingNote ? (
            <Button size="sm" variant="ghost" onClick={() => setEditingNote(true)}>
              <IconEdit className="size-4" />
              {item.note ? 'Edit note' : 'Add note'}
            </Button>
          ) : null}
          <Link
            to={cartItemResultsUrl(item)}
            className="text-brand-strong inline-flex h-9 items-center gap-1 px-2 text-sm font-semibold hover:underline"
          >
            Open comparison
            <IconChevronRight className="size-4" />
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:text-danger ml-auto"
            onClick={() => setConfirmingRemove(true)}
            disabled={remove.isPending}
            aria-label={`Remove ${item.name}`}
          >
            <IconTrash className="size-4" />
            Remove
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        onConfirm={removeItem}
        title={`Remove ${item.name}?`}
        description="It leaves this customer’s cart. The comparison can be run again at any time."
        confirmLabel="Remove"
        busy={remove.isPending}
      />
    </li>
  );
}
