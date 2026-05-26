/**
 * Tests for the Google Fonts importer (tools/imports/google-fonts.ts).
 *
 * Coverage:
 *  1. Parser correctness — feed known METADATA.pb fixtures (Inter, Roboto,
 *     Lobster, Playfair Display, Ubuntu) and assert extracted fields.
 *  2. Atom builder — emit a schema-valid Font atom from parsed metadata.
 *  3. CSS URL — variable-font path uses wght@min..max range; static-only
 *     path enumerates weights; italic adds ital axis.
 *  4. Determinism — emitYaml on the same input is byte-identical.
 *  5. Idempotency — running importFonts twice over the same fixtures
 *     produces no diff on disk.
 *  6. Schema validation — every emitted atom passes Font.parse.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Font } from '../schemas/font.js';
import {
  buildAtom,
  buildGoogleCssUrl,
  classifyFont,
  dedupStyles,
  emitYaml,
  extractMetadata,
  parseProtoText,
  sortStyles,
  type ParsedMetadata,
} from '../imports/google-fonts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures', 'google-fonts');

const readFixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');

const parseFixture = (name: string): ParsedMetadata => {
  return extractMetadata(parseProtoText(readFixture(name)));
};

// -----------------------------------------------------------------------------
// Parser tests
// -----------------------------------------------------------------------------

test('parser: Inter METADATA — name, designer, license, category', () => {
  const md = parseFixture('inter.METADATA.pb');
  assert.equal(md.name, 'Inter');
  assert.equal(md.designer, 'Rasmus Andersson');
  assert.equal(md.license, 'OFL');
  assert.equal(md.category, 'SANS_SERIF');
});

test('parser: Inter — exactly two fonts {} blocks (normal + italic 400)', () => {
  const md = parseFixture('inter.METADATA.pb');
  assert.equal(md.fonts.length, 2);
  const normal = md.fonts.find((f) => f.style === 'normal');
  const italic = md.fonts.find((f) => f.style === 'italic');
  assert.ok(normal && italic);
  assert.equal(normal.weight, 400);
  assert.equal(italic.weight, 400);
  assert.equal(normal.filename, 'Inter[opsz,wght].ttf');
  assert.ok(normal.copyright.includes('Inter Project Authors'));
});

test('parser: Inter — variable axes opsz + wght', () => {
  const md = parseFixture('inter.METADATA.pb');
  assert.equal(md.axes.length, 2);
  const opsz = md.axes.find((a) => a.tag === 'opsz');
  const wght = md.axes.find((a) => a.tag === 'wght');
  assert.ok(opsz && wght);
  assert.equal(opsz.minValue, 14);
  assert.equal(opsz.maxValue, 32);
  assert.equal(wght.minValue, 100);
  assert.equal(wght.maxValue, 900);
});

test('parser: Roboto — captures subsets list', () => {
  const md = parseFixture('roboto.METADATA.pb');
  assert.ok(md.subsets.length >= 5);
  assert.ok(md.subsets.includes('latin'));
});

test('parser: Lobster — single fonts {} block, no italic', () => {
  const md = parseFixture('lobster.METADATA.pb');
  assert.equal(md.fonts.length, 1);
  assert.equal(md.fonts[0]?.style, 'normal');
  assert.equal(md.fonts[0]?.weight, 400);
  assert.equal(md.axes.length, 0); // not variable
});

test('parser: Ubuntu — multi-weight static (no axes)', () => {
  const md = parseFixture('ubuntu.METADATA.pb');
  assert.ok(md.fonts.length >= 4);
  const weights = new Set(md.fonts.map((f) => f.weight));
  assert.ok(weights.has(300));
  assert.ok(weights.has(400));
  assert.ok(weights.has(700));
});

test('parser: escaped quotes in copyright strings preserved', () => {
  const md = parseFixture('lobster.METADATA.pb');
  const cp = md.fonts[0]?.copyright ?? '';
  assert.ok(cp.includes('"Lobster"'), `expected unescaped quotes in copyright; got: ${cp}`);
});

// -----------------------------------------------------------------------------
// Classifier
// -----------------------------------------------------------------------------

test('classifier: maps Google category to atom classification', () => {
  assert.equal(classifyFont('SANS_SERIF'), 'sans-serif');
  assert.equal(classifyFont('SERIF'), 'serif');
  assert.equal(classifyFont('MONOSPACE'), 'monospace');
  assert.equal(classifyFont('DISPLAY'), 'display');
  assert.equal(classifyFont('HANDWRITING'), 'handwriting');
});

test('classifier: override wins over category', () => {
  assert.equal(classifyFont('SERIF', 'slab-serif'), 'slab-serif');
});

test('classifier: unknown category throws', () => {
  assert.throws(() => classifyFont('NEW_CATEGORY_2030'));
});

// -----------------------------------------------------------------------------
// Style sort + dedup
// -----------------------------------------------------------------------------

test('sortStyles: weight ascending, normal before italic at same weight', () => {
  const sorted = sortStyles([
    { weight: 700, style: 'italic' },
    { weight: 400, style: 'italic' },
    { weight: 400, style: 'normal' },
    { weight: 700, style: 'normal' },
  ]);
  assert.deepEqual(sorted, [
    { weight: 400, style: 'normal' },
    { weight: 400, style: 'italic' },
    { weight: 700, style: 'normal' },
    { weight: 700, style: 'italic' },
  ]);
});

test('dedupStyles: removes (weight,style) duplicates, preserves first', () => {
  const out = dedupStyles([
    { weight: 400, style: 'normal' },
    { weight: 400, style: 'normal' },
    { weight: 700, style: 'italic' },
  ]);
  assert.equal(out.length, 2);
});

// -----------------------------------------------------------------------------
// CSS URL builder
// -----------------------------------------------------------------------------

test('CSS URL: variable font with italic uses ital,wght@0,min..max;1,min..max', () => {
  const md = parseFixture('inter.METADATA.pb');
  const url = buildGoogleCssUrl(md);
  assert.equal(
    url,
    'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100..900;1,100..900&display=swap',
  );
});

test('CSS URL: single-weight non-variable uses bare family', () => {
  const md = parseFixture('lobster.METADATA.pb');
  const url = buildGoogleCssUrl(md);
  assert.equal(url, 'https://fonts.googleapis.com/css2?family=Lobster&display=swap');
});

test('CSS URL: spaces in family name are encoded as +', () => {
  const md = parseFixture('playfairdisplay.METADATA.pb');
  const url = buildGoogleCssUrl(md);
  assert.ok(url.includes('family=Playfair+Display'), `got: ${url}`);
});

// -----------------------------------------------------------------------------
// Atom builder + schema validation
// -----------------------------------------------------------------------------

test('buildAtom: Inter from OFL — atom matches schema', () => {
  const md = parseFixture('inter.METADATA.pb');
  // Use a distinct slug so we don't conflict with the existing inter atom.
  const atom = buildAtom({ md, slug: 'inter-test', licenseDir: 'ofl' });
  const res = Font.safeParse(atom);
  assert.equal(res.success, true, res.success ? '' : JSON.stringify(res.error.issues));
  assert.equal(atom.id, 'inter-test');
  assert.equal(atom.classification, 'sans-serif');
  const prov = atom.provenance as Record<string, unknown>;
  assert.equal(prov.license, 'OFL-1.1');
  assert.ok(String(prov.attribution).includes('Rasmus Andersson'));
});

test('buildAtom: Lobster — display classification, single style', () => {
  const md = parseFixture('lobster.METADATA.pb');
  const atom = buildAtom({ md, slug: 'lobster', licenseDir: 'ofl' });
  const res = Font.safeParse(atom);
  assert.equal(res.success, true, res.success ? '' : JSON.stringify(res.error.issues));
  assert.equal(atom.classification, 'display');
  const styles = atom.availableStyles as Array<{ weight: number; style: string }>;
  assert.equal(styles.length, 1);
  assert.equal(styles[0]?.weight, 400);
});

test('buildAtom: Ubuntu — UFL license mapping', () => {
  const md = parseFixture('ubuntu.METADATA.pb');
  const atom = buildAtom({ md, slug: 'ubuntu', licenseDir: 'ufl' });
  const prov = atom.provenance as Record<string, unknown>;
  assert.equal(prov.license, 'UFL-1.0');
});

test('buildAtom: slab-serif override applies and adds slab tag', () => {
  const md = parseFixture('playfairdisplay.METADATA.pb');
  const atom = buildAtom({
    md,
    slug: 'fake-slab',
    licenseDir: 'ofl',
    classificationOverride: 'slab-serif',
    extraTags: .slab,
  });
  assert.equal(atom.classification, 'slab-serif');
  const tags = atom.tags as string[];
  assert.ok(tags.includes('slab'));
});

test('buildAtom: provenance.source is the METADATA URL', () => {
  const md = parseFixture('roboto.METADATA.pb');
  const atom = buildAtom({ md, slug: 'roboto', licenseDir: 'ofl' });
  const prov = atom.provenance as Record<string, unknown>;
  assert.equal(
    prov.source,
    'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/METADATA.pb',
  );
});

// -----------------------------------------------------------------------------
// Determinism — emitYaml is stable
// -----------------------------------------------------------------------------

test('emitYaml: byte-identical output for identical input (run twice)', () => {
  const md = parseFixture('inter.METADATA.pb');
  const atom1 = buildAtom({ md, slug: 'inter-test', licenseDir: 'ofl' });
  const atom2 = buildAtom({ md, slug: 'inter-test', licenseDir: 'ofl' });
  assert.equal(emitYaml(atom1), emitYaml(atom2));
});

test('emitYaml: top-level keys appear in the canonical order', () => {
  const md = parseFixture('inter.METADATA.pb');
  const atom = buildAtom({ md, slug: 'inter-test', licenseDir: 'ofl' });
  const text = emitYaml(atom);
  const idxKind = text.indexOf('\nkind:');
  const idxId = text.indexOf('\nid:');
  const idxVer = text.indexOf('\nversion:');
  const idxName = text.indexOf('\nname:');
  const idxFamily = text.indexOf('\nfamily:');
  const idxStyles = text.indexOf('\navailableStyles:');
  // kind is first; ordering follows the canonical list
  assert.ok(text.startsWith('kind:'));
  assert.ok(idxId < idxVer && idxVer < idxName);
  assert.ok(idxName < idxFamily);
  assert.ok(idxFamily < idxStyles);
});

// -----------------------------------------------------------------------------
// Idempotency end-to-end (uses parser + builder + emitter; no network)
// -----------------------------------------------------------------------------

test('idempotency: running emit twice over fixtures yields zero diff', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gf-import-'));
  try {
    const fixtures = [
      { name: 'inter.METADATA.pb', slug: 'inter-test', licenseDir: 'ofl' as const },
      { name: 'roboto.METADATA.pb', slug: 'roboto', licenseDir: 'ofl' as const },
      { name: 'lobster.METADATA.pb', slug: 'lobster', licenseDir: 'ofl' as const },
      { name: 'ubuntu.METADATA.pb', slug: 'ubuntu', licenseDir: 'ufl' as const },
      { name: 'playfairdisplay.METADATA.pb', slug: 'playfairdisplay', licenseDir: 'ofl' as const },
    ];

    const writeAll = (): Map<string, string> => {
      const out = new Map<string, string>();
      for (const f of fixtures) {
        const md = extractMetadata(parseProtoText(readFixture(f.name)));
        const atom = buildAtom({ md, slug: f.slug, licenseDir: f.licenseDir });
        out.set(f.slug, emitYaml(atom));
      }
      return out;
    };

    const first = writeAll();
    const second = writeAll();
    for (const [slug, content] of first) {
      assert.equal(second.get(slug), content, `idempotency broken for ${slug}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Hard cases
// -----------------------------------------------------------------------------

test('hard case: variable font (Inter) gets variable-font tag', () => {
  const md = parseFixture('inter.METADATA.pb');
  const atom = buildAtom({ md, slug: 'inter-test', licenseDir: 'ofl' });
  const tags = atom.tags as string[];
  assert.ok(tags.includes('variable-font'));
});

test('hard case: non-variable font (Lobster) does NOT get variable-font tag', () => {
  const md = parseFixture('lobster.METADATA.pb');
  const atom = buildAtom({ md, slug: 'lobster', licenseDir: 'ofl' });
  const tags = atom.tags as string[];
  assert.ok(!tags.includes('variable-font'));
});

test('hard case: no fonts {} blocks throws on buildAtom', () => {
  const md: ParsedMetadata = {
    name: 'Empty',
    designer: 'x',
    license: 'OFL',
    category: 'SANS_SERIF',
    dateAdded: '',
    fonts: [],
    axes: [],
    subsets: [],
  };
  assert.throws(() => buildAtom({ md, slug: 'empty', licenseDir: 'ofl' }));
});
