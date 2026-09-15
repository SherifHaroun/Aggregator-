/**
 * INSURANCE, WITHOUT THE COMPLEXITY.
 *
 * The home page's picture of what the broker does. The motion is checked in
 * the browser; here, the words, where the button leads, and that the three
 * tier cards — the same Basic, Standard, Premium the comparison ranks — are
 * there with one of them chosen, while the photograph says nothing to a
 * screen reader.
 */

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import { PlanShowcase } from '@/features/public/PlanShowcase';

describe('plan showcase', () => {
  it('says what the broker does and leads to the services', () => {
    render(
      <MemoryRouter>
        <PlanShowcase />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Insurance, without the complexity.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore our services/i })).toHaveAttribute(
      'href',
      ROUTES.public.services,
    );

    const cards = within(screen.getByRole('list', { name: 'Example plan comparison' }));
    expect(cards.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Basic'),
      expect.stringContaining('Standard'),
      expect.stringContaining('Premium'),
    ]);
    expect(cards.getByLabelText('Chosen').closest('li')).toHaveTextContent('Standard');

    // The photograph is decoration; it must not be announced.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
