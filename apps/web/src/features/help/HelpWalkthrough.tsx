import { useEffect, useId, useRef, useState } from 'react';
import {
  Button,
  Callout,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { TUTORIAL_STEPS, TUTORIAL_SUBTITLE, TUTORIAL_TITLE } from './tutorial-steps';

/**
 * The "Need help?" walkthrough.
 *
 * A guided tour rather than a page of documentation: one step is on screen at a
 * time, and the employee moves through them with Back and Next. The order is
 * the order the application imposes — company, plans, benefits, conditions,
 * review, compare — so following it once is the same as doing the job once.
 *
 * Built on the native `<dialog>` element for the same reason `ui/Dialog` is:
 * focus trapping and Escape come from the platform. It does not reuse that
 * component because a tour has no title bar and no dialog footer — it has a
 * progress header and a pager — and bending `Dialog` into that shape would
 * change a component every other screen depends on.
 */
export function HelpWalkthrough({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const [index, setIndex] = useState(0);
  /** Which way the last move went, so the incoming step slides in from it. */
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const total = TUTORIAL_STEPS.length;
  const step = TUTORIAL_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === total - 1;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // Always begin at the beginning: a tour reopened halfway through is confusing.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setDirection('forward');
    }
  }, [open]);

  // A long step leaves the panel scrolled down; the next one starts at its top.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [index]);

  if (!open || !step) return null;

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setDirection(clamped >= index ? 'forward' : 'back');
    setIndex(clamped);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) dismisses.
        if (event.target === ref.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' && !isLast) goTo(index + 1);
        if (event.key === 'ArrowLeft' && !isFirst) goTo(index - 1);
      }}
      className={cn(
        'bg-surface text-content m-auto w-[calc(100vw-2rem)] max-w-3xl overflow-hidden',
        'rounded-(--radius-card) p-0 shadow-(--shadow-raised) backdrop:bg-black/50',
      )}
    >
      {/* ---------------------------------------------------------------- */}
      {/* Progress header — the same navy panel the setup and comparison    */}
      {/* screens open with, so the tour looks like part of the product.    */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-brand-gradient text-content-inverted px-6 py-6 sm:px-10 sm:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.16em] text-white/70 uppercase">
              {TUTORIAL_TITLE}
            </p>
            <p className="mt-1 text-sm text-white/75">{TUTORIAL_SUBTITLE}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close the walkthrough"
            className="-mt-1 -mr-2 shrink-0 rounded-(--radius-control) p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconClose className="size-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* Dots double as a pager: any step is one click away. */}
          <div className="flex items-center gap-2">
            {TUTORIAL_STEPS.map((item, itemIndex) => {
              const done = itemIndex < index;
              const current = itemIndex === index;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(itemIndex)}
                  aria-label={`Step ${itemIndex + 1} of ${total}: ${item.title}`}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'h-2.5 rounded-(--radius-pill) transition-all duration-200',
                    'hover:bg-white focus-visible:outline-white',
                    current ? 'w-7 bg-white' : done ? 'w-2.5 bg-white/70' : 'w-2.5 bg-white/30',
                  )}
                />
              );
            })}
          </div>

          <p aria-live="polite" className="text-xs font-semibold text-white/80">
            Step {index + 1} of {total}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* One step. Re-keyed per step so the slide replays on every move.   */}
      {/* ---------------------------------------------------------------- */}
      <div ref={bodyRef} className="max-h-[58vh] overflow-y-auto px-6 py-7 sm:px-10 sm:py-8">
        <div
          key={step.id}
          className={direction === 'forward' ? 'animate-tour-forward' : 'animate-tour-back'}
        >
          <div className="flex items-center gap-3">
            <span className="bg-brand text-content-inverted flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              {index + 1}
            </span>
            <h2 id={titleId} className="text-content text-2xl font-bold tracking-tight sm:text-3xl">
              {step.title}
            </h2>
          </div>

          <p className="text-content-muted mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
            {step.lead}
          </p>

          <div className="mt-7 grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
            <ol className="space-y-3">
              {step.actions.map((action) => (
                <li key={action} className="flex items-start gap-3">
                  <span className="bg-brand-soft text-brand mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                    <IconCheck className="size-3.5" />
                  </span>
                  <span className="text-content text-sm leading-relaxed">{action}</span>
                </li>
              ))}
            </ol>

            {step.visual}
          </div>

          <Callout className="mt-7">{step.note}</Callout>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Pager                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-border-subtle bg-surface-muted/60 flex items-center justify-between gap-3 border-t px-6 py-4 sm:px-10">
        <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={isFirst}>
          <IconChevronLeft className="size-4" />
          Back
        </Button>

        {!isLast ? (
          <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">
            Skip tutorial
          </Button>
        ) : null}

        <Button onClick={() => (isLast ? onClose() : goTo(index + 1))}>
          {isLast ? 'Finish' : 'Next'}
          {isLast ? <IconCheck className="size-4" /> : <IconChevronRight className="size-4" />}
        </Button>
      </div>
    </dialog>
  );
}
