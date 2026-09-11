/**
 * THE PLAN IMPORT — reading an insurer's Word document into the review screen.
 *
 * What the model is, how big a document may be, and how the progress bar is
 * worked out, all in one place. The prompt itself lives with the API
 * (`apps/api/src/modules/plan-imports/plan-import.prompt.ts`) and its audit
 * copy in `docs/plan-import-prompt.md`.
 */

import type { PlanImportStatus } from '../types/plan-import.js';

/** The model that reads the document. A rate table read wrong is a mis-quote. */
export const PLAN_IMPORT_MODEL = 'claude-opus-5';

/** Ten plans with rate tables fit comfortably. */
export const PLAN_IMPORT_MAX_OUTPUT_TOKENS = 32000;

/** Word documents only, and a generous ceiling for one with pictures in it. */
export const PLAN_IMPORT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const PLAN_IMPORT_ACCEPTED_EXTENSION = '.docx';
export const PLAN_IMPORT_ACCEPTED_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** How often the screen asks where the import is. */
export const PLAN_IMPORT_POLL_MS = 1500;

/**
 * THE PROGRESS BAR, HONESTLY.
 *
 * Four stages with fixed shares of the bar. Reading is the long one and the
 * only one that moves within its share: the model announces the plan names
 * first, so `completed ÷ announced` is a real fraction, not a guess.
 */
export const PLAN_IMPORT_STAGES: Record<
  Exclude<PlanImportStatus, 'DONE' | 'FAILED'>,
  { from: number; to: number; label: string }
> = {
  CONVERTING: { from: 0, to: 10, label: 'Converting the document' },
  SENDING: { from: 10, to: 15, label: 'Sending it to be read' },
  READING: { from: 15, to: 95, label: 'Reading the plans' },
  VALIDATING: { from: 95, to: 100, label: 'Checking the answer' },
};

/** Where the bar stands for a stage, part-way through it. */
export function planImportPercent(status: PlanImportStatus, fraction = 0): number {
  if (status === 'DONE') return 100;
  if (status === 'FAILED') return 0;
  const stage = PLAN_IMPORT_STAGES[status];
  const share = Math.min(Math.max(fraction, 0), 1);
  return Math.round(stage.from + (stage.to - stage.from) * share);
}

/** What the screen says a stage is doing. */
export function planImportStageLabel(status: PlanImportStatus): string {
  if (status === 'DONE') return 'Ready to review';
  if (status === 'FAILED') return 'Could not read the document';
  return PLAN_IMPORT_STAGES[status].label;
}
