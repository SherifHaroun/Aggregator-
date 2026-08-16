import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-(--radius-control) border border-border-subtle bg-surface px-3 py-2.5 text-sm ' +
  'text-content placeholder:text-content-subtle transition-colors ' +
  'hover:border-border-strong focus:border-brand focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-[invalid=true]:border-danger';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(CONTROL, 'resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, 'appearance-none pr-8', className)} {...props}>
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
      <span className="text-content-subtle pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
        {suffix}
      </span>
    </div>
  );
}
