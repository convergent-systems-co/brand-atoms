import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsonEmitter } from '../emitters/json.js';
import type { ResolvedBrand } from '../resolver.js';

const minimalBrand: ResolvedBrand = {
  id: 'test-brand',
  version: '1.0.0',
  name: 'Test Brand',
  tags: [],
  palette: {
    slug: 'test-palette',
    versionRef: '1.0.0',
    resolvedVersion: '1.0.0',
    data: {
      swatches: [],
      modes: { light: { roles: {} }, dark: { roles: {} } },
    },
  },
  fonts: [],
  roles: {},
  assets: [],
  rules: [],
};

test('jsonEmitter includes _ai metadata block', () => {
  const files = jsonEmitter.emit(minimalBrand);
  const brandFile = files.find((f) => f.path === 'json/brand.json');
  assert.ok(brandFile, 'brand.json output must exist');

  const parsed = JSON.parse(brandFile.contents) as Record<string, unknown>;
  assert.ok(parsed._ai, '_ai block must be present');

  const ai = parsed._ai as Record<string, unknown>;
  assert.equal(ai.docs, 'https://brand-atoms.com/ai/index.json');
  assert.equal(ai.catalog, 'https://brand-atoms.com/dist/index.json');
});
