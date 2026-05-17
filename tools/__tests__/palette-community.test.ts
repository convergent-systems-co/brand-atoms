import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';
import { Palette } from '../schemas/palette.js';

/**
 * Global guarantees for the Wave 2 community palettes (issue #12).
 *
 * For every palette atom under `palettes/<slug>/<version>/atom.yaml`:
 *   1. The YAML validates against the Palette schema.
 *   2. Every role mapping (light + dark) references a declared swatch ID.
 *   3. Every swatch value is a 6- or 8-digit hex color (ColorValue regex).
 *   4. Required identifying fields are present and well-formed.
 *   5. Provenance is real — has a source URL and SPDX license string.
 *
 * The new community palettes (Wave 2) additionally require both light and dark
 * `roles` to be non-empty — a deliberately single-mode upstream should still
 * provide a thoughtful inversion in the other mode.
 */

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const PALETTES_DIR = join(REPO_ROOT, 'palettes');

const HEX_REGEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

// Wave 2 community palettes — both modes must be non-empty even if upstream is
// single-mode (require a thoughtful inversion).
const COMMUNITY_SLUGS = new Set([
  // Group 1 — Dev classics
  'dracula',
  'tokyo-night',
  'tokyo-night-storm',
  'tokyo-night-light',
  'monokai',
  'one-dark',
  'one-light',
  'solarized-light',
  'solarized-dark',
  'gruvbox-light-soft',
  'gruvbox-light-medium',
  'gruvbox-light-hard',
  'gruvbox-dark-soft',
  'gruvbox-dark-medium',
  'gruvbox-dark-hard',
  // Group 2 — Modern dev
  'rose-pine',
  'rose-pine-dawn',
  'rose-pine-moon',
  'ayu-light',
  'ayu-mirage',
  'ayu-dark',
  'palenight',
  'iceberg-light',
  'iceberg-dark',
  'everforest-light',
  'everforest-dark',
  // Group 3 — Corporate
  'github-light',
  'github-dark',
  'atlassian',
  'bootstrap',
  'ibm-carbon',
]);

type PaletteRecord = {
  slug: string;
  version: string;
  filePath: string;
  raw: unknown;
};

const listDirs = (parent: string): string[] => {
  try {
    return readdirSync(parent).filter((name) => {
      try {
        return statSync(join(parent, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
};

const loadAllPalettes = (): PaletteRecord[] => {
  const records: PaletteRecord[] = [];
  for (const slug of listDirs(PALETTES_DIR)) {
    for (const version of listDirs(join(PALETTES_DIR, slug))) {
      const filePath = join(PALETTES_DIR, slug, version, 'atom.yaml');
      try {
        const raw = parseYaml(readFileSync(filePath, 'utf8'));
        records.push({ slug, version, filePath, raw });
      } catch {
        // Surface as a missing file in the relevant test below.
      }
    }
  }
  return records;
};

const allPalettes = loadAllPalettes();

test('All palette atoms validate against the Palette schema', () => {
  assert.ok(allPalettes.length > 0, 'expected at least one palette atom on disk');
  for (const p of allPalettes) {
    const res = Palette.safeParse(p.raw);
    assert.ok(
      res.success,
      `${p.slug}@${p.version} failed schema validation: ${
        res.success ? '' : JSON.stringify(res.error.issues, null, 2)
      }`,
    );
  }
});

test('Every role mapping references a declared swatch (both modes)', () => {
  for (const p of allPalettes) {
    const parsed = Palette.safeParse(p.raw);
    if (!parsed.success) continue; // covered above
    const swatchIds = new Set(parsed.data.swatches.map((s) => s.id));
    for (const mode of ['light', 'dark'] as const) {
      for (const [role, swatchId] of Object.entries(parsed.data.modes[mode].roles)) {
        assert.ok(
          swatchIds.has(swatchId),
          `${p.slug}@${p.version}: modes.${mode}.roles.${role} → "${swatchId}" not in swatches`,
        );
      }
    }
  }
});

test('Every swatch value is a valid hex color', () => {
  for (const p of allPalettes) {
    const parsed = Palette.safeParse(p.raw);
    if (!parsed.success) continue;
    for (const s of parsed.data.swatches) {
      assert.ok(
        HEX_REGEX.test(s.value),
        `${p.slug}@${p.version}: swatch "${s.id}" has invalid hex value "${s.value}"`,
      );
    }
  }
});

test('id matches folder slug and version matches folder version', () => {
  for (const p of allPalettes) {
    const parsed = Palette.safeParse(p.raw);
    if (!parsed.success) continue;
    assert.equal(parsed.data.id, p.slug, `${p.filePath} id "${parsed.data.id}" != folder "${p.slug}"`);
    assert.equal(
      parsed.data.version,
      p.version,
      `${p.filePath} version "${parsed.data.version}" != folder "${p.version}"`,
    );
  }
});

test('Community palettes (Wave 2) ship with real provenance and dual-mode roles', () => {
  const seen = new Set<string>();
  for (const p of allPalettes) {
    if (!COMMUNITY_SLUGS.has(p.slug)) continue;
    seen.add(p.slug);
    const parsed = Palette.safeParse(p.raw);
    assert.ok(parsed.success, `${p.slug}: failed schema validation`);
    if (!parsed.success) continue;

    // Provenance must exist with source URL + license.
    const prov = parsed.data.provenance;
    assert.ok(prov, `${p.slug}: provenance is required for community palettes`);
    assert.ok(
      prov?.source && prov.source.length > 0,
      `${p.slug}: provenance.source is required`,
    );
    assert.ok(
      prov?.license && prov.license.length > 0,
      `${p.slug}: provenance.license is required`,
    );
    assert.ok(
      prov?.attribution && prov.attribution.length > 0,
      `${p.slug}: provenance.attribution is required`,
    );

    // Both modes must have a non-empty role map.
    const lightRoles = Object.keys(parsed.data.modes.light.roles).length;
    const darkRoles = Object.keys(parsed.data.modes.dark.roles).length;
    assert.ok(
      lightRoles > 0,
      `${p.slug}: modes.light.roles must not be empty (provide an inversion if upstream is dark-only)`,
    );
    assert.ok(
      darkRoles > 0,
      `${p.slug}: modes.dark.roles must not be empty (provide an inversion if upstream is light-only)`,
    );

    // Tags must be a non-empty list.
    assert.ok(
      Array.isArray(parsed.data.tags) && parsed.data.tags.length > 0,
      `${p.slug}: tags should be non-empty`,
    );
  }

  for (const required of COMMUNITY_SLUGS) {
    assert.ok(seen.has(required), `Wave 2 community palette missing on disk: ${required}`);
  }
});
