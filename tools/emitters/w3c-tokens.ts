import type { ResolvedBrand } from '../resolver.js';
import type { Emitter } from './types.js';

type W3CColorToken = {
  $value: string;
  $type: 'color';
  $description?: string;
};

type W3CRefToken = {
  $value: string;
  $type: 'color';
  $description?: string;
};

type W3CFontFamilyToken = {
  $value: string[];
  $type: 'fontFamily';
  $description?: string;
};

type W3CFontWeightToken = {
  $value: number;
  $type: 'fontWeight';
  $description?: string;
};

type W3CGroup = {
  $description?: string;
  [key: string]: unknown;
};

const buildSwatchTokens = (brand: ResolvedBrand): W3CGroup => {
  const group: W3CGroup = {
    $description: `Source-of-truth color swatches from palette ${brand.palette.slug}@${brand.palette.resolvedVersion}`,
  };
  for (const swatch of brand.palette.data.swatches) {
    const token: W3CColorToken = {
      $value: swatch.value,
      $type: 'color',
      ...(swatch.description && { $description: swatch.description }),
    };
    group[swatch.id] = token;
  }
  return group;
};

const buildRoleTokens = (brand: ResolvedBrand, mode: 'light' | 'dark'): W3CGroup => {
  const group: W3CGroup = {
    $description: `Semantic color roles (${mode} mode) mapped to palette swatches`,
  };
  const modeData = brand.palette.data.modes[mode];

  for (const [role, swatchId] of Object.entries(modeData.roles)) {
    const swatch = brand.palette.data.swatches.find((s) => s.id === swatchId);
    if (!swatch) continue;
    const token: W3CRefToken = {
      $value: `{color.swatches.${swatchId}}`,
      $type: 'color',
      $description: `${role} role → ${swatch.name}`,
    };
    group[role] = token;
  }

  if (brand.roles?.colors) {
    const brandOverride: W3CGroup = {
      $description: 'Brand-level role overrides (take precedence over palette role mappings)',
    };
    for (const [role, swatchId] of Object.entries(brand.roles.colors)) {
      const swatch = brand.palette.data.swatches.find((s) => s.id === swatchId);
      if (!swatch) continue;
      brandOverride[role] = {
        $value: `{color.swatches.${swatchId}}`,
        $type: 'color',
        $description: `Brand role ${role} → ${swatch.name}`,
      } as W3CRefToken;
    }
    group['brand-overrides'] = brandOverride;
  }

  return group;
};

const buildFontTokens = (brand: ResolvedBrand): W3CGroup => {
  const group: W3CGroup = {
    $description: 'Typography roles mapped to font atoms',
  };
  for (const font of brand.fonts) {
    const familyToken: W3CFontFamilyToken = {
      $value: [font.data.family, ...font.data.fallbackStack],
      $type: 'fontFamily',
      $description: `${font.role} role → ${font.data.name} (${font.slug}@${font.resolvedVersion})`,
    };
    const familyGroup: W3CGroup = {
      family: familyToken,
    };
    if (font.data.availableStyles.length > 0) {
      const weights = [...new Set(font.data.availableStyles.map((s) => s.weight))].sort(
        (a, b) => a - b,
      );
      const weightGroup: W3CGroup = {
        $description: 'Available font weights',
      };
      for (const w of weights) {
        weightGroup[String(w)] = {
          $value: w,
          $type: 'fontWeight',
        } as W3CFontWeightToken;
      }
      familyGroup.weight = weightGroup;
    }
    group[font.role] = familyGroup;
  }
  return group;
};

const buildRulesExtension = (brand: ResolvedBrand): Record<string, unknown> => ({
  $extensions: {
    'com.brand-atoms.rules': brand.rules,
    'com.brand-atoms.assets': brand.assets,
    'com.brand-atoms.provenance': brand.provenance,
    'com.brand-atoms.references': {
      palette: `${brand.palette.slug}@${brand.palette.resolvedVersion}`,
      fonts: Object.fromEntries(brand.fonts.map((f) => [f.role, `${f.slug}@${f.resolvedVersion}`])),
    },
  },
});

export const w3cTokensEmitter: Emitter = {
  name: 'w3c',
  description: 'W3C Design Tokens (compatible with Style Dictionary, Figma Tokens)',

  emit(brand) {
    const swatches = buildSwatchTokens(brand);
    const fontGroup = buildFontTokens(brand);
    const rulesExt = buildRulesExtension(brand);

    const baseDoc = {
      $description: `Brand: ${brand.name} (${brand.id}@${brand.version})`,
      color: {
        swatches,
      },
      font: fontGroup,
      ...rulesExt,
    };

    const lightDoc = {
      $description: `Brand: ${brand.name} — light mode`,
      color: {
        swatches,
        roles: buildRoleTokens(brand, 'light'),
      },
      font: fontGroup,
    };

    const darkDoc = {
      $description: `Brand: ${brand.name} — dark mode`,
      color: {
        swatches,
        roles: buildRoleTokens(brand, 'dark'),
      },
      font: fontGroup,
    };

    return [
      { path: 'w3c/tokens.json', contents: `${JSON.stringify(baseDoc, null, 2)}\n` },
      { path: 'w3c/tokens.light.json', contents: `${JSON.stringify(lightDoc, null, 2)}\n` },
      { path: 'w3c/tokens.dark.json', contents: `${JSON.stringify(darkDoc, null, 2)}\n` },
    ];
  },
};
