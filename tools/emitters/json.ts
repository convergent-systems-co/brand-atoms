import type { Emitter } from './types.js';

export const jsonEmitter: Emitter = {
  name: 'json',
  description: 'Plain JSON mirror of the resolved brand (palette + fonts + roles + rules)',

  emit(brand) {
    const out = {
      id: brand.id,
      version: brand.version,
      name: brand.name,
      description: brand.description,
      provenance: brand.provenance,
      tags: brand.tags,
      palette: {
        ref: `${brand.palette.slug}@${brand.palette.resolvedVersion}`,
        swatches: brand.palette.data.swatches,
        modes: brand.palette.data.modes,
      },
      fonts: brand.fonts.map((f) => ({
        role: f.role,
        ref: `${f.slug}@${f.resolvedVersion}`,
        family: f.data.family,
        classification: f.data.classification,
        source: f.data.source,
        fallbackStack: f.data.fallbackStack,
        availableStyles: f.data.availableStyles,
      })),
      roles: brand.roles,
      assets: brand.assets,
      rules: brand.rules,
      _ai: {
        docs: 'https://brand-atoms.com/ai/index.json',
        catalog: 'https://brand-atoms.com/dist/index.json',
      },
    };
    return [
      {
        path: 'json/brand.json',
        contents: `${JSON.stringify(out, null, 2)}\n`,
      },
    ];
  },
};
