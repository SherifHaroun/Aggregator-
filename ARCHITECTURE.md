# Architecture

The repository is an npm workspaces monorepo with three workspaces.

```
packages/shared      @aggregator/shared   business rules, config, contracts
apps/api             @aggregator/api      Express + Prisma
apps/web             @aggregator/web      React + Vite
```

`shared` has no dependencies and is consumed by both apps, so a rule can only be
written once.

---

## 1. Where the business rules live

**`packages/shared/src/config/business-rules.ts`** — plain constants, no imports.
This is the file to open when the business changes a standard.

| Constant                       | Meaning                                             |
| ------------------------------ | --------------------------------------------------- |
| `SME_FIXED_AVERAGE_AGE`        | The fixed average age used for every SME comparison |
| `AVERAGE_AGE_LABEL_PREFIX`     | Wording of the average-age line in all output       |
| `SME_FIXED_AVERAGE_AGE_NOTICE` | Explanation shown next to the SME option            |

**`packages/shared/src/rules/`** — the pure functions that apply those constants.

- `age.ts` — `resolveAverageAgeForCustomerType()` is the **only** implementation
  of "which age applies". Nothing else in the codebase may branch on customer
  type to decide an age.
- `comparison-criteria.ts` — validation, and `resolveComparisonCriteria()` which
  turns raw selections into labels plus the resolved age.

The number `35` appears exactly once in the codebase, in `business-rules.ts`.

### Changing the SME average age

Edit `SME_FIXED_AVERAGE_AGE`. The option card, the summary, the API
configuration endpoint and any future comparison output all update.

---

## 2. Where the selectable options live

**`packages/shared/src/config/`**

| File                        | Contains                                          |
| --------------------------- | ------------------------------------------------- |
| `customer-types.ts`         | Individual, Family, SME                           |
| `geographical-coverage.ts`  | Local, International                              |
| `comparison-form.ts`        | The steps of the selection screen and their order |
| `option-registry.ts`        | The generic option shape and its helpers          |

Every option has `id`, `label`, `description?`, `order` and `enabled`. Setting
`enabled: false` retires an option from the UI without deleting it, so existing
records that reference it stay valid.

### Adding a new comparison selection

1. Add a registry file under `config/` following the existing pattern.
2. Add the field to `ComparisonCriteriaInput` in `types/comparison.ts`.
3. Add a step to `COMPARISON_STEPS` in `config/comparison-form.ts`.
4. Add the registry to `getOptionsForSource()` in
   `apps/web/src/features/comparison/comparison-options.ts`.

No component changes are required — the form renders whatever the steps
describe.

---

## 3. API (`apps/api`)

```
src/config/env.ts        the only file that reads process.env
src/lib/prisma.ts        lazy Prisma singleton
src/lib/api-response.ts  ApiResponse envelope + HttpError
src/middleware/          error handling, async wrapper
src/routes/index.ts      mounts every module under /api/v1
src/modules/<feature>/   one folder per feature: .routes.ts, .service.ts
```

Every endpoint answers with the shared `ApiResponse<T>` envelope:
`{ ok: true, data }` or `{ ok: false, error }`.

Current modules: `health`, `configuration`, `companies`, `insurance-types`,
`insurance-options` (with option fields), `plans`, `plan-configurations`,
`plan-options`.

`configuration` serves `GET /api/v1/configuration/comparison` — the comparison
options and business rules from `@aggregator/shared`. It is the seam for later:
if some of that configuration becomes employee-editable and moves into
PostgreSQL, only `configuration.service.ts` changes.

Future modules (comparison, auth, audit) each get a folder under `src/modules/`
and a line in `src/routes/index.ts`.

Each data module is three files: `*.schemas.ts` (Zod), `*.service.ts` (all
logic and integrity rules), `*.routes.ts` (thin — parse, call service, respond),
plus a `*.mapper.ts` that converts Prisma rows to the DTOs in
`@aggregator/shared`. Routes contain no business logic.

---

## 4. The data model

```
Company ──< Plan >── InsuranceType ──< InsuranceOption ──< OptionField
                │                            │                   │
                └──< PlanConfiguration       │                   │
                          │                  │                   │
                          └──< PlanOption >──┘                   │
                                    │                            │
                                    └──< PlanOptionValue >───────┘
```

**No benefit is ever a column.** There is no `dentalCare` or `maternity` field
anywhere. A benefit is a row in `InsuranceOption`; the information it requires
is rows in `OptionField`; what a configuration says about it is rows in
`PlanOptionValue`. An employee can define a benefit that has never existed
before, with fields nobody anticipated, without a schema change or a deploy.

### Plan vs PlanConfiguration

A **`Plan`** is the product — name, code, category, company, insurance type.
It carries no price and no benefits.

A **`PlanConfiguration`** is that product priced and configured for one
customer type and one coverage area. One plan therefore holds up to six
configurations (Individual/Family/SME × Local/International) rather than being
split into six plan records:

```
Plan "…"
 ├── INDIVIDUAL + LOCAL          price, limits, its own options
 ├── INDIVIDUAL + INTERNATIONAL  …
 ├── FAMILY     + LOCAL          …
 └── …
```

`@@unique([planId, customerType, geographicalCoverage])` allows at most one
configuration per combination. The constraint covers active *and* inactive
rows, so deactivating one does not free the slot — edit or delete it to reuse
the combination.

**Options attach to the configuration, not the plan.** That is what lets the
same benefit carry 80% for Individual+Local and 90% for Family+Local. Each
configuration owns its `PlanOption` rows, which own their `PlanOptionValue`
rows, so values can never leak between configurations.

### The comparison query

The employee enters criteria, never a company or a plan. The engine will run:

```
PlanConfiguration
  where customerType = ? and geographicalCoverage = ? and isActive
  include plan -> company
```

backed by `@@index([customerType, geographicalCoverage, isActive])`. That
returns every matching configuration across all companies and plans, each
knowing its plan and company, ready to be grouped by `Plan.category` or name.
Coverage details for scoring come from each configuration's options and values.

### Customer type and geographical coverage

Application configuration, not insurance data — so unlike insurance types they
are **not** database records. They exist as:

- the registries in `@aggregator/shared` (single source of truth for the UI and
  for Zod validation), and
- Prisma enums, so PostgreSQL rejects an invalid value outright.

That is deliberate duplication, and
[`apps/api/src/lib/enum-parity.ts`](apps/api/src/lib/enum-parity.ts) makes drift
a **build failure**: a type-level assertion stops compiling if the two lists
disagree. Adding a value means editing the shared config, the Prisma enum, and
adding a migration — together, or the build breaks.

### Age

`PlanConfiguration` stores **no age column**. The SME average age remains the
single constant in `business-rules.ts`; the API resolves it per configuration in
`plan-configurations.mapper.ts` and returns it as `averageAge`. Age-based
pricing has not been specified — adding it later means new columns here, not a
redesign.

### How a dynamic value is stored

`PlanOptionValue` has three typed columns — `numberValue`, `textValue`,
`booleanValue`. The field's `dataType` selects which one is used, so numbers
stay sortable and comparable in SQL instead of being stringified.
`src/modules/plan-options/plan-option-values.ts` is the only place that maps
between the API's single `value` and those columns, and the only place that
validates a value against its field definition.

### Deletion policy

Every entity carries `isActive`. Deactivation is `PATCH { isActive: false }`;
there is no separate endpoint. `DELETE` means permanent removal and is refused
(409) whenever other records depend on the row, so historical comparisons and
reports keep resolving:

| Deleting           | Refused when                                              |
| ------------------ | --------------------------------------------------------- |
| Company            | it has plans                                               |
| Insurance type     | it has plans or options                                    |
| Option             | any configuration uses it                                  |
| Option field       | any configuration has supplied a value for it              |
| Plan               | never — configurations, options and values cascade with it |
| Plan configuration | never — its options and values cascade with it             |

`OptionField.dataType` cannot be changed once plans have supplied values for it,
since existing values live in a column chosen by the old type.

### Database

`apps/api/prisma/schema.prisma` holds the models above. There is **no seed
script and no seed data** — every record is entered by employees through the
application.

### Tests

`apps/api/tests/`, run with `npm run test`.

- `schema-contract.test.ts` and `business-rules.test.ts` need **no database**.
  They assert the architecture from Prisma's generated datamodel and the
  migration SQL: options attach to configurations, the uniqueness rule exists,
  no benefit is a column, no age column, the enums match the shared config, no
  seed data. Plus the SME rule and the dynamic-field round trip.
- `plan-configurations.integration.test.ts` is **opt-in** and exercises the same
  guarantees against real PostgreSQL. It runs only when `TEST_DATABASE_URL` is
  set, so it can never touch the development database:

  ```bash
  TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/aggregator_test" npm run test
  ```

  The target database needs the migrations applied first
  (`DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`). Its fixtures
  are namespaced and removed afterwards — they are not seed data.

---

## 5. Web client (`apps/web`)

```
src/app/            router and providers
src/components/ui/  presentational, feature-agnostic building blocks
src/components/layout/  application frame (sidebar, mobile drawer)
src/config/         routes.ts, navigation.ts — no URL or nav item is hardcoded elsewhere
src/features/       feature logic; one folder per feature
src/lib/            api-client.ts, cn.ts
src/pages/          one component per route, composed from features and ui
src/styles/index.css  design tokens (@theme) — colours, radii, shadows
```

### Management screens

`src/pages/manage/` holds the employee data-management interface: companies,
insurance types, plans, plan configurations and insurance options. All data
access goes through `src/features/insurance-data/insurance-data.api.ts` — one
set of React Query hooks over the existing `api` client. There is no second
client, and React never touches the database.

Two feature folders carry the interesting logic:

- `features/insurance-data/` — the query hooks, `useRecordForm` (which maps a
  `VALIDATION_ERROR` response's `details` onto individual fields), and display
  helpers.
- `features/plan-configuration/` — `ConfigurationOptionsBoard` (drag-and-drop
  via dnd-kit) and `PlanOptionValuesForm`.

**The interface hardcodes no benefit.** `PlanOptionValuesForm` renders one input
per entry in the API's `values` array, choosing the control from `dataType`
alone. There is no `if (option === ...)` anywhere. A benefit an employee invents
today renders identically to any other, and a new data type is added in one
`switch`.

### Empty, loading and error states

`DataState` renders all four states for every list screen, so no page invents
its own wording. `describeError` translates API error codes into employee-facing
sentences — a technical message never reaches the screen.

### Component conventions

- `components/ui` knows nothing about insurance. `OptionCardGroup` renders any
  list of `{ id, label, description? }`, which is why the same component serves
  the customer-type and coverage steps and every future one.
- Colours, radii and shadows are referenced by token name (`bg-surface`,
  `text-content-muted`, `rounded-(--radius-card)`). A rebrand touches only the
  `@theme` block in `src/styles/index.css`.
- Screens with no data render `EmptyState`. Placeholder rows are never invented.

### Feature folders

`src/features/comparison/` holds the selection screen's logic:

- `useComparisonCriteria.ts` — selection state; delegates all validation and
  rule resolution to `@aggregator/shared`.
- `ComparisonCriteriaForm.tsx` — renders the configured steps.
- `ComparisonCriteriaSummary.tsx` — reads back the resolved criteria, including
  the average-age line.
- `comparison-options.ts` — maps a step's `optionSource` to its registry.

---

## 6. Preparing for a public aggregator

A separate customer-facing site is planned. It will consume **this same API and
database**; only the interface differs.

```
web-admin  ─┐                  ┌─ employees: create / edit / configure
            ├─► API ─► Neon ───┤
web-public ─┘                  └─ customers: read / compare / recommend
```

### The read/write boundary

`apps/api/src/middleware/access.ts` is the single gate, mounted once in
`routes/index.ts` ahead of every data router so no endpoint can skip it.

- **Reads are open.** A public client uses the same resource endpoints the admin
  UI does; it must never need an API of its own.
- **Writes are staff-only.** With `ADMIN_API_TOKEN` unset (today's internal-only
  deployment) writes behave exactly as before. Set it once a public client can
  reach the API and every write requires `Authorization: Bearer <token>`.
  Real employee authentication replaces the body of that one function.

`tests/access-boundary.test.ts` pins this down: every representative write is
refused without the token, and every public read still succeeds.

### What the public site already has

| Need | Already available |
| ---- | ----------------- |
| Find matching plans | `GET /plan-configurations?customerType=&geographicalCoverage=&isActive=true`, backed by a matching index |
| Company / plan detail | `GET /companies/:id`, `GET /plans/:id` (includes configurations, options and values) |
| Benefit definitions | `GET /insurance-options` — employee-defined, with their own fields |
| Business rules | `@aggregator/shared` — SME average age, customer types, coverage, labels, money formatting |
| Contracts | `ApiResponse<T>`, `Paginated<T>` and every DTO in `@aggregator/shared` |

`packages/shared` imports no React, Prisma or Express, so a second client can
depend on it directly.

### Deliberately deferred

Doing these now would be speculative; none is blocked by the current design.

- `POST /compare`, match scoring and recommendation ranking.
- Renaming `apps/web` to `apps/web-admin` — a `git mv` plus a Render root-dir
  change when `web-public` actually exists.
- Splitting the React Query hooks into read-only and admin modules.
- Including plan/company summaries in the configurations list to save a round
  trip; the right shape depends on the results page.
- Extracting `components/ui` into a shared UI package.

---

## 7. Not implemented

Deliberately absent, to be built in later steps:

employee authentication · permissions · reports · settings · the comparison
engine · comparison results · the recommendation algorithm · audit logs · the
age input for Individual and Family

The database and API behind the management screens exist; only the UI is
missing. A `SELECT` field type (dropdown with employee-defined choices) was
deliberately deferred — `TEXT` covers arbitrary values, and adding it later is
one enum value plus a small table.
