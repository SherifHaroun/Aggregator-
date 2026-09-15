/**
 * SERVICES — the broker's know-how, in the broker's words.
 *
 * The page was reshaped, not rewritten: every line of substance from the
 * company site must still be on it, verbatim — the five steps, the
 * objective, the four undertakings, and what each area of work covers — and
 * the areas must open to show it. The home page, for its part, shows what is
 * insured, with the one line still to come marked and not disabled.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { InsuranceSolutions } from '@/features/public/InsuranceSolutions';
import { ServicesPage } from '@/pages/public/ServicesPage';

function renderServices() {
  return render(
    <MemoryRouter>
      <ServicesPage />
    </MemoryRouter>,
  );
}

describe('services page', () => {
  it('keeps every word of the client approach and the objective', () => {
    renderServices();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Know-how and added value');
    for (const step of [
      'Identify possible non commercial risks which might have a financial damage on the professional activity.',
      'Quantify these risks using all necessary tools of risk measurement.',
      'Grade into hierarchy the risks by potential damage and eventual concurrency.',
      'Reduce all controllable risks.',
      'Decide either to retain the risk once evaluated or transfer it to an Insurance company.',
    ]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/all the risks of our clients are evaluated, calculated and covered/),
    ).toBeInTheDocument();
  });

  it('brings the step under the pointer forward', async () => {
    const user = userEvent.setup();
    renderServices();
    const identify = screen.getByRole('button', { name: /01\s*Identify/ });
    const reduce = screen.getByRole('button', { name: /04\s*Reduce/ });
    expect(identify).toHaveAttribute('aria-pressed', 'true');
    await user.hover(reduce);
    expect(reduce).toHaveAttribute('aria-pressed', 'true');
    expect(identify).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the four undertakings between client and insurer', () => {
    renderServices();
    for (const title of [
      'Replacement value',
      'Market practice',
      'Insurer standards',
      'Claim assistance',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText(/with the support of our world-wide network/)).toBeInTheDocument();
  });

  it('opens an area of work to show exactly what it covers, and our role', async () => {
    const user = userEvent.setup();
    renderServices();
    for (const title of [
      'Risk Management',
      'Claims Management',
      'Premium Management',
      'Policy Management',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(title) })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }

    const risk = screen.getByRole('button', { name: /Risk Management/ });
    await user.click(risk);
    expect(risk).toHaveAttribute('aria-expanded', 'true');
    const panel = within(risk.closest('article')!);
    for (const heading of ['Risk profile', 'Risk control', 'Risk transfer']) {
      expect(panel.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    for (const item of ['Identification', 'Evaluation', 'Elimination', 'Prevention', 'External']) {
      expect(panel.getByText(item)).toBeInTheDocument();
    }
    expect(
      panel.getByText('To make sure that the insured risks are covered at the replacement value.'),
    ).toBeInTheDocument();

    const claims = within(
      screen.getByRole('button', { name: /Claims Management/ }).closest('article')!,
    );
    expect(
      claims.getByText('Insurers, Third party administrations, your company'),
    ).toBeInTheDocument();
    expect(claims.getByText('Handle losses below retention levels')).toBeInTheDocument();
  });

  it('ends with a way to talk to the team', () => {
    renderServices();
    const links = screen.getAllByRole('link', { name: /Talk to our team/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', ROUTES.public.contact);
  });
});

describe('insurance solutions', () => {
  it('shows the four lines, with motor marked as coming and still open', () => {
    render(
      <MemoryRouter>
        <InsuranceSolutions />
      </MemoryRouter>,
    );
    for (const title of [
      'Individual insurance',
      'Family insurance',
      'SME insurance',
      'Motor insurance',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Register interest/ })).toHaveAttribute(
      'href',
      ROUTES.public.contact,
    );
    expect(screen.getAllByRole('link', { name: /Compare plans/ })).toHaveLength(3);
  });
});
