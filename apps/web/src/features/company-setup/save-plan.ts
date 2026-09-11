/**
 * SAVING A DRAFTED PLAN — one path, whoever drafted it.
 *
 * The add-plan form and the document import both end with the same thing: a
 * plan name, a network, and variants with their figures, co-payments, detail
 * lines and rate tables. This is the sequence of API calls that writes that,
 * shared so an imported plan lands in the database exactly as a typed one
 * would — same catalogue reuse, same co-payment fields, same notes.
 *
 * Benefits are settled BEFORE the plan is created. A name clashing with a
 * benefit group, or wording typed into a benefit that carries a figure, both
 * stop the save — and a plan created first would survive as an empty shell
 * nobody asked for. Benefits are global, so anything created here is reusable
 * rather than debris.
 */

import {
  ALTERNATIVE_VALUE_KEY,
  BENEFIT_DETAIL_SEPARATOR,
  BENEFIT_INCLUDED_LABEL,
  CO_PAYMENT_FIELD,
  CORE_MEDICAL_BENEFITS,
  MAX_INSURABLE_AGE,
  MIN_INSURABLE_AGE,
  derivePlanCode,
  medicalBenefitLookupNames,
  resolveBenefitSpec,
  variantDisplayName,
  type CustomerTypeId,
  type InsuranceOptionDto,
  type MedicalBenefitSpec,
  type OptionFieldDto,
  type Paginated,
  type PlanConfigurationDto,
  type PlanDto,
  type PlanOptionDto,
} from '@aggregator/shared';
import { api, query } from '@/lib/api-client';
import { emptyEntry, type VariantDraft } from './variant-draft';

/** Currency for a plan entered by hand. Egypt is the only market so far. */
export const DEFAULT_CURRENCY = 'EGP';

const fold = (name: string) => name.trim().toLowerCase();

export interface PlanDraftInput {
  companyId: string;
  /** The company section the plan is created under. */
  customerType: CustomerTypeId;
  name: string;
  description?: string | null;
  /** '' = not stated. */
  medicalNetworkId: string;
  variants: VariantDraft[];
}

/**
 * A benefit resolved against the catalogue, ready to attach and value.
 *
 * `attach` is what goes onto the configuration; `valueOptionId` names the row
 * that receives the figure. The two differ only when the name belongs to a
 * benefit group, whose own sub-benefit holds the value.
 */
interface ResolvedBenefit {
  attach: InsuranceOptionDto;
  valueOptionId: string;
  valueFields: OptionFieldDto[];
}

/**
 * What a typed coverage box is worth to a field of this type.
 *
 * `undefined` means the two disagree — wording typed into a benefit that
 * carries a figure — which is reported rather than silently sent as `NaN`.
 */
function coerce(typed: string, dataType: string): string | number | undefined {
  const text = typed.trim();
  if (dataType === 'TEXT') return text;
  const number = Number(text.replace(/,/g, ''));
  return Number.isFinite(number) ? number : undefined;
}

/** Bands a variant actually priced. A blank premium means "not sold". */
export const pricedBands = (variant: VariantDraft) =>
  variant.bands.filter((band) => band.premium.trim() !== '');

/** Why a draft cannot be saved yet, in words, or null when it can. */
export function validatePlanDraft(input: PlanDraftInput): string | null {
  const name = input.name.trim();
  if (name === '') return 'Enter a plan name.';

  for (const [index, variant] of input.variants.entries()) {
    const label = variantDisplayName(name, variant.geographicalCoverage) || `Variant ${index + 1}`;
    if (variant.annualLimit.trim() === '') return `${label}: enter the annual limit.`;
    if (pricedBands(variant).length === 0) {
      return `${label}: enter a premium for at least one age band.`;
    }
    for (const band of pricedBands(variant)) {
      const from = Number(band.from);
      const to = Number(band.to);
      if (!Number.isInteger(from) || !Number.isInteger(to)) {
        return `${label}: age bands take whole numbers of years.`;
      }
      if (from < MIN_INSURABLE_AGE || to > MAX_INSURABLE_AGE || from > to) {
        return `${label}: check the ${band.from}–${band.to} band — ages run from ${MIN_INSURABLE_AGE} to ${MAX_INSURABLE_AGE}, lowest first.`;
      }
    }
  }

  // Two variants covering the same scope at the same ceiling are one
  // offering entered twice, and the API would refuse the second. Saying so
  // here costs nothing.
  const seen = new Set<string>();
  for (const variant of input.variants) {
    const identity = `${variant.geographicalCoverage}|${variant.annualLimit.trim()}|${(variant.roomType ?? '').trim()}`;
    if (seen.has(identity)) {
      return 'Two variants have the same coverage and limit. Change one of them.';
    }
    seen.add(identity);
  }
  return null;
}

/**
 * The benefit as it exists in the global catalogue, created on first use.
 *
 * REUSE BEFORE CREATE. The catalogue is the source of truth and it was not
 * written by this form. A company's in-patient cover may already be filed as
 * "Inpatient and daycare Details"; creating "In-patient" beside it would split
 * the same benefit across two records, and nothing could compare them.
 *
 * So every name this benefit is known by is tried — its own first, then the
 * aliases — and only a benefit the catalogue genuinely does not have is
 * created. When the name already belongs to a BENEFIT GROUP the group is used
 * as it stands and the figure goes to the first sub-benefit that can hold one.
 */
async function ensureBenefit(
  spec: MedicalBenefitSpec,
  catalogue: Map<string, InsuranceOptionDto>,
): Promise<ResolvedBenefit> {
  const existing = medicalBenefitLookupNames(spec)
    .map((name) => catalogue.get(fold(name)))
    .find((match) => match !== undefined);

  if (existing?.isUmbrella) {
    const target = (existing.children ?? []).find((child) =>
      (child.fields ?? []).some((field) => field.key !== ALTERNATIVE_VALUE_KEY),
    );
    if (!target) {
      throw new Error(
        `"${spec.name}" is a benefit group with nothing underneath it that holds a value. Add a benefit to that group on the Benefits screen, then add this plan again.`,
      );
    }
    return { attach: existing, valueOptionId: target.id, valueFields: target.fields ?? [] };
  }

  let option = existing;
  if (!option) {
    option = await api.post<InsuranceOptionDto>('/insurance-options', {
      name: spec.name,
      valueKind: spec.valueKind,
    });
  }

  /**
   * A core area carries ONE figure, of the kind the business fixed for it.
   * Nothing else is created alongside it — a co-payment box added here would
   * be a field no screen fills and the comparison would still find.
   */
  const settled = await api.get<InsuranceOptionDto>(`/insurance-options/${option.id}`);
  catalogue.set(fold(spec.name), settled);
  return { attach: settled, valueOptionId: settled.id, valueFields: settled.fields ?? [] };
}

/**
 * Which benefits a variant records, core and optional together.
 *
 * An optional benefit the catalogue does not know — one a document named —
 * is still stated, as its wording; `resolveBenefitSpec` gives it a spec.
 */
export function statedBenefits(variant: VariantDraft): MedicalBenefitSpec[] {
  const all = [...CORE_MEDICAL_BENEFITS, ...variant.extras.map(resolveBenefitSpec)];
  return all.filter((spec) => {
    // Ticking an optional benefit IS the statement that the variant includes
    // it; the box beside it only adds wording.
    if (variant.extras.includes(spec.name)) return true;
    const entry = variant.entries[spec.name];
    return (
      (entry?.coverage ?? '').trim() !== '' ||
      (entry?.details ?? []).some((line) => line.trim() !== '')
    );
  });
}

const numberOrUndefined = (typed: string | undefined) => {
  const text = (typed ?? '').trim().replace(/,/g, '');
  if (text === '') return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
};

/**
 * Write the draft: the plan once, then each variant with its benefits once
 * and its whole rate table with it. Returns the plan as created.
 *
 * `onProgress` is told what is being saved, for a screen to show.
 */
export async function savePlanDraft(
  input: PlanDraftInput,
  onProgress: (message: string) => void = () => {},
): Promise<PlanDto> {
  const name = input.name.trim();

  onProgress('Preparing benefits…');
  const page = await api.get<Paginated<InsuranceOptionDto>>(
    `/insurance-options${query({ pageSize: 200 })}`,
  );
  /**
   * CHILDREN COUNT TOO. The catalogue endpoint nests a group's members inside
   * it, so a map built from the top level alone cannot see "Physiotherapy"
   * filed under "Other key benefits" — and the form would try to create a
   * benefit the catalogue already has.
   */
  const catalogue = new Map<string, InsuranceOptionDto>();
  for (const item of page.items) {
    catalogue.set(fold(item.name), item);
    for (const child of item.children ?? []) catalogue.set(fold(child.name), child);
  }

  const definitions = new Map<string, ResolvedBenefit>();
  for (const variant of input.variants) {
    for (const spec of statedBenefits(variant)) {
      if (!definitions.has(spec.name)) {
        definitions.set(spec.name, await ensureBenefit(spec, catalogue));
      }
      const typed = (variant.entries[spec.name]?.coverage ?? '').trim();
      const field = definitions
        .get(spec.name)!
        .valueFields.find(
          (item) => item.key !== CO_PAYMENT_FIELD.key && item.key !== ALTERNATIVE_VALUE_KEY,
        );
      if (typed !== '' && field && coerce(typed, field.dataType) === undefined) {
        throw new Error(
          `${spec.name} takes a number, but "${typed}" is not one. Enter a figure, or change what this benefit carries on the Benefits screen.`,
        );
      }
    }
  }

  // --- the plan, once -------------------------------------------------------
  const plan = await api.post<PlanDto>('/plans', {
    companyId: input.companyId,
    customerType: input.customerType,
    name,
    code: derivePlanCode(name, input.customerType),
    description: (input.description ?? '').trim() === '' ? null : input.description!.trim(),
    medicalNetworkId: input.medicalNetworkId === '' ? null : input.medicalNetworkId,
    isActive: true,
  });

  // --- each variant: its benefits once, its whole rate table with it --------
  for (const variant of input.variants) {
    const label = variantDisplayName(name, variant.geographicalCoverage);
    onProgress(`Saving ${label}…`);

    const configuration = await api.post<PlanConfigurationDto>('/plan-configurations', {
      planId: plan.id,
      geographicalCoverage: variant.geographicalCoverage,
      currency: (variant.currency ?? '').trim() || DEFAULT_CURRENCY,
      annualLimit: Number(variant.annualLimit.replace(/,/g, '')),
      ...((variant.roomType ?? '').trim() !== '' ? { roomType: variant.roomType!.trim() } : {}),
      ...(numberOrUndefined(variant.deductible) !== undefined
        ? { deductible: numberOrUndefined(variant.deductible) }
        : {}),
      ...(numberOrUndefined(variant.coPayment) !== undefined
        ? { coPayment: numberOrUndefined(variant.coPayment) }
        : {}),
      /**
       * The whole rate table in the same request. A band is a row, so the
       * cover is entered once.
       */
      priceBands: pricedBands(variant).map((band) => ({
        ageFrom: Number(band.from),
        ageTo: Number(band.to),
        annualPrice: Number(band.premium.replace(/,/g, '')),
      })),
      isActive: true,
    });

    for (const spec of statedBenefits(variant)) {
      const definition = definitions.get(spec.name)!;
      const attached = await api.post<PlanOptionDto[]>(
        `/plan-configurations/${configuration.id}/options`,
        { optionId: definition.attach.id },
      );
      const row = attached.find((item) => item.optionId === definition.valueOptionId);
      if (!row) continue;

      const entry = variant.entries[spec.name] ?? emptyEntry();
      const isExtra = variant.extras.includes(spec.name);
      const written = isExtra
        ? entry.coverage.trim() === ''
          ? BENEFIT_INCLUDED_LABEL
          : entry.coverage.trim()
        : entry.coverage.trim();

      const coverageField = row.values.find((value) => value.fieldKey !== CO_PAYMENT_FIELD.key);
      if (coverageField && written !== '') {
        const value = coerce(written, coverageField.dataType);
        if (value === undefined) {
          throw new Error(
            `${spec.name} takes a number, but "${written}" is not one. Enter a figure, or change what this benefit carries on the Benefits screen.`,
          );
        }
        await api.put(`/plan-options/${row.id}/values/${coverageField.optionFieldId}`, { value });
      }

      /**
       * THE MEMBER'S SHARE, beside the figure, for a core area. The record
       * grows the co-payment field the first time a plan states one, on the
       * same row that holds the figure. Blank is left unwritten: the
       * comparison reads no co-payment.
       */
      const typedShare = isExtra ? '' : entry.coPayment.trim();
      if (typedShare !== '') {
        const share = Number(typedShare.replace(/,/g, ''));
        if (!Number.isFinite(share)) {
          throw new Error(
            `${spec.name} co-payment must be a percentage, but "${typedShare}" is not one.`,
          );
        }
        let shareFieldId = row.values.find(
          (value) => value.fieldKey === CO_PAYMENT_FIELD.key,
        )?.optionFieldId;
        if (!shareFieldId) {
          const created = await api.post<OptionFieldDto>(
            `/insurance-options/${row.optionId}/fields`,
            {
              label: CO_PAYMENT_FIELD.label,
              key: CO_PAYMENT_FIELD.key,
              dataType: CO_PAYMENT_FIELD.dataType,
              unit: CO_PAYMENT_FIELD.unit,
            },
          );
          shareFieldId = created.id;
        }
        await api.put(`/plan-options/${row.id}/values/${shareFieldId}`, { value: share });
      }

      const details = entry.details.map((line) => line.trim()).filter((line) => line !== '');
      if (details.length > 0) {
        await api.patch(`/plan-options/${row.id}/note`, {
          note: details.join(BENEFIT_DETAIL_SEPARATOR),
        });
      }
    }
  }

  return plan;
}
