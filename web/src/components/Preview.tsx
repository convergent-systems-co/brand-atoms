import type { ResolvedBrand } from '../lib/encyclopedia.js';

export type PreviewProps = {
  brand: ResolvedBrand;
  mode: 'light' | 'dark';
  onModeChange: (mode: 'light' | 'dark') => void;
};

const swatchValue = (brand: ResolvedBrand, swatchId: string | undefined): string => {
  if (!swatchId) return '#888888';
  const sw = brand.palette.data.swatches.find((s) => s.id === swatchId);
  return sw?.value ?? '#888888';
};

const fontStack = (brand: ResolvedBrand, role: 'heading' | 'body' | 'mono'): string => {
  const font = brand.fonts.find((f) => f.role === role);
  if (!font) return 'system-ui, sans-serif';
  return [font.data.family, ...font.data.fallbackStack]
    .map((f) => (f.includes(' ') ? `'${f}'` : f))
    .join(', ');
};

export function Preview({ brand, mode, onModeChange }: PreviewProps): JSX.Element {
  const roles = brand.palette.data.modes[mode].roles;

  const bg = swatchValue(brand, roles.background ?? roles.surface);
  const fg = swatchValue(
    brand,
    roles.foreground ?? roles['on-background'] ?? roles['on-surface'],
  );
  const primary = swatchValue(brand, roles.primary ?? roles.cta);
  const onPrimary = swatchValue(brand, roles['on-primary'] ?? (mode === 'light' ? roles.background : roles.foreground));
  const accent = swatchValue(brand, roles.accent ?? roles.secondary ?? roles.primary);
  const success = swatchValue(brand, roles.success ?? roles.accent ?? roles.primary);

  const headingFamily = fontStack(brand, 'heading');
  const bodyFamily = fontStack(brand, 'body');
  const monoFamily = fontStack(brand, 'mono');

  return (
    <section className="preview" data-component="preview">
      <header className="preview-head">
        <h2>Live preview</h2>
        <div className="mode-toggle" role="group" aria-label="Preview color mode">
          <button
            type="button"
            className={mode === 'light' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => onModeChange('light')}
            data-mode="light"
          >
            Light
          </button>
          <button
            type="button"
            className={mode === 'dark' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => onModeChange('dark')}
            data-mode="dark"
          >
            Dark
          </button>
        </div>
      </header>

      <div
        className="preview-card"
        style={{
          background: bg,
          color: fg,
        }}
      >
        <h3 className="preview-heading" style={{ fontFamily: headingFamily }}>
          {brand.name}
        </h3>
        <p className="preview-body" style={{ fontFamily: bodyFamily }}>
          A composed brand renders heading + body type in the chosen typefaces, with role-mapped
          colors driving primary, accent, and success surfaces.
        </p>

        <div className="preview-buttons">
          <button
            type="button"
            className="preview-btn"
            style={{ background: primary, color: onPrimary, fontFamily: bodyFamily }}
          >
            Primary action
          </button>
          <button
            type="button"
            className="preview-btn outline"
            style={{ borderColor: accent, color: accent, background: 'transparent', fontFamily: bodyFamily }}
          >
            Accent
          </button>
          <span
            className="preview-badge"
            style={{ background: success, color: onPrimary, fontFamily: bodyFamily }}
          >
            Success
          </span>
        </div>

        <pre
          className="preview-mono"
          style={{ fontFamily: monoFamily, color: fg, opacity: 0.85 }}
        >
{`{
  "id": "${brand.id}",
  "version": "${brand.version}",
  "palette": "${brand.palette.slug}",
  "fonts": ["${brand.fonts.map((f) => f.slug).join('", "')}"]
}`}
        </pre>
      </div>
    </section>
  );
}
