#!/usr/bin/env tsx
/**
 * Import the Tailwind CSS default color palette into a Palette atom.
 *
 * Source: Tailwind CSS v3.4.17 - the last release that ships hex values
 * in src/public/colors.js. Tailwind v4 switched its default palette to
 * oklch() values which our Palette schema cannot represent (it requires
 * 6/8-digit hex). The v3.4 hex palette is the canonical hex form of the
 * Tailwind palette and is what the rest of the ecosystem consumes.
 *
 * Output: palettes/tailwind-css/4.0.0/atom.yaml
 *  - id            tailwind-css
 *  - version       4.0.0   (this atom's version, not Tailwind's)
 *  - 22 families x 11 shades (50, 100..900, 950) = 242 color swatches
 *  - + 2 grayscale swatches (white, black) = 244 total
 *
 * Re-run with: pnpm tsx tools/imports/tailwind.ts
 */
import { join } from 'node:path';
import type { Palette as PaletteData } from '../schemas/index.js';
import { IMPORTED_DATE, fetchText, normalizeHex, writePaletteAtom } from './_shared.js';

const SOURCE_URL =
  'https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/public/colors.js';

// Canonical family order from Tailwind's docs page.
// https://tailwindcss.com/docs/customizing-colors
const FAMILY_ORDER = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;

const SHADE_ORDER = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

type FamilyColors = Record<string, string>;

/**
 * Parse Tailwind's colors.js source. The file is JS, not JSON, so we use
 * a focused regex pass. For each known family we extract the `{ 50: '#xxx', ... }`
 * block. Returns a map: family -> { shade -> hex }.
 *
 * Throws if any expected family is missing or has unexpected shades.
 */
export function parseTailwindColors(source: string): Record<string, FamilyColors> {
  const out: Record<string, FamilyColors> = {};
  for (const family of FAMILY_ORDER) {
    // Match a top-level property "family: { ... }" - the file is a default
    // export of a single object so each family starts at the beginning of a line.
    const blockRe = new RegExp(`^  ${family}: \\{([\\s\\S]*?)^  \\},`, 'm');
    const m = source.match(blockRe);
    if (!m) {
      throw new Error(`tailwind source: family "${family}" not found`);
    }
    const body = m[1];
    const shadeRe = /(\d{2,3}):\s*'(#[0-9a-fA-F]{3,8})'/g;
    const shades: FamilyColors = {};
    for (const entry of body.matchAll(shadeRe)) {
      shades[entry[1]] = normalizeHex(entry[2]);
    }
    if (Object.keys(shades).length !== SHADE_ORDER.length) {
      throw new Error(
        `tailwind source: family "${family}" has ${
          Object.keys(shades).length
        } shades, expected ${SHADE_ORDER.length}`,
      );
    }
    for (const s of SHADE_ORDER) {
      if (!(String(s) in shades)) {
        throw new Error(`tailwind source: family "${family}" missing shade ${s}`);
      }
    }
    out[family] = shades;
  }
  // Also extract black + white.
  const bw: FamilyColors = {};
  const blackM = source.match(/^  black:\s*'(#[0-9a-fA-F]{3,8})'/m);
  const whiteM = source.match(/^  white:\s*'(#[0-9a-fA-F]{3,8})'/m);
  if (!blackM || !whiteM) {
    throw new Error('tailwind source: missing black/white');
  }
  bw.black = normalizeHex(blackM[1]);
  bw.white = normalizeHex(whiteM[1]);
  out._mono = bw;
  return out;
}

export function buildTailwindPalette(parsed: Record<string, FamilyColors>): PaletteData {
  const swatches: PaletteData['swatches'] = [];

  // Mono first so role mapping is consistent.
  swatches.push({
    id: 'white',
    name: 'White',
    value: parsed._mono.white,
    aliases: [],
  });
  swatches.push({
    id: 'black',
    name: 'Black',
    value: parsed._mono.black,
    aliases: [],
  });

  for (const family of FAMILY_ORDER) {
    const shades = parsed[family];
    for (const shade of SHADE_ORDER) {
      const hex = shades[String(shade)];
      swatches.push({
        id: `${family}-${shade}`,
        name: `${family[0].toUpperCase()}${family.slice(1)} ${shade}`,
        value: hex,
        aliases: [],
      });
    }
  }

  return {
    kind: 'palette',
    id: 'tailwind-css',
    version: '4.0.0',
    name: 'Tailwind CSS - Default Palette',
    description:
      'The default Tailwind CSS color palette: 22 hue families x 11 shades ' +
      '(50, 100..900, 950) plus pure white and black. Hex values mirror the ' +
      'Tailwind v3.4.17 release (the last release shipping hex form; v4 ' +
      'expresses identical colors in oklch).',
    tags: ['tailwind', 'utility-first', 'web', 'default'],
    provenance: {
      source: SOURCE_URL,
      license: 'MIT',
      attribution: 'Tailwind CSS by Tailwind Labs (github.com/tailwindlabs/tailwindcss)',
      importedDate: IMPORTED_DATE,
      importedFromVersion: 'v3.4.17',
      notes:
        'Tailwind v4 switched the default palette to oklch() form; values are colorimetrically ' +
        'identical to the v3.4.17 hex form mirrored here. Pinned to a tagged release for ' +
        'reproducibility.',
    },
    swatches,
    modes: {
      light: {
        roles: {
          background: 'white',
          surface: 'slate-50',
          'surface-elevated': 'slate-100',
          'text-primary': 'slate-900',
          'text-secondary': 'slate-700',
          'text-tertiary': 'slate-500',
          primary: 'blue-600',
          'primary-hover': 'blue-700',
          secondary: 'slate-700',
          accent: 'indigo-600',
          success: 'green-600',
          warning: 'amber-500',
          error: 'red-600',
          info: 'sky-600',
          outline: 'slate-300',
        },
      },
      dark: {
        roles: {
          background: 'slate-950',
          surface: 'slate-900',
          'surface-elevated': 'slate-800',
          'text-primary': 'slate-50',
          'text-secondary': 'slate-300',
          'text-tertiary': 'slate-400',
          primary: 'blue-400',
          'primary-hover': 'blue-300',
          secondary: 'slate-300',
          accent: 'indigo-400',
          success: 'green-400',
          warning: 'amber-400',
          error: 'red-400',
          info: 'sky-400',
          outline: 'slate-700',
        },
      },
    },
  };
}

const OUT_PATH = (repoRoot: string): string =>
  join(repoRoot, 'palettes/tailwind-css/4.0.0/atom.yaml');

export async function importTailwind(repoRoot: string = process.cwd()): Promise<{
  filePath: string;
  swatchCount: number;
  changed: boolean;
}> {
  const source = await fetchText(SOURCE_URL);
  const parsed = parseTailwindColors(source);
  const palette = buildTailwindPalette(parsed);
  const filePath = OUT_PATH(repoRoot);
  const { changed } = writePaletteAtom(filePath, palette);
  return { filePath, swatchCount: palette.swatches.length, changed };
}

// Run when invoked directly via `tsx tools/imports/tailwind.ts`.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  importTailwind()
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
