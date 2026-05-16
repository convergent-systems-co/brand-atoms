import type { ResolvedBrand } from './encyclopedia.js';

/**
 * The 9 emitter format groups produced by the root converter
 * (tools/build.ts → tools/emitters/*). Each group corresponds to one
 * emitter; multi-file emitters (e.g. W3C tokens) list all their files.
 *
 * This list IS the source of truth for the on-site Downloads section.
 * If the emitters change shape, this list must be updated in lockstep
 * or the corresponding test in downloads.test.ts will fail.
 */
export type DownloadFormat = {
  name: string;
  description: string;
  files: string[];
};

export const downloadFormats: ReadonlyArray<DownloadFormat> = [
  {
    name: 'W3C Design Tokens',
    description: 'Cross-tool design-token spec (DTCG/W3C). Light + dark mode siblings.',
    files: ['w3c/tokens.json', 'w3c/tokens.light.json', 'w3c/tokens.dark.json'],
  },
  {
    name: 'JSON',
    description: 'Plain JSON mirror of the resolved brand — palette, fonts, roles, rules.',
    files: ['json/brand.json'],
  },
  {
    name: 'CSS variables',
    description: 'CSS custom properties on :root with prefers-color-scheme dark.',
    files: ['css/tokens.css'],
  },
  {
    name: 'SCSS',
    description: 'SCSS variables + Sass maps for swatches, roles, and fonts.',
    files: ['scss/_tokens.scss'],
  },
  {
    name: 'Tailwind config',
    description: 'Tailwind v3 theme.extend.colors + fontFamily.',
    files: ['tailwind/tailwind.config.cjs'],
  },
  {
    name: 'Figma Tokens',
    description: 'Figma Tokens plugin JSON (Tokens Studio compatible).',
    files: ['figma/tokens.json'],
  },
  {
    name: 'Swift',
    description: 'Swift enums for SwiftUI / UIKit color + font tokens.',
    files: ['swift/BrandTokens.swift'],
  },
  {
    name: 'Kotlin / Compose',
    description: 'Kotlin objects for Jetpack Compose color + typography tokens.',
    files: ['kotlin/BrandTokens.kt'],
  },
  {
    name: 'Markdown guide',
    description: 'Human-readable brand guide. Same source as the on-page Brand Guide.',
    files: ['markdown/brand-guide.md'],
  },
];

/** Build the relative URL for a brand artifact served from /public/dist/. */
export const downloadHref = (brand: { id: string; version: string }, file: string): string =>
  `/dist/brands/${brand.id}/${brand.version}/${file}`;

/** Pretty-print the file's leaf name (used as anchor text). */
export const downloadLabel = (file: string): string => {
  const idx = file.lastIndexOf('/');
  return idx === -1 ? file : file.slice(idx + 1);
};

/** Convenience: flat list of (format, file, href, label) for templates. */
export const flatDownloads = (brand: ResolvedBrand) =>
  downloadFormats.flatMap((format) =>
    format.files.map((file) => ({
      format: format.name,
      file,
      href: downloadHref(brand, file),
      label: downloadLabel(file),
    })),
  );
