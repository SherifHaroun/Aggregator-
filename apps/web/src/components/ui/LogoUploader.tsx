import { useRef, useState, type DragEvent } from 'react';
import { uploadImage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { describeError } from './DataState';

/**
 * Drag-and-drop (or click-to-browse) image upload.
 *
 * Uploads through the API and stores only the returned URL on the record —
 * the browser never talks to storage directly.
 */
export function LogoUploader({
  value,
  onChange,
  id,
  disabled = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  id?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (uploadError) {
      setError(describeError(uploadError, 'the logo'));
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    void handleFile(event.dataTransfer.files[0]);
  }

  if (value) {
    return (
      <div className="border-border-subtle flex items-center gap-4 rounded-(--radius-card) border p-4">
        <img
          src={value}
          alt="Company logo preview"
          className="bg-surface-muted size-16 rounded-(--radius-control) object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-content truncate text-sm font-medium">Logo uploaded</p>
          <p className="text-content-subtle truncate text-xs">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="text-danger hover:bg-danger-soft rounded-(--radius-control) px-3 py-1.5 text-sm font-medium"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-(--radius-card) border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-muted/40',
          disabled && 'opacity-60',
        )}
      >
        <p className="text-content text-sm font-medium">
          {uploading ? 'Uploading…' : 'Drag & drop a logo here'}
        </p>
        <p className="text-content-subtle mt-1 text-xs">PNG, JPEG, WEBP, SVG or GIF, up to 2 MB</p>
        <button
          type="button"
          id={id}
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="text-brand-strong hover:bg-brand-soft mt-3 rounded-(--radius-control) px-3 py-1.5 text-sm font-medium"
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>
      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
