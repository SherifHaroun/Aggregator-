import type { ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Label + control + error, used by every form in the app.
 * Renders its child through a callback so the control receives the generated
 * id and the aria wiring without each form repeating it.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="text-content mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger ml-0.5">*</span> : null}
      </label>

      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-danger mt-1.5 text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-content-subtle mt-1.5 text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Groups related fields under a heading, e.g. "Contact information". */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border-subtle border-t pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-content text-sm font-semibold tracking-wide uppercase">{title}</h2>
      {description ? <p className="text-content-muted mt-1 text-sm">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Makes a field span the full width of a `FormSection` grid. */
export function FullWidth({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}
