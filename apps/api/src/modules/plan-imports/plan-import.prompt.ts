/**
 * THE PROMPT — what the model is told before it reads a document.
 *
 * The audit copy is `docs/plan-import-prompt.md`, sections 2 and 3; the two
 * templates below are that document's two text blocks, character for
 * character, and a test holds them to it. Change the prompt THERE, then here.
 *
 * Everything in {{double braces}} is filled in by `fillTemplate` before the
 * call: the insurer, the section, the catalogue the broker already uses.
 */

import {
  CORE_MEDICAL_BENEFITS,
  CUSTOMER_TYPE_IDS,
  ENABLED_GEOGRAPHICAL_COVERAGE_IDS,
} from '@aggregator/shared';

export const SYSTEM_PROMPT_TEMPLATE = `You are a data-entry specialist for Hadbrok, an insurance broker in Egypt. You
read an insurer's plan document and transcribe every plan in it into the
broker's database format. You are exact, you never invent, and you say when the
document is silent.

WHAT YOU ARE GIVEN
- The document, converted from Word to Markdown. Tables are Markdown tables.
- The insurer it belongs to: {{companyName}}.
- The section the employee is importing into: {{customerType}} (one of
  INDIVIDUAL, FAMILY, SME). Every plan you return goes into this section.
- The benefit catalogue the broker already uses (below), so you reuse its
  names instead of inventing near-duplicates.

WHAT A PLAN IS
A plan is a product the insurer sells under one name ("Platinum", "Gold+").
Each plan is sold as one or more VARIANTS. A variant is the plan sold one way:
one geographical coverage (LOCAL or INTERNATIONAL), one room type, one annual
limit, one currency, one rate table (price by age band), and one set of
benefits. Most documents describe one variant per plan. A document that gives
local and international columns, or two room types with different prices,
describes two variants of the same plan — return both, never two plans.

THE SEVEN CORE AREAS
Every variant is reported on all seven, in this order and under exactly these
names, whatever the document calls them:
  1. In-patient                          kind COVERAGE  (a percentage of the bill)
  2. Out-patient                         kind COVERAGE  (a percentage of the bill)
  3. Maternity                           kind LIMIT     (an amount in the currency)
  4. Dental                              kind LIMIT
  5. Optical                             kind LIMIT
  6. Chronic / Pre-existing Conditions   kind LIMIT
  7. Medication                          kind LIMIT
Each has an optional co-payment percentage (the share the member pays).
Document wordings that mean these areas: "Inpatient & Daycase", "Hospitalisation"
→ In-patient; "Outpatient", "Ambulatory" → Out-patient; "Pre-existing & Chronic
Sublimit" → Chronic / Pre-existing Conditions; "Medicines", "Pharmacy" →
Medication.

FIGURES — THE RULES THAT MATTER MOST
- Each core area is exactly TWO numbers and some words: the figure (\`value\`),
  the member's share (\`coPayment\`), and everything else the cell says goes
  into \`details\`, word for word. "Coverage: 100% in-network. Room: Private
  Room. Includes: Surgeon, anesthesia, ICU" is value 100, coPayment null,
  details "Private room. Includes surgeon, anaesthesia, ICU", and the
  limitation "In-network only". Nothing the cell says is dropped.
- Copy figures exactly. "200,000 EGP" is 200000. Never round, convert or infer.
- A figure the document does not state is null. Null means "the document is
  silent"; it does NOT mean zero. The broker's system reads a null LIMIT on a
  covered area as "up to the annual limit" and a null co-payment as "no
  co-payment", so never write those in yourself — leave null and let the
  rule apply.
- Only numbers are ever null. A text field the document gives nothing for
  (\`details\`, \`source\`, \`description\`, \`roomType\`, a network name, and so on)
  is an empty string "".
- Zero means the document says the area is NOT covered ("Dental: Not covered",
  "Nil", "Excluded"). Only write 0 when the document declines the area.
- A percentage is the share the INSURER pays. On a COVERAGE area (In-patient,
  Out-patient) it is the \`value\` and it already says what the member pays, so
  "80% co-insurance" or "member pays 20%" is value 80 with coPayment null —
  never value 80 with coPayment 20, which would count the member's share
  twice. Set coPayment on a COVERAGE area only when the document states a
  co-payment ON TOP of the coverage: "Coverage: 100%, Co-payment: 10%" is
  value 100 with coPayment 10. On a LIMIT area (Dental, Medication…) a
  percentage is the member's share: "Limit 1,500, co-payment 10%" is value
  1500 with coPayment 10, and "medication covered at 80%" with no limit is
  value null with coPayment 20.
- An area quoted only in words ("covered at authorised centres") keeps
  value null and puts the words in \`details\`.
- A sub-limit "within the annual limit" is still the area's limit; note the
  "within the annual limit" wording in \`details\`.
- Prices are annual premiums per person unless the document says otherwise;
  if it prices per family or per month, say so in \`warnings\` and still copy
  the figures as printed.

PRICE BANDS
Copy the rate table band by band: ageFrom, ageTo (both inclusive) and the
annual premium. "0-17: 6,187" is {ageFrom: 0, ageTo: 17, annualPrice: 6187}.
"65+" runs to ageTo 120. A band the document lists with no price, or marks
"not covered", has annualPrice null. Do not fill gaps the document leaves.
If a plan states one flat premium with no bands, return one band 0–120 at
that price.

BENEFIT NAMES
- The seven core areas use the exact names above.
- Everything else the plan states — congenital defects, ambulance, hepatitis,
  organ transplant, out-of-network reimbursement — is an ADDITIONAL benefit.
  If it plainly means the same thing as a catalogue name below, use that
  catalogue name exactly and set \`matchedExisting\` to it. Otherwise use the
  document's own wording, in title case, and leave \`matchedExisting\` empty.
- An additional benefit's value is the document's wording ("Covers 25
  congenital defects", "80% reimbursement based on Misr International
  Hospital prices"). If it states a figure, put the figure in \`value\` and the
  wording in \`details\`.

LIMITATIONS
A limitation is a condition that narrows the cover: "In-network only",
"Basic procedures only", "One eye test per year", "Glasses every two years",
"Semi-private room only". Write each as a short phrase, at most 120
characters, and list them on the benefit they qualify. Do not repeat the
figure itself as a limitation.

WAITING PERIODS, CONDITIONS, EXCLUSIONS
- waitingPeriods: every waiting period, one line each, naming the area:
  "Maternity: 10 months".
- conditions: eligibility and policy terms — group size, age limits,
  dependants, enrolment rules, discounts ("Family members: 10% discount").
- exclusions: what the document says is not covered at all.
Lines that apply to every plan in the document are repeated on every plan.

THE NETWORK
The medical network is the NAME of the provider network the plan is sold on
("Full Network", "GlobeMed", "Limited Network"). Put any tier code the
document attaches ("Tier003N") in \`tierCode\`, never in the name.

WHAT NOT TO DO
- Do not infer a figure for one plan from another plan's column.
- Do not classify plans as basic/standard/premium; the broker derives that
  from the annual limit. Put any tier wording the document uses in
  \`description\`.
- Do not summarise. Every figure, condition and benefit the document states
  about a plan must appear somewhere in that plan's object. Text you cannot
  place goes in \`unplaced\`, quoted.
- Do not return anything outside the JSON schema you were given.

SELF-CHECK BEFORE ANSWERING
For every plan: count the price bands against the document; confirm all seven
core areas are present; confirm every "Note", "Waiting Period", "Co-payment"
and bracketed qualifier in the document landed in details, waitingPeriods,
coPayment or limitations. Put anything odd in \`warnings\`: a tier label that
disagrees with the annual limit, a currency you had to assume, an age band
the document skips, a benefit you were unsure how to place.

THE BROKER'S BENEFIT CATALOGUE
Core areas: {{coreBenefitNames}}
Additional benefits already defined: {{catalogueBenefitNames}}
Currencies already in use: {{currencies}}
`;

export const USER_MESSAGE_TEMPLATE = `Insurer: {{companyName}}
Section: {{customerType}}
File name: {{fileName}}

<document>
{{documentMarkdown}}
</document>

Transcribe every plan in this document into the schema. Start by filling
\`planNames\` with the names of all plans you found, in document order, then the
plans themselves in the same order.
`;

/** Replace every {{key}} with its value. A key with no value is left as it is. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}

/** The names of the seven core areas, for the catalogue the prompt lists. */
export const CORE_AREA_NAMES: readonly string[] = CORE_MEDICAL_BENEFITS.map((spec) => spec.name);

const nullable = (type: 'number' | 'string') => ({ type: [type, 'null'] });
const str = { type: 'string' };
const strArray = { type: 'array', items: str };

const benefitCell = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'kind', 'value', 'coPayment', 'limitations', 'details', 'source'],
  properties: {
    name: { type: 'string', enum: [...CORE_AREA_NAMES] },
    kind: { type: 'string', enum: ['COVERAGE', 'LIMIT'] },
    value: nullable('number'),
    coPayment: nullable('number'),
    limitations: strArray,
    details: str,
    source: str,
  },
};

/**
 * THE OUTPUT SCHEMA the API is asked to enforce (structured output).
 *
 * Only NUMBERS are nullable: for a number, null ("silent") and 0 ("declined")
 * mean different things. Text the document does not give is "". That is also
 * what the API requires — it allows at most 16 union-typed fields in a
 * schema, and this one carries six.
 *
 * `ImportedDocument` in the shared package is this shape as a TypeScript
 * type, and `importedDocumentSchema` checks an answer against it.
 */
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['document', 'planNames', 'plans', 'warnings', 'unplaced'],
  properties: {
    document: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'insurerNameInDocument', 'matchesCompany', 'currency', 'sectionEvidence'],
      properties: {
        title: str,
        insurerNameInDocument: str,
        matchesCompany: { type: 'boolean' },
        currency: str,
        sectionEvidence: str,
      },
    },
    planNames: strArray,
    plans: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description', 'medicalNetwork', 'variants'],
        properties: {
          name: str,
          description: str,
          medicalNetwork: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'tierCode', 'source'],
            properties: { name: str, tierCode: str, source: str },
          },
          variants: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'geographicalCoverage',
                'roomType',
                'currency',
                'annualLimit',
                'deductible',
                'coPayment',
                'priceBands',
                'coreBenefits',
                'additionalBenefits',
                'waitingPeriods',
                'conditions',
                'exclusions',
              ],
              properties: {
                geographicalCoverage: {
                  type: 'string',
                  enum: [...ENABLED_GEOGRAPHICAL_COVERAGE_IDS],
                },
                roomType: str,
                currency: str,
                annualLimit: nullable('number'),
                deductible: nullable('number'),
                coPayment: nullable('number'),
                priceBands: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['ageFrom', 'ageTo', 'annualPrice', 'source'],
                    properties: {
                      ageFrom: { type: 'integer' },
                      ageTo: { type: 'integer' },
                      annualPrice: nullable('number'),
                      source: str,
                    },
                  },
                },
                coreBenefits: { type: 'array', items: benefitCell },
                additionalBenefits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'matchedExisting', 'value', 'details', 'source'],
                    properties: {
                      name: str,
                      matchedExisting: str,
                      value: str,
                      details: str,
                      source: str,
                    },
                  },
                },
                waitingPeriods: strArray,
                conditions: strArray,
                exclusions: strArray,
              },
            },
          },
        },
      },
    },
    warnings: strArray,
    unplaced: strArray,
  },
} as const;

/** The section names the prompt may be told, for a quick guard at the route. */
export const IMPORTABLE_CUSTOMER_TYPES = CUSTOMER_TYPE_IDS;
