import { CUSTOMER_TYPES, listAllOptions, type CustomerTypeId } from '@aggregator/shared';

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
 * EVERY book is here, on sale or not: a line the site says is "coming soon"
 * still has plans to manage, and they must stay reachable. A book not on
 * sale is marked so the employee knows customers cannot see it yet.
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
      <p className="text-content-muted mb-2 text-xs font-semibold tracking-wide uppercase">
        Customer type
      </p>
      <div
        role="tablist"
        aria-label="Customer type"
        className="bg-surface-muted inline-flex gap-1 rounded-(--radius-control) p-1"
      >
        {listAllOptions(CUSTOMER_TYPES).map((option) => {
          const selected = option.id === value;
          const count = counts?.[option.id];
          const offSale = !option.enabled;
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
                <span className={selected ? 'text-content-muted ml-2' : 'ml-2 opacity-70'}>
                  {count}
                </span>
              ) : null}
              {offSale ? (
                <span
                  title="Not on sale to customers yet"
                  className="bg-warning-soft text-content-muted ml-2 rounded-(--radius-pill) px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wider uppercase"
                >
                  Soon
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
