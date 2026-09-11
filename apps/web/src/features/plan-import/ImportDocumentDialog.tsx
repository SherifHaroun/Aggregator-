import {
  CUSTOMER_TYPES,
  PLAN_IMPORT_ACCEPTED_EXTENSION,
  PLAN_IMPORT_ACCEPTED_MIME,
  PLAN_IMPORT_MAX_UPLOAD_BYTES,
  optionLabel,
  type CustomerTypeId,
} from '@aggregator/shared';
import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, IconUpload, describeError } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { startPlanImport } from './plan-import.api';

/**
 * THE SMALL WINDOW: one Word document, one button.
 *
 * The document is handed to the API, which starts reading it and answers
 * with a job; the screen then moves to that job's page, where the progress
 * and, later, the plans for review are shown. Nothing is published from here.
 */
export function ImportDocumentDialog({
  companyId,
  companyName,
  customerType,
  onClose,
}: {
  companyId: string;
  companyName: string;
  /** The section the plans will be published into. */
  customerType: CustomerTypeId;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(candidate: File | undefined) {
    if (!candidate) return;
    setError(null);
    if (!candidate.name.toLowerCase().endsWith(PLAN_IMPORT_ACCEPTED_EXTENSION)) {
      setError('Choose a Word document (.docx).');
      return;
    }
    if (candidate.size > PLAN_IMPORT_MAX_UPLOAD_BYTES) {
      setError('That document is too large. The limit is 15 MB.');
      return;
    }
    setFile(candidate);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  async function start() {
    if (!file) return;
    setStarting(true);
    setError(null);
    try {
      const job = await startPlanImport(companyId, customerType, file);
      navigate(ROUTES.imports.detail(companyId, job.id));
    } catch (cause) {
      setError(describeError(cause, 'the document'));
      setStarting(false);
    }
  }

  const section = optionLabel(CUSTOMER_TYPES, customerType);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Insert company plans document"
      description={`The plans in the document are read and shown for review before anything is added to ${companyName}'s ${section} plans.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={starting}>
            Cancel
          </Button>
          <Button onClick={() => void start()} disabled={file === null || starting}>
            {starting ? 'Uploading…' : 'Read the document'}
          </Button>
        </div>
      }
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-(--radius-card) border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-muted/40',
        )}
      >
        <IconUpload className="text-content-subtle mx-auto size-6" />
        <p className="text-content mt-2 text-sm font-medium">
          {file ? file.name : 'Drag & drop the Word document here'}
        </p>
        <p className="text-content-subtle mt-1 text-xs">
          {file
            ? `${(file.size / 1024).toFixed(0)} KB · will be filed under ${section}`
            : 'A .docx file, up to 15 MB'}
        </p>
        <button
          type="button"
          disabled={starting}
          onClick={() => inputRef.current?.click()}
          className="text-brand-strong hover:bg-brand-soft mt-3 rounded-(--radius-control) px-3 py-1.5 text-sm font-medium"
        >
          {file ? 'Choose another file' : 'Browse files'}
        </button>
        <input
          ref={inputRef}
          type="file"
          aria-label="Word document"
          accept={`${PLAN_IMPORT_ACCEPTED_EXTENSION},${PLAN_IMPORT_ACCEPTED_MIME}`}
          className="sr-only"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </div>
      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
