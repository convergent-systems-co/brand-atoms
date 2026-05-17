/**
 * Shared helpers for palette import scripts.
 *
 * Every importer produces YAML in the same top-level key order so that
 * re-running an importer yields no diff when upstream hasn't changed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { Palette, type Palette as PaletteData } from '../schemas/index.js';

export const IMPORTED_DATE = '2026-05-17';

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'convergent-branding-library-importer/1.0' },
  });
  if (!res.ok) {
    throw new Error(`fetch failed: ${url} -> ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const txt = await fetchText(url);
  return JSON.parse(txt) as T;
}

/**
 * Normalize a hex color to 6-digit lowercase form (#rrggbb).
 * Accepts "#abc", "#aabbcc", "#aabbccdd". Rejects anything else.
 */
export function normalizeHex(value: string): string {
  const v = value.trim();
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(v);
  if (short) {
    const [, r, g, b] = short;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(v);
  if (full) {
    return `#${full[1].toLowerCase()}${full[2] ? full[2].toLowerCase() : ''}`;
  }
  throw new Error(`invalid hex color: ${value}`);
}

/**
 * Canonical top-level key order for palette atom YAML.
 * The Zod schema is unordered, but YAML files are diffable text -- we
 * enforce this order so re-runs are stable.
 */
const TOP_LEVEL_ORDER = [
  'kind',
  'id',
  'version',
  'name',
  'description',
  'tags',
  'provenance',
  'swatches',
  'modes',
] as const;

const PROVENANCE_ORDER = [
  'source',
  'license',
  'attribution',
  'importedDate',
  'importedFromVersion',
  'notes',
] as const;

const SWATCH_ORDER = ['id', 'name', 'value', 'description', 'aliases'] as const;

function reorder<T extends Record<string, unknown>>(obj: T, order: readonly string[]): T {
  const out: Record<string, unknown> = {};
  for (const k of order) {
    if (k in obj && obj[k] !== undefined) out[k] = obj[k];
  }
  // Append any extra keys deterministically (alphabetical) so we never silently drop data.
  const extra = Object.keys(obj)
    .filter((k) => !order.includes(k) && obj[k] !== undefined)
    .sort();
  for (const k of extra) out[k] = obj[k];
  return out as T;
}

function sortRoles(roles: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(roles).sort()) out[k] = roles[k];
  return out;
}

/**
 * Serialize a Palette to YAML with stable, diffable output.
 *
 * - Top-level keys in canonical order
 * - Provenance keys in canonical order
 * - Each swatch's keys in canonical order
 * - Roles within each mode sorted alphabetically
 * - Swatches preserve source order (caller controls)
 */
export function paletteToYaml(p: PaletteData): string {
  // Re-validate to catch caller bugs early.
  const parsed = Palette.parse(p);

  const ordered: Record<string, unknown> = reorder(
    parsed as unknown as Record<string, unknown>,
    TOP_LEVEL_ORDER,
  );

  if (parsed.provenance) {
    ordered.provenance = reorder(
      parsed.provenance as unknown as Record<string, unknown>,
      PROVENANCE_ORDER,
    );
  }

  ordered.swatches = parsed.swatches.map((s) => {
    const o = reorder(s as unknown as Record<string, unknown>, SWATCH_ORDER);
    // Drop empty aliases -- keeps YAML minimal and stable.
    if (Array.isArray(o.aliases) && (o.aliases as unknown[]).length === 0) {
      delete o.aliases;
    }
    return o;
  });

  ordered.modes = {
    light: { roles: sortRoles(parsed.modes.light.roles) },
    dark: { roles: sortRoles(parsed.modes.dark.roles) },
  };

  return stringifyYaml(ordered, {
    lineWidth: 0,
    blockQuote: 'literal',
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });
}

/**
 * Write the palette atom to disk only if the rendered YAML differs from
 * what's already on disk. Returns whether the file changed.
 */
export function writePaletteAtom(filePath: string, palette: PaletteData): { changed: boolean } {
  const yaml = paletteToYaml(palette);
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
  if (existing === yaml) return { changed: false };
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, yaml, 'utf8');
  return { changed: true };
}
