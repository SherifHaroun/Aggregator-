import { resolveAssetUrl } from '@/lib/api-url';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'size-9 text-xs rounded-lg',
  md: 'size-12 text-sm rounded-xl',
  lg: 'size-16 text-base rounded-2xl',
} as const;

/**
 * A company's logo, falling back to its initials when none has been uploaded.
 * The initials come from the employee-entered name — nothing is hardcoded.
 */
export function CompanyLogo({
  name,
  logoUrl,
  size = 'md',
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  // Stored logos are API paths; they only load once resolved against the API.
  const src = resolveAssetUrl(logoUrl);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(
          'bg-surface border-border-subtle shrink-0 border object-contain p-1',
          SIZES[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-brand-soft text-brand-strong flex shrink-0 items-center justify-center font-bold',
        SIZES[size],
        className,
      )}
    >
      {initials || '—'}
    </span>
  );
}
