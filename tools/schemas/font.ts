import { z } from 'zod';
import { AtomBase } from './atom.js';
import { Url } from './common.js';

export const FontWeight = z.number().int().min(100).max(900);
export type FontWeight = z.infer<typeof FontWeight>;

export const FontStyle = z.object({
  weight: FontWeight,
  style: z.enum(['normal', 'italic']).default('normal'),
});
export type FontStyle = z.infer<typeof FontStyle>;

export const FontFileFormat = z.enum(['woff2', 'woff', 'ttf', 'otf']);

export const FontFile = z.object({
  weight: FontWeight,
  style: z.enum(['normal', 'italic']).default('normal'),
  formats: z
    .array(
      z.object({
        format: FontFileFormat,
        path: z.string().describe('Path relative to the atom directory'),
      }),
    )
    .min(1),
});

export const FontSource = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('google-fonts'),
    family: z.string(),
    url: Url.optional(),
  }),
  z.object({
    kind: z.literal('adobe-fonts'),
    family: z.string(),
    kitId: z.string(),
  }),
  z.object({
    kind: z.literal('self-hosted'),
    family: z.string(),
    files: z.array(FontFile).min(1),
  }),
  z.object({
    kind: z.literal('system'),
    stack: z
      .array(z.string())
      .min(1)
      .describe('Ordered list of system font family names (e.g., ["-apple-system", "Segoe UI"])'),
  }),
  z.object({
    kind: z.literal('external'),
    family: z.string(),
    cssImportUrl: Url.optional(),
    notes: z.string().optional(),
  }),
]);
export type FontSource = z.infer<typeof FontSource>;

export const FontClassification = z.enum([
  'serif',
  'sans-serif',
  'monospace',
  'display',
  'handwriting',
  'slab-serif',
]);

// OpenType variable-font axis. Four-letter axis tag (`wght`, `opsz`,
// `slnt`, `wdth`, `ital`, etc.) plus the min/max/default the font ships.
// Optional on every font — purely additive metadata for consumers that
// can target axis values (Figma variable-font import, CSS
// font-variation-settings).
export const FontVariableAxis = z.object({
  tag: z
    .string()
    .regex(/^[A-Za-z]{4}$/, 'OpenType axis tags are exactly four letters (e.g. "wght", "opsz")'),
  name: z.string().describe('Human-readable axis name, e.g. "Weight" or "Optical Size"'),
  min: z.number(),
  max: z.number(),
  default: z.number().optional(),
});
export type FontVariableAxis = z.infer<typeof FontVariableAxis>;

export const Font = AtomBase.extend({
  kind: z.literal('font'),
  family: z.string().describe('Canonical font family name used in CSS font-family'),
  source: FontSource,
  fallbackStack: z
    .array(z.string())
    .default([])
    .describe('Fallback font families to use if the primary fails to load'),
  availableStyles: z.array(FontStyle).default([]),
  variableAxes: z
    .array(FontVariableAxis)
    .optional()
    .describe(
      'Variable-font axis ranges. Present when the upstream ships a variable font. Additive — atoms without this field are treated as static. Consumers that need axis ranges (Figma, font-variation-settings) read this; consumers that only need discrete weights read availableStyles.',
    ),
  classification: FontClassification.optional(),
  cdnUrls: z
    .record(z.string(), Url)
    .optional()
    .describe(
      'Filename → public CDN URL for mirrored binaries. Populated by tools/r2-mirror.ts. Additive and optional — old YAML without this field remains valid.',
    ),
});
export type Font = z.infer<typeof Font>;
