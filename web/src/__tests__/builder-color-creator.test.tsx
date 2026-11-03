import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Builder from '../components/Builder.js';
import { fixtureBrand } from './fixtures/brand.js';

const catalog = {
  palettes: [
    {
      slug: fixtureBrand.palette.slug,
      version: fixtureBrand.palette.resolvedVersion,
      data: fixtureBrand.palette.data,
    },
  ],
  fonts: fixtureBrand.fonts.map((f) => ({
    slug: f.slug,
    version: f.resolvedVersion,
    data: f.data,
  })),
};

const mountCatalog = (): void => {
  const node = document.createElement('script');
  node.id = 'brand-atoms-data';
  node.type = 'application/json';
  node.textContent = JSON.stringify(catalog);
  document.body.appendChild(node);
};

describe('Builder color creation mode', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('switches from catalog palette to the color creator and back', async () => {
    mountCatalog();
    render(<Builder />);

    await screen.findByLabelText('Palette');

    fireEvent.click(screen.getByRole('button', { name: 'Create colors' }));
    expect(screen.queryByLabelText('Palette')).toBeNull();
    expect(document.querySelector('[data-component="color-creator"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Download palette YAML' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Catalog palette' }));
    expect(screen.getByLabelText('Palette')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download palette YAML' })).toBeNull();
  });

  it('updates the contrast readout when a hex value is typed', async () => {
    mountCatalog();
    render(<Builder />);
    await screen.findByLabelText('Palette');
    fireEvent.click(screen.getByRole('button', { name: 'Create colors' }));

    const lightInk = screen.getByLabelText('Light text hex value') as HTMLInputElement;
    // Partial input must not commit; a full valid value must.
    fireEvent.change(lightInk, { target: { value: '#00' } });
    expect(lightInk.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(lightInk, { target: { value: '#000000' } });

    await waitFor(() => {
      const light = document.querySelector('[data-contrast="light"]');
      expect(light?.textContent).toContain('21.00:1');
    });
  });
});
