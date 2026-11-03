import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { Palette, Brand } from '../../../tools/schemas/index.js';
import { emitters } from '../../../tools/emitters/index.js';
import { composeBrand, slugifyBrandName, toBrandDefinitionYaml } from '../lib/composeBrand.js';
import {
  DEFAULT_CUSTOM_COLORS,
  buildCustomPalette,
  contrastRatio,
  isHexColor,
  toPaletteDefinitionYaml,
} from '../lib/customPalette.js';
import { fixtureBrand } from './fixtures/brand.js';

const palette = buildCustomPalette({
  id: 'my-brand-palette',
  name: 'My Brand palette',
  colors: DEFAULT_CUSTOM_COLORS,
});

const fontAtoms = fixtureBrand.fonts.map((f) => ({
  slug: f.slug,
  version: f.resolvedVersion,
  data: f.data,
}));

const atoms = {
  palettes: [{ slug: palette.id, version: palette.version, data: palette }],
  fonts: fontAtoms,
};

describe('isHexColor', () => {
  it('accepts 6-digit hex only', () => {
    expect(isHexColor('#3b5bdb')).toBe(true);
    expect(isHexColor('#3B5BDB')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('3b5bdb')).toBe(false);
    expect(isHexColor('#3b5bdg')).toBe(false);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#111111', '#f2f4f7')).toBeCloseTo(contrastRatio('#f2f4f7', '#111111'), 10);
  });

  it('rejects malformed colors', () => {
    expect(() => contrastRatio('#fff', '#000000')).toThrow(TypeError);
  });
});

describe('buildCustomPalette', () => {
  it('produces a palette that satisfies the Palette schema', () => {
    const result = Palette.safeParse(palette);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.format())).toBe(true);
  });

  it('maps the six picked colors onto swatches', () => {
    const values = Object.fromEntries(palette.swatches.map((s) => [s.id, s.value]));
    expect(values).toEqual({
      'canvas-light': DEFAULT_CUSTOM_COLORS.canvasLight,
      'ink-light': DEFAULT_CUSTOM_COLORS.inkLight,
      'canvas-dark': DEFAULT_CUSTOM_COLORS.canvasDark,
      'ink-dark': DEFAULT_CUSTOM_COLORS.inkDark,
      primary: DEFAULT_CUSTOM_COLORS.primary,
      accent: DEFAULT_CUSTOM_COLORS.accent,
    });
  });

  it('only references swatches that exist, in both modes', () => {
    const swatchIds = new Set(palette.swatches.map((s) => s.id));
    for (const mode of [palette.modes.light, palette.modes.dark]) {
      for (const swatch of Object.values(mode.roles)) {
        expect(swatchIds.has(swatch)).toBe(true);
      }
    }
    expect(palette.modes.light.roles.background).toBe('canvas-light');
    expect(palette.modes.dark.roles.background).toBe('canvas-dark');
    expect(palette.modes.dark.roles.foreground).toBe('ink-dark');
  });

  it('lowercases user-entered hex values', () => {
    const upper = buildCustomPalette({
      id: 'upper-palette',
      name: 'Upper',
      colors: { ...DEFAULT_CUSTOM_COLORS, primary: '#3B5BDB' },
    });
    expect(upper.swatches.find((s) => s.id === 'primary')!.value).toBe('#3b5bdb');
  });
});

describe('toPaletteDefinitionYaml', () => {
  it('round-trips through the Palette schema', () => {
    const yaml = toPaletteDefinitionYaml(palette);
    const result = Palette.safeParse(parseYaml(yaml));
    expect(result.success, result.success ? '' : JSON.stringify(result.error.format())).toBe(true);
    expect(parseYaml(yaml).id).toBe('my-brand-palette');
  });
});

describe('composing a brand with a custom palette', () => {
  const composed = composeBrand({
    id: 'my-brand',
    version: '0.1.0',
    name: 'My Brand',
    paletteSlug: palette.id,
    headingSlug: atoms.fonts[0]!.slug,
    bodySlug: atoms.fonts[1]!.slug,
    monoSlug: atoms.fonts[2]!.slug,
    atoms,
  });

  it('resolves the generated palette into the composed brand', () => {
    expect(composed).not.toBeNull();
    expect(composed!.palette.slug).toBe(palette.id);
    expect(composed!.palette.data.swatches).toHaveLength(6);
  });

  it('runs every emitter against the composed brand', () => {
    for (const emitter of emitters) {
      const files = emitter.emit(composed!);
      expect(files.length, `emitter ${emitter.name}`).toBeGreaterThan(0);
    }
  });

  it('emits a brand YAML that validates and references the palette slug', () => {
    const yaml = toBrandDefinitionYaml({
      id: 'my-brand',
      version: '0.1.0',
      name: 'My Brand',
      paletteSlug: palette.id,
      paletteVersion: palette.version,
      headingSlug: atoms.fonts[0]!.slug,
      headingVersion: atoms.fonts[0]!.version,
      bodySlug: atoms.fonts[1]!.slug,
      bodyVersion: atoms.fonts[1]!.version,
      monoSlug: atoms.fonts[2]!.slug,
      monoVersion: atoms.fonts[2]!.version,
    });
    const parsed = parseYaml(yaml);
    expect(parsed.references.palette).toBe(`${palette.id}@${palette.version}`);
    expect(Brand.safeParse(parsed).success).toBe(true);
  });
});

describe('slugifyBrandName', () => {
  it('produces letter-leading slugs that satisfy the atom schema', () => {
    for (const name of ['2026 Brand', '3M', 'My Brand', '  !!  ', 'Ünïcode']) {
      const slug = slugifyBrandName(name);
      expect(/^[a-z][a-z0-9-]*$/.test(slug), `${name} -> ${slug}`).toBe(true);
      const built = buildCustomPalette({
        id: `${slug}-palette`,
        name: `${name} palette`,
        colors: DEFAULT_CUSTOM_COLORS,
      });
      expect(Palette.safeParse(built).success, name).toBe(true);
    }
  });

  it('keeps ordinary names unchanged and falls back for empty input', () => {
    expect(slugifyBrandName('My Brand')).toBe('my-brand');
    expect(slugifyBrandName('2026 Brand')).toBe('brand-2026-brand');
    expect(slugifyBrandName('!!!')).toBe('composed-brand');
  });
});
