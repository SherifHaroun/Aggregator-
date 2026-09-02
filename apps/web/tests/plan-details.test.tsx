/**
 * FROM A COMPARISON TO A DOCUMENT.
 *
 * Four renderings of one plan — the card, the preview, the full page and the
 * PDF — and the whole point of them is that they agree. These tests are mostly
 * about that agreement: the same six areas, in the same order, saying the same
 * thing about a zero and about a silence.
 */

import { CORE_BENEFIT_ORDER, planDocumentFilename } from '@aggregator/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/config/routes';
import { createStore, installFakeApi, type FakeStore } from './fake-api';
import { renderApp } from './render';

let store: FakeStore;
const originalFetch = globalThis.fetch;
const timestamps = { createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };

/** The criteria every test compares on. */
const CRITERIA =
  'customerTypeId=INDIVIDUAL&geographicalCoverageId=LOCAL&currency=EGP&ageFrom=35&ageTo=35';

/**
 * One company, two plans, and a spread of the four things a figure can be:
 * a percentage, a ceiling, a zero, and nothing at all.
 */
function givenTwoPlans() {
  store.companies.push({
    id: 'company_1',
    name: 'Arope',
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

  const areas: [string, number | null][] = [
    ['In-patient', 100],
    ['Out-patient', 90],
    ['Maternity', 20000],
    ['Dental', 750],
    ['Optical', 0],
    // Chronic is deliberately absent: the plan never said.
  ];

  for (const [index, [name]] of areas.entries()) {
    store.options.push({
      id: `option_${index}`,
      name,
      description: null,
      sortOrder: index,
      isUmbrella: false,
      parentId: null,
      isActive: true,
      ...timestamps,
      fields: [],
    });
  }
  // One benefit beyond the six, and one that names a section of its own.
  store.options.push({
    id: 'option_extra',
    name: 'Road Ambulance',
    description: null,
    sortOrder: 20,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [],
  });
  store.options.push({
    id: 'option_wait',
    name: 'Waiting Period',
    description: null,
    sortOrder: 21,
    isUmbrella: false,
    parentId: null,
    isActive: true,
    ...timestamps,
    fields: [],
  });

  const plan = (id: string, name: string, price: number, limit: number) => {
    store.plans.push({
      id,
      companyId: 'company_1',
      customerType: 'INDIVIDUAL',
      name,
      code: name.toUpperCase(),
      description: `${name} is written for this test and read back from it.`,
      averageAge: { value: null, source: 'NOT_SPECIFIED', label: null },
      isActive: true,
      ...timestamps,
    });
    store.configurations.push({
      id: `cfg_${id}`,
      planId: id,
      geographicalCoverage: 'LOCAL',
      medicalNetworkId: null,
      roomType: null,
      priceBands: [{ id: `band_${id}`, ageFrom: 0, ageTo: 120, annualPrice: price }],
      currency: 'EGP',
      annualLimit: limit,
      deductible: null,
      coPayment: null,
      isActive: true,
      ...timestamps,
    });

    for (const [index, [, value]] of areas.entries()) {
      const planOptionId = `po_${id}_${index}`;
      store.planOptions.push({
        id: planOptionId,
        planConfigurationId: `cfg_${id}`,
        optionId: `option_${index}`,
        sortOrder: index,
      });
      if (value !== null) {
        store.values.push({
          id: `v_${id}_${index}`,
          planOptionId,
          optionFieldId: `f_${index}`,
          value,
        });
      }
    }
    store.planOptions.push({
      id: `po_${id}_extra`,
      planConfigurationId: `cfg_${id}`,
      optionId: 'option_extra',
      sortOrder: 20,
      note: '700 EGP per case',
    });
    store.planOptions.push({
      id: `po_${id}_wait`,
      planConfigurationId: `cfg_${id}`,
      optionId: 'option_wait',
      sortOrder: 21,
      note: '10 months for maternity',
    });
  };

  plan('plan_elite', 'Elite', 5701, 600000);
  plan('plan_blue', 'Blue', 3100, 100000);
}

beforeEach(() => {
  store = installFakeApi(createStore());
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('what a comparison card says', () => {
  it('shows the annual limit on every matching plan, not only the winner', async () => {
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    /**
     * The ceiling beside the price on EVERY card. A customer shown only the
     * price is being invited to read the cheapest as the best, which is the
     * one thing a comparison exists to prevent.
     */
    const limits = await screen.findAllByText('Annual limit');
    expect(limits.length).toBeGreaterThanOrEqual(2);

    expect(await screen.findByText('EGP 600,000')).toBeInTheDocument();
    expect(await screen.findByText('EGP 100,000')).toBeInTheDocument();
  });

  it('reads the six areas in the fixed order, whatever the plan states', async () => {
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    await screen.findAllByText('Annual limit');
    const rendered = screen.getAllByText(CORE_BENEFIT_ORDER[0]!);
    expect(rendered.length).toBeGreaterThan(0);

    /**
     * All six, in order, on a plan that only stated five. An area left out
     * would read as an area that does not exist.
     */
    for (const name of CORE_BENEFIT_ORDER) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it('tells a zero apart from a silence', async () => {
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    await screen.findAllByText('Annual limit');

    // Optical is 0 — the plan declining it.
    expect(screen.getAllByText('Not covered').length).toBeGreaterThan(0);
    // Chronic was never stated — which is a different fact.
    expect(screen.getAllByText('Not specified in plan').length).toBeGreaterThan(0);
  });

  it('writes a percentage as a percentage and a ceiling in money', async () => {
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    await screen.findAllByText('Annual limit');
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('90%').length).toBeGreaterThan(0);
    // A ceiling carries its currency; a bare "20,000" could be anything.
    expect(screen.getAllByText('EGP 20,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('EGP 750').length).toBeGreaterThan(0);
  });
});

describe('opening a plan', () => {
  it('opens the plan that was clicked, recommended or not', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    await screen.findAllByText('Annual limit');

    /**
     * A plan from the grid beneath the winner. Reserving the fuller reading
     * for the recommendation tells the customer the rest are not worth
     * opening, which is the opposite of comparing.
     */
    const cards = screen.getAllByRole('button', { name: /^Arope / });
    expect(cards.length).toBeGreaterThan(0);
    await user.click(cards[0]!);

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(dialog.getByText('Annual limit')).toBeInTheDocument();
  });

  it('gives the recommended plan the same preview, opened the same way', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    const details = await screen.findAllByRole('button', { name: /View details/i });
    await user.click(details[0]!);

    // One structure, so the two are genuinely comparable side by side.
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(dialog.getByRole('tab', { name: 'Benefits' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
  });

  it('fills the screen when asked, and offers the way back from it', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    await screen.findAllByText('Annual limit');
    await user.click(screen.getByRole('button', { name: 'View details for Elite' }));

    const dialog = await screen.findByRole('dialog');
    /**
     * Six benefits, the additional ones and the coverage terms are more than a
     * letterbox holds. Expanding is the customer's choice; nothing opens that
     * way on its own.
     */
    const expand = within(dialog).getByRole('button', { name: 'Full screen' });
    expect(expand).toHaveAttribute('aria-pressed', 'false');
    await user.click(expand);
    expect(
      within(dialog).getByRole('button', { name: 'Exit full screen' }),
    ).toHaveAttribute('aria-pressed', 'true');

    /**
     * A dialog filling the screen has hidden the results entirely, so the way
     * back is NAMED rather than left to Escape or a bare cross.
     */
    await user.click(within(dialog).getByRole('button', { name: /Back to plans/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // And the comparison is still there, exactly as it was.
    expect(screen.getAllByText('Annual limit').length).toBeGreaterThan(0);
  });

  it('shows that plan’s own premium, ceiling and figures', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);

    await screen.findAllByText('Annual limit');
    await user.click(screen.getByRole('button', { name: 'View details for Elite' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('EGP 5,701')).toBeInTheDocument();
    expect(dialog.getByText('EGP 600,000')).toBeInTheDocument();
    expect(dialog.getByText('EGP 20,000')).toBeInTheDocument();
    expect(dialog.getByText('100%')).toBeInTheDocument();
  });
});

describe('the full plan page', () => {
  const openElite = async (user: ReturnType<typeof userEvent.setup>) => {
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);
    await screen.findAllByText('Annual limit');
    await user.click(screen.getByRole('button', { name: 'View details for Elite' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /View plan/i }));
  };

  it('opens the plan that was chosen, with its own premium', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    await openElite(user);

    expect(await screen.findByRole('heading', { name: 'Elite', level: 1 })).toBeInTheDocument();
    // Stated at the head of the page and again in the plan information table.
    expect(screen.getAllByText('EGP 5,701').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Annual premium').length).toBeGreaterThan(0);
  });

  it('states the ceiling, and says what it means', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    await openElite(user);

    await screen.findByRole('heading', { name: 'Elite', level: 1 });
    expect(screen.getAllByText('EGP 600,000').length).toBeGreaterThan(0);
    expect(screen.getByText(/maximum amount payable/i)).toBeInTheDocument();
  });

  it('lists all six areas, and the benefits beyond them', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    await openElite(user);

    await screen.findByRole('heading', { name: 'Elite', level: 1 });
    for (const name of CORE_BENEFIT_ORDER) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }

    /**
     * Additional benefits belong HERE and only here — read when somebody
     * opens a plan, never ranked as a column.
     */
    expect(await screen.findByText('Road Ambulance')).toBeInTheDocument();
  });

  it('separates a waiting period from the benefits it qualifies', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    await openElite(user);

    // "Waiting Period: 10 months" is not cover the plan provides.
    expect(await screen.findByText(/Waiting periods & conditions/i)).toBeInTheDocument();
    expect(screen.getByText(/10 months for maternity/)).toBeInTheDocument();
  });

  it('goes back to the same comparison it came from', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    await openElite(user);

    await screen.findByRole('heading', { name: 'Elite', level: 1 });
    await user.click(screen.getByRole('link', { name: /Back to comparison/i }));

    // The criteria travelled with it, so the results are the results.
    expect(await screen.findAllByText('Annual limit')).not.toHaveLength(0);
  });
});

describe('the plan document', () => {
  /** Capture the blob instead of asking jsdom to save a file. */
  function captureDownload() {
    const saved: { blob: Blob | null; filename: string | null } = { blob: null, filename: null };
    // jsdom implements no object URLs at all, so they are provided rather than
    // replaced — the browser's own are what the app uses.
    (URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = (blob) => {
      saved.blob = blob;
      return 'blob:plan';
    };
    (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = () => {};
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        saved.filename = this.download;
      });
    return { saved, click };
  }

  /**
   * The PDF's bytes, as text. Read through a FileReader because jsdom's Blob
   * offers neither `arrayBuffer` nor `text`, and `readAsBinaryString` gives
   * one character per byte — which is what a PDF wants to be inspected as.
   */
  const readPdf = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsBinaryString(blob);
    });

  it('is offered on the preview and on the full page', async () => {
    const user = userEvent.setup();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);
    await screen.findAllByText('Annual limit');
    await user.click(screen.getByRole('button', { name: 'View details for Elite' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: /View plan/i }));
    await screen.findByRole('heading', { name: 'Elite', level: 1 });
    expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
  });

  it('produces a real PDF, named for the plan it describes', async () => {
    const user = userEvent.setup();
    const { saved, click } = captureDownload();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);
    await screen.findAllByText('Annual limit');
    await user.click(screen.getByRole('button', { name: 'View details for Elite' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /Download PDF/i }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(saved.blob).not.toBeNull();
    expect(saved.blob!.type).toBe('application/pdf');

    const text = await readPdf(saved.blob!);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);

    // A folder of "download.pdf" is a folder nobody can use.
    expect(saved.filename).toBe('Arope-Elite-Plan-Details.pdf');
    expect(planDocumentFilename('Arope', 'Elite')).toBe('Arope-Elite-Plan-Details.pdf');
  });

  it('carries this plan’s own figures, not another plan’s', async () => {
    const user = userEvent.setup();
    const { saved, click } = captureDownload();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);
    await screen.findAllByText('Annual limit');
    await user.click(screen.getByRole('button', { name: 'View details for Blue' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /Download PDF/i }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    const text = await readPdf(saved.blob!);

    /**
     * Blue's premium and Blue's ceiling. A document built from whichever plan
     * was recommended would be a quote for a plan the customer did not open.
     */
    expect(text).toContain('EGP 3,100');
    expect(text).toContain('EGP 100,000');
    expect(text).not.toContain('EGP 5,701');
    expect(saved.filename).toBe('Arope-Blue-Plan-Details.pdf');
  });

  it('includes the branding, the six areas and the benefits beyond them', async () => {
    const user = userEvent.setup();
    const { saved, click } = captureDownload();
    givenTwoPlans();
    renderApp(`${ROUTES.comparison.results}?${CRITERIA}`);
    await screen.findAllByText('Annual limit');
    await user.click(screen.getByRole('button', { name: 'View details for Elite' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /Download PDF/i }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    const text = await readPdf(saved.blob!);

    expect(text).toContain('HADBROK');
    expect(text).toContain('ANNUAL PREMIUM');
    expect(text).toContain('ANNUAL LIMIT');
    for (const name of CORE_BENEFIT_ORDER) {
      // Written with the PDF's own escaping, so the slash is escaped too.
      expect(text).toContain(name.replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
    }
    expect(text).toContain('Road Ambulance');
    expect(text).toContain('ADDITIONAL BENEFITS');
  });
});
