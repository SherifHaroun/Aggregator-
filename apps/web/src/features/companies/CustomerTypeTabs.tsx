import { CUSTOMER_TYPES, listEnabledOptions, type CustomerTypeId } from '@aggregator/shared';

/**
 * THE THREE BOOKS A COMPANY SELLS.
 *
 * Individual, Family and SME are not a filter over one list of products — they
 * are separate products that merely share a name. A company's Gold+ for a
 * family is a different record from its Gold+ for one person, priced
 * differently and benefiting differently, and somebody managing one should
 * never be shown the others.
 *
 * So this is navigation, not a refinement: exactly one is always chosen, and
 * what sits below belongs to it alone.
 *
 * The list comes from `@aggregator/shared`, never from a copy written here.
 */
export function CustomerTypeTabs({
  value,
  onChange,
  counts,
}: {
  value: CustomerTypeId;
  onChange: (next: CustomerTypeId) => void;
  /** How many plans sit under each, so an empty section is visible before it is opened. */
  counts?: Partial<Record<CustomerTypeId, number>>;
}) {
  return (
    <div>
      <p className="text-content-muted mb-2 text-xs font-semibold tracking-wide uppercase">Customer type</p>
      <div
        role="tablist"
        aria-label="Customer type"
        className="bg-surface-muted inline-flex gap-1 rounded-(--radius-control) p-1"
      >
        {listEnabledOptions(CUSTOMER_TYPES).map((option) => {
          const selected = option.id === value;
          const count = counts?.[option.id];
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option.id)}
              className={[
                'rounded-(--radius-control) px-4 py-2 text-sm font-medium transition',
                selected
                  ? 'bg-surface text-content shadow-sm'
                  : 'text-content-muted hover:text-content cursor-pointer',
              ].join(' ')}
            >
              {option.label}
              {count !== undefined ? (
                <span className={selected ? 'text-content-muted ml-2' : 'ml-2 opacity-70'}>{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
