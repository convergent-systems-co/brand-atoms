/**
 * Tests for palette import scripts (tools/imports/*.ts).
 *
 * Strategy:
 *  - Parse the on-disk emitted atom YAML files (the import scripts have
 *    already been run in CI / by the dev). This decouples tests from the
 *    network so they're fast and deterministic.
 *  - Cross-check known hex values against Tailwind v3.4.17, Open Color v1.9.1,
 *    and Catppuccin (per upstream palette.json).
 *  - Test the importer helpers directly with synthetic inputs for hex
 *    normalization and YAML stability.
 *
 * Run: pnpm test  (uses node --test --import tsx)
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { parse as parseYaml } from 'yaml';
import { Palette } from '../schemas/index.js';
import { normalizeHex, paletteToYaml } from '../imports/_shared.js';
import { buildTailwindPalette, parseTailwindColors } from '../imports/tailwind.ts';
import { buildOpenColorPalette } from '../imports/open-color.ts';
import { buildCatppuccinPalette } from '../imports/catppuccin.ts';

const REPO_ROOT = resolve(import.meta.dirname ?? __dirname, '..', '..');

function loadAtom(rel: string): unknown {
  const path = join(REPO_ROOT, rel);
  if (!existsSync(path)) {
    throw new Error(
      `expected atom not found at ${rel} - run the importers before running tests`,
    );
  }
  return parseYaml(readFileSync(path, 'utf8'));
}

describe('normalizeHex', () => {
  test('expands 3-digit hex to 6-digit lowercase', () => {
    assert.equal(normalizeHex('#FfF'), '#ffffff');
    assert.equal(normalizeHex('#000'), '#000000');
    assert.equal(normalizeHex('#abc'), '#aabbcc');
  });

  test('lowercases 6-digit hex', () => {
    assert.equal(normalizeHex('#FF00AA'), '#ff00aa');
  });

  test('preserves 8-digit hex (alpha) and lowercases', () => {
    assert.equal(normalizeHex('#AABBCCDD'), '#aabbccdd');
  });

  test('rejects malformed input', () => {
    assert.throws(() => normalizeHex('not a color'));
    assert.throws(() => normalizeHex('#xyz'));
    assert.throws(() => normalizeHex('#1234'));
    assert.throws(() => normalizeHex('rgb(255,0,0)'));
  });
});

describe('Tailwind importer', () => {
  test('parseTailwindColors extracts all 22 families + black + white', () => {
    // Minimal synthetic source that matches the real file's shape.
    const fake = [
      "export default {",
      "  black: '#000',",
      "  white: '#fff',",
      ...[
        'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
        'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
        'purple', 'fuchsia', 'pink', 'rose',
      ].flatMap((f) => [
        `  ${f}: {`,
        `    50: '#aaa',`,
        `    100: '#aaa',`,
        `    200: '#aaa',`,
        `    300: '#aaa',`,
        `    400: '#aaa',`,
        `    500: '#aaa',`,
        `    600: '#aaa',`,
        `    700: '#aaa',`,
        `    800: '#aaa',`,
        `    900: '#aaa',`,
        `    950: '#aaa',`,
        `  },`,
      ]),
      "}",
    ].join('\n');
    const parsed = parseTailwindColors(fake);
    assert.equal(Object.keys(parsed).length, 23); // 22 families + _mono
    assert.equal(parsed._mono.black, '#000000');
    assert.equal(parsed._mono.white, '#ffffff');
    for (const fam of ['slate', 'red', 'blue', 'rose']) {
      assert.equal(Object.keys(parsed[fam]).length, 11);
    }
  });

  test('parseTailwindColors fails loudly if a family is missing', () => {
    const truncated = "export default { black: '#000', white: '#fff' }\n";
    assert.throws(() => parseTailwindColors(truncated), /family "slate" not found/);
  });

  test('emitted atom validates against the Palette schema', () => {
    const raw = loadAtom('palettes/tailwind-css/4.0.0/atom.yaml');
    const result = Palette.safeParse(raw);
    if (!result.success) {
      assert.fail(`schema invalid: ${JSON.stringify(result.error.issues, null, 2)}`);
    }
  });

  test('emitted atom has 244 swatches (22 families × 11 + black + white)', () => {
    const atom = Palette.parse(loadAtom('palettes/tailwind-css/4.0.0/atom.yaml'));
    assert.equal(atom.swatches.length, 244);
  });

  test('emitted atom hex spot-checks match Tailwind v3.4.17 upstream', () => {
    const atom = Palette.parse(loadAtom('palettes/tailwind-css/4.0.0/atom.yaml'));
    const byId = new Map(atom.swatches.map((s) => [s.id, s.value]));
    // Well-known Tailwind v3.4 hex values - copied from the upstream file
    // for the test. If the importer ever stops fetching and starts
    // hardcoding, an upstream drift in these values would surface here.
    const expected: Record<string, string> = {
      'red-500': '#ef4444',
      'red-600': '#dc2626',
      'blue-500': '#3b82f6',
      'blue-600': '#2563eb',
      'green-500': '#22c55e',
      'slate-900': '#0f172a',
      'slate-950': '#020617',
      'amber-500': '#f59e0b',
      'rose-500': '#f43f5e',
      white: '#ffffff',
      black: '#000000',
    };
    for (const [id, hex] of Object.entries(expected)) {
      assert.equal(byId.get(id), hex, `expected ${id} -> ${hex}, got ${byId.get(id)}`);
    }
  });

  test('every role references a real swatch', () => {
    const atom = Palette.parse(loadAtom('palettes/tailwind-css/4.0.0/atom.yaml'));
    const ids = new Set(atom.swatches.map((s) => s.id));
    for (const mode of ['light', 'dark'] as const) {
      for (const [role, id] of Object.entries(atom.modes[mode].roles)) {
        assert.ok(ids.has(id), `${mode}.${role} -> ${id} not in swatches`);
      }
    }
  });

  test('provenance is real and complete', () => {
    const atom = Palette.parse(loadAtom('palettes/tailwind-css/4.0.0/atom.yaml'));
    const p = atom.provenance;
    assert.ok(p, 'provenance is required');
    assert.match(p.source!, /tailwindlabs\/tailwindcss/);
    assert.equal(p.license, 'MIT');
    assert.match(p.attribution!, /Tailwind/);
    assert.match(p.importedFromVersion!, /v3\.4\.17/);
  });
});

describe('Open Color importer', () => {
  test('buildOpenColorPalette emits 132 swatches (13 hues × 10 + white + black)', () => {
    const fake = {
      white: '#ffffff',
      black: '#000000',
      gray: Array(10).fill('#888888'),
      red: Array(10).fill('#ff0000'),
      pink: Array(10).fill('#ff00ff'),
      grape: Array(10).fill('#aa00ff'),
      violet: Array(10).fill('#7700ff'),
      indigo: Array(10).fill('#4400ff'),
      blue: Array(10).fill('#0000ff'),
      cyan: Array(10).fill('#00ffff'),
      teal: Array(10).fill('#008888'),
      green: Array(10).fill('#00ff00'),
      lime: Array(10).fill('#88ff00'),
      yellow: Array(10).fill('#ffff00'),
      orange: Array(10).fill('#ff8800'),
    };
    const atom = buildOpenColorPalette(fake);
    assert.equal(atom.swatches.length, 132);
  });

  test('buildOpenColorPalette throws on missing hue', () => {
    const fake = { white: '#ffffff', black: '#000000', gray: Array(10).fill('#888') } as any;
    assert.throws(() => buildOpenColorPalette(fake), /hue "red"/);
  });

  test('buildOpenColorPalette throws on wrong shade count', () => {
    const fake: any = {
      white: '#fff', black: '#000',
      gray: Array(9).fill('#888'),
    };
    // Add the other 12 hues with 10 shades each so we fail on gray specifically.
    for (const h of ['red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime', 'yellow', 'orange']) {
      fake[h] = Array(10).fill('#888');
    }
    assert.throws(() => buildOpenColorPalette(fake), /hue "gray".*9 shades.*10/);
  });

  test('emitted atom validates against the Palette schema', () => {
    const raw = loadAtom('palettes/open-color/1.9.1/atom.yaml');
    const result = Palette.safeParse(raw);
    if (!result.success) {
      assert.fail(`schema invalid: ${JSON.stringify(result.error.issues, null, 2)}`);
    }
  });

  test('emitted atom has 132 swatches', () => {
    const atom = Palette.parse(loadAtom('palettes/open-color/1.9.1/atom.yaml'));
    assert.equal(atom.swatches.length, 132);
  });

  test('emitted atom hex spot-checks match Open Color v1.9.1 upstream', () => {
    const atom = Palette.parse(loadAtom('palettes/open-color/1.9.1/atom.yaml'));
    const byId = new Map(atom.swatches.map((s) => [s.id, s.value]));
    const expected: Record<string, string> = {
      'blue-5': '#339af0',
      'blue-7': '#1c7ed6',
      'red-5': '#ff6b6b',
      'red-6': '#fa5252',
      'gray-0': '#f8f9fa',
      'gray-9': '#212529',
      'green-7': '#37b24d',
      white: '#ffffff',
      black: '#000000',
    };
    for (const [id, hex] of Object.entries(expected)) {
      assert.equal(byId.get(id), hex, `expected ${id} -> ${hex}, got ${byId.get(id)}`);
    }
  });

  test('provenance is real and complete', () => {
    const atom = Palette.parse(loadAtom('palettes/open-color/1.9.1/atom.yaml'));
    const p = atom.provenance;
    assert.ok(p, 'provenance is required');
    assert.match(p.source!, /yeun\/open-color/);
    assert.equal(p.license, 'MIT');
    assert.match(p.attribution!, /Yeun/);
    assert.equal(p.importedFromVersion, 'v1.9.1');
  });
});

describe('Catppuccin importer', () => {
  function makeFakeFlavor(dark: boolean) {
    const colors: Record<string, { name: string; order: number; hex: string }> = {};
    const order = [
      'rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach', 'yellow',
      'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender',
      'text', 'subtext1', 'subtext0',
      'overlay2', 'overlay1', 'overlay0',
      'surface2', 'surface1', 'surface0',
      'base', 'mantle', 'crust',
    ];
    order.forEach((name, i) => {
      colors[name] = { name: name[0].toUpperCase() + name.slice(1), order: i, hex: '#abcdef' };
    });
    return { name: 'X', order: 0, dark, colors };
  }

  test('buildCatppuccinPalette emits 26 swatches per flavor', () => {
    const fakeSrc: any = {
      version: '1.8.0',
      latte: makeFakeFlavor(false),
      frappe: makeFakeFlavor(true),
      macchiato: makeFakeFlavor(true),
      mocha: makeFakeFlavor(true),
    };
    for (const f of ['latte', 'frappe', 'macchiato', 'mocha'] as const) {
      const atom = buildCatppuccinPalette(fakeSrc, f);
      assert.equal(atom.swatches.length, 26, `${f} should have 26 swatches`);
    }
  });

  test('throws on missing color in a flavor', () => {
    const fakeSrc: any = {
      version: '1.8.0',
      latte: makeFakeFlavor(false),
      frappe: makeFakeFlavor(true),
      macchiato: makeFakeFlavor(true),
      mocha: makeFakeFlavor(true),
    };
    delete fakeSrc.mocha.colors.mauve;
    assert.throws(() => buildCatppuccinPalette(fakeSrc, 'mocha'), /missing color "mauve"/);
  });

  test('every emitted Catppuccin atom validates and has provenance', () => {
    for (const slug of [
      'catppuccin-latte',
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha',
    ]) {
      const raw = loadAtom(`palettes/${slug}/1.0.0/atom.yaml`);
      const result = Palette.safeParse(raw);
      if (!result.success) {
        assert.fail(
          `${slug} schema invalid: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
      const atom = result.data;
      assert.equal(atom.swatches.length, 26, `${slug} should have 26 swatches`);
      assert.ok(atom.provenance, `${slug} needs provenance`);
      assert.match(atom.provenance!.source!, /catppuccin\/palette/);
      assert.equal(atom.provenance!.license, 'MIT');
      assert.match(atom.provenance!.attribution!, /Catppuccin/);
    }
  });

  test('Mocha mauve = #cba6f7 (well-known Catppuccin hex)', () => {
    const atom = Palette.parse(loadAtom('palettes/catppuccin-mocha/1.0.0/atom.yaml'));
    const mauve = atom.swatches.find((s) => s.id === 'mauve');
    assert.equal(mauve?.value, '#cba6f7');
  });

  test('Latte rosewater = #dc8a78 (well-known Catppuccin hex)', () => {
    const atom = Palette.parse(loadAtom('palettes/catppuccin-latte/1.0.0/atom.yaml'));
    const rw = atom.swatches.find((s) => s.id === 'rosewater');
    assert.equal(rw?.value, '#dc8a78');
  });

  test('Frappe base = #303446 (well-known Catppuccin hex)', () => {
    const atom = Palette.parse(loadAtom('palettes/catppuccin-frappe/1.0.0/atom.yaml'));
    const base = atom.swatches.find((s) => s.id === 'base');
    assert.equal(base?.value, '#303446');
  });

  test('Macchiato sky = #91d7e3 (well-known Catppuccin hex)', () => {
    const atom = Palette.parse(loadAtom('palettes/catppuccin-macchiato/1.0.0/atom.yaml'));
    const sky = atom.swatches.find((s) => s.id === 'sky');
    assert.equal(sky?.value, '#91d7e3');
  });

  test('roles reference real swatches in both modes for every flavor', () => {
    for (const slug of [
      'catppuccin-latte',
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha',
    ]) {
      const atom = Palette.parse(loadAtom(`palettes/${slug}/1.0.0/atom.yaml`));
      const ids = new Set(atom.swatches.map((s) => s.id));
      for (const mode of ['light', 'dark'] as const) {
        for (const [role, id] of Object.entries(atom.modes[mode].roles)) {
          assert.ok(ids.has(id), `${slug} ${mode}.${role} -> ${id} not in swatches`);
        }
      }
    }
  });
});

describe('paletteToYaml — diffability', () => {
  test('rendering the same palette twice yields byte-identical output', () => {
    const atom = Palette.parse(loadAtom('palettes/tailwind-css/4.0.0/atom.yaml'));
    const a = paletteToYaml(atom);
    const b = paletteToYaml(atom);
    assert.equal(a, b);
  });

  test('top-level key order is canonical (kind first, swatches/modes last)', () => {
    const atom = Palette.parse(loadAtom('palettes/open-color/1.9.1/atom.yaml'));
    const txt = paletteToYaml(atom);
    const keys = ['kind', 'id', 'version', 'name'];
    let lastIdx = -1;
    for (const k of keys) {
      const idx = txt.indexOf(`${k}:`);
      assert.ok(idx > lastIdx, `${k} should come after the previous key`);
      lastIdx = idx;
    }
    // swatches must come before modes
    assert.ok(txt.indexOf('swatches:') < txt.indexOf('modes:'));
  });

  test('roles within each mode are sorted alphabetically', () => {
    const atom = Palette.parse(loadAtom('palettes/tailwind-css/4.0.0/atom.yaml'));
    for (const mode of ['light', 'dark'] as const) {
      const keys = Object.keys(atom.modes[mode].roles);
      const sorted = [...keys].sort();
      // The Zod parse returns keys in the YAML file's order; if our writer
      // sorts before serialize, the round-trip preserves alpha order.
      const txt = paletteToYaml(atom);
      // Find the section for this mode and confirm role keys appear in alpha order.
      const start = txt.indexOf(`${mode}:`);
      const after = txt.slice(start);
      const positions = sorted.map((k) => after.indexOf(`${k}:`));
      for (let i = 1; i < positions.length; i++) {
        assert.ok(
          positions[i] > positions[i - 1],
          `${mode}.${sorted[i]} should come after ${mode}.${sorted[i - 1]}`,
        );
      }
    }
  });
});
