import {
  MAX_INSURABLE_AGE,
  formatNumber,
  presentPriceBands,
  type PriceBandLike,
} from '@aggregator/shared';
import { cn } from '@/lib/cn';

/**
 * THE RATE TABLE, DRAWN.
 *
 * A comparison prices a plan at one age. The plan is sold across many, and a
 * customer about to choose it — or choosing it for a family that will grow
 * older on it — wants to see the whole table. So it is drawn twice over: as a
 * bar running from the youngest age priced to the oldest, one segment per
 * band with the band that priced THIS comparison picked out, and as the list
 * of figures beneath it.
 *
 * The same layout feeds the PDF, from the same shared presentation, so the
 * document a customer is emailed shows what the screen showed.
 */
export function PriceBandRange({
  bands,
  currency,
  ages,
  compact = false,
}: {
  bands: readonly PriceBandLike[];
  currency: string | null;
  /**
   * The ages the comparison ran at, or `null` where no single band applies —
   * an SME priced by its workforce is priced across several.
   */
  ages: { ageFrom: number; ageTo: number; assumed?: boolean } | null;
  /** Tighter spacing for the preview dialog. */
  compact?: boolean;
}) {
  const table = presentPriceBands(bands, currency, ages, MAX_INSURABLE_AGE);

  if (table.bands.length === 0) {
    return <p className="text-content-subtle text-sm">This plan records no price by age.</p>;
  }

  const applying = table.bands.find((band) => band.applies) ?? null;
  const money = (value: number) => `${currency ? `${currency} ` : ''}${formatNumber(value)}`;

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* The caption: what the bar is, and the span of prices it holds. */}
      <p className="text-content-muted text-sm">
        The premium changes with age.
        {table.lowest !== null && table.highest !== null && table.lowest !== table.highest
          ? ` From ${money(table.lowest)} to ${money(table.highest)} a year across ${table.bands.length} age bands.`
          : ''}
        {applying && ages
          ? ` Highlighted: the band that priced this comparison at ${
              ages.ageFrom === ages.ageTo
                ? `age ${ages.ageFrom}`
                : `ages ${ages.ageFrom}–${ages.ageTo}`
            }${ages.assumed ? ' (assumed)' : ''}.`
          : ''}
      </p>

      {/* --- the bar --------------------------------------------------------- */}
      <div className="pt-6 pb-5" aria-hidden="true">
        <div className="bg-surface-muted relative h-3 rounded-full">
          {table.bands.map((band) => (
            <div
              key={`${band.ageFrom}-${band.ageTo}`}
              title={`Ages ${band.ageLabel}: ${band.display}`}
              className={cn(
                'absolute inset-y-0 rounded-full transition-colors',
                band.applies
                  ? 'bg-brand ring-brand/30 z-10 -inset-y-0.5 ring-4'
                  : band.annualPrice === null
                    ? 'bg-border-subtle'
                    : 'bg-brand/35',
              )}
              style={{
                left: `calc(${band.start * 100}% + 1px)`,
                width: `calc(${(band.end - band.start) * 100}% - 2px)`,
              }}
            />
          ))}

          {/* The customer's own age, as a pin on the bar. */}
          {table.marker !== null ? (
            <div
              className="absolute -top-6 z-20 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${table.marker * 100}%` }}
            >
              <span className="bg-brand text-content-inverted rounded-(--radius-pill) px-1.5 py-0.5 text-[10px] leading-none font-bold whitespace-nowrap">
                {ages && ages.ageFrom !== ages.ageTo
                  ? `${ages.ageFrom}–${ages.ageTo}`
                  : `Age ${ages?.ageFrom ?? ''}`}
              </span>
              <span className="bg-brand mt-0.5 h-2 w-0.5 rounded-full" />
            </div>
          ) : null}
        </div>

        {/* Age labels, one per band, sitting under their segment. */}
        <div className="relative mt-2 h-4">
          {table.bands.map((band) => (
            <span
              key={`${band.ageFrom}-${band.ageTo}-label`}
              className={cn(
                'absolute top-0 truncate text-center text-[11px] tabular-nums',
                band.applies ? 'text-brand-strong font-semibold' : 'text-content-subtle',
              )}
              style={{ left: `${band.start * 100}%`, width: `${(band.end - band.start) * 100}%` }}
            >
              {band.ageLabel}
            </span>
          ))}
        </div>
      </div>

      {/* --- the list -------------------------------------------------------- */}
      <dl
        className={cn(
          'grid gap-x-6 gap-y-0',
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {table.bands.map((band) => (
          <div
            key={`${band.ageFrom}-${band.ageTo}-row`}
            className={cn(
              'flex items-baseline justify-between gap-3 border-b px-2 py-2',
              band.applies
                ? 'bg-brand-soft border-brand-border rounded-(--radius-control)'
                : 'border-border-subtle',
            )}
          >
            <dt
              className={cn(
                'text-sm tabular-nums',
                band.applies ? 'text-brand-strong font-semibold' : 'text-content-muted',
              )}
            >
              Ages {band.ageLabel}
              {band.applies ? (
                <span className="text-brand-strong ml-1.5 text-[10px] font-bold tracking-wide uppercase">
                  this comparison
                </span>
              ) : null}
            </dt>
            <dd
              className={cn(
                'shrink-0 text-sm tabular-nums',
                band.annualPrice === null
                  ? 'text-content-subtle italic'
                  : band.applies
                    ? 'text-brand-strong font-bold'
                    : 'text-content font-semibold',
              )}
            >
              {band.display}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
