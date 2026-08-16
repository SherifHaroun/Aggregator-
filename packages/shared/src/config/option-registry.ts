/**
 * Generic building blocks for every "selectable option" list in the application
 * (customer types, geographical coverage, and any future comparison option).
 *
 * Every option list in `src/config` is declared with this shape so that:
 *  - the UI can render any list without knowing what it contains,
 *  - the API can validate any list without a bespoke schema,
 *  - adding / removing / reordering / disabling an option is a one-line change.
 *
 * NOTE: These registries describe *application configuration* (the shape of the
 * comparison form). They are NOT insurance data. Insurance companies, plans,
 * benefits, prices and coverage values live in the database and are never
 * declared here.
 */

/** A single selectable option presented to the employee. */
export interface ConfigOption<TId extends string = string> {
  /** Stable machine identifier. Persisted, sent over the wire, never translated. */
  id: TId;
  /** Human-facing label shown in the UI. Safe to change at any time. */
  label: string;
  /** Optional supporting text shown under the label. */
  description?: string;
  /** Ascending display order. */
  order: number;
  /**
   * Soft switch. Disabled options stay in the codebase (and remain valid for
   * historical records) but are not offered in the UI.
   */
  enabled: boolean;
}

/** A keyed collection of options, e.g. `Record<CustomerTypeId, CustomerTypeOption>`. */
export type OptionRegistry<TId extends string, TOption extends ConfigOption<TId>> = Readonly<
  Record<TId, TOption>
>;

/** All options, enabled or not, in display order. */
export function listAllOptions<TId extends string, TOption extends ConfigOption<TId>>(
  registry: OptionRegistry<TId, TOption>,
): TOption[] {
  return Object.values(registry as Record<string, TOption>).sort((a, b) => a.order - b.order);
}

/** Only the options that should currently be offered in the UI, in display order. */
export function listEnabledOptions<TId extends string, TOption extends ConfigOption<TId>>(
  registry: OptionRegistry<TId, TOption>,
): TOption[] {
  return listAllOptions(registry).filter((option) => option.enabled);
}

/** Look up an option by id, or `undefined` when the id is unknown. */
export function findOption<TId extends string, TOption extends ConfigOption<TId>>(
  registry: OptionRegistry<TId, TOption>,
  id: string,
): TOption | undefined {
  return (registry as Record<string, TOption | undefined>)[id];
}

/** Type guard: is `value` a known id of this registry? */
export function isOptionId<TId extends string, TOption extends ConfigOption<TId>>(
  registry: OptionRegistry<TId, TOption>,
  value: unknown,
): value is TId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(registry, value);
}

/** Resolve an option's label, falling back to the raw id for unknown values. */
export function optionLabel<TId extends string, TOption extends ConfigOption<TId>>(
  registry: OptionRegistry<TId, TOption>,
  id: string,
): string {
  return findOption(registry, id)?.label ?? id;
}
