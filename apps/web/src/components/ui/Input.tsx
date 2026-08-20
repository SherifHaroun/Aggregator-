import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-(--radius-control) border border-border-subtle bg-surface px-3.5 py-2.5 text-sm ' +
  'text-content placeholder:text-content-subtle transition-colors ' +
  'hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15';

/**
 * The application's text control, and the one place the wheel is disarmed.
 *
 * A focused `type="number"` input treats a wheel scroll as increment or
 * decrement, so a scroll past the page silently rewrites a price or an age.
 * Dropping focus stops that: the browser only spins a number input while it is
 * focused, and the wheel event itself is left alone so the page keeps
 * scrolling exactly as it normally would.
 *
 * `preventDefault` is deliberately NOT used — React listens for `wheel`
 * passively, so it would be ignored, and stopping the default would freeze the
 * page under the cursor even when it worked.
 *
 * Every numeric field in the application renders through here (directly or via
 * `InputWithSuffix`), including the ones generated from employee-defined
 * option fields, so none of them can miss this.
 */
export function Input({ className, onWheel, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(CONTROL, className)}
      {...props}
      onWheel={(event) => {
        if (props.type === 'number' && event.currentTarget === document.activeElement) {
          event.currentTarget.blur();
        }
        onWheel?.(event);
      }}
    />
  );
}

export function Textarea({
  className,
  rows = 4,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(CONTROL, 'resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, 'appearance-none pr-9', className)} {...props}>
      {children}
    </select>
  );
}

/** Input with a trailing unit or currency marker, e.g. "%" or "EGP". */
export function InputWithSuffix({
  suffix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix: string }) {
  return (
    <div className="relative">
      <Input className={cn('pr-16', className)} {...props} />
      <span className="text-content-subtle pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-medium">
        {suffix}
      </span>
    </div>
  );
}
