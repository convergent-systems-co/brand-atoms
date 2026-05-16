import assert from 'node:assert/strict';
/**
 * Schema tests for the additive `cdnUrls` field on Font atoms.
 *
 * Goals:
 *  1. Old YAML (no `cdnUrls`) still validates → backward compatibility.
 *  2. YAML with a valid `cdnUrls` map validates → forward compatibility.
 *  3. YAML with a malformed URL in `cdnUrls` fails with a Zod issue on that key.
 */
import { test } from 'node:test';
import { Font } from '../schemas/font.js';

const baseAtom = {
  kind: 'font' as const,
  id: 'inter',
  version: '1.0.0',
  name: 'Inter',
  family: 'Inter',
  classification: 'sans-serif' as const,
  source: { kind: 'google-fonts' as const, family: 'Inter' },
  fallbackStack: ['sans-serif'],
  availableStyles: [{ weight: 400, style: 'normal' as const }],
};

test('Font schema accepts atom without cdnUrls (backward compat)', () => {
  const res = Font.safeParse(baseAtom);
  assert.equal(res.success, true, res.success ? '' : JSON.stringify(res.error.issues));
});

test('Font schema accepts atom with a valid cdnUrls map', () => {
  const atom = {
    ...baseAtom,
    cdnUrls: {
      'InterVariable.woff2': 'https://cdn.brand-atoms.com/fonts/inter/1.0.0/InterVariable.woff2',
      'InterVariable-Italic.woff2':
        'https://cdn.brand-atoms.com/fonts/inter/1.0.0/InterVariable-Italic.woff2',
    },
  };
  const res = Font.safeParse(atom);
  assert.equal(res.success, true, res.success ? '' : JSON.stringify(res.error.issues));
  if (res.success) {
    assert.equal(
      res.data.cdnUrls?.['InterVariable.woff2'],
      'https://cdn.brand-atoms.com/fonts/inter/1.0.0/InterVariable.woff2',
    );
  }
});

test('Font schema rejects atom with a malformed URL in cdnUrls', () => {
  const atom = {
    ...baseAtom,
    cdnUrls: {
      // Not a URL — relative path, no scheme.
      'InterVariable.woff2': 'not-a-url-just-a-string',
    },
  };
  const res = Font.safeParse(atom);
  assert.equal(res.success, false);
  if (!res.success) {
    const issue = res.error.issues.find((i) => i.path.join('.').startsWith('cdnUrls'));
    assert.ok(issue, 'expected a Zod issue on cdnUrls');
  }
});

test('Font schema rejects atom with non-record cdnUrls', () => {
  const atom = { ...baseAtom, cdnUrls: 'https://example.com/file.woff2' };
  const res = Font.safeParse(atom);
  assert.equal(res.success, false);
});
