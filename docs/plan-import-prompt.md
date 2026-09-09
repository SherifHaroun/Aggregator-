# Importing a company's plans from its Word document — the prompt

Status: **design for audit, nothing built yet.**

This is the prompt the API will be given when an employee, inside a company's
Individual, Family or SME section, clicks **Insert company plans document** and
uploads the insurer's Word file. Read it as the contract: whatever the model
returns is exactly what the review screen shows, plan by plan, before
**Publish** writes it into the database.

---

## 1. How the call is made

| Decision             | Choice                                                                                                                             | Why                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| What the model reads | The `.docx` converted to Markdown on the API server (paragraphs, headings, and every table as a Markdown table, in document order) | The Messages API reads PDF, images and text, not Word files. Converting to Markdown keeps the tables as tables, which is where every figure lives. |
| Model                | `claude-opus-5`                                                                                                                    | The current default; a rate table read wrong is a mis-quote, so accuracy comes before cost.                                                        |
| Thinking / effort    | adaptive thinking, `effort: high`                                                                                                  | Cross-checking a figure against three columns is real reasoning.                                                                                   |
| Output               | Structured output (`output_config.format` with the JSON schema below)                                                              | The review screen renders editable forms from the JSON. A schema-validated answer can never arrive half-shaped.                                    |
| Streaming            | Yes                                                                                                                                | Long output, and the progress bar is driven by it (below).                                                                                         |
| `max_tokens`         | 32,000                                                                                                                             | Ten plans with rate tables fit comfortably.                                                                                                        |
| The key              | The employee's Anthropic API key, sent to our API once and held server-side only                                                   | The browser never calls Anthropic directly.                                                                                                        |

**The progress bar.** The upload runs as a job with four stages the screen can
show honestly: converting the document (0–10%), sending it (10–15%), reading —
the streamed output grows and each completed plan object bumps the bar
(15–95%), and validating against the catalogue (95–100%). The percentage during
"reading" is `completed plans ÷ plans announced in the document header`, where
the model is asked to list the plan names first (see the output shape) so the
bar knows how many to expect.

---

## 2. The system prompt

Everything in `{{double braces}}` is filled in by our API before the call.

```text
You are a data-entry specialist for Hadbrok, an insurance broker in Egypt. You
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
- Each core area is exactly TWO numbers and some words: the figure (`value`),
  the member's share (`coPayment`), and everything else the cell says goes
  into `details`, word for word. "Coverage: 100% in-network. Room: Private
  Room. Includes: Surgeon, anesthesia, ICU" is value 100, coPayment null,
  details "Private room. Includes surgeon, anaesthesia, ICU", and the
  limitation "In-network only". Nothing the cell says is dropped.
- Copy figures exactly. "200,000 EGP" is 200000. Never round, convert or infer.
- A figure the document does not state is null. Null means "the document is
  silent"; it does NOT mean zero. The broker's system reads a null LIMIT on a
  covered area as "up to the annual limit" and a null co-payment as "no
  co-payment", so never write those in yourself — leave null and let the
  rule apply.
- Zero means the document says the area is NOT covered ("Dental: Not covered",
  "Nil", "Excluded"). Only write 0 when the document declines the area.
- A percentage is the share the INSURER pays. "80% co-insurance" or "member
  pays 20%" is value 80 with coPayment 20. "Coverage: 100%, Co-payment: 10%" is
  value 100 with coPayment 10.
- An area quoted only in words ("covered at authorised centres") keeps
  value null and puts the words in `details`.
- A sub-limit "within the annual limit" is still the area's limit; note the
  "within the annual limit" wording in `details`.
- Prices are annual premiums per person unless the document says otherwise;
  if it prices per family or per month, say so in `warnings` and still copy
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
  catalogue name exactly and set `matchedExisting` to it. Otherwise use the
  document's own wording, in title case, and leave `matchedExisting` null.
- An additional benefit's value is the document's wording ("Covers 25
  congenital defects", "80% reimbursement based on Misr International
  Hospital prices"). If it states a figure, put the figure in `value` and the
  wording in `details`.

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
document attaches ("Tier003N") in `tierCode`, never in the name.

WHAT NOT TO DO
- Do not infer a figure for one plan from another plan's column.
- Do not classify plans as basic/standard/premium; the broker derives that
  from the annual limit. Put any tier wording the document uses in
  `description`.
- Do not summarise. Every figure, condition and benefit the document states
  about a plan must appear somewhere in that plan's object. Text you cannot
  place goes in `unplaced`, quoted.
- Do not return anything outside the JSON schema you were given.

SELF-CHECK BEFORE ANSWERING
For every plan: count the price bands against the document; confirm all seven
core areas are present; confirm every "Note", "Waiting Period", "Co-payment"
and bracketed qualifier in the document landed in details, waitingPeriods,
coPayment or limitations. Put anything odd in `warnings`: a tier label that
disagrees with the annual limit, a currency you had to assume, an age band
the document skips, a benefit you were unsure how to place.

THE BROKER'S BENEFIT CATALOGUE
Core areas: {{coreBenefitNames}}
Additional benefits already defined: {{catalogueBenefitNames}}
Currencies already in use: {{currencies}}
```

## 3. The user message

```text
Insurer: {{companyName}}
Section: {{customerType}}
File name: {{fileName}}

<document>
{{documentMarkdown}}
</document>

Transcribe every plan in this document into the schema. Start by filling
`planNames` with the names of all plans you found, in document order, then the
plans themselves in the same order.
```

## 4. The output schema

Structured output: the model must return exactly this shape. Strings marked
`source` are short verbatim quotes from the document, so the review screen can
show the reader where a figure came from.

```jsonc
{
  "document": {
    "title": string,
    "insurerNameInDocument": string | null,
    "matchesCompany": boolean,          // the document's insurer is {{companyName}}
    "currency": string | null,          // ISO code the figures are in, e.g. "EGP"
    "sectionEvidence": string | null    // why this is a {{customerType}} document
  },
  "planNames": string[],                // announced first, so the progress bar knows the count
  "plans": [
    {
      "name": string,
      "description": string | null,     // the document's own summary of the plan, incl. tier wording
      "medicalNetwork": { "name": string | null, "tierCode": string | null, "source": string | null },
      "variants": [
        {
          "geographicalCoverage": "LOCAL" | "INTERNATIONAL",
          "roomType": string | null,
          "currency": string,
          "annualLimit": number | null,
          "deductible": number | null,
          "coPayment": number | null,   // a plan-wide co-payment, if the document states one
          "priceBands": [ { "ageFrom": number, "ageTo": number, "annualPrice": number | null, "source": string } ],
          "coreBenefits": [             // always all seven, in order
            {
              "name": "In-patient" | "Out-patient" | "Maternity" | "Dental" | "Optical" | "Chronic / Pre-existing Conditions" | "Medication",
              "kind": "COVERAGE" | "LIMIT",
              "value": number | null,   // null = document silent, 0 = declined
              "coPayment": number | null,
              "limitations": string[],
              "details": string | null,
              "source": string | null
            }
          ],
          "additionalBenefits": [
            { "name": string, "matchedExisting": string | null, "value": string | null, "details": string | null, "source": string | null }
          ],
          "waitingPeriods": string[],
          "conditions": string[],
          "exclusions": string[]
        }
      ]
    }
  ],
  "warnings": string[],
  "unplaced": string[]
}
```

---

## 5. What the model returns for `Arope Insurance SME Health Plans.docx`

Inputs for this run: `companyName = "Arope Insurance"`, `customerType = "SME"`.
This is the answer the prompt above is designed to produce, and it is what the
review screen would open with — three plan cards, Platinum, Premier and Silver.

```json
{
  "document": {
    "title": "Comprehensive Benefits Comparison Table: Arope Insurance SME Health Plans",
    "insurerNameInDocument": "Arope Insurance",
    "matchesCompany": true,
    "currency": "EGP",
    "sectionEvidence": "Minimum Group Size 10 Employees; Maximum Group Size Up to 150 Employees; Cost by Age (Annual Premium - EGP)"
  },
  "planNames": ["Platinum", "Premier", "Silver"],
  "plans": [
    {
      "name": "Platinum",
      "description": "High tier. Best for companies seeking high annual limits and robust coverage for serious conditions, with a lower chronic sub-limit than Premier but a more affordable premium than Premier for younger ages.",
      "medicalNetwork": {
        "name": "Full Network",
        "tierCode": "Tier003N",
        "source": "Full Network (Tier003N)"
      },
      "variants": [
        {
          "geographicalCoverage": "LOCAL",
          "roomType": "Private Room",
          "currency": "EGP",
          "annualLimit": 200000,
          "deductible": null,
          "coPayment": null,
          "priceBands": [
            { "ageFrom": 0, "ageTo": 17, "annualPrice": 6187, "source": "0-17: 6,187" },
            { "ageFrom": 18, "ageTo": 24, "annualPrice": 7617, "source": "18-24: 7,617" },
            { "ageFrom": 25, "ageTo": 29, "annualPrice": 8830, "source": "25-29: 8,830" },
            { "ageFrom": 30, "ageTo": 34, "annualPrice": 10582, "source": "30-34: 10,582" },
            { "ageFrom": 35, "ageTo": 39, "annualPrice": 12603, "source": "35-39: 12,603" },
            { "ageFrom": 40, "ageTo": 44, "annualPrice": 14571, "source": "40-44: 14,571" },
            { "ageFrom": 45, "ageTo": 49, "annualPrice": 17709, "source": "45-49: 17,709" },
            { "ageFrom": 50, "ageTo": 54, "annualPrice": 19611, "source": "50-54: 19,611" },
            { "ageFrom": 55, "ageTo": 59, "annualPrice": 25002, "source": "55-59: 25,002" },
            { "ageFrom": 60, "ageTo": 64, "annualPrice": 31066, "source": "60-64: 31,066" }
          ],
          "coreBenefits": [
            {
              "name": "In-patient",
              "kind": "COVERAGE",
              "value": 100,
              "coPayment": null,
              "limitations": ["In-network only"],
              "details": "Private room. Includes surgeon, anaesthesia, ICU, room & board, medications and tests.",
              "source": "Coverage: 100% in-network. Room: Private Room. Includes: Surgeon, anesthesia, ICU, room & board, medications, tests."
            },
            {
              "name": "Out-patient",
              "kind": "COVERAGE",
              "value": 100,
              "coPayment": null,
              "limitations": ["In-network only"],
              "details": "Consultations, tests, physiotherapy and prescribed medications.",
              "source": "Coverage: 100% in-network for consultations, tests, physiotherapy, and prescribed medications."
            },
            {
              "name": "Maternity",
              "kind": "LIMIT",
              "value": 10000,
              "coPayment": null,
              "limitations": [],
              "details": "Normal and C-section. Waiting period 10 months. Coverage applies even if pregnancy started before the policy.",
              "source": "Limit: 10,000 EGP (Normal & C-Section). Waiting Period: 10 months."
            },
            {
              "name": "Dental",
              "kind": "LIMIT",
              "value": 1500,
              "coPayment": 10,
              "limitations": ["Basic procedures only"],
              "details": "Fillings, simple/surgical extraction, root canal, X-rays.",
              "source": "Limit: 1,500 EGP for basic procedures (fillings, simple/surgical extraction, root canal, X-rays). Co-payment: 10%"
            },
            {
              "name": "Optical",
              "kind": "LIMIT",
              "value": 1500,
              "coPayment": 10,
              "limitations": ["One eye test per year", "Glasses every two years"],
              "details": null,
              "source": "Limit: 1,500 EGP (One eye test per year, glasses every two years). Co-payment: 10%"
            },
            {
              "name": "Chronic / Pre-existing Conditions",
              "kind": "LIMIT",
              "value": 25000,
              "coPayment": null,
              "limitations": [],
              "details": "Within the annual limit. The maximum the policy pays for all treatment related to conditions that existed before the policy started.",
              "source": "25,000 EGP (within the annual limit)"
            },
            {
              "name": "Medication",
              "kind": "LIMIT",
              "value": null,
              "coPayment": null,
              "limitations": ["In-network only"],
              "details": "No separate limit stated. Prescribed medications are covered under Out-patient at 100% in-network.",
              "source": "Coverage: 100% in-network for consultations, tests, physiotherapy, and prescribed medications."
            }
          ],
          "additionalBenefits": [
            {
              "name": "Congenital Defects",
              "matchedExisting": null,
              "value": "Covers 25 congenital defects",
              "details": null,
              "source": "Covers 25 Congenital Defects."
            },
            {
              "name": "Hepatitis B & C",
              "matchedExisting": "Hepatitis B & C",
              "value": "Covered",
              "details": "The document says \"Covers Hepatitis\" without naming the types.",
              "source": "Covers Hepatitis."
            },
            {
              "name": "COVID-19 Inpatient Cover",
              "matchedExisting": null,
              "value": "Covered",
              "details": null,
              "source": "COVID-19 inpatient coverage included."
            },
            {
              "name": "Out-of-Network Reimbursement",
              "matchedExisting": null,
              "value": "80% reimbursement based on Misr International Hospital prices",
              "details": "In-network: direct billing. Applies within Egypt.",
              "source": "Out-of-Network (Egypt): 80% reimbursement based on Misr International Hospital prices."
            }
          ],
          "waitingPeriods": [
            "Maternity: 10 months (coverage applies even if pregnancy started before the policy)"
          ],
          "conditions": [
            "Minimum group size: 10 employees",
            "Maximum group size: 150 employees",
            "Children covered until age 18, extendable to 23 if in full-time education",
            "Members over 65 require a medical questionnaire and are subject to underwriting",
            "Family members: 10% discount"
          ],
          "exclusions": []
        }
      ]
    },
    {
      "name": "Premier",
      "description": "Mid-High tier. The top-tier plan with the highest annual and chronic sub-limits. Ideal for companies wanting the maximum coverage available, particularly for older employee demographics where chronic conditions are a greater concern.",
      "medicalNetwork": {
        "name": "Full Network",
        "tierCode": "Tier004N",
        "source": "Full Network (Tier004N)"
      },
      "variants": [
        {
          "geographicalCoverage": "LOCAL",
          "roomType": "Private Room",
          "currency": "EGP",
          "annualLimit": 300000,
          "deductible": null,
          "coPayment": null,
          "priceBands": [
            { "ageFrom": 0, "ageTo": 17, "annualPrice": 8767, "source": "0-17: 8,767" },
            { "ageFrom": 18, "ageTo": 24, "annualPrice": 11151, "source": "18-24: 11,151" },
            { "ageFrom": 25, "ageTo": 29, "annualPrice": 12835, "source": "25-29: 12,835" },
            { "ageFrom": 30, "ageTo": 34, "annualPrice": 15267, "source": "30-34: 15,267" },
            { "ageFrom": 35, "ageTo": 39, "annualPrice": 16074, "source": "35-39: 16,074" },
            { "ageFrom": 40, "ageTo": 44, "annualPrice": 20056, "source": "40-44: 20,056" },
            { "ageFrom": 45, "ageTo": 49, "annualPrice": 25162, "source": "45-49: 25,162" },
            { "ageFrom": 50, "ageTo": 54, "annualPrice": 27803, "source": "50-54: 27,803" },
            { "ageFrom": 55, "ageTo": 59, "annualPrice": 35287, "source": "55-59: 35,287" },
            { "ageFrom": 60, "ageTo": 64, "annualPrice": 43707, "source": "60-64: 43,707" }
          ],
          "coreBenefits": [
            {
              "name": "In-patient",
              "kind": "COVERAGE",
              "value": 100,
              "coPayment": null,
              "limitations": ["In-network only"],
              "details": "Private room. Includes surgeon, anaesthesia, ICU, room & board, medications and tests.",
              "source": "Coverage: 100% in-network. Room: Private Room. Includes: Surgeon, anesthesia, ICU, room & board, medications, tests."
            },
            {
              "name": "Out-patient",
              "kind": "COVERAGE",
              "value": 100,
              "coPayment": null,
              "limitations": ["In-network only"],
              "details": "Consultations, tests, physiotherapy and prescribed medications.",
              "source": "Coverage: 100% in-network for consultations, tests, physiotherapy, and prescribed medications."
            },
            {
              "name": "Maternity",
              "kind": "LIMIT",
              "value": 15000,
              "coPayment": null,
              "limitations": [],
              "details": "Normal and C-section. Waiting period 10 months. Coverage applies even if pregnancy started before the policy.",
              "source": "Limit: 15,000 EGP (Normal & C-Section). Waiting Period: 10 months."
            },
            {
              "name": "Dental",
              "kind": "LIMIT",
              "value": 2000,
              "coPayment": 10,
              "limitations": ["Basic procedures only"],
              "details": "Fillings, simple/surgical extraction, root canal, X-rays.",
              "source": "Limit: 2,000 EGP for basic procedures (fillings, simple/surgical extraction, root canal, X-rays). Co-payment: 10%"
            },
            {
              "name": "Optical",
              "kind": "LIMIT",
              "value": 2000,
              "coPayment": 10,
              "limitations": ["One eye test per year", "Glasses every two years"],
              "details": null,
              "source": "Limit: 2,000 EGP (One eye test per year, glasses every two years). Co-payment: 10%"
            },
            {
              "name": "Chronic / Pre-existing Conditions",
              "kind": "LIMIT",
              "value": 35000,
              "coPayment": null,
              "limitations": [],
              "details": "Within the annual limit.",
              "source": "35,000 EGP (within the annual limit)"
            },
            {
              "name": "Medication",
              "kind": "LIMIT",
              "value": null,
              "coPayment": null,
              "limitations": ["In-network only"],
              "details": "No separate limit stated. Prescribed medications are covered under Out-patient at 100% in-network.",
              "source": "Coverage: 100% in-network for consultations, tests, physiotherapy, and prescribed medications."
            }
          ],
          "additionalBenefits": [
            {
              "name": "Congenital Defects",
              "matchedExisting": null,
              "value": "Covers 25 congenital defects",
              "details": null,
              "source": "Covers 25 Congenital Defects."
            },
            {
              "name": "Hepatitis B & C",
              "matchedExisting": "Hepatitis B & C",
              "value": "Covered",
              "details": "The document says \"Covers Hepatitis\" without naming the types.",
              "source": "Covers Hepatitis."
            },
            {
              "name": "COVID-19 Inpatient Cover",
              "matchedExisting": null,
              "value": "Covered",
              "details": null,
              "source": "COVID-19 inpatient coverage included."
            },
            {
              "name": "Out-of-Network Reimbursement",
              "matchedExisting": null,
              "value": "80% reimbursement based on Cleopatra Hospital prices",
              "details": "In-network: direct billing. Applies within Egypt.",
              "source": "Out-of-Network (Egypt): 80% reimbursement based on Cleopatra Hospital prices."
            }
          ],
          "waitingPeriods": [
            "Maternity: 10 months (coverage applies even if pregnancy started before the policy)"
          ],
          "conditions": [
            "Minimum group size: 10 employees",
            "Maximum group size: 150 employees",
            "Children covered until age 18, extendable to 23 if in full-time education",
            "Members over 65 require a medical questionnaire and are subject to underwriting",
            "Family members: 10% discount"
          ],
          "exclusions": []
        }
      ]
    },
    {
      "name": "Silver",
      "description": "Standard tier. A cost-effective, essential coverage plan for budget-conscious companies. The key trade-offs are the lower annual limit, a significantly lower chronic/pre-existing condition sub-limit, and 80% co-insurance for all outpatient services.",
      "medicalNetwork": {
        "name": "Limited Network",
        "tierCode": "Tier002N",
        "source": "Limited Network (Tier002N)"
      },
      "variants": [
        {
          "geographicalCoverage": "LOCAL",
          "roomType": "Private Room",
          "currency": "EGP",
          "annualLimit": 100000,
          "deductible": null,
          "coPayment": null,
          "priceBands": [
            { "ageFrom": 0, "ageTo": 17, "annualPrice": 3914, "source": "0-17: 3,914" },
            { "ageFrom": 18, "ageTo": 24, "annualPrice": 4888, "source": "18-24: 4,888" },
            { "ageFrom": 25, "ageTo": 29, "annualPrice": 5619, "source": "25-29: 5,619" },
            { "ageFrom": 30, "ageTo": 34, "annualPrice": 6718, "source": "30-34: 6,718" },
            { "ageFrom": 35, "ageTo": 39, "annualPrice": 7986, "source": "35-39: 7,986" },
            { "ageFrom": 40, "ageTo": 44, "annualPrice": 9221, "source": "40-44: 9,221" },
            { "ageFrom": 45, "ageTo": 49, "annualPrice": 11189, "source": "45-49: 11,189" },
            { "ageFrom": 50, "ageTo": 54, "annualPrice": 12383, "source": "50-54: 12,383" },
            { "ageFrom": 55, "ageTo": 59, "annualPrice": 15766, "source": "55-59: 15,766" },
            { "ageFrom": 60, "ageTo": 64, "annualPrice": 19569, "source": "60-64: 19,569" }
          ],
          "coreBenefits": [
            {
              "name": "In-patient",
              "kind": "COVERAGE",
              "value": 100,
              "coPayment": null,
              "limitations": ["In-network only"],
              "details": "Private room. Includes surgeon, anaesthesia, ICU, room & board, medications and tests.",
              "source": "Coverage: 100% in-network. Room: Private Room. Includes: Surgeon, anesthesia, ICU, room & board, medications, tests."
            },
            {
              "name": "Out-patient",
              "kind": "COVERAGE",
              "value": 80,
              "coPayment": 20,
              "limitations": ["In-network only"],
              "details": "Consultations, tests, physiotherapy and prescribed medications. Members pay 20% co-insurance on all outpatient services.",
              "source": "Coverage: 80% in-network for consultations, tests, physiotherapy, and prescribed medications."
            },
            {
              "name": "Maternity",
              "kind": "LIMIT",
              "value": 5000,
              "coPayment": null,
              "limitations": [],
              "details": "Normal and C-section. Waiting period 10 months. Coverage applies even if pregnancy started before the policy.",
              "source": "Limit: 5,000 EGP (Normal & C-Section). Waiting Period: 10 months."
            },
            {
              "name": "Dental",
              "kind": "LIMIT",
              "value": 1000,
              "coPayment": 10,
              "limitations": ["Basic procedures only"],
              "details": "Fillings, simple/surgical extraction, root canal, X-rays.",
              "source": "Limit: 1,000 EGP for basic procedures (fillings, simple/surgical extraction, root canal, X-rays). Co-payment: 10%"
            },
            {
              "name": "Optical",
              "kind": "LIMIT",
              "value": 1000,
              "coPayment": 10,
              "limitations": ["One eye test per year", "Glasses every two years"],
              "details": null,
              "source": "Limit: 1,000 EGP (One eye test per year, glasses every two years). Co-payment: 10%"
            },
            {
              "name": "Chronic / Pre-existing Conditions",
              "kind": "LIMIT",
              "value": 10000,
              "coPayment": null,
              "limitations": [],
              "details": "Within the annual limit.",
              "source": "10,000 EGP (within the annual limit)"
            },
            {
              "name": "Medication",
              "kind": "LIMIT",
              "value": null,
              "coPayment": 20,
              "limitations": ["In-network only"],
              "details": "No separate limit stated. Prescribed medications are covered under Out-patient at 80% in-network.",
              "source": "Coverage: 80% in-network for consultations, tests, physiotherapy, and prescribed medications."
            }
          ],
          "additionalBenefits": [
            {
              "name": "Hepatitis B & C",
              "matchedExisting": "Hepatitis B & C",
              "value": "Covered",
              "details": "The document says \"Covers Hepatitis\" without naming the types.",
              "source": "Covers Hepatitis."
            },
            {
              "name": "COVID-19 Inpatient Cover",
              "matchedExisting": null,
              "value": "Covered",
              "details": null,
              "source": "COVID-19 inpatient coverage included."
            },
            {
              "name": "Out-of-Network Reimbursement",
              "matchedExisting": null,
              "value": "80% reimbursement based on \"Salam\" Hospital prices",
              "details": "In-network: direct billing. Applies within Egypt.",
              "source": "Out-of-Network (Egypt): 80% reimbursement based on \"Salam\" Hospital prices."
            }
          ],
          "waitingPeriods": [
            "Maternity: 10 months (coverage applies even if pregnancy started before the policy)"
          ],
          "conditions": [
            "Minimum group size: 10 employees",
            "Maximum group size: 150 employees",
            "Children covered until age 18, extendable to 23 if in full-time education",
            "Members over 65 require a medical questionnaire and are subject to underwriting",
            "Family members: 10% discount"
          ],
          "exclusions": []
        }
      ]
    }
  ],
  "warnings": [
    "Premier is labelled \"Mid-High\" in the document but has the highest annual limit (300,000 EGP) and the highest premiums; the broker's tier will read Premium.",
    "Medication has no limit of its own in this document; it is covered under Out-patient. Value left null on all three plans.",
    "No price is given for ages 65 and over; the document says those members are subject to underwriting. No band was created for them.",
    "Congenital Defects (25 conditions) is stated for Platinum and Premier only; Silver does not list it.",
    "The document gives local cover only; no international variant was created."
  ],
  "unplaced": []
}
```

---

## 6. What the review screen does with a null limit

A null `value` on a LIMIT area (Maternity, Dental, Optical, Chronic,
Medication) is the document being silent, and the comparison reads it as
**the plan's annual limit**, shown as "EGP 600,000 (annual limit)". That is
the reading insurers' own tables give a covered area with no sub-limit, but
the insurer did not write the figure, so the review screen:

1. Marks the area on the plan card with a warning — `importReviewWarnings()`
   in the shared rules produces one per silent LIMIT area, naming the figure
   that will stand in.
2. Keeps **Publish** disabled for that plan until the employee has confirmed
   each warning, or typed the limit the document actually meant, or entered
   0 if the document declines the area. `readyToPublish()` is the check.
3. Never turns a null into "not covered" or "not specified" on its own. A
   co-payment with no sub-limit beside it (AXA's tables) is a covered area.

A null `coPayment` needs no confirmation: it is read as no co-payment, which
is what a table with nothing beside the figure means.

## 7. Questions for the audit

1. **Medication.** This document folds medicines into Out-patient. The prompt
   returns Medication with a null limit and a note, so the review screen will
   flag it for confirmation (section 6). The alternative is to copy
   Out-patient's percentage into Medication as a COVERAGE value, which the
   review screen cannot hold today (Medication is a LIMIT). Keep null?
2. **"Hepatitis" → "Hepatitis B & C".** The prompt lets the model adopt a
   catalogue name when the meaning plainly matches, and say so in details. If
   you would rather it never renames, that rule comes out.
3. **Conditions repeated on every plan.** Group size, age limits and the
   family discount apply to all three, so they appear on all three. The
   alternative is a single document-level list shown once on the review
   screen and attached to every published plan.
4. **Sources.** Each figure carries a short quote. They cost output tokens
   (roughly a third of the answer) but let the review screen show "where did
   this number come from" on hover. Keep them?
5. **Description.** The model copies the document's own plan summary into the
   plan description. Fine, or leave descriptions for the employee to write?
