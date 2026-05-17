#!/usr/bin/env tsx
/**
 * Import the Catppuccin palette into 4 Palette atoms (one per flavor).
 *
 * Source: https://raw.githubusercontent.com/catppuccin/palette/main/palette.json
 * The JSON's top-level "version" field identifies the upstream palette version.
 *
 * Output:
 *   palettes/catppuccin-latte/1.0.0/atom.yaml      (light flavor)
 *   palettes/catppuccin-frappe/1.0.0/atom.yaml     (dark, lightest)
 *   palettes/catppuccin-macchiato/1.0.0/atom.yaml  (dark, mid)
 *   palettes/catppuccin-mocha/1.0.0/atom.yaml      (dark, deepest)
 *
 * Each atom has 26 swatches in the canonical Catppuccin order:
 *  accents:  rosewater, flamingo, pink, mauve, red, maroon, peach, yellow,
 *            green, teal, sky, sapphire, blue, lavender
 *  text:     text, subtext1, subtext0
 *  overlays: overlay2, overlay1, overlay0
 *  surfaces: surface2, surface1, surface0
 *  base:     base, mantle, crust
 *
 * Per Catppuccin's style guide, the accent identity (e.g. "mauve" = primary)
 * is preserved across flavors. Light mode of a dark flavor flips base/text
 * tokens against the Latte flavor's tone hierarchy, but the accent name still
 * maps to the same role.
 *
 * Re-run with: pnpm tsx tools/imports/catppuccin.ts
 */
import { join } from 'node:path';
import type { Palette as PaletteData } from '../schemas/index.js';
import { IMPORTED_DATE, fetchJson, normalizeHex, writePaletteAtom } from './_shared.js';

const SOURCE_URL = 'https://raw.githubusercontent.com/catppuccin/palette/main/palette.json';

// Canonical color order (matches Catppuccin's docs / "order" field).
const COLOR_ORDER = [
  'rosewater',
  'flamingo',
  'pink',
  'mauve',
  'red',
  'maroon',
  'peach',
  'yellow',
  'green',
  'teal',
  'sky',
  'sapphire',
  'blue',
  'lavender',
  'text',
  'subtext1',
  'subtext0',
  'overlay2',
  'overlay1',
  'overlay0',
  'surface2',
  'surface1',
  'surface0',
  'base',
  'mantle',
  'crust',
] as const;

type ColorName = (typeof COLOR_ORDER)[number];

const FLAVORS = [
  { key: 'latte', slug: 'catppuccin-latte', display: 'Latte', dark: false },
  { key: 'frappe', slug: 'catppuccin-frappe', display: 'Frappe', dark: true },
  { key: 'macchiato', slug: 'catppuccin-macchiato', display: 'Macchiato', dark: true },
  { key: 'mocha', slug: 'catppuccin-mocha', display: 'Mocha', dark: true },
] as const;

interface CatppuccinColor {
  name: string;
  order: number;
  hex: string;
  accent?: boolean;
}

interface CatppuccinFlavor {
  name: string;
  emoji?: string;
  order: number;
  dark: boolean;
  colors: Record<string, CatppuccinColor>;
}

interface CatppuccinJson {
  version: string;
  latte: CatppuccinFlavor;
  frappe: CatppuccinFlavor;
  macchiato: CatppuccinFlavor;
  mocha: CatppuccinFlavor;
}

/**
 * Role mappings for a Catppuccin flavor. Same accent identity across all
 * flavors per Catppuccin's design guidance: mauve = primary accent,
 * red = error, green = success, peach = warning, blue = info.
 *
 * Surface/text tokens flip when light_mode is the *opposite* of the flavor's
 * native polarity (so a dark flavor's "light" mode is a sensible inversion).
 */
function rolesForMode(args: {
  flavorIsDark: boolean;
  targetMode: 'light' | 'dark';
}): Record<string, string> {
  const { flavorIsDark, targetMode } = args;
  const native = flavorIsDark === (targetMode === 'dark');

  // For the native polarity, use canonical Catppuccin surface stack.
  // For the inverted polarity, invert base/mantle/crust against
  // surface levels so text remains legible.
  const bg = native ? 'base' : 'crust';
  const surface = native ? 'mantle' : 'surface0';
  const surfaceElevated = native ? 'surface0' : 'surface1';
  const textPrimary = native ? 'text' : 'crust';
  const textSecondary = native ? 'subtext1' : 'surface2';
  const textTertiary = native ? 'subtext0' : 'overlay1';
  const outline = native ? 'overlay0' : 'overlay2';

  return {
    background: bg,
    surface,
    'surface-elevated': surfaceElevated,
    'text-primary': textPrimary,
    'text-secondary': textSecondary,
    'text-tertiary': textTertiary,
    primary: 'mauve',
    'primary-hover': 'lavender',
    secondary: 'blue',
    accent: 'pink',
    success: 'green',
    warning: 'peach',
    error: 'red',
    info: 'sky',
    outline,
  };
}

export function buildCatppuccinPalette(
  src: CatppuccinJson,
  flavorKey: 'latte' | 'frappe' | 'macchiato' | 'mocha',
): PaletteData {
  const flavor = src[flavorKey];
  if (!flavor) throw new Error(`catppuccin: flavor "${flavorKey}" not in source`);
  if (!flavor.colors) throw new Error(`catppuccin: flavor "${flavorKey}" has no colors`);

  // Validate every expected color is present, build swatches in canonical order.
  const swatches: PaletteData['swatches'] = [];
  for (const name of COLOR_ORDER) {
    const c = flavor.colors[name];
    if (!c || typeof c.hex !== 'string') {
      throw new Error(`catppuccin: flavor "${flavorKey}" missing color "${name}"`);
    }
    swatches.push({
      id: name,
      name: c.name || name,
      value: normalizeHex(c.hex),
      aliases: [],
    });
  }

  const flavorMeta = FLAVORS.find((f) => f.key === flavorKey);
  if (!flavorMeta) throw new Error(`unreachable: unknown flavor ${flavorKey}`);

  const description = flavor.dark
    ? `Catppuccin ${flavorMeta.display} - a soothing dark pastel theme. ` +
      'Native dark mode; the light mode role map is a sensible inversion that ' +
      'preserves accent identity (mauve = primary, etc.).'
    : `Catppuccin ${flavorMeta.display} - the light flavor in the Catppuccin family. ` +
      'Native light mode; the dark mode role map is a sensible inversion that ' +
      'preserves accent identity (mauve = primary, etc.).';

  return {
    kind: 'palette',
    id: flavorMeta.slug,
    version: '1.0.0',
    name: `Catppuccin ${flavorMeta.display}`,
    description,
    tags: ['catppuccin', flavor.dark ? 'dark' : 'light', 'pastel', 'developer'],
    provenance: {
      source: SOURCE_URL,
      license: 'MIT',
      attribution:
        'Catppuccin palette by the Catppuccin organization (github.com/catppuccin/palette)',
      importedDate: IMPORTED_DATE,
      importedFromVersion: src.version,
      notes:
        'Hex values verbatim from the upstream palette.json. Role mappings follow ' +
        "Catppuccin's design guidance: the same accent name (mauve = primary, red = error, " +
        'green = success, peach = warning) is used across all four flavors so themes can be ' +
        'switched without changing role semantics.',
    },
    swatches,
    modes: {
      light: { roles: rolesForMode({ flavorIsDark: flavor.dark, targetMode: 'light' }) },
      dark: { roles: rolesForMode({ flavorIsDark: flavor.dark, targetMode: 'dark' }) },
    },
  };
}

const OUT_PATH = (repoRoot: string, slug: string): string =>
  join(repoRoot, `palettes/${slug}/1.0.0/atom.yaml`);

export async function importCatppuccin(repoRoot: string = process.cwd()): Promise<
  Array<{ flavor: ColorName | string; filePath: string; swatchCount: number; changed: boolean }>
> {
  const src = await fetchJson<CatppuccinJson>(SOURCE_URL);
  const results: Array<{
    flavor: string;
    filePath: string;
    swatchCount: number;
    changed: boolean;
  }> = [];
  for (const f of FLAVORS) {
    const palette = buildCatppuccinPalette(src, f.key);
    const filePath = OUT_PATH(repoRoot, f.slug);
    const { changed } = writePaletteAtom(filePath, palette);
    results.push({
      flavor: f.key,
      filePath,
      swatchCount: palette.swatches.length,
      changed,
    });
  }
  return results;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  importCatppuccin()
    .then((results) => {
      for (const r of results) {
        console.log(
          `${r.changed ? 'wrote' : 'unchanged'}: ${r.filePath} (${r.swatchCount} swatches)`,
        );
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
