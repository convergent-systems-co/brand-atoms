import type { ResolvedBrand } from '../../lib/encyclopedia.js';

/**
 * Minimal fixture brand for component tests. Uses the same shape the
 * resolver produces from real atoms — enough fields to exercise every
 * emitter and component code path.
 */
export const fixtureBrand: ResolvedBrand = {
  id: 'test-brand',
  version: '1.0.0',
  name: 'Test Brand',
  description: 'A fixture brand for unit tests.',
  tags: ['test'],
  provenance: {
    source: 'https://example.com/test-brand',
    license: 'CC-BY-4.0',
  },
  palette: {
    slug: 'test-palette',
    versionRef: '1',
    resolvedVersion: '1.0.0',
    data: {
      id: 'test-palette',
      version: '1.0.0',
      name: 'Test Palette',
      swatches: [
        { id: 'bg', name: 'Background', value: '#FFFFFF' },
        { id: 'fg', name: 'Foreground', value: '#111111' },
        { id: 'primary', name: 'Primary', value: '#3366FF' },
        { id: 'accent', name: 'Accent', value: '#00C2A8' },
        { id: 'success', name: 'Success', value: '#22BB66' },
      ],
      modes: {
        light: {
          roles: {
            background: 'bg',
            foreground: 'fg',
            primary: 'primary',
            accent: 'accent',
            success: 'success',
          },
        },
        dark: {
          roles: {
            background: 'fg',
            foreground: 'bg',
            primary: 'primary',
            accent: 'accent',
            success: 'success',
          },
        },
      },
      provenance: { license: 'CC-BY-4.0' },
    },
  },
  fonts: [
    {
      role: 'heading',
      slug: 'test-sans',
      versionRef: '1',
      resolvedVersion: '1.0.0',
      data: {
        id: 'test-sans',
        version: '1.0.0',
        name: 'Test Sans',
        family: 'Test Sans',
        classification: 'sans-serif',
        availableStyles: [
          { weight: 400, style: 'normal' },
          { weight: 700, style: 'normal' },
        ],
        source: { kind: 'system' },
        fallbackStack: ['system-ui', 'sans-serif'],
        provenance: { license: 'OFL-1.1' },
      },
    },
    {
      role: 'body',
      slug: 'test-serif',
      versionRef: '1',
      resolvedVersion: '1.0.0',
      data: {
        id: 'test-serif',
        version: '1.0.0',
        name: 'Test Serif',
        family: 'Test Serif',
        classification: 'serif',
        availableStyles: [{ weight: 400, style: 'normal' }],
        source: { kind: 'system' },
        fallbackStack: ['Georgia', 'serif'],
        provenance: { license: 'OFL-1.1' },
      },
    },
    {
      role: 'mono',
      slug: 'test-mono',
      versionRef: '1',
      resolvedVersion: '1.0.0',
      data: {
        id: 'test-mono',
        version: '1.0.0',
        name: 'Test Mono',
        family: 'Test Mono',
        classification: 'monospace',
        availableStyles: [{ weight: 400, style: 'normal' }],
        source: { kind: 'system' },
        fallbackStack: ['ui-monospace', 'monospace'],
        provenance: { license: 'OFL-1.1' },
      },
    },
  ],
  assets: [],
  rules: [],
};
