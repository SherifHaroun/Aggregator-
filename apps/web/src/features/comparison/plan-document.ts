/**
 * THE PLAN, AS A DOCUMENT A CUSTOMER CAN BE SENT — from the browser.
 *
 * The renderer lives in `@aggregator/shared` so the API can email the very
 * same file. This is the browser's end of it: the provider-list address is
 * resolved against THIS site's API, and the bytes become a download.
 */

import {
  renderPlanDocument,
  type DocumentAges,
  type DocumentBenefit,
  type PlanDocumentInput,
} from '@aggregator/shared';
import { providerListUrl } from '@/lib/api-url';
import { downloadBlob, pdfBlob } from '@/lib/pdf';

export type { DocumentAges, DocumentBenefit, PlanDocumentInput };

/** Build the document. Returns the blob and the name it should be saved under. */
export function buildPlanDocument(input: Omit<PlanDocumentInput, 'providerListUrl'>): {
  blob: Blob;
  filename: string;
} {
  const { bytes, filename } = renderPlanDocument({ ...input, providerListUrl });
  return { blob: pdfBlob(bytes), filename };
}

/** Build the document and hand it to the browser. */
export function downloadPlanDocument(input: Omit<PlanDocumentInput, 'providerListUrl'>) {
  const { blob, filename } = buildPlanDocument(input);
  downloadBlob(blob, filename);
  return filename;
}
