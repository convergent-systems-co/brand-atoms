import { stringify as yamlStringify } from 'yaml';
import type { Palette as PaletteData } from '../../../tools/schemas/index.js';

/**
 * The six colors a user picks in the builder. Light and dark modes each get
 * their own canvas + text pair so the generated palette is usable in both
 * modes without the user having to design a full swatch scale.
 */
export type CustomColors = {
  canvasLight: string;
  inkLight: string;
  canvasDark: string;
  inkDark: string;
  primary: string;
  accent: string;
};

export type CustomColorKey = keyof CustomColors;

export const CUSTOM_COLOR_FIELDS: ReadonlyArray<{
  key: CustomColorKey;
  label: string;
  swatchId: string;
  hint: string;
}> = [
  { key: 'canvasLight', label: 'Light canvas', swatchId: 'canvas-light', hint: 'Page background in light mode' },
  { key: 'inkLight', label: 'Light text', swatchId: 'ink-light', hint: 'Body text on the light canvas' },
  { key: 'canvasDark', label: 'Dark canvas', swatchId: 'canvas-dark', hint: 'Page background in dark mode' },
  { key: 'inkDark', label: 'Dark text', swatchId: 'ink-dark', hint: 'Body text on the dark canvas' },
  { key: 'primary', label: 'Primary', swatchId: 'primary', hint: 'Buttons and key actions' },
  { key: 'accent', label: 'Accent', swatchId: 'accent', hint: 'Highlights and secondary emphasis' },
];

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  canvasLight: '#ffffff',
  inkLight: '#111111',
  canvasDark: '#111418',
  inkDark: '#f2f4f7',
  primary: '#3b5bdb',
  accent: '#f59f00',
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const isHexColor = (value: string): boolean => HEX_RE.test(value);

const linearChannel = (hex: string, offset: number): number => {
  const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (hex: string): number =>
  0.2126 * linearChannel(hex, 1) + 0.7152 * linearChannel(hex, 3) + 0.0722 * linearChannel(hex, 5);

/** WCAG 2.x contrast ratio between two #rrggbb colors (1 to 21). */
export const contrastRatio = (a: string, b: string): number => {
  if (!isHexColor(a) || !isHexColor(b)) {
    throw new TypeError(`contrastRatio expects #rrggbb colors, got "${a}" and "${b}"`);
  }
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Turn the six user colors into a palette atom that satisfies the Palette
 * schema (tools/schemas/palette.ts). The role mapping mirrors the names the
 * live Preview reads (background, surface, foreground, primary, accent, ...).
 */
export const buildCustomPalette = (opts: {
  id: string;
  name: string;
  colors: CustomColors;
}): PaletteData => {
  const { colors } = opts;
  const swatches = CUSTOM_COLOR_FIELDS.map((field) => ({
    id: field.swatchId,
    name: field.label,
    value: colors[field.key].toLowerCase(),
    description: field.hint,
    aliases: [] as string[],
  }));

  const lightRoles = {
    background: 'canvas-light',
    surface: 'canvas-light',
    'surface-elevated': 'canvas-light',
    foreground: 'ink-light',
    'on-background': 'ink-light',
    'on-surface': 'ink-light',
    primary: 'primary',
    'on-primary': 'canvas-light',
    accent: 'accent',
  };

  const darkRoles = {
    background: 'canvas-dark',
    surface: 'canvas-dark',
    'surface-elevated': 'canvas-dark',
    foreground: 'ink-dark',
    'on-background': 'ink-dark',
    'on-surface': 'ink-dark',
    primary: 'primary',
    'on-primary': 'canvas-dark',
    accent: 'accent',
  };

  return {
    kind: 'palette',
    id: opts.id,
    version: '0.1.0',
    name: opts.name,
    description: 'Colors created in the brand-atoms builder.',
    tags: ['composed-in-builder'],
    swatches,
    modes: {
      light: { roles: lightRoles },
      dark: { roles: darkRoles },
    },
  };
};

/** Palette atom YAML, the same shape as palettes/<slug>/<version>/*.yaml. */
export const toPaletteDefinitionYaml = (palette: PaletteData): string =>
  yamlStringify(palette, { lineWidth: 0 });
