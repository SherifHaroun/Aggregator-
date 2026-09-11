/**
 * A WORD DOCUMENT, AS MARKDOWN — the form the model reads.
 *
 * The Messages API reads text, not Word files. A `.docx` is a zip holding
 * `word/document.xml`, whose body is paragraphs and tables in document order.
 * This walks that body and writes Markdown: headings for heading styles, a
 * line per paragraph, and every table as a Markdown table — which is where
 * every figure in an insurer's document lives.
 *
 * Nothing is interpreted here. Bold, colour and layout are dropped; text and
 * table structure are kept, in order. What the model gets is what a person
 * would get pasting the document into a plain text editor, with the tables
 * still tables.
 */

import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';

/** One node of the ordered XML tree fast-xml-parser gives with `preserveOrder`. */
type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // "200,000" is text and stays text; a run's leading space is meaningful.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

/** Children of a node whose single tag is `name`, or [] when it is something else. */
function childrenOf(node: XmlNode, name: string): XmlNode[] {
  const children = node[name];
  return Array.isArray(children) ? (children as XmlNode[]) : [];
}

function tagOf(node: XmlNode): string | null {
  return Object.keys(node).find((key) => key !== ':@') ?? null;
}

function attributes(node: XmlNode): Record<string, string> {
  const raw = node[':@'];
  return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
}

/**
 * The text of a paragraph: its runs, in order, with tabs as spaces and line
 * breaks as " / " so a cell that lists three things on three lines reads as
 * three things rather than one run-on.
 */
function paragraphText(paragraph: XmlNode[]): string {
  const parts: string[] = [];
  const walk = (nodes: XmlNode[]) => {
    for (const node of nodes) {
      const tag = tagOf(node);
      if (tag === null) continue;
      if (tag === 'w:t') {
        for (const piece of childrenOf(node, 'w:t')) {
          const text = piece['#text'];
          if (typeof text === 'string') parts.push(text);
        }
      } else if (tag === 'w:tab') {
        parts.push(' ');
      } else if (tag === 'w:br' || tag === 'w:cr') {
        parts.push(' / ');
      } else if (tag !== 'w:pPr' && tag !== 'w:rPr' && tag !== 'w:tbl') {
        // Runs, hyperlinks, tracked insertions, content controls: descend.
        walk(childrenOf(node, tag));
      }
    }
  };
  walk(paragraph);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/** "Heading1" → 1, "Title" → 1, anything else → 0 (a plain paragraph). */
function headingLevel(paragraph: XmlNode[]): number {
  const properties = paragraph.find((node) => tagOf(node) === 'w:pPr');
  if (!properties) return 0;
  const style = childrenOf(properties, 'w:pPr').find((node) => tagOf(node) === 'w:pStyle');
  const value = style ? (attributes(style)['@_w:val'] ?? '') : '';
  if (/^title$/i.test(value)) return 1;
  const match = /^heading\s*(\d)$/i.exec(value);
  return match ? Number(match[1]) : 0;
}

function isListItem(paragraph: XmlNode[]): boolean {
  const properties = paragraph.find((node) => tagOf(node) === 'w:pPr');
  return properties
    ? childrenOf(properties, 'w:pPr').some((node) => tagOf(node) === 'w:numPr')
    : false;
}

/** A cell's paragraphs, joined the way a line break inside one is. */
function cellText(cell: XmlNode[]): string {
  const lines = cell
    .filter((node) => tagOf(node) === 'w:p')
    .map((node) => paragraphText(childrenOf(node, 'w:p')))
    .filter((line) => line !== '');
  return lines.join(' / ').replace(/\|/g, '\\|');
}

function tableMarkdown(table: XmlNode[]): string {
  const rows = table
    .filter((node) => tagOf(node) === 'w:tr')
    .map((row) =>
      childrenOf(row, 'w:tr')
        .filter((node) => tagOf(node) === 'w:tc')
        .map((cell) => cellText(childrenOf(cell, 'w:tc'))),
    )
    .filter((cells) => cells.length > 0);
  if (rows.length === 0) return '';

  const width = Math.max(...rows.map((cells) => cells.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  const [header, ...body] = rows;
  return [
    line(header ?? []),
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...body.map(line),
  ].join('\n');
}

/**
 * The body of a document as Markdown. Exported on its own so the walk can be
 * tested on XML without building a zip around it.
 */
export function documentXmlToMarkdown(xml: string): string {
  const tree = parser.parse(xml) as XmlNode[];
  const document = tree.find((node) => tagOf(node) === 'w:document');
  const body = document
    ? childrenOf(document, 'w:document').find((node) => tagOf(node) === 'w:body')
    : undefined;
  if (!body) return '';

  const blocks: string[] = [];
  const walk = (nodes: XmlNode[]) => {
    for (const node of nodes) {
      const tag = tagOf(node);
      if (tag === 'w:p') {
        const paragraph = childrenOf(node, 'w:p');
        const text = paragraphText(paragraph);
        if (text === '') continue;
        const level = headingLevel(paragraph);
        if (level > 0) blocks.push(`${'#'.repeat(Math.min(level, 6))} ${text}`);
        else if (isListItem(paragraph)) blocks.push(`- ${text}`);
        else blocks.push(text);
      } else if (tag === 'w:tbl') {
        const table = tableMarkdown(childrenOf(node, 'w:tbl'));
        if (table !== '') blocks.push(table);
      } else if (tag === 'w:sdt' || tag === 'w:sdtContent') {
        // A content control wraps ordinary paragraphs and tables.
        walk(childrenOf(node, tag));
      }
    }
  };
  walk(childrenOf(body, 'w:body'));
  return blocks.join('\n\n');
}

/** The Markdown for a `.docx` file's bytes. Throws when it is not one. */
export function docxToMarkdown(file: Uint8Array): string {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(file);
  } catch {
    throw new Error('The file is not a Word document.');
  }
  const xml = entries['word/document.xml'];
  if (!xml) throw new Error('The file is not a Word document: it has no document body.');
  return documentXmlToMarkdown(new TextDecoder('utf-8').decode(xml));
}
