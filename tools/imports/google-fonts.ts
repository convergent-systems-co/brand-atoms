#!/usr/bin/env tsx
/**
 * Google Fonts bulk importer.
 *
 * Reads each font's canonical METADATA.pb (Google Fonts repo at
 * https://github.com/google/fonts) and emits a schema-valid font atom YAML
 * at fonts/<slug>/<version>/atom.yaml.
 *
 * Deterministic + idempotent: same slug list with unchanged upstream produces
 * zero diff. We sort keys, sort styles by (weight asc, style: normal-before-italic),
 * and use a hand-rolled protobuf-text parser to avoid any cross-version variance
 * from a third-party dep.
 *
 * Usage:
 *   tsx tools/imports/google-fonts.ts                # default curated slug list
 *   tsx tools/imports/google-fonts.ts roboto opensans lato
 *
 * Each positional arg is "<slug>" (license dir auto-detected: ofl → apache → ufl).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { Font } from '../schemas/font.js';

// =============================================================================
// Types
// =============================================================================

export type LicenseDir = 'ofl' | 'apache' | 'ufl';

export type FontWeight = number;
export type FontStyleKind = 'normal' | 'italic';

export interface MetadataFontEntry {
  name: string;
  style: FontStyleKind;
  weight: FontWeight;
  filename: string;
  postScriptName: string;
  fullName: string;
  copyright: string;
}

export interface MetadataAxis {
  tag: string;
  minValue: number;
  maxValue: number;
}

export interface ParsedMetadata {
  name: string;
  designer: string;
  license: string;
  category: string;
  dateAdded: string;
  fonts: MetadataFontEntry[];
  axes: MetadataAxis[];
  subsets: string[];
}

export type Classification =
  | 'serif'
  | 'sans-serif'
  | 'monospace'
  | 'display'
  | 'handwriting'
  | 'slab-serif';

export interface SlugSpec {
  /** Folder slug in google/fonts repo (e.g. `roboto`, `opensans`). */
  slug: string;
  /** Atom slug to use on disk; defaults to `slug`. */
  atomSlug?: string;
  /** Override classification (e.g., force `slab-serif` for slab fonts in SERIF dir). */
  classificationOverride?: Classification;
  /** Extra tags to add. */
  extraTags?: string[];
  /** License-directory hint; if unset, the importer probes ofl → apache → ufl. */
  licenseDirHint?: LicenseDir;
}

// =============================================================================
// Constants
// =============================================================================

const ATOM_VERSION = '1.0.0';
const IMPORT_DATE = '2026-05-17';

const LICENSE_DIRS: LicenseDir[] = ['ofl', 'apache', 'ufl'];

const LICENSE_DIR_TO_SPDX: Record<LicenseDir, string> = {
  ofl: 'OFL-1.1',
  apache: 'Apache-2.0',
  ufl: 'UFL-1.0',
};

const CATEGORY_TO_CLASSIFICATION: Record<string, Classification> = {
  SANS_SERIF: 'sans-serif',
  SERIF: 'serif',
  MONOSPACE: 'monospace',
  DISPLAY: 'display',
  HANDWRITING: 'handwriting',
};

const FALLBACK_STACKS: Record<Classification, string[]> = {
  'sans-serif': [
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ],
  serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
  'slab-serif': ['Rockwell', 'Courier Bold', 'Courier', 'Georgia', 'Times', 'serif'],
  monospace: ['Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
  display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
  handwriting: ['Brush Script MT', 'Lucida Handwriting', 'cursive'],
};

const RAW_BASE = 'https://raw.githubusercontent.com/google/fonts/main';

// =============================================================================
// Parser — hand-rolled protobuf-text reader.
//
// METADATA.pb files are flat key:value with `{}` nested blocks. We only need a
// shallow parser: top-level scalars + repeated `fonts {}` and `axes {}` blocks.
// =============================================================================

/** Unquote a protobuf-text string literal, handling `\"` and `\\`. */
const unquote = (raw: string): string => {
  // Already without leading/trailing quote in `raw`.
  return raw.replace(/\\(["\\])/g, '$1');
};

/** Match `key: "value"` (scalar string). */
const RE_SCALAR_STR = /^([a-z_]+):\s*"((?:[^"\\]|\\.)*)"\s*$/;
/** Match `key: 1234` or `key: 1234.5` (scalar number). */
const RE_SCALAR_NUM = /^([a-z_]+):\s*(-?\d+(?:\.\d+)?)\s*$/;
/** Match block opener `key {` */
const RE_BLOCK_OPEN = /^([a-z_]+)\s*\{\s*$/;
/** Match block closer `}` */
const RE_BLOCK_CLOSE = /^\}\s*$/;

interface RawBlock {
  scalars: Record<string, string | number>;
  children: Array<{ key: string; block: RawBlock }>;
}

const newBlock = (): RawBlock => ({ scalars: {}, children: [] });

/**
 * Parses protobuf-text into a shallow tree. Repeated keys are preserved via
 * children entries; for scalars on the same key (e.g., repeated `subsets:`)
 * we collect into an array-suffixed bucket.
 */
export const parseProtoText = (text: string): RawBlock => {
  const root = newBlock();
  const stack: RawBlock[] = [root];
  const lines = text.split(/\r?\n/);

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const closeMatch = line.match(RE_BLOCK_CLOSE);
    if (closeMatch) {
      stack.pop();
      if (stack.length === 0) throw new Error('Unbalanced "}" in METADATA');
      continue;
    }

    const openMatch = line.match(RE_BLOCK_OPEN);
    if (openMatch) {
      const key = openMatch[1] as string;
      const child = newBlock();
      const top = stack[stack.length - 1];
      if (!top) throw new Error('Internal: empty stack');
      top.children.push({ key, block: child });
      stack.push(child);
      continue;
    }

    const strMatch = line.match(RE_SCALAR_STR);
    if (strMatch) {
      const key = strMatch[1] as string;
      const val = unquote(strMatch[2] as string);
      const top = stack[stack.length - 1];
      if (!top) throw new Error('Internal: empty stack');
      const existing = top.scalars[key];
      if (existing === undefined) {
        top.scalars[key] = val;
      } else {
        // Repeated scalar (e.g., `subsets: "..."` lines). Stash extras under
        // `<key>__list` so callers can recover the full sequence.
        const listKey = `${key}__list`;
        const list = (top.scalars[listKey] as unknown as string[] | undefined) ?? [
          existing as string,
        ];
        list.push(val);
        (top.scalars as Record<string, unknown>)[listKey] = list;
        top.scalars[key] = val;
      }
      continue;
    }

    const numMatch = line.match(RE_SCALAR_NUM);
    if (numMatch) {
      const key = numMatch[1] as string;
      const val = Number(numMatch[2]);
      const top = stack[stack.length - 1];
      if (!top) throw new Error('Internal: empty stack');
      top.scalars[key] = val;
      continue;
    }

    // Unknown line shape — ignore (forward-compatible with new fields).
  }

  if (stack.length !== 1) {
    throw new Error('Unbalanced blocks in METADATA');
  }
  return root;
};

/** Build a `ParsedMetadata` from the raw shallow tree. */
export const extractMetadata = (root: RawBlock): ParsedMetadata => {
  const name = String(root.scalars['name'] ?? '');
  const designer = String(root.scalars['designer'] ?? '');
  const license = String(root.scalars['license'] ?? '');
  const category = String(root.scalars['category'] ?? '');
  const dateAdded = String(root.scalars['date_added'] ?? '');

  const subsetsList = (root.scalars['subsets__list'] as unknown as string[] | undefined) ?? [];
  const singleSubset = root.scalars['subsets'];
  const subsets = subsetsList.length > 0
    ? subsetsList
    : (typeof singleSubset === 'string' ? [singleSubset] : []);

  const fonts: MetadataFontEntry[] = [];
  const axes: MetadataAxis[] = [];

  for (const { key, block } of root.children) {
    if (key === 'fonts') {
      const entry: MetadataFontEntry = {
        name: String(block.scalars['name'] ?? ''),
        style: (block.scalars['style'] === 'italic' ? 'italic' : 'normal') as FontStyleKind,
        weight: Number(block.scalars['weight'] ?? 400),
        filename: String(block.scalars['filename'] ?? ''),
        postScriptName: String(block.scalars['post_script_name'] ?? ''),
        fullName: String(block.scalars['full_name'] ?? ''),
        copyright: String(block.scalars['copyright'] ?? ''),
      };
      fonts.push(entry);
    } else if (key === 'axes') {
      axes.push({
        tag: String(block.scalars['tag'] ?? ''),
        minValue: Number(block.scalars['min_value'] ?? 0),
        maxValue: Number(block.scalars['max_value'] ?? 0),
      });
    }
  }

  return { name, designer, license, category, dateAdded, fonts, axes, subsets };
};

// =============================================================================
// Atom builder
// =============================================================================

/** Maps METADATA `category` + optional override to atom classification. */
export const classifyFont = (
  category: string,
  override?: Classification,
): Classification => {
  if (override) return override;
  const mapped = CATEGORY_TO_CLASSIFICATION[category];
  if (!mapped) {
    throw new Error(`Unknown METADATA category: "${category}"`);
  }
  return mapped;
};

/** Sort styles deterministically: weight asc, normal before italic. */
export const sortStyles = (
  styles: Array<{ weight: number; style: FontStyleKind }>,
): Array<{ weight: number; style: FontStyleKind }> => {
  return [...styles].sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    if (a.style === b.style) return 0;
    return a.style === 'normal' ? -1 : 1;
  });
};

/** Dedup styles by (weight, style). */
export const dedupStyles = (
  styles: Array<{ weight: number; style: FontStyleKind }>,
): Array<{ weight: number; style: FontStyleKind }> => {
  const seen = new Set<string>();
  const out: Array<{ weight: number; style: FontStyleKind }> = [];
  for (const s of styles) {
    const k = `${s.weight}:${s.style}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
};

/**
 * Build the Google Fonts CSS URL for this font. Uses the discrete static-style
 * list (from `fonts {}` blocks). If a `wght` axis is present, uses the
 * `wght@min..max` range form (this is the canonical variable-font URL).
 */
export const buildGoogleCssUrl = (md: ParsedMetadata): string => {
  const familyEnc = md.name.replace(/ /g, '+');

  const hasWghtAxis = md.axes.some((a) => a.tag === 'wght');
  const hasItalic = md.fonts.some((f) => f.style === 'italic');

  const styles = sortStyles(
    dedupStyles(md.fonts.map((f) => ({ weight: f.weight, style: f.style }))),
  );

  // Variable-font path: use wght range
  if (hasWghtAxis) {
    const wghtAxis = md.axes.find((a) => a.tag === 'wght');
    if (!wghtAxis) {
      throw new Error('unreachable');
    }
    const min = Math.round(wghtAxis.minValue);
    const max = Math.round(wghtAxis.maxValue);
    if (hasItalic) {
      return `https://fonts.googleapis.com/css2?family=${familyEnc}:ital,wght@0,${min}..${max};1,${min}..${max}&display=swap`;
    }
    return `https://fonts.googleapis.com/css2?family=${familyEnc}:wght@${min}..${max}&display=swap`;
  }

  // Static-only path: enumerate weights
  if (hasItalic) {
    const normals = styles
      .filter((s) => s.style === 'normal')
      .map((s) => `0,${s.weight}`)
      .join(';');
    const italics = styles
      .filter((s) => s.style === 'italic')
      .map((s) => `1,${s.weight}`)
      .join(';');
    const parts = [normals, italics].filter((p) => p.length > 0).join(';');
    return `https://fonts.googleapis.com/css2?family=${familyEnc}:ital,wght@${parts}&display=swap`;
  }

  const weights = styles.map((s) => String(s.weight)).join(';');
  if (weights === '' || weights === '400') {
    return `https://fonts.googleapis.com/css2?family=${familyEnc}&display=swap`;
  }
  return `https://fonts.googleapis.com/css2?family=${familyEnc}:wght@${weights}&display=swap`;
};

export interface BuildAtomInput {
  md: ParsedMetadata;
  slug: string;
  licenseDir: LicenseDir;
  classificationOverride?: Classification;
  extraTags?: string[];
}

/**
 * Build a font atom object from parsed METADATA. Returns a plain object
 * suitable for YAML emission. Validated via Font.parse before return.
 */
export const buildAtom = (input: BuildAtomInput): Record<string, unknown> => {
  const { md, slug, licenseDir } = input;
  const classification = classifyFont(md.category, input.classificationOverride);
  const styles = sortStyles(
    dedupStyles(md.fonts.map((f) => ({ weight: f.weight, style: f.style }))),
  );
  if (styles.length === 0) {
    throw new Error(`No fonts {} entries in METADATA for ${slug}`);
  }

  // Provenance attribution: designer + canonical copyright (first style's).
  // Append a SPDX license line only if the copyright text doesn't already
  // mention the license (avoids duplicate "Licensed under..." phrasing).
  const firstCopyright = md.fonts[0]?.copyright ?? '';
  const designerLine = md.designer ? `Designed by ${md.designer}.` : '';
  const licenseLine = (() => {
    if (licenseDir === 'ofl') {
      return 'Licensed under the SIL Open Font License, Version 1.1.';
    }
    if (licenseDir === 'apache') {
      return 'Licensed under the Apache License, Version 2.0.';
    }
    return 'Licensed under the Ubuntu Font Licence, Version 1.0.';
  })();
  const copyrightMentionsLicense = /licen[cs]ed/i.test(firstCopyright);
  const attribParts = [designerLine, firstCopyright];
  if (!copyrightMentionsLicense) attribParts.push(licenseLine);
  const attribution = attribParts.filter((s) => s.length > 0).join(' ');

  const source = `${RAW_BASE}/${licenseDir}/${slug}/METADATA.pb`;
  const cssUrl = buildGoogleCssUrl(md);

  const baseTags: string[] = [];
  if (md.axes.length > 0) baseTags.push('variable-font');
  baseTags.push(classification === 'slab-serif' ? 'slab' : classification);
  const tags = Array.from(new Set([...baseTags, ...(input.extraTags ?? [])])).sort();

  const atom: Record<string, unknown> = {
    kind: 'font',
    id: slug,
    version: ATOM_VERSION,
    name: md.name,
    family: md.name,
    classification,
    tags,
    provenance: {
      source,
      license: LICENSE_DIR_TO_SPDX[licenseDir],
      attribution,
      importedDate: IMPORT_DATE,
    },
    source: {
      kind: 'google-fonts',
      family: md.name,
      url: cssUrl,
    },
    fallbackStack: FALLBACK_STACKS[classification],
    availableStyles: styles.map((s) => ({ weight: s.weight, style: s.style })),
  };

  // Validate before returning — fail fast on schema drift.
  const res = Font.safeParse(atom);
  if (!res.success) {
    throw new Error(
      `Built atom for ${slug} failed schema validation: ${JSON.stringify(res.error.issues)}`,
    );
  }
  return atom;
};

// =============================================================================
// YAML emission (deterministic key order)
// =============================================================================

/**
 * Emit YAML with a stable key order. Uses `yaml` package's sortMapEntries via
 * a custom replacer that pre-orders the top-level keys.
 */
export const emitYaml = (atom: Record<string, unknown>): string => {
  const orderedTop: Record<string, unknown> = {};
  const keyOrder = [
    'kind',
    'id',
    'version',
    'name',
    'description',
    'family',
    'classification',
    'tags',
    'provenance',
    'source',
    'fallbackStack',
    'availableStyles',
    'cdnUrls',
  ];
  for (const k of keyOrder) {
    if (k in atom) orderedTop[k] = atom[k];
  }
  // Include any unexpected extra keys at the end (forward-compat).
  for (const k of Object.keys(atom)) {
    if (!(k in orderedTop)) orderedTop[k] = atom[k];
  }

  // Custom yaml.stringify with stable formatting:
  //   - Block scalars for top-level objects
  //   - Flow style for each availableStyles entry (matches existing repo style)
  const text = stringifyYaml(orderedTop, {
    indent: 2,
    lineWidth: 0,
    minContentWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    aliasDuplicateObjects: false,
  });
  return text;
};

// =============================================================================
// Fetching with retries
// =============================================================================

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const fetchWithRetry = async (
  url: string,
  retries = 3,
): Promise<string | null> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`Fetch failed after ${retries + 1} attempts: ${url}: ${(err as Error).message}`);
      }
      await sleep(250 * 2 ** attempt);
    }
  }
  return null;
};

/** Probe ofl → apache → ufl for the slug. Returns first found + which dir. */
export const fetchMetadataForSlug = async (
  slug: string,
  hint?: LicenseDir,
): Promise<{ text: string; licenseDir: LicenseDir } | null> => {
  const order: LicenseDir[] = hint
    ? [hint, ...LICENSE_DIRS.filter((d) => d !== hint)]
    : LICENSE_DIRS;
  for (const dir of order) {
    const url = `${RAW_BASE}/${dir}/${slug}/METADATA.pb`;
    const text = await fetchWithRetry(url);
    if (text !== null) return { text, licenseDir: dir };
  }
  return null;
};

// =============================================================================
// Importer entry point
// =============================================================================

export interface ImportResult {
  imported: Array<{ slug: string; classification: Classification; licenseDir: LicenseDir }>;
  skipped: Array<{ slug: string; reason: string }>;
}

export const REPO_ROOT_DEFAULT = (() => {
  // tools/imports/google-fonts.ts → ../../..
  // When run via tsx, process.cwd() is repo root; we prefer that.
  return process.cwd();
})();

export const importFonts = async (
  specs: SlugSpec[],
  opts: { repoRoot?: string; dryRun?: boolean } = {},
): Promise<ImportResult> => {
  const repoRoot = opts.repoRoot ?? REPO_ROOT_DEFAULT;
  const result: ImportResult = { imported: [], skipped: [] };

  for (const spec of specs) {
    const slugForDisk = spec.atomSlug ?? spec.slug;
    try {
      const fetched = await fetchMetadataForSlug(spec.slug, spec.licenseDirHint);
      if (!fetched) {
        result.skipped.push({ slug: spec.slug, reason: 'METADATA.pb not found in ofl/apache/ufl' });
        continue;
      }
      const tree = parseProtoText(fetched.text);
      const md = extractMetadata(tree);
      const atom = buildAtom({
        md,
        slug: slugForDisk,
        licenseDir: fetched.licenseDir,
        classificationOverride: spec.classificationOverride,
        extraTags: spec.extraTags,
      });
      const yamlText = emitYaml(atom);

      const outPath = join(repoRoot, 'fonts', slugForDisk, ATOM_VERSION, 'atom.yaml');
      if (!opts.dryRun) {
        mkdirSync(dirname(outPath), { recursive: true });
        // Idempotency: only write if content changed.
        if (existsSync(outPath)) {
          const prev = readFileSync(outPath, 'utf8');
          if (prev === yamlText) {
            result.imported.push({
              slug: slugForDisk,
              classification: (atom['classification'] as Classification),
              licenseDir: fetched.licenseDir,
            });
            continue;
          }
        }
        writeFileSync(outPath, yamlText, 'utf8');
      }
      result.imported.push({
        slug: slugForDisk,
        classification: (atom['classification'] as Classification),
        licenseDir: fetched.licenseDir,
      });
    } catch (err) {
      result.skipped.push({ slug: spec.slug, reason: (err as Error).message });
    }
  }

  return result;
};

// =============================================================================
// Curated slug list (~100)
//
// Each entry is a Google Fonts directory slug. Existing repo atoms (inter,
// firacode-nerdfont, jetbrainsmono-nerdfont, hack-nerdfont, cascadiacode-nerdfont)
// are intentionally NOT included to avoid clobbering.
//
// Slab-serif overrides force the slab-serif classification for fonts that
// Google Fonts classifies as SERIF but are slab in design.
// =============================================================================

export const CURATED_SLUGS: SlugSpec[] = [
  // ---------- Sans-serif (~35) ----------
  { slug: 'roboto' },
  { slug: 'opensans' },
  { slug: 'lato' },
  { slug: 'montserrat' },
  { slug: 'oswald' },
  { slug: 'raleway' },
  { slug: 'ptsans' },
  { slug: 'nunito' },
  { slug: 'nunitosans' },
  { slug: 'worksans' },
  { slug: 'sourcesans3' },
  { slug: 'rubik' },
  { slug: 'poppins' },
  { slug: 'dmsans' },
  { slug: 'manrope' },
  { slug: 'plusjakartasans' },
  { slug: 'mulish' },
  { slug: 'hind' },
  { slug: 'karla' },
  { slug: 'quicksand' },
  { slug: 'urbanist' },
  { slug: 'prompt' },
  { slug: 'kanit' },
  { slug: 'exo2' },
  { slug: 'barlow' },
  { slug: 'firasans' },
  { slug: 'archivo' },
  { slug: 'jost' },
  { slug: 'asap' },
  { slug: 'mukta' },
  { slug: 'ibmplexsans' },
  { slug: 'librefranklin' },
  { slug: 'signika' },
  { slug: 'titilliumweb' },
  { slug: 'cabin' },

  // ---------- Serif (~20) ----------
  { slug: 'playfairdisplay' },
  { slug: 'lora' },
  { slug: 'cormorantgaramond' },
  { slug: 'ebgaramond' },
  { slug: 'librebaskerville' },
  { slug: 'crimsonpro' },
  { slug: 'crimsontext' },
  { slug: 'ptserif' },
  { slug: 'sourceserif4' },
  { slug: 'dmserifdisplay' },
  { slug: 'spectral' },
  { slug: 'cardo' },
  { slug: 'faustina' },
  { slug: 'notoserif' },
  { slug: 'alegreya' },
  { slug: 'domine' },
  { slug: 'vollkorn' },
  { slug: 'tinos' },
  { slug: 'cormorant' },
  { slug: 'gentiumplus' },

  // ---------- Slab-serif (~8) ----------
  // Google's category is SERIF or DISPLAY; we override classification to slab-serif.
  { slug: 'robotoslab', classificationOverride: 'slab-serif', extraTags: ['slab'] },
  { slug: 'zillaslab', classificationOverride: 'slab-serif', extraTags: ['slab'] },
  { slug: 'arvo', classificationOverride: 'slab-serif', extraTags: ['slab'] },
  { slug: 'bitter', classificationOverride: 'slab-serif', extraTags: ['slab'] },
  { slug: 'merriweather', classificationOverride: 'slab-serif', extraTags: ['slab'] },
  { slug: 'oldstandardtt', classificationOverride: 'slab-serif', extraTags: ['slab'] },
  { slug: 'rokkitt', classificationOverride: 'slab-serif', extraTags: ['slab'] },
  { slug: 'josefinslab', classificationOverride: 'slab-serif', extraTags: ['slab'] },

  // ---------- Display (~10) ----------
  { slug: 'lobster' },
  { slug: 'righteous' },
  { slug: 'abrilfatface' },
  { slug: 'bebasneue' },
  { slug: 'pacifico' },
  { slug: 'comfortaa' },
  { slug: 'lobstertwo' },
  { slug: 'alfaslabone' },
  { slug: 'oleoscript' },
  { slug: 'fredoka' },

  // ---------- Handwriting (~8) ----------
  { slug: 'dancingscript' },
  { slug: 'caveat' },
  { slug: 'satisfy' },
  { slug: 'kalam' },
  { slug: 'sacramento' },
  { slug: 'indieflower' },
  { slug: 'shadowsintolight' },
  { slug: 'greatvibes' },

  // ---------- Monospace (~12), non-Nerd-Font base counterparts ----------
  { slug: 'robotomono' },
  { slug: 'sourcecodepro' },
  { slug: 'ibmplexmono' },
  { slug: 'spacemono' },
  { slug: 'inconsolata' },
  { slug: 'ubuntumono' },
  { slug: 'anonymouspro' },
  { slug: 'ptmono' },
  { slug: 'courierprime' },
  { slug: 'overpassmono' },
  { slug: 'victormono' },
  { slug: 'jetbrainsmono' },
];

// =============================================================================
// CLI
// =============================================================================

const isMain =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('google-fonts.ts');

const printResult = (result: ImportResult): void => {
  const byClass: Record<string, number> = {};
  for (const r of result.imported) {
    byClass[r.classification] = (byClass[r.classification] ?? 0) + 1;
  }
  console.log(`\nImported: ${result.imported.length}`);
  for (const [k, v] of Object.entries(byClass).sort()) {
    console.log(`  ${k}: ${v}`);
  }
  if (result.skipped.length > 0) {
    console.log(`\nSkipped: ${result.skipped.length}`);
    for (const s of result.skipped) {
      console.log(`  - ${s.slug}: ${s.reason}`);
    }
  }
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const specs: SlugSpec[] = args.length > 0 ? args.map((slug) => ({ slug })) : CURATED_SLUGS;
  const result = await importFonts(specs);
  printResult(result);
  if (result.imported.length === 0 && result.skipped.length > 0) {
    process.exit(1);
  }
};

if (isMain) {
  void main();
}
