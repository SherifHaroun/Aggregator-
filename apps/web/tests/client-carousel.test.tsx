/**
 * OUR CLIENTS.
 *
 * The moving band of client logos at the foot of the home page. jsdom has no
 * layout, so the motion itself is checked in the browser; here, what a screen
 * reader and a keyboard get: each client named once (not once per copy of the
 * looping set), arrows, one dot per client, and a pause control that starts
 * out as "play" for anyone who has asked their device for less motion.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENTS, ClientCarousel } from '@/features/public/ClientCarousel';

function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('client logo carousel', () => {
  it('names every client once, however many copies the loop draws', () => {
    preferReducedMotion(false);
    render(<ClientCarousel />);

    const band = screen.getByRole('region', { name: 'Client logos' });
    const logos = within(band).getAllByRole('img');
    expect(logos.map((logo) => logo.getAttribute('alt'))).toEqual(
      CLIENTS.filter((client) => client.logo).map((client) => client.name),
    );
    // A client without a file yet is set in type rather than a broken image.
    const [visibleSet, ...others] = within(band).getAllByRole('list');
    expect(others).toHaveLength(0);
    expect(within(visibleSet!).getAllByRole('listitem')).toHaveLength(CLIENTS.length);
    expect(within(visibleSet!).getByText('30 North')).toBeInTheDocument();
  });

  it('offers arrows, a dot per client and a pause control', async () => {
    preferReducedMotion(false);
    render(<ClientCarousel />);

    expect(screen.getAllByRole('button', { name: 'Previous client' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Next client' }).length).toBeGreaterThan(0);
    const dots = within(screen.getByRole('group', { name: 'Choose a client' })).getAllByRole(
      'button',
    );
    expect(dots).toHaveLength(CLIENTS.length);

    await userEvent.click(screen.getByRole('button', { name: 'Pause the moving logos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play the moving logos' }));
    expect(screen.getByRole('button', { name: 'Pause the moving logos' })).toBeInTheDocument();
  });

  it('stays still for visitors who prefer reduced motion', () => {
    preferReducedMotion(true);
    render(<ClientCarousel />);

    expect(screen.getByRole('button', { name: 'Play the moving logos' })).toBeInTheDocument();
  });
});
