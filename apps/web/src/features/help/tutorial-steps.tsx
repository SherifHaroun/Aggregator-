import {
  CUSTOMER_TYPES,
  SME_FIXED_AVERAGE_AGE,
  listEnabledOptions,
  type CustomerTypeOption,
} from '@aggregator/shared';
import type { ReactNode } from 'react';
import { BranchTree, FlowStack, FlowWrap, MockPanel, VisualFrame } from './tutorial-visuals';

/**
 * ============================================================================
 *  THE WALKTHROUGH, AS CONTENT
 * ============================================================================
 *
 * The six steps an employee goes through, in the order the application itself
 * imposes: a company, then its plans, then the cover those plans carry, then
 * the conditions each price applies under, then editing, then comparing.
 *
 * Kept declarative, like `comparison-form.ts` and `navigation.ts`: the
 * walkthrough component renders whatever this file describes and names nothing
 * itself. Rewording a step, reordering the flow or adding a seventh one is a
 * change to this file alone.
 *
 * Business values are read from `@aggregator/shared` rather than typed in, so
 * the tutorial cannot drift from the rules the application actually applies.
 */

export interface TutorialStep {
  /** Stable key — also what the step animation is re-keyed on. */
  id: string;
  /** The short title, shown large. */
  title: string;
  /** One sentence saying what this step is for. */
  lead: string;
  /** What the employee actually does, in order. One action per line. */
  actions: readonly string[];
  /** The drawing for this step. */
  visual: ReactNode;
  /** The one thing worth remembering afterwards. */
  note: string;
}

/**
 * The customer types whose age the employee types in, and the one the system
 * fills in for them. Derived, so retiring or adding a customer type in the
 * shared config rewrites these sentences rather than dating them.
 */
const enabledCustomerTypes = listEnabledOptions(CUSTOMER_TYPES);

const typedAgeTypes: CustomerTypeOption[] = enabledCustomerTypes.filter(
  (type) => type.ageInputMode !== 'FIXED_AVERAGE',
);

const fixedAgeType = enabledCustomerTypes.find((type) => type.ageInputMode === 'FIXED_AVERAGE');

/** "Individual and Family" — from the registry, not from this sentence. */
const typedAgeLabels = typedAgeTypes.map((type) => type.label).join(' and ');

const fixedAgeSentence = fixedAgeType
  ? ` ${fixedAgeType.label} comparisons always use the standard average age of ${SME_FIXED_AVERAGE_AGE}, so no age is asked for.`
  : '';

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'company',
    title: 'Create a company',
    lead: 'Start by adding the insurance company you want to manage.',
    actions: [
      'Click "Add Company" in the sidebar.',
      'Type the company name.',
      'Press "Create company".',
      'Add the logo afterwards from the company page. It is optional.',
    ],
    visual: (
      <VisualFrame>
        <MockPanel
          title="Add a company"
          rows={[
            { label: 'Company name', value: 'Your insurer' },
            { label: 'Logo', value: 'Optional' },
          ]}
          action="Create company"
        />
      </VisualFrame>
    ),
    note: 'Saving takes you straight to the next step — setting up this company’s plans.',
  },

  {
    id: 'plan',
    title: 'Add a plan',
    lead: 'Now create the plans this company offers.',
    actions: [
      'Give the plan a name — Basic, Medium or Premium, for example.',
      'Choose the insurance type, or type a new one if it does not exist yet.',
      'Fill in the plan details and press "Add plan".',
      'Repeat for every plan the company sells.',
    ],
    visual: (
      <VisualFrame>
        <FlowStack
          nodes={[
            { label: 'Company' },
            { label: 'Add plan' },
            { label: 'Choose insurance type' },
            { label: 'Enter plan details' },
            { label: 'Save', emphasis: true },
          ]}
        />
      </VisualFrame>
    ),
    note: 'Nothing is preloaded — every plan is one you created. You can edit any of them later from Companies.',
  },

  {
    id: 'benefits',
    title: 'Add benefits',
    lead: 'Add the cover this plan includes.',
    actions: [
      'Open the plan, then its configuration.',
      'Drag a benefit onto the plan, or press "Add" beside it.',
      'Set the percentage that applies here.',
      'Press "New benefit" if the one you need does not exist yet.',
    ],
    visual: (
      <VisualFrame>
        <BranchTree root="Plan" leaves={['Outpatient', 'Inpatient', 'Dental', 'Optical']} />
      </VisualFrame>
    ),
    note: 'Benefits are what customers end up comparing, so this is the part that decides which plan wins. Benefits are shared by every company — only the percentage is set here.',
  },

  {
    id: 'conditions',
    title: 'Set the conditions',
    lead: 'Say who a price applies to, and when.',
    actions: [
      'Choose the customer type and the coverage area.',
      'Set the age range this price covers.',
      'Enter the currency and the annual price.',
      'Annual limit, deductible and co-payment are optional.',
    ],
    visual: (
      <VisualFrame>
        <MockPanel
          title="Plan configuration"
          rows={[
            { label: 'Customer type', value: typedAgeTypes[0]?.label ?? '—' },
            { label: 'Coverage', value: 'Local' },
            { label: 'Age range', value: '18 – 45' },
            { label: 'Currency', value: 'USD' },
            { label: 'Annual price', value: '1,200' },
          ]}
        />
      </VisualFrame>
    ),
    note: `For ${typedAgeLabels}, you set the age range yourself.${fixedAgeSentence} You filled the first configuration in when you added the plan — add another for a different customer type, coverage area or age band.`,
  },

  {
    id: 'review',
    title: 'Review your plans',
    lead: 'Your company is ready.',
    actions: [
      'Open "Companies" in the sidebar.',
      'Select the company.',
      'View its plans.',
      'Edit the company, a plan, a configuration or its benefits.',
    ],
    visual: (
      <VisualFrame>
        <FlowStack
          nodes={[
            { label: 'Companies' },
            { label: 'Select company' },
            { label: 'View plans' },
            { label: 'Edit company, plan or benefits', emphasis: true },
          ]}
        />
      </VisualFrame>
    ),
    note: 'You never have to recreate anything. Come back at any time and change what is already there.',
  },

  {
    id: 'compare',
    title: 'Start comparing',
    lead: 'With companies and plans in place, you can compare them for a customer.',
    actions: [
      'Open "Compare plans" in the sidebar.',
      'Answer the questions about the customer.',
      'Let the system work the budget out, or enter an amount.',
      'Press "Compare Plans" to see the matching plans, best first.',
    ],
    visual: (
      <VisualFrame className="space-y-4">
        <FlowWrap
          nodes={[
            { label: 'Insurance type' },
            { label: 'Who to insure' },
            { label: 'Coverage' },
            { label: 'Age' },
            { label: 'Currency' },
            { label: 'Budget' },
          ]}
        />
        <FlowStack
          nodes={[{ label: 'Matching plans' }, { label: 'Best options', emphasis: true }]}
        />
      </VisualFrame>
    ),
    note: 'You never pick benefits for the customer. The system filters every plan on record against what you entered, and finds the benefits for you.',
  },
];

export const TUTORIAL_TITLE = 'How it works';
export const TUTORIAL_SUBTITLE = 'The whole system, one step at a time.';
