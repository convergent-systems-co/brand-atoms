#!/usr/bin/env tsx
/**
 * Import the Open Color palette into a Palette atom.
 *
 * Source: https://raw.githubusercontent.com/yeun/open-color/master/open-color.json
 * Pinned to v1.9.1 - the current stable release as of import.
 *
 * Output: palettes/open-color/1.9.1/atom.yaml
 *  - 13 hues x 10 shades = 130 hue swatches
 *  - + white + black = 132 swatches total
 *
 * Open Color is a color scheme designed for UI design (Yeun, MIT-licensed).
 *
 * Re-run with: pnpm tsx tools/imports/open-color.ts
 */
import { join } from 'node:path';
import type { Palette as PaletteData } from '../schemas/index.js';
import { IMPORTED_DATE, fetchJson, normalizeHex, writePaletteAtom } from './_shared.js';

const SOURCE_URL = 'https://raw.githubusercontent.com/yeun/open-color/v1.9.1/open-color.json';

// Canonical hue order from open-color.com docs.
const HUE_ORDER = [
  'gray',
  'red',
  'pink',
  'grape',
  'violet',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
] as const;

// Open Color exposes shades 0..9 per hue. Display label = shade index.
const SHADE_COUNT = 10;

// Open Color JSON schema: top-level white/black are scalars; each hue
// is a 10-element array of hex strings, index 0 = lightest, 9 = darkest.
interface OpenColorJson {
  white: string;
  black: string;
  // hue arrays are indexed dynamically
  [hue: string]: string | string[];
}

export function buildOpenColorPalette(src: OpenColorJson): PaletteData {
  const swatches: PaletteData['swatches'] = [];

  // Top-level scalars first.
  swatches.push({
    id: 'white',
    name: 'White',
    value: normalizeHex(src.white),
    aliases: [],
  });
  swatches.push({
    id: 'black',
    name: 'Black',
    value: normalizeHex(src.black),
    aliases: [],
  });

  for (const hue of HUE_ORDER) {
    const arr = src[hue];
    if (!Array.isArray(arr)) {
      throw new Error(`open-color: hue "${hue}" missing or not an array`);
    }
    if (arr.length !== SHADE_COUNT) {
      throw new Error(
        `open-color: hue "${hue}" has ${arr.length} shades, expected ${SHADE_COUNT}`,
      );
    }
    for (let i = 0; i < arr.length; i++) {
      const hex = normalizeHex(arr[i]);
      const hueDisplay = `${hue[0].toUpperCase()}${hue.slice(1)}`;
      swatches.push({
        id: `${hue}-${i}`,
        name: `${hueDisplay} ${i}`,
        value: hex,
        aliases: [],
      });
    }
  }

  return {
    kind: 'palette',
    id: 'open-color',
    version: '1.9.1',
    name: 'Open Color',
    description:
      'Open Color - a color scheme optimized for UI design. 13 hue families ' +
      '(gray, red, pink, grape, violet, indigo, blue, cyan, teal, green, lime, yellow, orange) ' +
      'each with 10 shades (0 = lightest, 9 = darkest), plus pure white and black.',
    tags: ['open-color', 'ui', 'web', 'mit'],
    provenance: {
      source: SOURCE_URL,
      license: 'MIT',
      attribution: 'Open Color by Yeun Park (github.com/yeun/open-color)',
      importedDate: IMPORTED_DATE,
      importedFromVersion: 'v1.9.1',
      notes: 'Pinned to the v1.9.1 tag on GitHub for reproducibility.',
    },
    swatches,
    modes: {
      light: {
        roles: {
          background: 'white',
          surface: 'gray-0',
          'surface-elevated': 'gray-1',
          'text-primary': 'gray-9',
          'text-secondary': 'gray-7',
          'text-tertiary': 'gray-6',
          primary: 'blue-7',
          'primary-hover': 'blue-8',
          accent: 'violet-6',
          success: 'green-7',
          warning: 'yellow-7',
          error: 'red-7',
          info: 'cyan-7',
          outline: 'gray-3',
        },
      },
      dark: {
        roles: {
          background: 'gray-9',
          surface: 'gray-8',
          'surface-elevated': 'gray-7',
          'text-primary': 'gray-0',
          'text-secondary': 'gray-3',
          'text-tertiary': 'gray-5',
          primary: 'blue-4',
          'primary-hover': 'blue-3',
          accent: 'violet-4',
          success: 'green-4',
          warning: 'yellow-4',
          error: 'red-5',
          info: 'cyan-4',
          outline: 'gray-7',
        },
      },
    },
  };
}

const OUT_PATH = (repoRoot: string): string =>
  join(repoRoot, 'palettes/open-color/1.9.1/atom.yaml');

export async function importOpenColor(repoRoot: string = process.cwd()): Promise<{
  filePath: string;
  swatchCount: number;
  changed: boolean;
}> {
  const src = await fetchJson<OpenColorJson>(SOURCE_URL);
  const palette = buildOpenColorPalette(src);
  const filePath = OUT_PATH(repoRoot);
  const { changed } = writePaletteAtom(filePath, palette);
  return { filePath, swatchCount: palette.swatches.length, changed };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  importOpenColor()
    .then(({ filePath, swatchCount, changed }) => {
      console.log(
        `${changed ? 'wrote' : 'unchanged'}: ${filePath} (${swatchCount} swatches)`,
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
