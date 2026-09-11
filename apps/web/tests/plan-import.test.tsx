/**
 * THE DOCUMENT IMPORT, THROUGH THE SCREEN.
 *
 * A Word document is chosen in a company's section, the API reads it as a
 * job the screen polls, and the answer is reviewed as plan cards before
 * Publish writes every plan the way a typed one is written. The fake API
 * scripts the answer — nothing here calls a model — and every record is
 * invented inside the test.
 */

import type { ImportedDocument, InsuranceOptionDto } from '@aggregator/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { createStore, installFakeApi, type FakeStore } from './fake-api';
import { renderApp } from './render';

let store: FakeStore;
const originalFetch = globalThis.fetch;
const timestamps = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

beforeEach(() => {
  store = installFakeApi(createStore());
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function givenCompany(id = 'company_1', name = 'Arope Insurance') {
  store.companies.push({
    id,
    name,
    shortName: null,
    logoUrl: null,
    description: null,
    website: null,
    email: null,
    phone: null,
    mobile: null,
    address: null,
    isActive: true,
    ...timestamps,
  });
  return id;
}

/** The catalogue as the entry form finds it: the seven core areas, each with its figure. */
function givenCoreCatalogue() {
  const areas = [
    ['In-patient', 'PERCENTAGE'],
    ['Out-patient', 'PERCENTAGE'],
    ['Maternity', 'CURRENCY'],
    ['Dental', 'CURRENCY'],
    ['Optical', 'CURRENCY'],
    ['Chronic / Pre-existing Conditions', 'CURRENCY'],
    ['Medication', 'CURRENCY'],
  ] as const;
  for (const [index, [name, dataType]] of areas.entries()) {
    const id = `core_${index}`;
    store.options.push({
      id,
      name,
      description: null,
      sortOrder: index,
      isUmbrella: false,
      parentId: null,
      isActive: true,
      ...timestamps,
      fields: [
        {
          id: `${id}_value`,
          optionId: id,
          label: dataType === 'CURRENCY' ? 'Limit' : 'Coverage',
          key: dataType === 'CURRENCY' ? 'limit' : 'percentage',
          dataType,
          unit: dataType === 'PERCENTAGE' ? '%' : null,
          helpText: null,
          isRequired: false,
          isOptional: false,
          sortOrder: 0,
          isActive: true,
          ...timestamps,
        },
      ],
    } as InsuranceOptionDto);
  }
}

/** One plan, as the model would return it: Dental named but with no limit. */
function eliteAnswer(): ImportedDocument {
  const core = (
    name: string,
    kind: 'COVERAGE' | 'LIMIT',
    value: number | null,
    coPayment: number | null,
    limitations: string[] = [],
    details = '',
  ) => ({ name, kind, value, coPayment, limitations, details, source: '' });
  return {
    document: {
      title: 'Elite Health',
      insurerNameInDocument: 'Arope Insurance',
      matchesCompany: true,
      currency: 'EGP',
      sectionEvidence: 'Group size 10 to 150',
    },
    planNames: ['Elite'],
    plans: [
      {
        name: 'Elite',
        description: 'Tier: High.',
        medicalNetwork: { name: 'Full Network', tierCode: 'Tier003N', source: '' },
        variants: [
          {
            geographicalCoverage: 'LOCAL',
            roomType: 'Private Room',
            currency: 'EGP',
            annualLimit: 600000,
            deductible: null,
            coPayment: null,
            priceBands: [
              { ageFrom: 0, ageTo: 17, annualPrice: 6187, source: '' },
              { ageFrom: 18, ageTo: 64, annualPrice: 12603, source: '' },
              { ageFrom: 65, ageTo: 120, annualPrice: null, source: '' },
            ],
            coreBenefits: [
              core('In-patient', 'COVERAGE', 100, null, ['In-network only'], 'Private room.'),
              core('Out-patient', 'COVERAGE', 80, null),
              core('Maternity', 'LIMIT', 10000, null),
              core('Dental', 'LIMIT', null, 10, ['Basic procedures only']),
              core('Optical', 'LIMIT', 1500, 10),
              core('Chronic / Pre-existing Conditions', 'LIMIT', 25000, null),
              core('Medication', 'LIMIT', 0, null),
            ],
            additionalBenefits: [
              {
                name: 'Congenital Defects',
                matchedExisting: '',
                value: 'Covers 25 congenital defects',
                details: '',
                source: '',
              },
            ],
            waitingPeriods: ['Maternity: 10 months'],
            conditions: ['Minimum group size: 10 employees'],
            exclusions: [],
          },
        ],
      },
    ],
    warnings: ['No premium is stated for members aged 65 and over.'],
    unplaced: [],
  };
}

describe('importing a document into a company section', () => {
  it('takes the Word document from the section and shows the reading progress, then the review', async () => {
    const user = userEvent.setup();
    const companyId = givenCompany();
    store.importAnswer = { result: eliteAnswer(), error: null };

    renderApp(ROUTES.companies.detail(companyId));
    await screen.findByRole('heading', { name: 'Arope Insurance' });

    /** Beside "Add plan", into the section that is open. */
    await user.click(await screen.findByRole('button', { name: /Insert company plans document/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Read the document/i })).toBeDisabled();

    await user.upload(
      within(dialog).getByLabelText('Word document'),
      new File(['docx bytes'], 'Arope SME plans.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: /Read the document/i }));

    /** The job's own page: the stage, a percentage, and the plans to expect. */
    expect(
      await screen.findByRole('heading', { name: 'Reading the document' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Import progress' })).toHaveAttribute(
      'aria-valuenow',
      '15',
    );
    expect(screen.getByText('Elite — reading')).toBeInTheDocument();
    expect(store.planImports).toHaveLength(1);
    expect(store.planImports[0]!.job.customerType).toBe('INDIVIDUAL');

    /** The next poll brings the answer, and the page becomes the review. */
    expect(
      await screen.findByRole('heading', { name: 'Review the imported plans' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('shows every figure in the editor, holds Publish until the silent limit is confirmed, then publishes', async () => {
    const user = userEvent.setup();
    const companyId = givenCompany();
    givenCoreCatalogue();
    store.importAnswer = { result: eliteAnswer(), error: null };
    store.planImports.push({
      polls: 5,
      job: {
        id: 'import_1',
        companyId,
        customerType: 'SME',
        fileName: 'Arope SME plans.docx',
        status: 'DONE',
        percent: 100,
        planNames: ['Elite'],
        plansCompleted: 1,
        result: eliteAnswer(),
        error: null,
        createdAt: timestamps.createdAt,
      },
    });

    renderApp(ROUTES.imports.detail(companyId, 'import_1'));
    await screen.findByRole('heading', { name: 'Review the imported plans' });

    /** The document's figures, in the same boxes the add-plan form uses. */
    expect(await screen.findByLabelText('Maternity Limit')).toHaveValue('10,000');
    expect(screen.getByLabelText('In-patient Coverage')).toHaveValue('100');
    expect(screen.getByLabelText('Optical Limit')).toHaveValue('1,500');
    expect(screen.getByLabelText('Optical Co-payment')).toHaveValue('10');
    expect(screen.getByLabelText('Dental Limit')).toHaveValue('');
    expect(screen.getByLabelText('Dental Co-payment')).toHaveValue('10');
    expect(screen.getByLabelText('Medication Limit')).toHaveValue('0');
    // The waiting period landed on Maternity as a detail line.
    expect(screen.getByLabelText('Maternity detail 1')).toHaveValue('Waiting period: 10 months');
    // A benefit the catalogue has never heard of is still there, as its wording.
    expect(screen.getByLabelText('Congenital Defects detail')).toHaveValue(
      'Covers 25 congenital defects',
    );
    expect(screen.getByLabelText('Room Type detail')).toHaveValue('Private Room');
    // The rate table, band by band; the unpriced band is simply blank.
    expect(screen.getByLabelText('Variant 1 premium, ages 0 to 17')).toHaveValue('6,187');
    expect(screen.getByLabelText('Variant 1 premium, ages 65 to 120')).toHaveValue('');
    // What the reader noticed is shown, not hidden.
    expect(screen.getByText(/No premium is stated for members aged 65/)).toBeInTheDocument();
    // The network is not on the list: it is offered to be created.
    expect(screen.getByLabelText('Medical network')).toHaveValue('__create__');

    /**
     * Dental is named but has no limit. The comparison would use the annual
     * limit, and that is the industry's reading rather than the insurer's
     * figure — so the plan waits until a person confirms it.
     */
    const publish = screen.getByRole('button', { name: /Publish 1 plan/ });
    expect(publish).toBeDisabled();
    const confirmations = screen.getByRole('region', { name: 'Elite confirmations' });
    expect(within(confirmations).getByText(/No Dental limit is stated/)).toBeInTheDocument();
    expect(within(confirmations).getAllByRole('checkbox')).toHaveLength(1);
    await user.click(within(confirmations).getByRole('checkbox'));
    expect(publish).toBeEnabled();

    await user.click(publish);

    /** Written exactly as a typed plan is: plan, network, variant, values, note. */
    await waitFor(() => expect(store.plans).toHaveLength(1));
    const plan = store.plans[0]!;
    expect(plan.name).toBe('Elite');
    expect(plan.customerType).toBe('SME');
    expect(plan.description).toContain('Tier: High.');
    expect(plan.description).toContain('Conditions:\n- Minimum group size: 10 employees');
    const network = store.medicalNetworks.find((item) => item.name === 'Full Network');
    expect(network).toBeDefined();
    expect(plan.medicalNetworkId).toBe(network!.id);

    await waitFor(() => expect(store.configurations).toHaveLength(1));
    const variant = store.configurations[0]!;
    expect(variant.annualLimit).toBe(600000);
    expect(variant.roomType).toBe('Private Room');
    expect(variant.priceBands.map((band) => band.annualPrice)).toEqual([6187, 12603]);

    await waitFor(() => {
      const byOption = new Map(
        store.values.map((value) => {
          const row = store.planOptions.find((item) => item.id === value.planOptionId)!;
          const option = store.options.find((item) => item.id === row.optionId)!;
          const field = option.fields!.find((item) => item.id === value.optionFieldId)!;
          return [`${option.name}/${field.key}`, value.value];
        }),
      );
      expect(byOption.get('Maternity/limit')).toBe(10000);
      expect(byOption.get('Optical/limit')).toBe(1500);
      expect(byOption.get('Optical/co_payment')).toBe(10);
      expect(byOption.get('Dental/co_payment')).toBe(10);
      expect(byOption.has('Dental/limit')).toBe(false);
      expect(byOption.get('Medication/limit')).toBe(0);
    });
    // A benefit the catalogue had never heard of was created for it, as text.
    const congenital = store.options.find((option) => option.name === 'Congenital Defects');
    expect(congenital).toBeDefined();
    const congenitalRow = store.planOptions.find((row) => row.optionId === congenital!.id);
    expect(store.values.find((value) => value.planOptionId === congenitalRow?.id)?.value).toBe(
      'Covers 25 congenital defects',
    );
    const maternityRow = store.planOptions.find(
      (row) => store.options.find((item) => item.id === row.optionId)?.name === 'Maternity',
    );
    expect(maternityRow?.note).toBe('Waiting period: 10 months');

    /** Back on the company, where the plan now is. */
    expect(await screen.findByRole('heading', { name: 'Arope Insurance' })).toBeInTheDocument();
  });

  it('says why when the document could not be read', async () => {
    const companyId = givenCompany();
    store.planImports.push({
      polls: 5,
      job: {
        id: 'import_2',
        companyId,
        customerType: 'FAMILY',
        fileName: 'scan.docx',
        status: 'FAILED',
        percent: 0,
        planNames: [],
        plansCompleted: 0,
        result: null,
        error: 'The document has no readable text. Check that it is the right file.',
        createdAt: timestamps.createdAt,
      },
    });

    renderApp(ROUTES.imports.detail(companyId, 'import_2'));
    expect(
      await screen.findByText(
        'The document has no readable text. Check that it is the right file.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Arope Insurance/ })).toHaveAttribute(
      'href',
      ROUTES.companies.detail(companyId),
    );
  });
});
