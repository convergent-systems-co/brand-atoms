import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';

/**
 * Validation tests for the brands/shell/ extension atom subtype.
 *
 * Issues: #35 (schema), #36 (migrate nord/dracula/gruvbox), #37 (7 new brands)
 *
 * Assertions per shell brand YAML:
 *   1. File is parseable YAML (no syntax errors).
 *   2. Required fields are present: id, name, version, base_brand,
 *      prompt_symbol, separator_char, ansi_256_support, truecolor_support.
 *   3. id matches slug pattern: ^[a-z0-9-]+$
 *   4. version matches semver pattern: ^[0-9]+\.[0-9]+\.[0-9]+$
 *   5. ansi_256_support and truecolor_support are booleans.
 *   6. role_bindings hex values match #RRGGBB pattern when present.
 *   7. tags is an array of strings when present.
 *
 * Additionally:
 *   8. schemas/shell-brand-v1.json exists and is valid JSON.
 *   9. docs/shell-brand-spec.md exists.
 *  10. The 10 expected shell brands are all present.
 */

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const SHELL_DIR = join(REPO_ROOT, 'brands', 'shell');
const SCHEMA_FILE = join(REPO_ROOT, 'schemas', 'shell-brand-v1.json');
const SPEC_DOC = join(REPO_ROOT, 'docs', 'shell-brand-spec.md');

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const SLUG_REGEX = /^[a-z0-9-]+$/;
const SEMVER_REGEX = /^[0-9]+\.[0-9]+\.[0-9]+$/;

const REQUIRED_FIELDS = [
  'id',
  'name',
  'version',
  'base_brand',
  'prompt_symbol',
  'separator_char',
  'ansi_256_support',
  'truecolor_support',
] as const;

const EXPECTED_BRANDS = [
  // #36 — migrated
  'nord',
  'dracula',
  'gruvbox',
  // #37 — new curated
  'catppuccin-mocha',
  'catppuccin-latte',
  'solarized-dark',
  'solarized-light',
  'tokyo-night',
  'one-dark',
  'monokai',
];

// ── Schema artifact tests ────────────────────────────────────────────────────

test('schemas/shell-brand-v1.json exists', () => {
  assert.ok(existsSync(SCHEMA_FILE), `Expected ${SCHEMA_FILE} to exist`);
});

test('schemas/shell-brand-v1.json is valid JSON', () => {
  assert.ok(existsSync(SCHEMA_FILE), `Schema file missing: ${SCHEMA_FILE}`);
  const raw = readFileSync(SCHEMA_FILE, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    assert.fail(`schemas/shell-brand-v1.json is not valid JSON: ${e}`);
  }
  assert.ok(typeof parsed === 'object' && parsed !== null, 'Schema must be a JSON object');
  const schema = parsed as Record<string, unknown>;
  assert.ok('$schema' in schema, 'Schema must have $schema field');
  assert.ok('$id' in schema, 'Schema must have $id field');
  assert.ok('required' in schema, 'Schema must have required field');
});

test('docs/shell-brand-spec.md exists', () => {
  assert.ok(existsSync(SPEC_DOC), `Expected ${SPEC_DOC} to exist`);
});

// ── brands/shell/ directory tests ────────────────────────────────────────────

test('brands/shell/ directory exists', () => {
  assert.ok(existsSync(SHELL_DIR), `Expected brands/shell/ directory to exist at ${SHELL_DIR}`);
});

test('all 10 expected shell brands are present', () => {
  assert.ok(existsSync(SHELL_DIR), 'brands/shell/ directory does not exist');
  const files = readdirSync(SHELL_DIR).filter((f) => f.endsWith('.yaml'));
  const slugs = files.map((f) => f.replace(/\.yaml$/, ''));
  for (const expected of EXPECTED_BRANDS) {
    assert.ok(
      slugs.includes(expected),
      `Missing expected shell brand: ${expected}.yaml in brands/shell/`,
    );
  }
});

// ── Per-file validation ───────────────────────────────────────────────────────

const getShellBrandFiles = (): string[] => {
  if (!existsSync(SHELL_DIR)) return [];
  return readdirSync(SHELL_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => join(SHELL_DIR, f));
};

const shellBrandFiles = getShellBrandFiles();

for (const filePath of shellBrandFiles) {
  const fileName = filePath.replace(`${REPO_ROOT}/`, '');

  test(`${fileName} — is valid YAML`, () => {
    const raw = readFileSync(filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = parseYaml(raw);
    } catch (e) {
      assert.fail(`YAML parse error in ${fileName}: ${e}`);
    }
    assert.ok(typeof parsed === 'object' && parsed !== null, `${fileName} must parse to an object`);
  });

  test(`${fileName} — has all required fields`, () => {
    const raw = readFileSync(filePath, 'utf8');
    const data = parseYaml(raw) as Record<string, unknown>;
    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        field in data && data[field] !== undefined && data[field] !== null,
        `${fileName} is missing required field: ${field}`,
      );
    }
  });

  test(`${fileName} — id matches slug pattern`, () => {
    const raw = readFileSync(filePath, 'utf8');
    const data = parseYaml(raw) as Record<string, unknown>;
    const id = data.id as string;
    assert.match(id, SLUG_REGEX, `${fileName}: id "${id}" does not match slug pattern ^[a-z0-9-]+$`);
  });

  test(`${fileName} — version is semver`, () => {
    const raw = readFileSync(filePath, 'utf8');
    const data = parseYaml(raw) as Record<string, unknown>;
    const version = data.version as string;
    assert.match(
      version,
      SEMVER_REGEX,
      `${fileName}: version "${version}" does not match semver pattern`,
    );
  });

  test(`${fileName} — ansi_256_support and truecolor_support are booleans`, () => {
    const raw = readFileSync(filePath, 'utf8');
    const data = parseYaml(raw) as Record<string, unknown>;
    assert.strictEqual(
      typeof data.ansi_256_support,
      'boolean',
      `${fileName}: ansi_256_support must be a boolean`,
    );
    assert.strictEqual(
      typeof data.truecolor_support,
      'boolean',
      `${fileName}: truecolor_support must be a boolean`,
    );
  });

  test(`${fileName} — role_bindings hex values are #RRGGBB when present`, () => {
    const raw = readFileSync(filePath, 'utf8');
    const data = parseYaml(raw) as Record<string, unknown>;
    if (!data.role_bindings || typeof data.role_bindings !== 'object') return;
    const bindings = data.role_bindings as Record<string, unknown>;
    for (const [role, value] of Object.entries(bindings)) {
      if (value === null || value === undefined) continue;
      assert.match(
        String(value),
        HEX_REGEX,
        `${fileName}: role_bindings.${role} value "${value}" is not a valid #RRGGBB hex color`,
      );
    }
  });

  test(`${fileName} — tags is array of strings when present`, () => {
    const raw = readFileSync(filePath, 'utf8');
    const data = parseYaml(raw) as Record<string, unknown>;
    if (!('tags' in data)) return;
    assert.ok(Array.isArray(data.tags), `${fileName}: tags must be an array`);
    for (const tag of data.tags as unknown[]) {
      assert.strictEqual(typeof tag, 'string', `${fileName}: each tag must be a string`);
    }
  });
}
