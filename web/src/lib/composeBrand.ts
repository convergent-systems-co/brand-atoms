import { stringify as yamlStringify } from 'yaml';
import type { Font as FontData, Palette as PaletteData } from '../../../tools/schemas/index.js';
import type { ResolvedBrand } from './encyclopedia.js';

/**
 * Atom catalog as serialized into the page payload (#brand-atoms-data).
 * Plain JSON-safe shapes — no class instances, no functions — so the
 * Astro build can JSON.stringify them and the client can JSON.parse.
 */
export type PaletteAtomPayload = {
  slug: string;
  version: string;
  data: PaletteData;
};

export type FontAtomPayload = {
  slug: string;
  version: string;
  data: FontData;
};

export type AtomCatalog = {
  palettes: PaletteAtomPayload[];
  fonts: FontAtomPayload[];
};

export type BuilderSelection = {
  id: string;
  version: string;
  name: string;
  paletteSlug: string;
  headingSlug: string;
  bodySlug: string;
  monoSlug: string;
  atoms: AtomCatalog;
};

export type BrandDefinitionRefs = {
  id: string;
  version: string;
  name: string;
  description?: string;
  paletteSlug: string;
  paletteVersion: string;
  headingSlug: string;
  headingVersion: string;
  bodySlug: string;
  bodyVersion: string;
  monoSlug: string;
  monoVersion: string;
};

/**
 * Compose a ResolvedBrand from atom payload + user selections. Returns
 * null if any selection points at a slug not present in the catalog.
 *
 * The shape matches `tools/resolver.ts:resolveBrand` so every emitter
 * runs against it unchanged.
 */
export const composeBrand = (sel: BuilderSelection): ResolvedBrand | null => {
  const palette = sel.atoms.palettes.find((p) => p.slug === sel.paletteSlug);
  if (!palette) return null;

  const heading = sel.atoms.fonts.find((f) => f.slug === sel.headingSlug);
  const body = sel.atoms.fonts.find((f) => f.slug === sel.bodySlug);
  const mono = sel.atoms.fonts.find((f) => f.slug === sel.monoSlug);
  if (!heading || !body || !mono) return null;

  return {
    id: sel.id,
    version: sel.version,
    name: sel.name,
    tags: [],
    palette: {
      slug: palette.slug,
      versionRef: palette.version,
      resolvedVersion: palette.version,
      data: palette.data,
    },
    fonts: [
      {
        role: 'heading',
        slug: heading.slug,
        versionRef: heading.version,
        resolvedVersion: heading.version,
        data: heading.data,
      },
      {
        role: 'body',
        slug: body.slug,
        versionRef: body.version,
        resolvedVersion: body.version,
        data: body.data,
      },
      {
        role: 'mono',
        slug: mono.slug,
        versionRef: mono.version,
        resolvedVersion: mono.version,
        data: mono.data,
      },
    ],
    roles: undefined,
    assets: [],
    rules: [],
  };
};

/**
 * Emit a Brand-schema YAML definition (the format that lives in
 * brands/<slug>/<version>/brand.yaml) for the user's selections. This is
 * the file a user can save and feed back into the encyclopedia.
 */
export const toBrandDefinitionYaml = (refs: BrandDefinitionRefs): string => {
  const def = {
    id: refs.id,
    version: refs.version,
    name: refs.name,
    ...(refs.description ? { description: refs.description } : {}),
    tags: ['composed-in-builder'],
    references: {
      palette: `${refs.paletteSlug}@${refs.paletteVersion}`,
      fonts: {
        heading: `${refs.headingSlug}@${refs.headingVersion}`,
        body: `${refs.bodySlug}@${refs.bodyVersion}`,
        mono: `${refs.monoSlug}@${refs.monoVersion}`,
      },
    },
    assets: [],
    rules: [],
  };
  return yamlStringify(def, { lineWidth: 0 });
};
