/**
 * THE IMPORT JOB — one uploaded document, read in the background.
 *
 * Reading a document takes a minute or two, longer than a request should
 * hold a connection open, so the upload starts a JOB and answers at once with
 * its id. The screen then asks where the job is until it is DONE or FAILED,
 * and shows the answer for review. Nothing here writes a plan: publishing is
 * the review screen's decision, made through the ordinary plan endpoints.
 *
 * Jobs live in memory on this process. They are working state for one
 * employee's screen, not records: a restart loses them and the employee
 * uploads again, which costs one more read of the document and nothing else.
 *
 * The model call is behind `PlanReader` so the runner can be exercised with a
 * scripted answer, and the catalogue lookup behind `PlanImportContext` so it
 * can run without a database.
 */

import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  OPTIONAL_MEDICAL_BENEFITS,
  PLAN_IMPORT_MAX_OUTPUT_TOKENS,
  PLAN_IMPORT_MODEL,
  PLAN_IMPORT_TYPICAL_PLAN_CHARS,
  planImportPercent,
  type CustomerTypeId,
  type PlanImportJobDto,
  type PlanImportStatus,
} from '@aggregator/shared';
import { env } from '../../config/env.js';
import { getPrisma } from '../../lib/prisma.js';
import { docxToMarkdown } from './docx-to-markdown.js';
import { importedDocumentSchema } from './imported-document.schema.js';
import {
  CORE_AREA_NAMES,
  OUTPUT_SCHEMA,
  SYSTEM_PROMPT_TEMPLATE,
  USER_MESSAGE_TEMPLATE,
  fillTemplate,
} from './plan-import.prompt.js';

/** Anthropic's own endpoint, whatever `ANTHROPIC_BASE_URL` a shell carries. */
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

/** A finished job is kept this long for the screen to collect. */
const JOB_TTL_MS = 2 * 60 * 60 * 1000;

export interface PlanImportInput {
  companyId: string;
  companyName: string;
  customerType: CustomerTypeId;
  fileName: string;
  /** The `.docx` bytes. */
  file: Uint8Array;
}

/** The two halves of the prompt, filled in. */
export interface FilledPrompt {
  system: string;
  user: string;
}

/**
 * Whatever reads the document: yields the answer's text as it arrives, and
 * finishes when the answer is complete. The real one streams from Anthropic.
 */
export type PlanReader = (prompt: FilledPrompt) => AsyncIterable<string>;

/** What the prompt lists as already known to the broker. */
export interface PlanImportContext {
  /** Additional benefits the catalogue already has, by name. */
  catalogueBenefitNames: string[];
  /** Currencies plans are already priced in. */
  currencies: string[];
}

export interface PlanImportDependencies {
  reader: PlanReader;
  loadContext: () => Promise<PlanImportContext>;
}

interface StoredJob {
  dto: PlanImportJobDto;
  expiresAt: number;
}

const jobs = new Map<string, StoredJob>();

function sweepExpired(now = Date.now()): void {
  for (const [id, job] of jobs) if (job.expiresAt <= now) jobs.delete(id);
}

/** A copy, so nothing outside can move a job along. */
function snapshot(dto: PlanImportJobDto): PlanImportJobDto {
  return { ...dto, planNames: [...dto.planNames] };
}

export function getPlanImport(id: string): PlanImportJobDto | null {
  sweepExpired();
  const job = jobs.get(id);
  return job ? snapshot(job.dto) : null;
}

/**
 * WHERE THE ANSWER HAS GOT TO, read off the stream as it arrives.
 *
 * The answer is one JSON object. The model is asked to announce `planNames`
 * before the plans, so the moment that array closes the bar knows how many
 * plans to expect; after that, every plan object that closes inside `plans`
 * is one more done. A small tokenizer — strings, escapes, nesting depth — is
 * enough to see those two things without parsing anything.
 */
export class AnswerProgress {
  planNames: string[] = [];
  plansCompleted = 0;

  /** Characters received so far, and where the last finished plan ended. */
  private chars = 0;
  private charsAtLastPlan = 0;

  private text = '';
  private inString = false;
  private escaped = false;
  private depth = 0;
  private currentString = '';
  private lastKeyAtTop: string | null = null;
  private plansDepth: number | null = null;
  private namesFound = false;

  feed(delta: string): void {
    this.text += delta;
    this.chars += delta.length;
    for (const char of delta) this.step(char);
    if (!this.namesFound) this.readPlanNames();
  }

  /**
   * How far through the plans the answer is, 0–1, moving WITHIN a plan too.
   *
   * A plan takes half a minute to write, and a bar that only moves when one
   * finishes looks frozen for all of it. So the part-plan in progress counts
   * for how much of a typical plan's text has arrived — the document's own
   * finished plans set that size once there is one — capped short of a whole
   * plan, because only the closing brace says a plan is done.
   */
  fraction(): number {
    const announced = this.planNames.length;
    if (announced === 0) return 0;
    const perPlan =
      this.plansCompleted > 0
        ? this.charsAtLastPlan / this.plansCompleted
        : PLAN_IMPORT_TYPICAL_PLAN_CHARS;
    const partial = Math.min(0.9, (this.chars - this.charsAtLastPlan) / perPlan);
    return Math.min(1, (this.plansCompleted + partial) / announced);
  }

  private step(char: string): void {
    if (this.inString) {
      if (this.escaped) {
        this.escaped = false;
        this.currentString += char;
      } else if (char === '\\') {
        this.escaped = true;
      } else if (char === '"') {
        this.inString = false;
        // A key at the top level is remembered until its value starts.
        if (this.depth === 1) this.lastKeyAtTop = this.currentString;
      } else {
        this.currentString += char;
      }
      return;
    }

    switch (char) {
      case '"':
        this.inString = true;
        this.currentString = '';
        break;
      case '{':
        this.depth += 1;
        break;
      case '[':
        if (this.depth === 1 && this.lastKeyAtTop === 'plans' && this.plansDepth === null) {
          // The plans array: its elements open at depth 2 and close back to it.
          this.plansDepth = 2;
        }
        this.depth += 1;
        break;
      case '}':
        this.depth -= 1;
        if (this.plansDepth !== null && this.depth === this.plansDepth) {
          this.plansCompleted += 1;
          this.charsAtLastPlan = this.chars;
        }
        break;
      case ']':
        this.depth -= 1;
        if (this.plansDepth !== null && this.depth < this.plansDepth) this.plansDepth = -1;
        break;
      case ':':
        break;
      default:
        break;
    }
  }

  private readPlanNames(): void {
    const match = /"planNames"\s*:\s*\[((?:\s*"(?:[^"\\]|\\.)*"\s*,?)*)\s*\]/.exec(this.text);
    if (!match) return;
    try {
      const names = JSON.parse(`[${match[1]}]`) as unknown;
      if (Array.isArray(names) && names.every((name) => typeof name === 'string')) {
        this.planNames = names as string[];
        this.namesFound = true;
      }
    } catch {
      // The array is still being written; try again on the next delta.
    }
  }
}

/** Streams the model's answer from Anthropic. */
export const anthropicReader: PlanReader = async function* (prompt) {
  if (!env.anthropicApiKey) {
    throw new Error(
      'The server has no Anthropic API key. Set ANTHROPIC_API_KEY on the API and try again.',
    );
  }
  const client = new Anthropic({ apiKey: env.anthropicApiKey, baseURL: ANTHROPIC_BASE_URL });
  const stream = client.messages.stream({
    model: PLAN_IMPORT_MODEL,
    max_tokens: PLAN_IMPORT_MAX_OUTPUT_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> },
    },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === 'max_tokens') {
    throw new Error(
      'The document has more plans than can be read in one go. Split it into smaller documents and import each.',
    );
  }
};

/** What the broker already knows, read from the database. */
export async function loadPlanImportContext(): Promise<PlanImportContext> {
  const prisma = getPrisma();
  const [options, configurations] = await Promise.all([
    prisma.insuranceOption.findMany({ where: { isActive: true }, select: { name: true } }),
    prisma.planConfiguration.findMany({
      where: { currency: { not: null } },
      select: { currency: true },
      distinct: ['currency'],
    }),
  ]);

  const core = new Set(CORE_AREA_NAMES.map((name) => name.toLowerCase()));
  const names = new Map<string, string>();
  for (const name of [
    ...OPTIONAL_MEDICAL_BENEFITS.map((spec) => spec.name),
    ...options.map((option) => option.name),
  ]) {
    const key = name.trim().toLowerCase();
    if (!core.has(key) && !names.has(key)) names.set(key, name.trim());
  }

  const currencies = configurations
    .map((configuration) => configuration.currency)
    .filter((currency): currency is string => typeof currency === 'string' && currency !== '');

  return {
    catalogueBenefitNames: [...names.values()].sort((a, b) => a.localeCompare(b)),
    currencies: currencies.length > 0 ? currencies.sort() : ['EGP'],
  };
}

const defaultDependencies: PlanImportDependencies = {
  reader: anthropicReader,
  loadContext: loadPlanImportContext,
};

let activeDependencies: PlanImportDependencies = defaultDependencies;

/**
 * For tests that go through the HTTP route: read with a scripted answer
 * instead of Anthropic. `null` restores the real reader.
 */
export function overridePlanImportDependencies(
  dependencies: Partial<PlanImportDependencies> | null,
): void {
  activeDependencies = dependencies
    ? { ...defaultDependencies, ...dependencies }
    : defaultDependencies;
}

/** The prompt for one document, filled in. Exported for the tests. */
export function buildPrompt(
  input: Pick<PlanImportInput, 'companyName' | 'customerType' | 'fileName'>,
  markdown: string,
  context: PlanImportContext,
): FilledPrompt {
  const values = {
    companyName: input.companyName,
    customerType: input.customerType,
    fileName: input.fileName,
    documentMarkdown: markdown,
    coreBenefitNames: CORE_AREA_NAMES.join(', '),
    catalogueBenefitNames: context.catalogueBenefitNames.join(', '),
    currencies: context.currencies.join(', '),
  };
  return {
    system: fillTemplate(SYSTEM_PROMPT_TEMPLATE, values),
    user: fillTemplate(USER_MESSAGE_TEMPLATE, values),
  };
}

/** What the employee is told when a stage throws. */
function describeFailure(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `Anthropic could not read the document (HTTP ${error.status}): ${error.message}`;
  }
  if (error instanceof Error && error.message !== '') return error.message;
  return 'The document could not be read.';
}

async function run(
  job: StoredJob,
  input: PlanImportInput,
  dependencies: PlanImportDependencies,
): Promise<void> {
  const dto = job.dto;
  const move = (status: PlanImportStatus, fraction = 0) => {
    dto.status = status;
    dto.percent = Math.max(dto.percent, planImportPercent(status, fraction));
  };

  try {
    // 1. The document, as text the model can read.
    move('CONVERTING');
    const markdown = docxToMarkdown(input.file);
    if (markdown.trim() === '') {
      throw new Error('The document has no readable text. Check that it is the right file.');
    }

    // 2. The prompt, with what the broker already knows.
    move('SENDING');
    const prompt = buildPrompt(input, markdown, await dependencies.loadContext());

    // 3. The answer, plan by plan.
    move('READING');
    const progress = new AnswerProgress();
    let text = '';
    for await (const delta of dependencies.reader(prompt)) {
      text += delta;
      progress.feed(delta);
      dto.planNames = progress.planNames;
      dto.plansCompleted = progress.plansCompleted;
      move('READING', progress.fraction());
    }

    // 4. A whole answer, or none.
    move('VALIDATING');
    const parsed = importedDocumentSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error('The answer did not have the expected shape. Try the import again.');
    }
    dto.result = parsed.data;
    dto.planNames = parsed.data.planNames;
    dto.plansCompleted = parsed.data.plans.length;
    move('DONE');
  } catch (error) {
    dto.status = 'FAILED';
    dto.error = describeFailure(error);
    console.error(`[plan-import ${dto.id}] failed:`, error);
  }
}

/**
 * Start reading a document. Answers at once with the job; the reading
 * continues in the background and `getPlanImport` reports on it.
 */
export function createPlanImport(
  input: PlanImportInput,
  dependencies: PlanImportDependencies = activeDependencies,
): PlanImportJobDto {
  sweepExpired();
  const dto: PlanImportJobDto = {
    id: randomUUID(),
    companyId: input.companyId,
    customerType: input.customerType,
    fileName: input.fileName,
    status: 'CONVERTING',
    percent: 0,
    planNames: [],
    plansCompleted: 0,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  const job: StoredJob = { dto, expiresAt: Date.now() + JOB_TTL_MS };
  jobs.set(dto.id, job);

  // Taken BEFORE the run starts: the run's first stage is synchronous, and the
  // caller is owed the job as it was when it asked, not one stage along.
  const started = snapshot(dto);
  // Not awaited: the request that started the job returns now.
  void run(job, input, dependencies);
  return started;
}

/** For tests: forget every job. */
export function clearPlanImports(): void {
  jobs.clear();
}
