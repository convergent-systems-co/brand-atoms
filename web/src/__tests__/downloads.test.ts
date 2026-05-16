import { describe, expect, it } from 'vitest';
import { emitters } from '../../../tools/emitters/index.js';
import { downloadFormats, downloadHref } from '../lib/downloads.js';
import { fixtureBrand } from './fixtures/brand.js';

// The 11 files the root converter writes per brand. The Downloads section
// must surface every one of them as a working download link.
const expectedFiles = [
  'w3c/tokens.json',
  'w3c/tokens.light.json',
  'w3c/tokens.dark.json',
  'json/brand.json',
  'css/tokens.css',
  'scss/_tokens.scss',
  'tailwind/tailwind.config.cjs',
  'figma/tokens.json',
  'swift/BrandTokens.swift',
  'kotlin/BrandTokens.kt',
  'markdown/brand-guide.md',
];

const expectedFormatNames = [
  'W3C Design Tokens',
  'JSON',
  'CSS variables',
  'SCSS',
  'Tailwind config',
  'Figma Tokens',
  'Swift',
  'Kotlin / Compose',
  'Markdown guide',
];

describe('downloadFormats', () => {
  it('declares exactly the 9 emitter format groups', () => {
    expect(downloadFormats).toHaveLength(9);
    const names = downloadFormats.map((f) => f.name);
    expect(names).toEqual(expectedFormatNames);
  });

  it('declares exactly the 11 emitter file paths the converter writes', () => {
    const files = downloadFormats.flatMap((f) => f.files);
    expect(files.sort()).toEqual([...expectedFiles].sort());
  });

  it('each format has at least one file', () => {
    for (const f of downloadFormats) {
      expect(f.files.length, `format ${f.name} has no files`).toBeGreaterThan(0);
    }
  });
});

describe('downloadFormats vs. real emitter output (integration)', () => {
  it('matches the files actually written by every emitter against a fixture brand', () => {
    // Run every emitter against the fixture brand and collect the exact
    // paths they write. The Downloads section's declared file list must
    // be a 1:1 match — no theatrical hardcoding.
    const emittedPaths = emitters
      .flatMap((emitter) => emitter.emit(fixtureBrand).map((f) => f.path))
      .sort();
    const declaredPaths = downloadFormats.flatMap((f) => f.files).sort();
    expect(declaredPaths).toEqual(emittedPaths);
  });
});

describe('downloadHref', () => {
  it('produces a /dist/brands/{id}/{version}/{file} URL for the given brand', () => {
    const href = downloadHref(fixtureBrand, 'css/tokens.css');
    expect(href).toBe('/dist/brands/test-brand/1.0.0/css/tokens.css');
  });

  it('resolves each expected file to a valid /dist/ URL', () => {
    for (const file of expectedFiles) {
      const href = downloadHref(fixtureBrand, file);
      expect(href).toBe(`/dist/brands/${fixtureBrand.id}/${fixtureBrand.version}/${file}`);
    }
  });
});
