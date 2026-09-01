import {
  BENEFIT_VALUE_KINDS,
  isCoreMedicalBenefit,
  medicalBenefitSpec,
} from '@aggregator/shared';

/**
 * WHICH COLUMNS A COMPARISON HAS.
 *
 * Its own file because it is a rule rather than a query: the answer depends
 * only on what the plans carry, never on the database, and it is worth being
 * able to state that rule directly.
 */

/** All this rule reads off a benefit attached to a plan. */
export interface ComparableOption {
  optionId: string;
  option: {
    name: string;
    isUmbrella: boolean;
    parentId: string | null;
    fields?: { dataType: string }[];
  };
}

export interface ComparisonColumn {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * THE SIX CORE AREAS, AND NOTHING ELSE.
 *
 * A comparison ranks plans against each other, which only means anything where
 * every plan answers the same question. The six core areas are those questions
 * — in-patient and out-patient as a share of the bill, maternity, dental,
 * optical and chronic cover as a ceiling — and each is quoted one way by every
 * plan that states it.
 *
 * Everything else a plan carries is ADDITIONAL: stated in words, present on one
 * plan and absent from the next, and read when somebody opens a plan rather
 * than when plans are placed side by side. Scoring on it would rank plans on
 * whichever happened to have been typed in most fully.
 *
 * The core areas are found by NAME through the shared aliases, because the
 * catalogue records them under whatever the documents called them —
 * "Inpatient & Daycase" at one company, "Inpatient and daycare Details" at
 * another.
 */
export function discoverComparisonColumns(
  configurations: { options: ComparableOption[] }[],
): ComparisonColumn[] {
  const groupNameByOptionId = new Map<string, string>();
  for (const configuration of configurations) {
    for (const planOption of configuration.options) {
      if (planOption.option.isUmbrella)
        groupNameByOptionId.set(planOption.optionId, planOption.option.name);
    }
  }

  /** One column per area, whichever record turns out to hold its figure. */
  const claimed = new Set<string>();
  const discovered = new Map<string, ComparisonColumn>();
  for (const configuration of configurations) {
    for (const planOption of configuration.options) {
      // A group is a heading, not cover: its members carry the figures.
      if (planOption.option.isUmbrella) continue;
      if (discovered.has(planOption.optionId)) continue;

      const spec =
        medicalBenefitSpec(planOption.option.name) ??
        /**
         * A member of a core group — "Dental Limit" under "Dental" — is the
         * record the figure actually sits on, so the group's name is what
         * decides whether it is core.
         */
        (planOption.option.parentId
          ? medicalBenefitSpec(groupNameByOptionId.get(planOption.option.parentId) ?? '')
          : null);
      if (!spec || !isCoreMedicalBenefit(spec.name)) continue;

      /**
       * ONE COLUMN PER AREA, on the record that carries the figure.
       *
       * A core group holds several members — "Dental Limit" beside "Dental
       * Coverage", "Outpatient Services" beside "Outpatient Network Scope" —
       * and only one of them answers the question the area is quoted in. The
       * rest would each become a column of their own, all headed "Dental",
       * comparing plans on things they were never asked.
       */
      const wanted = BENEFIT_VALUE_KINDS[spec.valueKind].field.dataType;
      const carriesFigure = (planOption.option.fields ?? []).some(
        (field) => field.dataType === wanted,
      );
      if (!carriesFigure) continue;
      if (claimed.has(spec.name)) continue;
      claimed.add(spec.name);

      discovered.set(planOption.optionId, {
        id: planOption.optionId,
        // Named by the AREA, so every plan's column reads the same.
        name: spec.name,
        sortOrder: spec.order,
      });
    }
  }

  return [...discovered.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}
