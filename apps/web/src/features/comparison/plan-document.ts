/**
 * THE PLAN, AS A DOCUMENT A CUSTOMER CAN BE SENT.
 *
 * Everything on it comes from the plan that was compared — the same figures the
 * screen showed, read through the same presentation rules. Nothing is written
 * for the document alone, so a printed quote can never disagree with the one on
 * screen.
 */

import {
  MAX_INSURABLE_AGE,
  NOT_SOLD_AT_AGE_LABEL,
  PROVIDER_LIST_DOWNLOAD_LABEL,
  PROVIDER_LIST_PANEL_TITLE,
  formatNumber,
  providerListPanelSubtitle,
  presentAnnualLimit,
  presentCoreBenefits,
  presentPremium,
  presentPriceBands,
  planDocumentFilename,
  type ComparisonPlanResult,
  type PriceBandLike,
} from '@aggregator/shared';
import { providerListUrl } from '@/lib/api-url';
import { PdfDocument, downloadBlob, rgb, widthOf, wrap, type Rgb } from '@/lib/pdf';

/** The house colours, as the screen uses them. */
const NAVY = rgb(0.1, 0.15, 0.36);
const INK = rgb(0.11, 0.13, 0.2);
const MUTED = rgb(0.42, 0.45, 0.53);
const RULE = rgb(0.85, 0.87, 0.91);
const WASH = rgb(0.96, 0.97, 0.99);
const WHITE = rgb(1, 1, 1);
/** The navy at a third, for the bands a comparison did not price. */
const NAVY_SOFT = rgb(0.64, 0.69, 0.86);
/** The halo around the band that did. */
const NAVY_HALO = rgb(0.82, 0.86, 0.95);
/** The wash the highlighted row sits on — the screen's brand-soft. */
const HIGHLIGHT = rgb(0.86, 0.91, 0.98);

/**
 * THE ROW THAT PRICED THIS COMPARISON, picked out.
 *
 * A pill-shaped row on the brand wash with a navy outline, the label in bold
 * navy and the figure in a navy pill of its own — the same treatment the
 * screen gives it, so the customer finds the same row in both.
 */
function highlightedRow(doc: PdfDocument, label: string, value: string) {
  const height = 24;
  doc.ensure(height + 8);
  const left = doc.margin;
  const width = doc.contentWidth;
  const top = doc.y - 2;

  doc.roundedRect(left, top, width, height, height / 2, HIGHLIGHT, { color: NAVY, width: 0.9 });

  doc.y = top + 7;
  doc.text(label, left + 12, 10, 'bold', NAVY);

  const pillHeight = 17;
  const pillWidth = widthOf(value, 10, 'bold') + 18;
  const pillLeft = left + width - 4 - pillWidth;
  const pillTop = top + (height - pillHeight) / 2;
  doc.roundedRect(pillLeft, pillTop, pillWidth, pillHeight, pillHeight / 2, NAVY);
  doc.y = pillTop + 3.5;
  doc.text(value, pillLeft + 9, 10, 'bold', WHITE);

  doc.y = top + height + 5;
}

/** The ages a comparison ran at, and whether they were the customer's. */
export interface DocumentAges {
  ageFrom: number;
  ageTo: number;
  assumed?: boolean;
}

/** A benefit the plan states beyond the six, with whatever it says about it. */
export interface DocumentBenefit {
  name: string;
  value: string | null;
  details: string[];
}

export interface PlanDocumentInput {
  plan: ComparisonPlanResult;
  /** Everything the variant carries that is not one of the seven core areas. */
  additional: DocumentBenefit[];
  /** Free text the plan attaches — waiting periods, conditions, exclusions. */
  waitingPeriods: string[];
  conditions: string[];
  exclusions: string[];
  /** The whole rate table, so the customer sees every age the plan is sold at. */
  priceBands: readonly PriceBandLike[];
  /**
   * The ages the comparison ran at, so the band that priced it can be picked
   * out. `null` where no single band applies — an SME priced by workforce.
   */
  ages?: DocumentAges | null;
  description: string | null;
}

/** How the ages read in a sentence: "age 35", "ages 4–52", "age 35 (assumed)". */
function describeAges(ages: DocumentAges): string {
  const span =
    ages.ageFrom === ages.ageTo ? `age ${ages.ageFrom}` : `ages ${ages.ageFrom}–${ages.ageTo}`;
  return ages.assumed ? `${span} (assumed)` : span;
}

/** A heading with a rule under it, kept with at least one line of its section. */
function section(doc: PdfDocument, title: string) {
  doc.ensure(46);
  doc.y += 10;
  doc.text(title.toUpperCase(), doc.margin, 9, 'bold', MUTED);
  doc.y += 13;
  doc.line(doc.margin, doc.y, doc.width - doc.margin, RULE);
  doc.y += 10;
}

/**
 * A two-column row, label left and value right.
 *
 * The value is measured and the label wrapped to what is left, so a long
 * benefit name pushes itself onto a second line rather than running under the
 * figure.
 */
function row(doc: PdfDocument, label: string, value: string, bold = false) {
  const right = doc.width - doc.margin;
  const valueWidth = widthOf(value, 10, bold ? 'bold' : 'regular');
  const labelWidth = doc.contentWidth - valueWidth - 16;
  const lines = wrap(label, Math.max(labelWidth, 80), 10, 'regular');

  doc.ensure(lines.length * 14 + 4);
  const top = doc.y;
  lines.forEach((line, index) => {
    doc.text(line, doc.margin, 10, 'regular', INK);
    if (index < lines.length - 1) doc.y += 13;
  });
  doc.y = top;
  doc.textRight(value, right, 10, bold ? 'bold' : 'regular', bold ? NAVY : INK);
  doc.y += lines.length * 13 + 5;
  doc.line(doc.margin, doc.y - 3, right, RULE, 0.4);
}

/**
 * THE PANEL THAT OPENS THE NETWORK'S PROVIDER LIST.
 *
 * The list cannot be printed here — it is thousands of rows, in Arabic, in a
 * layout the insurer changes every few months — so the document carries a
 * panel with a button instead: a badge, what is on offer, which network, and
 * the button. The address is the network's STABLE one: it hands out whatever
 * file is current when the customer clicks, however long after this PDF was
 * made.
 */
function providerListPanel(doc: PdfDocument, networkName: string, url: string) {
  const height = 54;
  doc.ensure(height + 18);
  doc.y += 8;
  const top = doc.y;
  const left = doc.margin;
  const width = doc.contentWidth;

  doc.rect(left, top, width, height, WASH);

  // The badge: the network's initial in a navy disc.
  const initial = (networkName.trim()[0] ?? 'N').toUpperCase();
  doc.circle(left + 26, top + height / 2, 12, NAVY);
  doc.y = top + height / 2 - 5.5;
  doc.text(initial, left + 26 - widthOf(initial, 10, 'bold') / 2, 10, 'bold', WHITE);

  // What is on offer, and from which network.
  doc.y = top + 13;
  doc.text(PROVIDER_LIST_PANEL_TITLE, left + 48, 10, 'bold', INK);
  doc.y = top + 30;
  doc.text(providerListPanelSubtitle(networkName), left + 48, 8.5, 'regular', MUTED);

  // The button, right-aligned inside the panel, and the click area over it.
  const label = PROVIDER_LIST_DOWNLOAD_LABEL.toUpperCase();
  const buttonWidth = widthOf(label, 8.5, 'bold') + 28;
  const buttonHeight = 24;
  const buttonLeft = left + width - 14 - buttonWidth;
  const buttonTop = top + (height - buttonHeight) / 2;
  doc.rect(buttonLeft, buttonTop, buttonWidth, buttonHeight, NAVY);
  doc.y = buttonTop + 7.5;
  doc.text(label, buttonLeft + 14, 8.5, 'bold', WHITE);
  doc.link(buttonLeft, buttonTop, buttonWidth, buttonHeight, url);

  doc.y = top + height + 10;
}

/**
 * THE RATE TABLE, AS A BAR AND A LIST.
 *
 * The premium the document leads with is the premium at ONE age. The plan is
 * sold across many, and this is where the customer sees the whole table: a
 * bar from the youngest age priced to the oldest, one segment per band, the
 * band that priced this comparison in full navy with its figure above it and
 * a pin at the customer's own age, then the figures band by band. The same
 * shared presentation lays out the screen, so the two cannot disagree.
 */
function priceTablePanel(doc: PdfDocument, input: PlanDocumentInput) {
  const { plan } = input;
  // A business priced by its workforce was priced across several bands; none
  // of them is "the" band, so none is picked out.
  const ages = plan.pricedEmployeeCount === null ? (input.ages ?? null) : null;
  const table = presentPriceBands(input.priceBands, plan.currency, ages, MAX_INSURABLE_AGE);
  if (table.bands.length === 0) return;

  section(doc, 'Price by age');

  const money = (value: number) =>
    `${plan.currency ? `${plan.currency} ` : ''}${formatNumber(value)}`;
  const applying = table.bands.find((band) => band.applies);
  const caption = [
    'The premium changes with age.',
    table.lowest !== null && table.highest !== null && table.lowest !== table.highest
      ? `From ${money(table.lowest)} to ${money(table.highest)} a year across ${table.bands.length} age bands.`
      : '',
    applying && ages
      ? `Highlighted: the band that priced this comparison at ${describeAges(ages)}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  doc.paragraph(caption, 9, 'regular', MUTED);

  // --- the bar --------------------------------------------------------------
  const pillHeight = 16;
  const pillRoom = pillHeight + 12;
  const barHeight = 12;
  const ageRoom = 14;
  const legendRoom = 20;
  doc.ensure(pillRoom + barHeight + ageRoom + legendRoom + 12);
  doc.y += 6;

  const left = doc.margin;
  const width = doc.contentWidth;
  const barTop = doc.y + pillRoom;

  doc.rect(left, barTop, width, barHeight, WASH);

  for (const band of table.bands) {
    const x = left + band.start * width + 0.75;
    const w = Math.max((band.end - band.start) * width - 1.5, 1);
    const colour: Rgb = band.applies ? NAVY : band.annualPrice === null ? RULE : NAVY_SOFT;

    if (band.applies) doc.rect(x - 2, barTop - 2.5, w + 4, barHeight + 5, NAVY_HALO);
    doc.rect(x, barTop, w, barHeight, colour);

    // The ages under the segment — only where they fit inside it.
    const face = band.applies ? 'bold' : 'regular';
    const labelWidth = widthOf(band.ageLabel, 7.5, face);
    if (labelWidth <= w + 3) {
      doc.y = barTop + barHeight + 4;
      doc.text(band.ageLabel, x + w / 2 - labelWidth / 2, 7.5, face, band.applies ? NAVY : MUTED);
    }

    // The figure above the band that priced this comparison, as a navy pill
    // with a stem down to its segment.
    if (band.applies) {
      const pillWidth = widthOf(band.display, 8, 'bold') + 14;
      const centre = x + w / 2;
      const pillLeft = Math.min(Math.max(centre - pillWidth / 2, left), left + width - pillWidth);
      const pillTop = barTop - pillRoom + 2;
      doc.rect(pillLeft, pillTop, pillWidth, pillHeight, NAVY);
      doc.rect(centre - 1, pillTop + pillHeight, 2, pillRoom - pillHeight - 4, NAVY);
      doc.y = pillTop + 4;
      doc.text(band.display, pillLeft + 7, 8, 'bold', WHITE);
    }
  }

  // The customer's own age, pinned on the bar: a white ring with a navy dot.
  if (table.marker !== null) {
    const cx = left + table.marker * width;
    const cy = barTop + barHeight / 2;
    doc.circle(cx, cy, 4.5, WHITE);
    doc.circle(cx, cy, 2.75, NAVY);
  }

  // The legend.
  doc.y = barTop + barHeight + ageRoom + 4;
  let legendLeft = left;
  const legend: [Rgb, string][] = [
    [NAVY, 'This comparison'],
    [NAVY_SOFT, 'Other ages'],
    [RULE, NOT_SOLD_AT_AGE_LABEL],
  ];
  for (const [colour, label] of legend) {
    doc.rect(legendLeft, doc.y + 1, 7, 7, colour);
    doc.text(label, legendLeft + 11, 7.5, 'regular', MUTED);
    legendLeft += 11 + widthOf(label, 7.5, 'regular') + 14;
  }
  doc.y += legendRoom;

  // --- the list -------------------------------------------------------------
  for (const band of table.bands) {
    if (band.applies) {
      highlightedRow(doc, `Ages ${band.ageLabel}  ·  this comparison`, band.display);
    } else {
      row(doc, `Ages ${band.ageLabel}`, band.display);
    }
  }
}

/** Build the document. Returns the blob and the name it should be saved under. */
export function buildPlanDocument(input: PlanDocumentInput): { blob: Blob; filename: string } {
  const { plan } = input;
  const benefits = presentCoreBenefits(plan);
  const ages = plan.pricedEmployeeCount === null ? (input.ages ?? null) : null;

  const doc = new PdfDocument(
    48,
    /**
     * Repeated on every page, so a table that spills over is still headed and
     * a loose second page still says which plan it belongs to.
     */
    (d, page) => {
      d.rect(0, 0, d.width, 4, NAVY);
      d.y = 34;
      d.text('HADBROK', d.margin, 15, 'bold', NAVY);
      d.textRight(
        page === 1 ? 'Plan details' : `${plan.companyName} — ${plan.planName} (continued)`,
        d.width - d.margin,
        9,
        'regular',
        MUTED,
      );
      d.y = 52;
      d.text('Insurance Aggregator', d.margin, 8, 'regular', MUTED);
      d.y = 74;
    },
    (d, page) => {
      d.line(d.margin, d.y - 8, d.width - d.margin, RULE, 0.4);
      d.text('Generated by Hadbrok Insurance Aggregator', d.margin, 8, 'regular', MUTED);
      d.textRight(`Page ${page}`, d.width - d.margin, 8, 'regular', MUTED);
    },
  );

  // --- who and what -------------------------------------------------------
  doc.y += 6;
  doc.text(plan.companyName, doc.margin, 11, 'regular', MUTED);
  doc.y += 16;
  doc.text(plan.planName, doc.margin, 22, 'bold', NAVY);
  doc.y += 28;
  doc.text(
    [plan.customerTypeLabel, plan.geographicalCoverageLabel, plan.currency]
      .filter(Boolean)
      .join('  ·  '),
    doc.margin,
    10,
    'regular',
    MUTED,
  );
  doc.y += 26;

  // --- the two figures a customer reads first ------------------------------
  const half = (doc.contentWidth - 12) / 2;
  doc.rect(doc.margin, doc.y, half, 62, WASH);
  doc.rect(doc.margin + half + 12, doc.y, half, 62, WASH);
  const boxTop = doc.y;
  doc.y += 14;
  doc.text('ANNUAL PREMIUM', doc.margin + 14, 8, 'bold', MUTED);
  doc.text('ANNUAL LIMIT', doc.margin + half + 26, 8, 'bold', MUTED);
  doc.y += 18;
  doc.text(presentPremium(plan), doc.margin + 14, 16, 'bold', NAVY);
  doc.text(presentAnnualLimit(plan), doc.margin + half + 26, 16, 'bold', NAVY);
  doc.y += 20;
  doc.text(
    plan.pricedEmployeeCount !== null
      ? `estimated for ${plan.pricedEmployeeCount} ${plan.pricedEmployeeCount === 1 ? 'employee' : 'employees'}`
      : ages
        ? `per year at ${describeAges(ages)}`
        : 'per year',
    doc.margin + 14,
    8,
    'regular',
    MUTED,
  );
  doc.text('maximum payable per policy year', doc.margin + half + 26, 8, 'regular', MUTED);
  doc.y = boxTop + 62 + 8;

  if (input.description) {
    section(doc, 'About this plan');
    doc.paragraph(input.description, 10, 'regular', INK);
  }

  // --- every age the plan is sold at, with this comparison's band marked ---
  priceTablePanel(doc, input);

  // --- the seven, always seven and always in order --------------------------
  section(doc, 'Core benefits & coverage');
  for (const benefit of benefits) {
    row(doc, benefit.name, benefit.display, true);
    for (const limitation of benefit.limitations) {
      doc.ensure(12);
      doc.text(`— ${limitation}`, doc.margin + 12, 8.5, 'regular', MUTED);
      doc.y += 12;
    }
  }

  if (input.additional.length) {
    section(doc, 'Additional benefits');
    for (const benefit of input.additional) {
      row(doc, benefit.name, benefit.value ?? 'Covered');
      for (const detail of benefit.details) {
        for (const line of wrap(detail, doc.contentWidth - 16, 8.5, 'regular')) {
          doc.ensure(12);
          doc.text(line, doc.margin + 12, 8.5, 'regular', MUTED);
          doc.y += 11;
        }
      }
    }
  }

  section(doc, 'Plan information');
  row(doc, 'Plan type', plan.customerTypeLabel);
  row(doc, 'Coverage', plan.geographicalCoverageLabel);
  row(doc, 'Currency', plan.currency ?? '—');
  row(doc, 'Annual premium', presentPremium(plan));
  row(doc, 'Annual limit', presentAnnualLimit(plan));
  if (plan.medicalNetworkName) {
    // The name only — never the tier. With a list on file the panel names the
    // network itself; without one, a plain row does.
    if (plan.medicalNetworkId && plan.medicalNetworkHasProviderList) {
      providerListPanel(doc, plan.medicalNetworkName, providerListUrl(plan.medicalNetworkId));
    } else {
      row(doc, 'Medical network', plan.medicalNetworkName);
    }
  }
  if (plan.pricedEmployeeCount !== null) {
    row(doc, 'Employees priced', String(plan.pricedEmployeeCount));
  }

  for (const [title, lines] of [
    ['Waiting periods', input.waitingPeriods],
    ['Conditions', input.conditions],
    ['Exclusions', input.exclusions],
  ] as const) {
    if (!lines.length) continue;
    section(doc, title);
    for (const line of lines) doc.paragraph(line, 9.5, 'regular', INK);
  }

  return {
    blob: doc.build(),
    filename: planDocumentFilename(plan.companyName, plan.planName),
  };
}

/** Build the document and hand it to the browser. */
export function downloadPlanDocument(input: PlanDocumentInput) {
  const { blob, filename } = buildPlanDocument(input);
  downloadBlob(blob, filename);
  return filename;
}
