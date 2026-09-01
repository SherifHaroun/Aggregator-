import {
  DEFAULT_AGE_BANDS,
  GEOGRAPHICAL_COVERAGES,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  UNSPECIFIED_OPTION_LABEL,
  describeBracketProblem,
  listEnabledOptions,
  nextBracket,
  planTierLabel,
  rebalanceBrackets,
  removeBracket,
  variantDisplayName,
  type CompanyMedicalNetworkDto,
  type CustomerTypeId,
  type GeographicalCoverageId,
  type InsuranceOptionDto,
  type PlanConfigurationDto,
  type PlanOptionDto,
} from '@aggregator/shared';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Field,
  IconAdd,
  IconLayers,
  IconTrash,
  Input,
  NumberInput,
  Select,
  StatusToggle,
  describeError,
  useToast,
} from '@/components/ui';
import {
  useAddPlanOption,
  useRemovePlanOption,
  useSavePlanConfiguration,
} from '@/features/insurance-data/insurance-data.api';
import { AddBenefitDialog } from './AddBenefitDialog';
import { BenefitConditions } from './BenefitConditions';
import { BenefitCoreFields, BenefitValue, isCondition } from './AttachedBenefitFields';
import { PlanOptionNoteInline } from './PlanOptionValuesForm';
import { appliesToCustomerType } from './settings';
import { isResolved, optionalBenefitChoices, resolveCoreSections } from './core-benefits';

interface BandDraft {
  key: string;
  from: string;
  to: string;
  premium: string;
}

let nextKey = 0;
const newKey = () => `band-${(nextKey += 1)}`;

const toBandDrafts = (variant: PlanConfigurationDto): BandDraft[] =>
  variant.priceBands.map((band) => ({
    key: newKey(),
    from: String(band.ageFrom),
    to: String(band.ageTo),
    premium: band.annualPrice === null ? '' : String(band.annualPrice),
  }));

/**
 * THE WHOLE VARIANT, ON ONE PAGE.
 *
 * What it covers and on what terms, the six core areas every plan is judged on,
 * whichever additional benefits it states, and the premium at every age it is
 * sold at. One screen, because they are one document to the person reading them
 * off an insurer's PDF.
 *
 * The core areas are LABELS, not records. "In-patient" is this business's
 * heading; the record beneath it is whatever the catalogue already holds —
 * "Inpatient & Daycase" at one company, "Inpatient and daycare Details" at
 * another. Nothing is created here to make a heading fit; an area the catalogue
 * has no record for says so and points at the Benefits screen.
 *
 * TWO SAVING RULES, on purpose. The variant's own terms and its rate table are
 * a form, saved together by the button at the foot. A benefit's values save
 * themselves as they are typed — that is older than this screen and worth
 * keeping: benefits are filled in while reading a document, and losing a
 * screenful to a missed button is the failure worth designing out.
 */
export function VariantEditorForm({
  variant,
  planName,
  customerType,
  catalogue,
  networks,
}: {
  variant: PlanConfigurationDto;
  planName: string;
  /** The plan's, never the variant's — every variant beneath it shares it. */
  customerType: CustomerTypeId;
  catalogue: InsuranceOptionDto[];
  networks: CompanyMedicalNetworkDto[];
}) {
  const { notify } = useToast();
  const save = useSavePlanConfiguration(variant.id);
  const addOption = useAddPlanOption(variant.id);
  const removeOption = useRemovePlanOption(variant.id);

  const sections = useMemo(() => resolveCoreSections(catalogue), [catalogue]);
  const byId = useMemo(() => {
    const map = new Map<string, InsuranceOptionDto>();
    const walk = (option: InsuranceOptionDto) => {
      map.set(option.id, option);
      for (const child of option.children ?? []) walk(child);
    };
    for (const option of catalogue) walk(option);
    return map;
  }, [catalogue]);

  const attached = variant.options ?? [];

  /** Every record the six core areas occupy — group and members alike. */
  const coreOptionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const section of sections) {
      if (!isResolved(section)) continue;
      ids.add(section.attach.id);
      for (const target of section.targets) ids.add(target.option.id);
    }
    return ids;
  }, [sections]);

  /**
   * Additional benefits: the top-level records on this variant that are not one
   * of the six. A group's members render underneath it rather than as rows of
   * their own, because attaching a group brings them and listing both would
   * offer the same cover twice.
   */
  const attachedOptionIds = new Set(attached.map((planOption) => planOption.optionId));
  const additional = attached.filter(
    (planOption) =>
      !coreOptionIds.has(planOption.optionId) &&
      /**
       * A member is shown UNDER its group, so it is not a row of its own —
       * unless the group has been taken off and it alone is left, in which case
       * hiding it would make an attached benefit unreachable.
       */
      (planOption.parentOptionId === null || !attachedOptionIds.has(planOption.parentOptionId)),
  );

  const attachedIds = new Set(attached.map((planOption) => planOption.optionId));
  const available = optionalBenefitChoices(catalogue, new Set([...coreOptionIds, ...attachedIds]));

  // --- the variant's own terms, saved together ------------------------------

  const [coverage, setCoverage] = useState<GeographicalCoverageId>(variant.geographicalCoverage);
  const [networkId, setNetworkId] = useState(variant.medicalNetworkId ?? '');
  const [annualLimit, setAnnualLimit] = useState(
    variant.annualLimit === null ? '' : String(variant.annualLimit),
  );
  const [currency, setCurrency] = useState(variant.currency ?? '');
  const [deductible, setDeductible] = useState(
    variant.deductible === null ? '' : String(variant.deductible),
  );
  const [coPayment, setCoPayment] = useState(
    variant.coPayment === null ? '' : String(variant.coPayment),
  );
  const [isActive, setIsActive] = useState(variant.isActive);
  const [bands, setBands] = useState<BandDraft[]>(() => toBandDrafts(variant));

  const [adding, setAdding] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setError(null);
    setCoverage(variant.geographicalCoverage);
    setNetworkId(variant.medicalNetworkId ?? '');
    setAnnualLimit(variant.annualLimit === null ? '' : String(variant.annualLimit));
    setCurrency(variant.currency ?? '');
    setDeductible(variant.deductible === null ? '' : String(variant.deductible));
    setCoPayment(variant.coPayment === null ? '' : String(variant.coPayment));
    setIsActive(variant.isActive);
    setBands(toBandDrafts(variant));
  }

  // --- benefits: attached and removed at once, values save themselves -------

  /**
   * Attaching a GROUP brings its members with it, so the optimistic rows are
   * the group and everything under it, in the order they should read.
   */
  function attachBenefit(option: InsuranceOptionDto) {
    setError(null);
    setPendingAdd(option.id);
    addOption.mutate(
      { option, rows: [option, ...(option.children ?? [])] },
      {
        onSuccess: () => {
          notify(`${option.name} was added.`);
          setPendingAdd(null);
        },
        onError: (addError) => {
          setError(describeError(addError, 'the benefit'));
          setPendingAdd(null);
        },
      },
    );
  }

  function detachBenefit(planOptionId: string, name: string) {
    setError(null);
    removeOption.mutate(planOptionId, {
      onSuccess: () => notify(`${name} was removed.`),
      onError: (removeError) => setError(describeError(removeError, 'the benefit')),
    });
  }

  /**
   * Every plan option one section covers: the records named, and anything
   * attached UNDER them.
   *
   * Read off the attachments rather than the catalogue's nesting, because a
   * member is a member by virtue of pointing at its group — waiting for the
   * catalogue to say so as well is how an attached sub-benefit goes missing
   * from the only screen that could edit it.
   */
  const rowsUnder = (optionIds: Set<string>) =>
    attached.filter(
      (planOption) =>
        optionIds.has(planOption.optionId) ||
        (planOption.parentOptionId !== null && optionIds.has(planOption.parentOptionId)),
    );

  // --- age bands ------------------------------------------------------------

  function addBand() {
    setError(null);
    setBands((rows) => {
      /**
       * An SME table is a partition, so a new bracket continues where the last
       * one ended. Anywhere else the bands are just rows and the same guess is
       * as good a starting point as any.
       */
      const suggestion =
        rows.length === 0
          ? (DEFAULT_AGE_BANDS[0] ?? { from: MIN_INSURABLE_AGE, to: MIN_INSURABLE_AGE })
          : (() => {
              const bracket = nextBracket(
                rows.map((row) => ({ ageFrom: Number(row.from), ageTo: Number(row.to) })),
              );
              return { from: bracket.ageFrom, to: bracket.ageTo };
            })();

      const from = Math.min(suggestion.from, MAX_INSURABLE_AGE);
      return [
        ...rows,
        {
          key: newKey(),
          from: String(from),
          to: String(Math.min(Math.max(suggestion.to, from), MAX_INSURABLE_AGE)),
          premium: '',
        },
      ];
    });
  }

  /**
   * WHAT AN SME'S BRACKETS DO WHEN ONE BOUNDARY MOVES.
   *
   * They stay a partition. Changing 21-25 to 21-27 makes the next start at 28;
   * pulling 26-30 back to 28-30 pushes the one before to end at 27. Each
   * premium stays with its own bracket — the row is re-bounded, not replaced.
   *
   * Done when the box is LEFT rather than on every keystroke, so typing "2" on
   * the way to "28" does not drag the neighbours through 3 and 4 first.
   */
  function rebalanceFrom(key: string) {
    if (!usesBrackets) return;
    setBands((rows) => {
      const index = rows.findIndex((row) => row.key === key);
      if (index === -1) return rows;
      if (rows.some((row) => row.from.trim() === '' || row.to.trim() === '')) return rows;

      const rebalanced = rebalanceBrackets(
        rows.map((row) => ({ ageFrom: Number(row.from), ageTo: Number(row.to), row })),
        index,
      );
      return rebalanced.map((bracket) => ({
        ...bracket.row,
        from: String(bracket.ageFrom),
        to: String(bracket.ageTo),
      }));
    });
  }

  function dropBand(key: string) {
    setError(null);
    setBands((rows) => {
      const index = rows.findIndex((row) => row.key === key);
      if (index === -1) return rows;
      if (!usesBrackets) return rows.filter((row) => row.key !== key);

      /** The bracket after it takes over the years it covered, so no gap opens. */
      const closed = removeBracket(
        rows.map((row) => ({ ageFrom: Number(row.from), ageTo: Number(row.to), row })),
        index,
      );
      return closed.map((bracket) => ({
        ...bracket.row,
        from: String(bracket.ageFrom),
        to: String(bracket.ageTo),
      }));
    });
  }

  /**
   * The first thing wrong with the rate table, in the order it reads.
   *
   * Bands may not OVERLAP: an age has to fall into exactly one of them, or the
   * premium a customer is quoted depends on which row happened to be read
   * first. The API refuses the same thing — this is so the employee hears it
   * before the request goes.
   */
  function bandProblem(): string | null {
    for (const row of bands) {
      if (row.from.trim() === '' || row.to.trim() === '') return 'Every band needs both ages.';
      const from = Number(row.from);
      const to = Number(row.to);
      if (!Number.isInteger(from) || !Number.isInteger(to)) {
        return 'Enter whole numbers of years.';
      }
      if (from < MIN_INSURABLE_AGE || to > MAX_INSURABLE_AGE) {
        return `Ages run from ${MIN_INSURABLE_AGE} to ${MAX_INSURABLE_AGE}.`;
      }
      if (from > to) return `Ages ${from}–${to} run backwards.`;
    }

    /**
     * An SME's brackets must also leave no GAP: they price a workforce, so an
     * age between the first and the last that nobody priced is an employee
     * nobody can be quoted for. Elsewhere a plan may simply not be sold at an
     * age, and the absence of a band says exactly that.
     */
    return describeBracketProblem(
      bands.map((row) => ({ ageFrom: Number(row.from), ageTo: Number(row.to) })),
      { requireContiguous: usesBrackets },
    );
  }

  const updateBand = (key: string, patch: Partial<BandDraft>) => {
    setError(null);
    setBands((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  function submit() {
    const problem = bandProblem();
    if (problem) {
      setError(problem);
      return;
    }

    save.mutate(
      {
        geographicalCoverage: coverage,
        medicalNetworkId: networkId === '' ? null : networkId,
        annualLimit: annualLimit.trim() === '' ? null : Number(annualLimit.replace(/,/g, '')),
        currency: currency.trim() === '' ? null : currency.trim().toUpperCase(),
        deductible: deductible.trim() === '' ? null : Number(deductible.replace(/,/g, '')),
        coPayment: coPayment.trim() === '' ? null : Number(coPayment.replace(/,/g, '')),
        isActive,
        /**
         * The rate table is replaced whole, so a band removed here is a band
         * the plan no longer sells.
         */
        priceBands: bands.map((row) => ({
          ageFrom: Number(row.from),
          ageTo: Number(row.to),
          annualPrice: row.premium.trim() === '' ? null : Number(row.premium.replace(/,/g, '')),
        })),
      },
      {
        onSuccess: () => notify('The variant was saved.'),
        onError: (saveError) => setError(describeError(saveError, 'the variant')),
      },
    );
  }

  /**
   * SME is priced by employee bracket — a partition of the ages, where every
   * one falls into exactly one row. An individual has one age and a family is a
   * list of people, so neither is a partition and neither gets this.
   */
  const usesBrackets = customerType === 'SME';

  const tier = planTierLabel(
    annualLimit.trim() === '' ? null : Number(annualLimit.replace(/,/g, '')),
  );

  return (
    <div className="space-y-5">
      {error ? (
        <Callout tone="danger" title="Could not save">
          {error}
        </Callout>
      ) : null}

      <Card>
        <CardHeader
          title={variantDisplayName(planName, coverage)}
          description="The plan's name and this scope read together. It is never typed, and it follows the plan if the plan is renamed."
          action={tier ? <Badge tone="brand">{tier}</Badge> : undefined}
        />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Coverage">
            {(props) => (
              <Select
                {...props}
                value={coverage}
                onChange={(event) => setCoverage(event.target.value as GeographicalCoverageId)}
              >
                {listEnabledOptions(GEOGRAPHICAL_COVERAGES).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Medical network"
            hint={
              networks.length === 0
                ? 'This company has no networks yet.'
                : 'From this company’s own list.'
            }
          >
            {(props) => (
              <Select
                {...props}
                value={networkId}
                disabled={networks.length === 0}
                onChange={(event) => setNetworkId(event.target.value)}
              >
                <option value="">{UNSPECIFIED_OPTION_LABEL}</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* The tier is read off this figure — nothing to pick, and it moves
              the moment the ceiling does. */}
          <Field label="Annual limit" {...(tier ? { hint: `Reads as ${tier}.` } : {})}>
            {(props) => (
              <NumberInput
                {...props}
                suffix={currency}
                value={annualLimit}
                onChange={setAnnualLimit}
              />
            )}
          </Field>

          <Field label="Currency" hint="Three-letter code.">
            {(props) => (
              <Input
                {...props}
                maxLength={3}
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                placeholder="EGP"
              />
            )}
          </Field>

          {/* Blank means the document did not state one — never a zero. */}
          <Field label="Deductible" hint={NOT_STATED}>
            {(props) => (
              <NumberInput
                {...props}
                suffix={currency}
                value={deductible}
                onChange={setDeductible}
              />
            )}
          </Field>

          <Field label="Co-payment" hint={NOT_STATED}>
            {(props) => (
              <NumberInput {...props} suffix="%" value={coPayment} onChange={setCoPayment} />
            )}
          </Field>

          <Field label="Status">
            {(props) => <StatusToggle id={props.id} value={isActive} onChange={setIsActive} />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Core benefits"
          description="The six areas every plan is judged on. Each box saves itself; blank means the document did not say."
        />
        <CardBody className="divide-y divide-(--color-border)" role="region" aria-label="Core benefits">
          {sections.map((section) => (
            <div key={section.label} className="py-4 first:pt-0 last:pb-0">
              {isResolved(section) ? (
                <BenefitRow
                  label={section.label}
                  attached={rowsUnder(
                    new Set([section.attach.id, ...section.targets.map((t) => t.option.id)]),
                  )}
                  customerType={customerType}
                  adding={pendingAdd === section.attach.id}
                  onAdd={() => attachBenefit(section.attach)}
                  {...(section.attach.name === section.label
                    ? {}
                    : { note: `Recorded as “${section.attach.name}”` })}
                />
              ) : (
                <>
                  <p className="text-content font-semibold">{section.label}</p>
                  <p className="text-content-muted mt-1 text-sm">
                    No benefit in the catalogue matches this area yet. Create one named{' '}
                    <span className="font-medium">{section.lookedFor[0]}</span> on the Benefits
                    screen and it will appear here.
                  </p>
                </>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Additional benefits"
          description="Only what this variant actually states. Nothing here is required."
          action={
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <IconAdd className="size-4" />
              Add benefit
            </Button>
          }
        />
        <CardBody role="region" aria-label="Additional benefits">
          {additional.length === 0 ? (
            <p className="text-content-muted text-sm">No additional benefits selected.</p>
          ) : (
            <ul className="divide-y divide-(--color-border)">
              {additional.map((planOption) => {
                const option = byId.get(planOption.optionId);
                return (
                  <li key={planOption.id} className="py-4 first:pt-0 last:pb-0">
                    <BenefitRow
                      label={planOption.optionName}
                      attached={rowsUnder(new Set([planOption.optionId]))}
                      customerType={customerType}
                      adding={false}
                      onAdd={() => {
                        const option = byId.get(planOption.optionId);
                        if (option) attachBenefit(option);
                      }}
                      onRemove={() => detachBenefit(planOption.id, planOption.optionName)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={usesBrackets ? 'Employee age brackets' : 'Age pricing'}
          description={
            usesBrackets
              ? 'One premium per bracket, running without gaps. Change a boundary and its neighbour follows.'
              : 'One premium per age band. The cover above is the same for all of them.'
          }
          action={
            <Button size="sm" variant="secondary" onClick={addBand}>
              <IconAdd className="size-4" />
              Add age band
            </Button>
          }
        />
        <CardBody>
          {bands.length === 0 ? (
            <p className="text-content-muted text-sm">
              No prices yet. Add the first age band this variant is sold at.
            </p>
          ) : (
            <ul className="space-y-2">
              {bands.map((row) => (
                <li key={row.key} className="flex items-end gap-2">
                  <label className="w-20">
                    <span className="text-content-subtle text-xs font-medium">From</span>
                    <Input
                      type="number"
                      min={MIN_INSURABLE_AGE}
                      max={MAX_INSURABLE_AGE}
                      step={1}
                      value={row.from}
                      aria-label="Age from"
                      onChange={(event) => updateBand(row.key, { from: event.target.value })}
                      onBlur={() => rebalanceFrom(row.key)}
                    />
                  </label>
                  <label className="w-20">
                    <span className="text-content-subtle text-xs font-medium">To</span>
                    <Input
                      type="number"
                      min={MIN_INSURABLE_AGE}
                      max={MAX_INSURABLE_AGE}
                      step={1}
                      value={row.to}
                      aria-label="Age to"
                      onChange={(event) => updateBand(row.key, { to: event.target.value })}
                      onBlur={() => rebalanceFrom(row.key)}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <span className="text-content-subtle text-xs font-medium">Annual premium</span>
                    <NumberInput
                      suffix={currency}
                      value={row.premium}
                      aria-label={`Annual premium for ages ${row.from} to ${row.to}`}
                      onChange={(next) => updateBand(row.key, { premium: next })}
                    />
                  </div>
                  {/* Blank is a statement, so it is labelled rather than left
                      looking like an unfinished row. */}
                  <p className="text-content-subtle w-24 pb-2.5 text-xs">
                    {row.premium.trim() === '' ? 'Not covered' : ''}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ages ${row.from} to ${row.to}`}
                    onClick={() => dropBand(row.key)}
                    className="text-content-muted hover:bg-surface-muted hover:text-danger mb-1 rounded-(--radius-control) p-2"
                  >
                    <IconTrash className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <p className="text-content-subtle mr-auto text-xs">
          Benefit values save as you type. Cancel and Save apply to the terms and the rate table.
        </p>
        <Button variant="secondary" onClick={reset} disabled={save.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {adding ? (
        <AddBenefitDialog
          available={available}
          onAdd={(chosen) => {
            for (const option of chosen) attachBenefit(option);
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

/** Says what a blank field means, so nobody types a 0 that isn't in the plan. */
const NOT_STATED = 'Leave blank if the plan does not state one.';

/**
 * ONE BENEFIT'S ROW: its heading, and whatever the catalogue says it carries.
 *
 * The fields are the board's own — conditional reveals, waiting periods that
 * appear once ticked, settings that apply to a family but not to an individual,
 * ranked answer lists. Rewriting them flat for a tidier layout would have
 * quietly thrown all of that away.
 *
 * A benefit the variant does not carry yet shows an Add rather than a row of
 * dead boxes, because a blank field and an absent benefit mean different
 * things — one says the document was silent, the other that nobody looked.
 */
function BenefitRow({
  label,
  attached,
  customerType,
  onAdd,
  onRemove,
  adding,
  note,
}: {
  label: string;
  /** Every plan option this section covers: the group and its members. */
  attached: PlanOptionDto[];
  customerType: CustomerTypeId;
  onAdd: () => void;
  onRemove?: () => void;
  adding: boolean;
  note?: string;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-content font-semibold">{label}</p>
          {/* Named when it differs, so it is clear WHICH record is being edited. */}
          {note ? <p className="text-content-subtle mt-0.5 text-xs">{note}</p> : null}
        </div>

        {attached.length === 0 ? (
          <Button size="sm" variant="secondary" onClick={onAdd} disabled={adding}>
            <IconAdd className="size-4" />
            {adding ? 'Adding…' : 'Add'}
          </Button>
        ) : onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
            className="text-content-muted hover:bg-surface-muted hover:text-danger rounded-(--radius-control) p-1.5"
          >
            <IconTrash className="size-4" />
          </button>
        ) : null}
      </div>

      {attached.length === 0 ? (
        <p className="text-content-subtle mt-1 text-sm">
          Not on this variant. Add it to record what the plan says.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {attached.map((planOption) => (
            <div key={planOption.id}>
              {attached.length > 1 ? (
                <p className="text-content-muted mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <IconLayers className="text-content-subtle size-3.5" />
                  {planOption.optionName}
                </p>
              ) : null}
              <BenefitValue planOption={planOption} pending={false} />
              <BenefitCoreFields
                planOption={planOption}
                customerType={customerType}
                disabled={false}
              />
              <BenefitConditions
                planOptionId={planOption.id}
                planConfigurationId={planOption.planConfigurationId}
                optionName={planOption.optionName}
                customerType={customerType}
                conditions={planOption.values.filter(
                  (value) => isCondition(value) && appliesToCustomerType(value, customerType),
                )}
                disabled={false}
              />
              {/*
                The remark that qualifies the figures — "1 in 10 members",
                "basic procedures only". It belongs to this variant, not to the
                benefit: the same benefit is noted differently on the next plan.
              */}
              <PlanOptionNoteInline
                planOptionId={planOption.id}
                planConfigurationId={planOption.planConfigurationId}
                optionName={planOption.optionName}
                note={planOption.note}
                disabled={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
