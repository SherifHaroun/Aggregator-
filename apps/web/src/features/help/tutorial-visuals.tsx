import type { ReactNode } from 'react';
import { IconChevronRight } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The drawings used by the walkthrough.
 *
 * They are pictures rather than interfaces: nothing here is focusable, and each
 * one is hidden from assistive technology because the step text beside it
 * already says the same thing in words.
 */

/** One labelled node in a flow. */
export interface FlowNode {
  label: string;
  /** A concrete example under the label. Two or three words at most. */
  hint?: string;
  /** The node the employee ends on, drawn in brand colour. */
  emphasis?: boolean;
}

/** The frame every drawing sits in, so they all read as one family. */
export function VisualFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'border-border-subtle bg-surface-muted/50 rounded-(--radius-card) border border-dashed p-5 sm:p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

function NodeBox({ node }: { node: FlowNode }) {
  return (
    <div
      className={cn(
        'w-full max-w-xs rounded-(--radius-control) border px-4 py-2.5 text-center shadow-(--shadow-card)',
        node.emphasis
          ? 'border-brand-border bg-brand text-content-inverted'
          : 'border-border-subtle bg-surface',
      )}
    >
      <p className={cn('text-sm font-semibold', !node.emphasis && 'text-content')}>{node.label}</p>
      {node.hint ? (
        <p
          className={cn('mt-0.5 text-xs', node.emphasis ? 'text-white/75' : 'text-content-subtle')}
        >
          {node.hint}
        </p>
      ) : null}
    </div>
  );
}

/** A downward chain: each box sits under the last, joined by an arrow. */
export function FlowStack({ nodes }: { nodes: readonly FlowNode[] }) {
  return (
    <div className="flex flex-col items-center">
      {nodes.map((node, index) => (
        <div key={node.label} className="flex w-full flex-col items-center">
          {index > 0 ? <Connector /> : null}
          <NodeBox node={node} />
        </div>
      ))}
    </div>
  );
}

function Connector() {
  return (
    <svg
      width="12"
      height="26"
      viewBox="0 0 12 26"
      fill="none"
      className="text-border-strong my-1"
      aria-hidden="true"
    >
      <path
        d="M6 1v18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
      <path
        d="M2.5 16.5 6 21l3.5-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A chain that wraps: used where the flow has more links than a column can
 * show without the drawing becoming a scroll of its own.
 */
export function FlowWrap({ nodes }: { nodes: readonly FlowNode[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
      {nodes.map((node, index) => (
        <div key={node.label} className="flex items-center gap-1.5">
          {index > 0 ? (
            <IconChevronRight className="text-content-subtle size-3.5 shrink-0" />
          ) : null}
          <span
            className={cn(
              'rounded-(--radius-pill) border px-3 py-1.5 text-xs font-semibold whitespace-nowrap',
              node.emphasis
                ? 'border-brand-border bg-brand text-content-inverted'
                : 'border-border-subtle bg-surface text-content',
            )}
          >
            {node.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A parent with its children hanging off it — the plan and its benefits. */
export function BranchTree({ root, leaves }: { root: string; leaves: readonly string[] }) {
  return (
    <div className="mx-auto max-w-sm">
      <div className="border-brand-border bg-brand text-content-inverted rounded-(--radius-control) border px-4 py-2.5 text-center text-sm font-semibold shadow-(--shadow-card)">
        {root}
      </div>

      <div className="pl-5">
        {leaves.map((leaf, index) => (
          <div key={leaf} className="relative flex items-center">
            {/* The trunk, stopping at the last elbow rather than running past it. */}
            <span
              className={cn(
                'bg-border-strong absolute left-0 w-px',
                index === leaves.length - 1 ? 'top-0 h-1/2' : 'inset-y-0',
              )}
            />
            <span className="bg-border-strong absolute left-0 h-px w-4 translate-y-0" />
            <div className="border-border-subtle bg-surface text-content my-1 ml-4 flex-1 rounded-(--radius-control) border px-3.5 py-2 text-sm font-medium">
              {leaf}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A miniature of a real screen: a titled panel with rows in it. Used where
 * showing the shape of the form says more than another chain of boxes.
 */
export function MockPanel({
  title,
  rows,
  action,
}: {
  title: string;
  rows: readonly { label: string; value: string }[];
  action?: string;
}) {
  return (
    <div className="border-border-subtle bg-surface mx-auto max-w-sm overflow-hidden rounded-(--radius-control) border shadow-(--shadow-card)">
      <div className="bg-brand-gradient text-content-inverted px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
      </div>

      <div className="divide-border-subtle divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-content-muted text-xs">{row.label}</span>
            <span className="text-content text-xs font-semibold">{row.value}</span>
          </div>
        ))}
      </div>

      {action ? (
        <div className="border-border-subtle bg-surface-muted/60 border-t px-4 py-3">
          <span className="bg-brand text-content-inverted block rounded-(--radius-control) px-3 py-2 text-center text-xs font-semibold">
            {action}
          </span>
        </div>
      ) : null}
    </div>
  );
}
