import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/**
 * Modal dialog built on the native <dialog> element, so focus trapping and
 * Escape handling come from the platform rather than a dependency.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) dismisses.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'bg-surface text-content m-auto w-[calc(100vw-2rem)] rounded-(--radius-card) p-0 shadow-(--shadow-raised)',
        'backdrop:bg-black/40',
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      <div className="border-border-subtle border-b px-6 py-4">
        <h2 className="text-content text-base font-semibold">{title}</h2>
        {description ? <p className="text-content-muted mt-1 text-sm">{description}</p> : null}
      </div>

      {children ? <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{children}</div> : null}

      {footer ? (
        <div className="border-border-subtle bg-surface-muted/60 flex flex-wrap justify-end gap-3 border-t px-6 py-4">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Confirmation for destructive actions. Deletion is refused by the API
 * whenever other records depend on the row, so `description` is the place to
 * tell the employee what will happen.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  tone = 'danger',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
