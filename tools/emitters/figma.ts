import type { ResolvedBrand } from '../resolver.js';
import type { Emitter } from './types.js';

type FigmaTokenValue = {
  value: string | string[] | number;
  type: string;
  description?: string;
};

type FigmaSet = Record<string, FigmaTokenValue | Record<string, FigmaTokenValue>>;

export const figmaTokensEmitter: Emitter = {
  name: 'figma',
  description: 'Figma Tokens / Tokens Studio JSON (global + light + dark sets)',

  emit(brand) {
    const globalColor: Record<string, FigmaTokenValue> = {};
    for (const s of brand.palette.data.swatches) {
      const entry: FigmaTokenValue = {
        value: s.value,
        type: 'color',
      };
      if (s.description) entry.description = s.description;
      globalColor[s.id] = entry;
    }

    const fontFamily: Record<string, FigmaTokenValue> = {};
    const fontStack: Record<string, FigmaTokenValue> = {};
    for (const font of brand.fonts) {
      fontFamily[font.role] = {
        value: font.data.family,
        type: 'fontFamilies',
        description: `${font.slug}@${font.resolvedVersion} · ${font.data.classification ?? 'font'}`,
      };
      fontStack[font.role] = {
        value: [font.data.family, ...font.data.fallbackStack],
        type: 'fontFamilies',
      };
    }

    const lightRoles: Record<string, FigmaTokenValue> = {};
    for (const [role, swatchId] of Object.entries(brand.palette.data.modes.light.roles)) {
      lightRoles[role] = {
        value: `{global.color.${swatchId}}`,
        type: 'color',
      };
    }

    const darkRoles: Record<string, FigmaTokenValue> = {};
    for (const [role, swatchId] of Object.entries(brand.palette.data.modes.dark.roles)) {
      darkRoles[role] = {
        value: `{global.color.${swatchId}}`,
        type: 'color',
      };
    }

    const brandSet: FigmaSet = {};
    if (brand.roles?.colors) {
      const colors: Record<string, FigmaTokenValue> = {};
      for (const [role, swatchId] of Object.entries(brand.roles.colors)) {
        colors[role] = {
          value: `{global.color.${swatchId}}`,
          type: 'color',
        };
      }
      brandSet.color = colors;
    }

    const doc = {
      $themes: [
        {
          id: 'light',
          name: 'Light',
          selectedTokenSets: { global: 'enabled', 'role-light': 'enabled', brand: 'enabled' },
        },
        {
          id: 'dark',
          name: 'Dark',
          selectedTokenSets: { global: 'enabled', 'role-dark': 'enabled', brand: 'enabled' },
        },
      ],
      global: {
        color: globalColor,
        fontFamily,
        fontStack,
      },
      'role-light': {
        color: lightRoles,
      },
      'role-dark': {
        color: darkRoles,
      },
      brand: brandSet,
      $metadata: {
        name: brand.name,
        ref: `${brand.id}@${brand.version}`,
        paletteRef: `${brand.palette.slug}@${brand.palette.resolvedVersion}`,
        generatedBy: 'brand-atoms converter',
      },
    };

    return [{ path: 'figma/tokens.json', contents: `${JSON.stringify(doc, null, 2)}\n` }];
  },
};
