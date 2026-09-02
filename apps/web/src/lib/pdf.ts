/**
 * A SMALL PDF WRITER.
 *
 * Written rather than installed. A plan document is a title, some headed
 * sections and two-column tables that must break across pages without cutting
 * a row in half — which is a few hundred lines of layout, against a megabyte of
 * library whose page-breaking would still have to be driven by hand.
 *
 * It emits PDF 1.4 with the two standard fonts every reader already has, so
 * nothing is embedded and the file stays small enough to email.
 */

const A4 = { width: 595.28, height: 841.89 };

/** Written this way because the file is assembled as bytes, not as source. */
const NEWLINE = String.fromCharCode(10);

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });

/**
 * Character widths for the two faces used, in 1/1000 em.
 *
 * Needed to wrap text: without real widths a line is either broken early and
 * looks ragged, or broken late and runs off the page. Taken from the standard
 * Helvetica metrics, for the printable ASCII range this document uses.
 */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

export type Face = 'regular' | 'bold';

/** How wide a string is, in points, at this size. */
export function widthOf(text: string, size: number, face: Face): number {
  const widths = face === 'bold' ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 32;
    total += (code >= 32 && code <= 126 ? widths[code - 32]! : 556) / 1000;
  }
  return total * size;
}

/**
 * Break text to a width, on spaces where it can and mid-word where it cannot.
 *
 * A word longer than the column — a URL, an unbroken policy reference — is cut
 * rather than allowed to run into the margin, because the alternative is text
 * that leaves the page.
 */
export function wrap(text: string, width: number, size: number, face: Face): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOf(candidate, size, face) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (widthOf(word, size, face) <= width) {
        line = word;
        continue;
      }
      let piece = '';
      for (const character of word) {
        if (widthOf(piece + character, size, face) > width) {
          lines.push(piece);
          piece = character;
        } else {
          piece += character;
        }
      }
      line = piece;
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

/** Escape the three characters a PDF string cannot carry raw. */
const escapeText = (text: string) =>
  text
    // Latin-1 is what the standard fonts hold; anything else is transliterated
    // to a question mark rather than emitted as a byte the reader misdraws.
    .replace(/[^\x20-\x7E -ÿ]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

/**
 * One page's worth of drawing commands, plus the cursor that fills it.
 *
 * `y` counts DOWN from the top, because a document is written top to bottom
 * and PDF's own origin at the bottom-left is a detail of the format rather
 * than of the page.
 */
export class PdfDocument {
  /** One array of drawing commands per page; the last is the one being filled. */
  private readonly pages: string[][] = [[]];
  y: number;

  constructor(
    readonly margin = 48,
    /** Drawn at the top of every page, including the ones a table spills onto. */
    private readonly header: (doc: PdfDocument, page: number) => void = () => {},
    private readonly footer: (doc: PdfDocument, page: number) => void = () => {},
  ) {
    this.y = margin;
    this.header(this, 1);
  }

  get width() {
    return A4.width;
  }
  get height() {
    return A4.height;
  }
  get contentWidth() {
    return A4.width - this.margin * 2;
  }
  /** How far down the page the cursor may go before the footer's room. */
  private get floor() {
    return A4.height - this.margin - 28;
  }

  /** Start a new page when `needed` points will not fit on this one. */
  ensure(needed: number) {
    if (this.y + needed <= this.floor) return;
    this.pages.push([]);
    this.y = this.margin;
    this.header(this, this.pages.length);
  }

  private op(command: string) {
    this.pages[this.pages.length - 1]!.push(command);
  }

  text(
    value: string,
    x: number,
    size = 10,
    face: Face = 'regular',
    color: Rgb = rgb(0.1, 0.13, 0.24),
  ) {
    this.op(
      `BT /F${face === 'bold' ? 2 : 1} ${size} Tf ${color.r} ${color.g} ${color.b} rg ` +
        `1 0 0 1 ${x.toFixed(2)} ${(A4.height - this.y - size).toFixed(2)} Tm (${escapeText(value)}) Tj ET`,
    );
  }

  /** Text whose right edge sits at `x` — how a figure is set against a label. */
  textRight(
    value: string,
    x: number,
    size = 10,
    face: Face = 'regular',
    color: Rgb = rgb(0.1, 0.13, 0.24),
  ) {
    this.text(value, x - widthOf(value, size, face), size, face, color);
  }

  rect(x: number, y: number, w: number, h: number, color: Rgb) {
    this.op(
      `${color.r} ${color.g} ${color.b} rg ${x.toFixed(2)} ${(A4.height - y - h).toFixed(2)} ` +
        `${w.toFixed(2)} ${h.toFixed(2)} re f`,
    );
  }

  line(x1: number, y: number, x2: number, color: Rgb, thickness = 0.6) {
    this.op(
      `${color.r} ${color.g} ${color.b} RG ${thickness} w ${x1.toFixed(2)} ${(A4.height - y).toFixed(2)} m ` +
        `${x2.toFixed(2)} ${(A4.height - y).toFixed(2)} l S`,
    );
  }

  /** Paragraph text, wrapped, advancing the cursor. */
  paragraph(value: string, size = 10, face: Face = 'regular', color?: Rgb, leading = 1.45) {
    for (const line of wrap(value, this.contentWidth, size, face)) {
      this.ensure(size * leading);
      this.text(line, this.margin, size, face, color);
      this.y += size * leading;
    }
  }

  /** Serialise every page. */
  build(): Blob {
    /**
     * The footer carries "page 2 of 5", which is only knowable once drawing
     * has stopped — so it is drawn here, onto each finished page in turn.
     */
    const total = this.pages.length;
    const savedY = this.y;
    for (let index = 0; index < total; index += 1) {
      const target = this.pages[index]!;
      const restore = this.pages.length;
      // Point `op` at the page being footed, then put it back.
      this.pages.push(target);
      this.y = A4.height - this.margin - 16;
      this.footer(this, index + 1);
      this.pages.length = restore;
    }
    this.y = savedY;

    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const fontRegular = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    );
    const fontBold = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    );

    // The page tree is written last but referenced by every page, so its id is
    // worked out in advance: two objects per page follow the two fonts.
    const treeId = 2 + this.pages.length * 2 + 1;
    const pageIds: number[] = [];
    for (const page of this.pages) {
      const stream = page.join(String.fromCharCode(10));
      const contents = add(`<< /Length ${stream.length} >>
stream
${stream}
endstream`);
      pageIds.push(
        add(
          `<< /Type /Page /Parent ${treeId} 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
            `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> ` +
            `/Contents ${contents} 0 R >>`,
        ),
      );
    }
    add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    const catalog = add(`<< /Type /Catalog /Pages ${treeId} 0 R >>`);

    let out = '%PDF-1.4' + NEWLINE;
    const offsets = [0];
    objects.forEach((body, index) => {
      offsets.push(out.length);
      out += `${index + 1} 0 obj
${body}
endobj
`;
    });
    const xref = out.length;
    out += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;
    for (let index = 1; index <= objects.length; index += 1) {
      out += `${String(offsets[index]).padStart(10, '0')} 00000 n 
`;
    }
    out += `trailer
<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>
startxref
${xref}
%%EOF`;

    const bytes = new Uint8Array(out.length);
    for (let index = 0; index < out.length; index += 1) bytes[index] = out.charCodeAt(index) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }
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
