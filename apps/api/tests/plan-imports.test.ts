/**
 * THE PLAN IMPORT, WITHOUT ANTHROPIC.
 *
 * The reader is scripted: it plays back the answer the real model gave for
 * the Arope document (docs/plan-import-trial-output.json) in pieces, the way
 * a stream arrives. What is proved here is everything around the model — the
 * Word conversion, the prompt, the progress read off the stream, the job's
 * stages, the validation — and that the HTTP route drives it.
 *
 * The Word document is built inside the test from XML, so no fixture file is
 * needed and the converter is held to the structure Word actually writes.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { strToU8, zipSync } from 'fflate';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  docxToMarkdown,
  documentXmlToMarkdown,
} from '../src/modules/plan-imports/docx-to-markdown.js';
import {
  SYSTEM_PROMPT_TEMPLATE,
  USER_MESSAGE_TEMPLATE,
  fillTemplate,
} from '../src/modules/plan-imports/plan-import.prompt.js';
import {
  AnswerProgress,
  buildPrompt,
  clearPlanImports,
  createPlanImport,
  getPlanImport,
  overridePlanImportDependencies,
  type PlanImportContext,
  type PlanReader,
} from '../src/modules/plan-imports/plan-imports.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const TRIAL_ANSWER = readFileSync(
  resolve(here, '../../../docs/plan-import-trial-output.json'),
  'utf8',
);
const PROMPT_DOC = readFileSync(resolve(here, '../../../docs/plan-import-prompt.md'), 'utf8');

const context: PlanImportContext = {
  catalogueBenefitNames: ['Room Type', 'Hepatitis B & C'],
  currencies: ['EGP'],
};

/** A Word document: the given body XML wrapped the way Word writes it. */
function docx(bodyXml: string): Uint8Array {
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${bodyXml}<w:sectPr/></w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types/>'),
    'word/document.xml': strToU8(document),
  });
}

const p = (text: string, style?: string, list = false) =>
  `<w:p>` +
  (style || list
    ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}</w:pPr>`
    : '') +
  `<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const cell = (...paragraphs: string[]) => `<w:tc>${paragraphs.join('')}</w:tc>`;
const row = (...cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`;

/** The scripted reader: the trial answer, in pieces, with a breath between. */
const playback = (answer: string, pieceSize = 700): PlanReader =>
  async function* () {
    for (let at = 0; at < answer.length; at += pieceSize) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      yield answer.slice(at, at + pieceSize);
    }
  };

async function untilSettled(id: string) {
  for (let i = 0; i < 400; i += 1) {
    const job = getPlanImport(id);
    if (job && (job.status === 'DONE' || job.status === 'FAILED')) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('The import did not finish.');
}

afterEach(() => {
  clearPlanImports();
  overridePlanImportDependencies(null);
});

describe('a Word document becomes Markdown', () => {
  it('keeps headings, paragraphs, lists and every table as a table', () => {
    const markdown = docxToMarkdown(
      docx(
        p('Arope SME Plans', 'Heading1') +
          p('Three plans are offered.') +
          p('Minimum group size 10', undefined, true) +
          `<w:tbl>${row(cell(p('Benefit')), cell(p('Platinum')), cell(p('Silver')))}${row(
            cell(p('Annual Limit')),
            cell(p('200,000 EGP')),
            cell(p('100,000 EGP')),
          )}${row(
            cell(p('Dental')),
            cell(p('Limit: 1,500 EGP'), p('Co-payment: 10%')),
            cell(`<w:p><w:r><w:t>Limit: 1,000</w:t><w:br/><w:t>Basic | only</w:t></w:r></w:p>`),
          )}</w:tbl>`,
      ),
    );

    expect(markdown).toBe(
      [
        '# Arope SME Plans',
        'Three plans are offered.',
        '- Minimum group size 10',
        [
          '| Benefit | Platinum | Silver |',
          '| --- | --- | --- |',
          '| Annual Limit | 200,000 EGP | 100,000 EGP |',
          // Two paragraphs in one cell, and a line break, both read as " / ";
          // a pipe in the text cannot break the table.
          '| Dental | Limit: 1,500 EGP / Co-payment: 10% | Limit: 1,000 / Basic \\| only |',
        ].join('\n'),
      ].join('\n\n'),
    );
  });

  it('reads text inside hyperlinks and content controls, and skips empty paragraphs', () => {
    const xml =
      `<w:document xmlns:w="w"><w:body>` +
      `<w:p/><w:p><w:hyperlink><w:r><w:t>See</w:t></w:r></w:hyperlink><w:r><w:t xml:space="preserve"> the table</w:t></w:r></w:p>` +
      `<w:sdt><w:sdtContent>${p('Inside a control')}</w:sdtContent></w:sdt>` +
      `</w:body></w:document>`;
    expect(documentXmlToMarkdown(xml)).toBe('See the table\n\nInside a control');
  });

  it('refuses a file that is not a Word document', () => {
    expect(() => docxToMarkdown(strToU8('just some text'))).toThrow('not a Word document');
    expect(() => docxToMarkdown(zipSync({ 'readme.txt': strToU8('x') }))).toThrow(
      'no document body',
    );
  });
});

describe('the prompt', () => {
  it('is the audit document, character for character', () => {
    const blocks = [...PROMPT_DOC.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1]);
    expect(blocks[0]).toBe(SYSTEM_PROMPT_TEMPLATE);
    expect(blocks[1]).toBe(USER_MESSAGE_TEMPLATE);
  });

  it('is filled in completely', () => {
    const prompt = buildPrompt(
      { companyName: 'Arope Insurance', customerType: 'SME', fileName: 'plans.docx' },
      '| Plan | Limit |\n| --- | --- |\n| Gold | 100 |',
      context,
    );
    expect(prompt.system).not.toContain('{{');
    expect(prompt.user).not.toContain('{{');
    expect(prompt.system).toContain('The insurer it belongs to: Arope Insurance.');
    expect(prompt.system).toContain(
      'Additional benefits already defined: Room Type, Hepatitis B & C',
    );
    expect(prompt.system).toContain('Core areas: In-patient, Out-patient, Maternity');
    expect(prompt.user).toContain('| Gold | 100 |');
    expect(prompt.user).toContain('File name: plans.docx');
  });

  it('leaves a placeholder it has no value for, so a gap is visible', () => {
    expect(fillTemplate('a {{x}} b {{y}}', { x: '1' })).toBe('a 1 b {{y}}');
  });
});

describe('progress is read off the stream', () => {
  it('learns the plan count from planNames and counts each plan as it closes', () => {
    const progress = new AnswerProgress();
    const seen: number[] = [];
    for (let at = 0; at < TRIAL_ANSWER.length; at += 300) {
      progress.feed(TRIAL_ANSWER.slice(at, at + 300));
      seen.push(progress.plansCompleted);
    }
    expect(progress.planNames).toEqual(['Platinum Plan', 'Premier Plan', 'Silver Plan']);
    expect(progress.plansCompleted).toBe(3);
    // Monotonic, one at a time: never a jump, never a step back.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]! - seen[i - 1]!).toBeGreaterThanOrEqual(0);
      expect(seen[i]! - seen[i - 1]!).toBeLessThanOrEqual(1);
    }
  });

  it('is not fooled by braces or "plans" inside strings', () => {
    const progress = new AnswerProgress();
    progress.feed(
      '{"document":{"title":"{plans} \\"quoted\\""},"planNames":["A"],"plans":[{"name":"A","x":{"y":[1,{}]}}]}',
    );
    expect(progress.planNames).toEqual(['A']);
    expect(progress.plansCompleted).toBe(1);
  });
});

describe('the import job', () => {
  const input = {
    companyId: 'company_1',
    companyName: 'Arope Insurance',
    customerType: 'SME' as const,
    fileName: 'Arope SME.docx',
    file: docx(p('Plans', 'Heading1') + p('Platinum 200,000 EGP')),
  };

  it('moves through the stages and ends with the whole answer', async () => {
    const started = createPlanImport(input, {
      reader: playback(TRIAL_ANSWER),
      loadContext: async () => context,
    });
    expect(started.status).toBe('CONVERTING');
    expect(started.percent).toBe(0);
    expect(started.result).toBeNull();

    // The bar only ever goes forward, and reading reports the plans as they land.
    let last = 0;
    let sawReading = false;
    for (let i = 0; i < 400; i += 1) {
      const job = getPlanImport(started.id)!;
      expect(job.percent).toBeGreaterThanOrEqual(last);
      last = job.percent;
      if (job.status === 'READING' && job.plansCompleted > 0) {
        sawReading = true;
        expect(job.planNames).toEqual(['Platinum Plan', 'Premier Plan', 'Silver Plan']);
      }
      if (job.status === 'DONE') break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const done = await untilSettled(started.id);
    expect(sawReading).toBe(true);
    expect(done.status).toBe('DONE');
    expect(done.percent).toBe(100);
    expect(done.plansCompleted).toBe(3);
    expect(done.result?.plans.map((plan) => plan.name)).toEqual([
      'Platinum Plan',
      'Premier Plan',
      'Silver Plan',
    ]);
    expect(done.result?.plans[0]?.variants[0]?.annualLimit).toBe(200000);
    expect(done.error).toBeNull();
  });

  it('fails in words when the reader cannot read', async () => {
    const started = createPlanImport(input, {
      // eslint-disable-next-line require-yield
      reader: async function* () {
        throw new Error('The server has no Anthropic API key.');
      },
      loadContext: async () => context,
    });
    const failed = await untilSettled(started.id);
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toBe('The server has no Anthropic API key.');
  });

  it('fails when the answer is not the shape the review screen needs', async () => {
    const started = createPlanImport(input, {
      reader: playback('{"planNames":["A"],"plans":"not an array"}'),
      loadContext: async () => context,
    });
    const failed = await untilSettled(started.id);
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toContain('expected shape');
  });

  it('fails before reading when the file is not a Word document', async () => {
    const started = createPlanImport(
      { ...input, file: strToU8('plain text') },
      { reader: playback(TRIAL_ANSWER), loadContext: async () => context },
    );
    const failed = await untilSettled(started.id);
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toContain('not a Word document');
  });

  it('forgets a job it never had', () => {
    expect(getPlanImport('nothing')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Through the HTTP route, against the test database.
// ---------------------------------------------------------------------------

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const PREFIX = `test_import_${Date.now()}`;

describe.skipIf(!url)('the plan-imports route', () => {
  let server: Server | undefined;
  let base = '';
  let companyId = '';

  beforeAll(async () => {
    const company = await prisma!.company.create({ data: { name: `${PREFIX}_company` } });
    companyId = company.id;
    const { createApp } = await import('../src/app.js');
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await prisma!.company.deleteMany({ where: { id: companyId } });
    await prisma!.$disconnect();
  });

  const upload = (name: string, bytes: Uint8Array, query: string) => {
    const form = new FormData();
    form.append('file', new Blob([bytes]), name);
    return fetch(`${base}/plan-imports?${query}`, { method: 'POST', body: form });
  };

  it('starts a job for a Word document and reports on it until the answer is ready', async () => {
    overridePlanImportDependencies({
      reader: playback(TRIAL_ANSWER),
      loadContext: async () => context,
    });

    const response = await upload(
      'Arope.docx',
      docx(p('Plans')),
      `companyId=${companyId}&customerType=SME`,
    );
    expect(response.status).toBe(202);
    const started = (await response.json()) as { data: { id: string; status: string } };
    expect(started.data.status).toBe('CONVERTING');

    interface PolledJob {
      status: string;
      percent: number;
      result: { plans: unknown[] } | null;
    }
    let job: PolledJob | null = null;
    for (let i = 0; i < 400; i += 1) {
      const poll = await fetch(`${base}/plan-imports/${started.data.id}`);
      expect(poll.status).toBe(200);
      job = ((await poll.json()) as { data: PolledJob }).data;
      if (job && (job.status === 'DONE' || job.status === 'FAILED')) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(job?.status).toBe('DONE');
    expect(job?.result?.plans).toHaveLength(3);
  });

  it('refuses anything but a Word document', async () => {
    const response = await upload(
      'notes.txt',
      strToU8('hello'),
      `companyId=${companyId}&customerType=SME`,
    );
    expect(response.status).toBe(400);
  });

  it('refuses a company that does not exist, and a section that does not', async () => {
    const missing = await upload('a.docx', docx(p('x')), 'companyId=nope&customerType=SME');
    expect(missing.status).toBe(404);
    const section = await upload('a.docx', docx(p('x')), `companyId=${companyId}&customerType=VIP`);
    expect(section.status).toBe(400);
  });

  it('answers 404 for a job it does not have', async () => {
    const response = await fetch(`${base}/plan-imports/never`);
    expect(response.status).toBe(404);
  });
});
