import { resolve } from 'node:path';
import {
  type AtomRecord,
  type BrandRecord,
  type FontAtomRecord,
  loadAll,
  type PaletteAtomRecord,
} from '../../../tools/loader.js';
import { type ResolvedBrand, resolveBrand } from '../../../tools/resolver.js';

// During Astro build, encyclopedia.ts is bundled into a Vite chunk, so
// import.meta.url is unreliable for locating the repo root. Use cwd
// (always the workspace package — web/) and walk up.
const repoRoot = resolve(process.cwd(), process.cwd().endsWith('/web') ? '..' : '.');

let cached: ReturnType<typeof loadAll> | null = null;

const load = () => {
  if (!cached) {
    cached = loadAll(repoRoot);
    if (cached.errors.length > 0) {
      for (const e of cached.errors) {
        console.warn(`[encyclopedia] ${e.file} [${e.path}]: ${e.message}`);
      }
    }
  }
  return cached;
};

export const getPalettes = (): PaletteAtomRecord[] => {
  return load().atoms.filter((a): a is PaletteAtomRecord => a.kind === 'palette');
};

export const getFonts = (): FontAtomRecord[] => {
  return load().atoms.filter((a): a is FontAtomRecord => a.kind === 'font');
};

export const getBrands = (): BrandRecord[] => {
  return load().brands;
};

export const getPaletteBySlug = (slug: string): PaletteAtomRecord | null => {
  const palettes = getPalettes().filter((p) => p.slug === slug);
  if (palettes.length === 0) return null;
  return palettes.sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
};

export const getFontBySlug = (slug: string): FontAtomRecord | null => {
  const fonts = getFonts().filter((f) => f.slug === slug);
  if (fonts.length === 0) return null;
  return fonts.sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
};

export const getResolvedBrandBySlug = (slug: string): ResolvedBrand | null => {
  const all = load();
  const matches = all.brands.filter((b) => b.slug === slug);
  if (matches.length === 0) return null;
  const latest = matches.sort((a, b) => b.version.localeCompare(a.version))[0];
  if (!latest) return null;
  const { brand, errors } = resolveBrand(latest, all.atoms);
  if (errors.length > 0) {
    for (const e of errors) {
      console.warn(`[encyclopedia] resolve ${e.brand} [${e.path}]: ${e.message}`);
    }
  }
  return brand;
};

const fontClassToFamilyMap: Record<string, string> = {
  inter: "'Inter', sans-serif",
  'firacode-nerdfont': "'Fira Code', ui-monospace, monospace",
  'jetbrainsmono-nerdfont': "'JetBrains Mono', ui-monospace, monospace",
  'hack-nerdfont': "'Hack', 'DejaVu Sans Mono', ui-monospace, monospace",
  'cascadiacode-nerdfont': "'Cascadia Code', ui-monospace, monospace",
};

export const fontShowcaseFamily = (slug: string): string => {
  return fontClassToFamilyMap[slug] ?? 'var(--font-sans)';
};

export type { AtomRecord, BrandRecord, PaletteAtomRecord, FontAtomRecord, ResolvedBrand };
