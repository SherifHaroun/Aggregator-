import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { IconCollapse, IconExpand } from './icons';

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
  expandable = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /**
   * Offers a control that fills the screen with this dialog.
   *
   * For the forms that are genuinely long — a plan and every variant of it —
   * where the default width leaves a rate table reading through a letterbox.
   * The employee chooses; nothing opens expanded on its own.
   */
  expandable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);

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
        expanded
          ? 'flex h-[calc(100vh-2rem)] max-w-none flex-col'
          : size === 'lg'
            ? 'max-w-2xl'
            : 'max-w-lg',
      )}
    >
      <div className="border-border-subtle flex items-start gap-3 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-content text-base font-semibold">{title}</h2>
          {description ? <p className="text-content-muted mt-1 text-sm">{description}</p> : null}
        </div>
        {expandable ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-pressed={expanded}
            aria-label={expanded ? 'Exit full screen' : 'Full screen'}
            title={expanded ? 'Exit full screen' : 'Full screen'}
            className="text-content-muted hover:bg-surface-muted hover:text-content shrink-0 rounded-(--radius-control) p-2"
          >
            {expanded ? <IconCollapse className="size-4" /> : <IconExpand className="size-4" />}
          </button>
        ) : null}
      </div>

      {children ? (
        <div
          className={cn(
            'overflow-y-auto px-6 py-5',
            expanded ? 'min-h-0 flex-1' : 'max-h-[60vh]',
          )}
        >
          {children}
        </div>
      ) : null}

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
