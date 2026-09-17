/**
 * PDFs IN THE BROWSER.
 *
 * The writer itself lives in `@aggregator/shared` (`pdf-writer.ts`), because
 * the API builds the same documents to email them. What is left here is the
 * one thing only a browser can do: hand the finished bytes to the person as
 * a download.
 */

export { PdfDocument, rgb, widthOf, wrap, type Face, type Rgb } from '@aggregator/shared';

/** The bytes as a file the browser understands. */
export function pdfBlob(bytes: Uint8Array): Blob {
  // The writer hands back a plain view; a Blob wants one over an ArrayBuffer.
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Hand the file to the browser. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: Safari has not finished reading it synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
