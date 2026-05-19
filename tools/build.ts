#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { emitterMap, emitters } from './emitters/index.js';
import { type AtomRecord, type FontAtomRecord, type PaletteAtomRecord, loadAll } from './loader.js';
import { type ResolvedBrand, resolveBrand } from './resolver.js';

type CliArgs = {
  brandRefs: string[];
  emitterNames: string[];
  outDir: string;
  help: boolean;
};

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    brandRefs: [],
    emitterNames: [],
    outDir: 'dist',
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      args.help = true;
    } else if (a === '--brand' || a === '-b') {
      const next = argv[++i];
      if (next) args.brandRefs.push(next);
    } else if (a === '--emit' || a === '-e') {
      const next = argv[++i];
      if (next) args.emitterNames.push(...next.split(','));
    } else if (a === '--out' || a === '-o') {
      const next = argv[++i];
      if (next) args.outDir = next;
    }
  }
  return args;
};

// ─── Catalog index ────────────────────────────────────────────────────
// A global JSON summary at <outDir>/index.json. The `brandatom` CLI fetches
// this to render `brands list`, `palettes list`, `fonts list` without having
// to parse every brand.json.

type CatalogBrandEntry = {
  slug: string;
  version: string;
  name: string;
  description: string;
  tags: string[];
  paletteRef: string;
  fontRefs: Record<string, string>;
  identity: string;
  primary: string;
  accent: string;
  assetCount: number;
  ruleCount: number;
};

type CatalogPaletteEntry = {
  slug: string;
  version: string;
  name: string;
  description: string;
  tags: string[];
  swatchCount: number;
  preview: string[];
  hasLight: boolean;
  hasDark: boolean;
};

type CatalogFontEntry = {
  slug: string;
  version: string;
  name: string;
  family: string;
  classification: string;
  license: string;
  isVariable: boolean;
  weightRange: [number, number] | null;
};

type CatalogIndex = {
  schemaVersion: '1';
  generated: string;
  brands: CatalogBrandEntry[];
  palettes: CatalogPaletteEntry[];
  fonts: CatalogFontEntry[];
};

const trimDescription = (desc: string | undefined): string => {
  if (!desc) return '';
  const flat = desc.replace(/\s+/g, ' ').trim();
  // First sentence boundary OR 140 chars, whichever is shorter.
  const dot = flat.indexOf('. ');
  const cut = dot > 0 && dot < 140 ? dot + 1 : 140;
  return flat.length <= cut ? flat : `${flat.slice(0, cut).trimEnd()}…`;
};

const semverGt = (a: string, b: string): boolean => {
  const ap = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const bp = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av > bv;
  }
  return false;
};

const resolveSwatchHex = (brand: ResolvedBrand, swatchId: string | undefined): string | null => {
  if (!swatchId) return null;
  const sw = brand.palette.data.swatches.find((s) => s.id === swatchId);
  return sw?.value ?? null;
};

const roleHex = (
  brand: ResolvedBrand,
  role: string,
  mode: 'light' | 'dark' = 'light',
): string | null => {
  const brandSwatchId = brand.roles?.colors?.[role];
  const paletteSwatchId = brand.palette.data.modes[mode]?.roles?.[role];
  return resolveSwatchHex(brand, brandSwatchId) ?? resolveSwatchHex(brand, paletteSwatchId);
};

const brandEntry = (brand: ResolvedBrand): CatalogBrandEntry => {
  const primary = roleHex(brand, 'primary') ?? '#5E81AC';
  const accent = roleHex(brand, 'accent') ?? primary;
  const identity = roleHex(brand, 'identity') ?? primary;
  const fontRefs: Record<string, string> = {};
  for (const f of brand.fonts) {
    fontRefs[f.role] = `${f.slug}@${f.resolvedVersion}`;
  }
  return {
    slug: brand.id,
    version: brand.version,
    name: brand.name,
    description: trimDescription(brand.description),
    tags: brand.tags,
    paletteRef: `${brand.palette.slug}@${brand.palette.resolvedVersion}`,
    fontRefs,
    identity,
    primary,
    accent,
    assetCount: brand.assets.length,
    ruleCount: brand.rules.length,
  };
};

const paletteEntry = (atom: PaletteAtomRecord): CatalogPaletteEntry => {
  const data = atom.data;
  // Prefer swatches mapped to canonical roles, then fill with remaining.
  const preferredRoles = ['primary', 'accent', 'background', 'text-primary', 'surface', 'warning'];
  const seen = new Set<string>();
  const ordered: string[] = [];
  const modeRoles = data.modes.light?.roles ?? data.modes.dark?.roles ?? {};
  for (const role of preferredRoles) {
    const swId = modeRoles[role];
    if (!swId || seen.has(swId)) continue;
    const sw = data.swatches.find((s) => s.id === swId);
    if (sw) {
      ordered.push(sw.value);
      seen.add(swId);
    }
  }
  for (const sw of data.swatches) {
    if (ordered.length >= 8) break;
    if (seen.has(sw.id)) continue;
    ordered.push(sw.value);
    seen.add(sw.id);
  }
  const preview = ordered.slice(0, Math.min(8, Math.max(6, ordered.length)));
  return {
    slug: atom.slug,
    version: atom.version,
    name: data.name,
    description: trimDescription(data.description),
    tags: data.tags,
    swatchCount: data.swatches.length,
    preview,
    hasLight: Object.keys(data.modes.light?.roles ?? {}).length > 0,
    hasDark: Object.keys(data.modes.dark?.roles ?? {}).length > 0,
  };
};

const fontEntry = (atom: FontAtomRecord): CatalogFontEntry => {
  const data = atom.data;
  let weightRange: [number, number] | null = null;
  let isVariable = false;
  if (data.variableAxes && data.variableAxes.length > 0) {
    isVariable = true;
    const wght = data.variableAxes.find((a) => a.tag.toLowerCase() === 'wght');
    if (wght) weightRange = [wght.min, wght.max];
  }
  if (!weightRange && data.availableStyles.length > 0) {
    const ws = data.availableStyles.map((s) => s.weight);
    weightRange = [Math.min(...ws), Math.max(...ws)];
  }
  return {
    slug: atom.slug,
    version: atom.version,
    name: data.name,
    family: data.family,
    classification: data.classification ?? 'sans-serif',
    license: data.provenance?.license ?? '',
    isVariable,
    weightRange,
  };
};

const buildCatalogIndex = (resolvedBrands: ResolvedBrand[], atoms: AtomRecord[]): CatalogIndex => {
  // Latest version per slug for atoms.
  const latestPalettes = new Map<string, PaletteAtomRecord>();
  const latestFonts = new Map<string, FontAtomRecord>();
  for (const a of atoms) {
    if (a.kind === 'palette') {
      const existing = latestPalettes.get(a.slug);
      if (!existing || semverGt(a.version, existing.version)) latestPalettes.set(a.slug, a);
    } else if (a.kind === 'font') {
      const existing = latestFonts.get(a.slug);
      if (!existing || semverGt(a.version, existing.version)) latestFonts.set(a.slug, a);
    }
  }

  // Latest version per slug for brands.
  const latestBrands = new Map<string, ResolvedBrand>();
  for (const b of resolvedBrands) {
    const existing = latestBrands.get(b.id);
    if (!existing || semverGt(b.version, existing.version)) latestBrands.set(b.id, b);
  }

  const brands = [...latestBrands.values()]
    .map(brandEntry)
    .sort((a, b) => a.name.localeCompare(b.name));
  const palettes = [...latestPalettes.values()]
    .map(paletteEntry)
    .sort((a, b) => a.name.localeCompare(b.name));
  const fonts = [...latestFonts.values()]
    .map(fontEntry)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    schemaVersion: '1',
    generated: new Date().toISOString(),
    brands,
    palettes,
    fonts,
  };
};

const printHelp = (): void => {
  console.log(`brand-atoms converter

Usage:
  pnpm build [--brand <slug>[@version]] [--emit <name>[,<name>...]] [--out <dir>]

Options:
  -b, --brand    Limit to a specific brand (repeatable). Default: build every brand.
  -e, --emit     Comma-separated emitters. Default: all emitters.
  -o, --out      Output directory. Default: dist
  -h, --help     Show this help.

Available emitters:
${emitters.map((e) => `  ${e.name.padEnd(8)}  ${e.description}`).join('\n')}
`);
};

const main = (): void => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = process.cwd();
  const { atoms, brands, errors: loadErrors } = loadAll(repoRoot);

  if (loadErrors.length > 0) {
    for (const e of loadErrors) {
      const rel = e.file.replace(`${repoRoot}${sep}`, '');
      const path = e.path ? ` [${e.path}]` : '';
      console.error(`✗ ${rel}${path}: ${e.message}`);
    }
    console.error(`\n${loadErrors.length} load error(s); aborting.`);
    process.exit(1);
  }

  const wantedEmitterNames =
    args.emitterNames.length > 0 ? args.emitterNames : emitters.map((e) => e.name);
  const wantedEmitters = wantedEmitterNames.map((n) => {
    const em = emitterMap.get(n);
    if (!em) {
      console.error(`✗ unknown emitter: "${n}". Available: ${[...emitterMap.keys()].join(', ')}`);
      process.exit(1);
    }
    return em;
  });

  const wantedBrands =
    args.brandRefs.length === 0
      ? brands
      : brands.filter((b) => {
          return args.brandRefs.some((ref) => {
            const [slug, version] = ref.split('@');
            if (slug !== b.slug) return false;
            if (!version) return true;
            return b.version === version || b.version.startsWith(`${version}.`);
          });
        });

  if (wantedBrands.length === 0) {
    console.error(`✗ no brands matched filter: ${args.brandRefs.join(', ')}`);
    process.exit(1);
  }

  const outRoot = join(repoRoot, args.outDir);
  let totalFiles = 0;
  let totalBrands = 0;
  const resolvedBrands: ResolvedBrand[] = [];

  for (const brand of wantedBrands) {
    const { brand: resolved, errors: resolveErrors } = resolveBrand(brand, atoms);
    if (resolveErrors.length > 0) {
      for (const e of resolveErrors) {
        console.error(`✗ ${e.brand} [${e.path}]: ${e.message}`);
      }
      continue;
    }
    if (!resolved) continue;

    resolvedBrands.push(resolved);

    const brandOutDir = join(outRoot, 'brands', resolved.id, resolved.version);
    const writtenFiles: string[] = [];

    for (const em of wantedEmitters) {
      const files = em.emit(resolved);
      for (const file of files) {
        const fullPath = join(brandOutDir, file.path);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, file.contents, 'utf8');
        writtenFiles.push(relative(repoRoot, fullPath));
        totalFiles++;
      }
    }

    totalBrands++;
    console.log(`✓ ${resolved.id}@${resolved.version} (${writtenFiles.length} files)`);
    for (const f of writtenFiles) {
      console.log(`    ${f}`);
    }
  }

  // ─── Write top-level catalog index ──────────────────────────────────
  // Only when the build covers the whole encyclopedia (no --brand filter).
  // A filtered build doesn't have enough info to claim "this is the catalog."
  if (args.brandRefs.length === 0) {
    const index = buildCatalogIndex(resolvedBrands, atoms);
    const indexPath = join(outRoot, 'index.json');
    mkdirSync(dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    console.log(`✓ catalog index → ${relative(repoRoot, indexPath)}`);
    console.log(
      `    ${index.brands.length} brand(s), ${index.palettes.length} palette(s), ${index.fonts.length} font(s)`,
    );
  }

  console.log(
    `\nBuilt ${totalBrands} brand(s) × ${wantedEmitters.length} emitter(s) = ${totalFiles} file(s) in ${args.outDir}/`,
  );
};

main();
