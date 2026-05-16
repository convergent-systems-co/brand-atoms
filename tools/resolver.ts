import {
  type AtomRecord,
  type BrandRecord,
  findAtom,
  indexAtoms,
  resolveVersion,
} from './loader.js';
import { parseAtomReference } from './schemas/index.js';
import type {
  Brand as BrandData,
  Constraint,
  Font as FontData,
  Palette as PaletteData,
  Provenance,
} from './schemas/index.js';

export type ResolvedFontReference = {
  role: string;
  slug: string;
  versionRef: string;
  resolvedVersion: string;
  data: FontData;
};

export type ResolvedBrand = {
  id: string;
  version: string;
  name: string;
  description?: string;
  provenance?: Provenance;
  tags: string[];

  palette: {
    slug: string;
    versionRef: string;
    resolvedVersion: string;
    data: PaletteData;
  };

  fonts: ResolvedFontReference[];

  roles: BrandData['roles'];
  assets: BrandData['assets'];
  rules: Constraint[];
};

export type ResolveError = {
  brand: string;
  path: string;
  message: string;
};

export type ResolveResult = {
  brand: ResolvedBrand | null;
  errors: ResolveError[];
};

export const resolveBrand = (brand: BrandRecord, atoms: AtomRecord[]): ResolveResult => {
  const errors: ResolveError[] = [];
  const brandKey = `${brand.slug}@${brand.version}`;
  const index = indexAtoms(atoms);

  const palRef = parseAtomReference(brand.data.references.palette);
  if (!palRef) {
    errors.push({
      brand: brandKey,
      path: 'references.palette',
      message: 'malformed atom reference',
    });
    return { brand: null, errors };
  }

  const palVersions = index.get('palette')?.get(palRef.slug);
  if (!palVersions || palVersions.length === 0) {
    errors.push({
      brand: brandKey,
      path: 'references.palette',
      message: `palette "${palRef.slug}" not found`,
    });
    return { brand: null, errors };
  }
  const palResolved = resolveVersion(palVersions, palRef.version);
  if (!palResolved) {
    errors.push({
      brand: brandKey,
      path: 'references.palette',
      message: `palette "${palRef.slug}" has no version matching "${palRef.version}"`,
    });
    return { brand: null, errors };
  }
  const palAtom = findAtom(atoms, 'palette', palRef.slug, palResolved);
  if (!palAtom) {
    errors.push({
      brand: brandKey,
      path: 'references.palette',
      message: `palette "${palRef.slug}@${palResolved}" disappeared during resolution`,
    });
    return { brand: null, errors };
  }

  const resolvedFonts: ResolvedFontReference[] = [];
  for (const [role, fontRef] of Object.entries(brand.data.references.fonts)) {
    const parsed = parseAtomReference(fontRef);
    if (!parsed) {
      errors.push({
        brand: brandKey,
        path: `references.fonts.${role}`,
        message: 'malformed atom reference',
      });
      continue;
    }
    const versions = index.get('font')?.get(parsed.slug);
    if (!versions || versions.length === 0) {
      errors.push({
        brand: brandKey,
        path: `references.fonts.${role}`,
        message: `font "${parsed.slug}" not found`,
      });
      continue;
    }
    const resolved = resolveVersion(versions, parsed.version);
    if (!resolved) {
      errors.push({
        brand: brandKey,
        path: `references.fonts.${role}`,
        message: `font "${parsed.slug}" has no version matching "${parsed.version}"`,
      });
      continue;
    }
    const fontAtom = findAtom(atoms, 'font', parsed.slug, resolved);
    if (!fontAtom) continue;
    resolvedFonts.push({
      role,
      slug: parsed.slug,
      versionRef: parsed.version,
      resolvedVersion: resolved,
      data: fontAtom.data,
    });
  }

  if (errors.length > 0) {
    return { brand: null, errors };
  }

  const resolved: ResolvedBrand = {
    id: brand.data.id,
    version: brand.data.version,
    name: brand.data.name,
    ...(brand.data.description !== undefined && { description: brand.data.description }),
    ...(brand.data.provenance !== undefined && { provenance: brand.data.provenance }),
    tags: brand.data.tags,
    palette: {
      slug: palRef.slug,
      versionRef: palRef.version,
      resolvedVersion: palResolved,
      data: palAtom.data,
    },
    fonts: resolvedFonts,
    roles: brand.data.roles,
    assets: brand.data.assets,
    rules: brand.data.rules,
  };

  return { brand: resolved, errors: [] };
};
