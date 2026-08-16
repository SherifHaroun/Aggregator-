import { cn } from '@/lib/cn';

/**
 * Active / Inactive switch used on every record form.
 *
 * Deactivation is the safe alternative to deletion throughout this system, so
 * it is presented as a first-class choice rather than buried in a menu.
 */
export function StatusToggle({
  value,
  onChange,
  id,
  disabled = false,
}: {
  value: boolean;
  onChange: (isActive: boolean) => void;
  id?: string;
  disabled?: boolean;
}) {
  const options = [
    { label: 'Active', active: true },
    { label: 'Inactive', active: false },
  ];

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Status"
      className="border-border-subtle bg-surface-muted inline-flex rounded-(--radius-control) border p-1"
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={value === option.active}
          disabled={disabled}
          onClick={() => onChange(option.active)}
          className={cn(
            'rounded-[calc(var(--radius-control)-2px)] px-4 py-1.5 text-sm font-medium transition-colors',
            value === option.active
              ? option.active
                ? 'bg-surface text-success shadow-sm'
                : 'bg-surface text-content-muted shadow-sm'
              : 'text-content-subtle hover:text-content',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Read-only status pill for tables and cards. */
export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isActive ? 'bg-success/12 text-success' : 'bg-surface-muted text-content-muted',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', isActive ? 'bg-success' : 'bg-content-subtle')}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}
