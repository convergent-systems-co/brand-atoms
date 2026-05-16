import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Brand, Font, Palette } from './schemas/index.js';
import type {
  Brand as BrandData,
  Font as FontData,
  Palette as PaletteData,
} from './schemas/index.js';

export type AtomKind = 'palette' | 'font';

export type PaletteAtomRecord = {
  kind: 'palette';
  slug: string;
  version: string;
  filePath: string;
  data: PaletteData;
};

export type FontAtomRecord = {
  kind: 'font';
  slug: string;
  version: string;
  filePath: string;
  data: FontData;
};

export type AtomRecord = PaletteAtomRecord | FontAtomRecord;

export type BrandRecord = {
  slug: string;
  version: string;
  filePath: string;
  versionDir: string;
  data: BrandData;
};

export type LoadIssue = { file: string; path: string; message: string };

export type LoadResult = {
  atoms: AtomRecord[];
  brands: BrandRecord[];
  errors: LoadIssue[];
};

const listDirs = (parent: string): string[] => {
  if (!existsSync(parent)) return [];
  return readdirSync(parent, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
};

const parseYamlFile = (filePath: string, errors: LoadIssue[]): unknown | null => {
  try {
    return parseYaml(readFileSync(filePath, 'utf8'));
  } catch (e) {
    errors.push({ file: filePath, path: '', message: `YAML parse error: ${(e as Error).message}` });
    return null;
  }
};

export const loadAtoms = (repoRoot: string, errors: LoadIssue[]): AtomRecord[] => {
  const atoms: AtomRecord[] = [];

  const kinds: { kind: AtomKind; dir: string }[] = [
    { kind: 'palette', dir: join(repoRoot, 'palettes') },
    { kind: 'font', dir: join(repoRoot, 'fonts') },
  ];

  for (const { kind, dir } of kinds) {
    for (const slug of listDirs(dir)) {
      for (const version of listDirs(join(dir, slug))) {
        const filePath = join(dir, slug, version, 'atom.yaml');
        if (!existsSync(filePath)) {
          errors.push({ file: join(dir, slug, version), path: '', message: 'missing atom.yaml' });
          continue;
        }
        const parsed = parseYamlFile(filePath, errors);
        if (parsed === null) continue;

        const result = kind === 'palette' ? Palette.safeParse(parsed) : Font.safeParse(parsed);
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push({ file: filePath, path: issue.path.join('.'), message: issue.message });
          }
          continue;
        }

        if (result.data.id !== slug) {
          errors.push({
            file: filePath,
            path: 'id',
            message: `id "${result.data.id}" does not match folder slug "${slug}"`,
          });
        }
        if (result.data.version !== version) {
          errors.push({
            file: filePath,
            path: 'version',
            message: `version "${result.data.version}" does not match folder version "${version}"`,
          });
        }

        if (kind === 'palette') {
          atoms.push({ kind, slug, version, filePath, data: result.data as PaletteData });
        } else {
          atoms.push({ kind, slug, version, filePath, data: result.data as FontData });
        }
      }
    }
  }

  return atoms;
};

export const loadBrands = (repoRoot: string, errors: LoadIssue[]): BrandRecord[] => {
  const brands: BrandRecord[] = [];
  const brandsDir = join(repoRoot, 'brands');
  for (const slug of listDirs(brandsDir)) {
    for (const version of listDirs(join(brandsDir, slug))) {
      const versionDir = join(brandsDir, slug, version);
      const filePath = join(versionDir, 'brand.yaml');
      if (!existsSync(filePath)) {
        errors.push({ file: versionDir, path: '', message: 'missing brand.yaml' });
        continue;
      }
      const parsed = parseYamlFile(filePath, errors);
      if (parsed === null) continue;
      const result = Brand.safeParse(parsed);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({ file: filePath, path: issue.path.join('.'), message: issue.message });
        }
        continue;
      }
      if (result.data.id !== slug) {
        errors.push({
          file: filePath,
          path: 'id',
          message: `id "${result.data.id}" does not match folder slug "${slug}"`,
        });
      }
      if (result.data.version !== version) {
        errors.push({
          file: filePath,
          path: 'version',
          message: `version "${result.data.version}" does not match folder version "${version}"`,
        });
      }
      brands.push({ slug, version, filePath, versionDir, data: result.data });
    }
  }
  return brands;
};

export const loadAll = (repoRoot: string): LoadResult => {
  const errors: LoadIssue[] = [];
  const atoms = loadAtoms(repoRoot, errors);
  const brands = loadBrands(repoRoot, errors);
  return { atoms, brands, errors };
};

const semverParts = (v: string): [number, number, number] => {
  const [a = 0, b = 0, c = 0] = v.split('.').map(Number);
  return [a, b, c];
};

export const compareSemver = (a: string, b: string): number => {
  const [a1, a2, a3] = semverParts(a);
  const [b1, b2, b3] = semverParts(b);
  return a1 - b1 || a2 - b2 || a3 - b3;
};

export const resolveVersion = (versions: string[], ref: string): string | null => {
  if (versions.length === 0) return null;
  const sorted = [...versions].sort(compareSemver);
  if (ref === 'latest') return sorted[sorted.length - 1] ?? null;
  const parts = ref.split('.').map(Number);
  const matching = sorted.filter((v) => {
    const vp = v.split('.').map(Number);
    for (let i = 0; i < parts.length; i++) {
      if (vp[i] !== parts[i]) return false;
    }
    return true;
  });
  return matching.length === 0 ? null : (matching[matching.length - 1] ?? null);
};

export const indexAtoms = (atoms: AtomRecord[]): Map<AtomKind, Map<string, string[]>> => {
  const index = new Map<AtomKind, Map<string, string[]>>([
    ['palette', new Map()],
    ['font', new Map()],
  ]);
  for (const a of atoms) {
    const slugMap = index.get(a.kind);
    if (!slugMap) continue;
    const versions = slugMap.get(a.slug) ?? [];
    versions.push(a.version);
    slugMap.set(a.slug, versions);
  }
  return index;
};

export const findAtom = <K extends AtomKind>(
  atoms: AtomRecord[],
  kind: K,
  slug: string,
  version: string,
): (K extends 'palette' ? PaletteAtomRecord : FontAtomRecord) | null => {
  const found = atoms.find((a) => a.kind === kind && a.slug === slug && a.version === version);
  return (found ?? null) as (K extends 'palette' ? PaletteAtomRecord : FontAtomRecord) | null;
};
