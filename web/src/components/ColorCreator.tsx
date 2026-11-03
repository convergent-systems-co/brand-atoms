import { useEffect, useState } from 'react';
import {
  CUSTOM_COLOR_FIELDS,
  type CustomColorKey,
  type CustomColors,
  contrastRatio,
  isHexColor,
} from '../lib/customPalette.js';

export type ColorCreatorProps = {
  colors: CustomColors;
  onColorChange: (key: CustomColorKey, value: string) => void;
};

type ColorFieldProps = {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
};

/**
 * One color: a native picker plus a hex text box. The text box keeps the
 * user's in-progress draft locally and only commits once it is a valid
 * #rrggbb value, so partial typing never produces an invalid palette.
 */
function ColorField({ id, label, hint, value, onChange }: ColorFieldProps) {
  const [draft, setDraft] = useState<string>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="color-field">
      <label htmlFor={id}>{label}</label>
      <div className="color-field-inputs">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          data-color={id}
        />
        <input
          type="text"
          value={draft}
          spellCheck={false}
          aria-label={`${label} hex value`}
          aria-invalid={!isHexColor(draft)}
          maxLength={7}
          onChange={(e) => {
            const next = e.target.value.trim();
            setDraft(next);
            if (isHexColor(next)) onChange(next.toLowerCase());
          }}
        />
      </div>
      <span className="color-hint">{hint}</span>
    </div>
  );
}

const gradeFor = (ratio: number): string => {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'Below AA';
};

export function ColorCreator({ colors, onColorChange }: ColorCreatorProps) {
  const contrast = [
    { mode: 'Light', ratio: contrastRatio(colors.inkLight, colors.canvasLight) },
    { mode: 'Dark', ratio: contrastRatio(colors.inkDark, colors.canvasDark) },
  ];

  return (
    <div className="color-creator" data-component="color-creator">
      <p className="color-creator-lede">
        Choose your colors. The builder derives light and dark role mappings from them.
      </p>
      <div className="color-grid">
        {CUSTOM_COLOR_FIELDS.map((field) => (
          <ColorField
            key={field.key}
            id={`color-${field.key}`}
            label={field.label}
            hint={field.hint}
            value={colors[field.key]}
            onChange={(value) => onColorChange(field.key, value)}
          />
        ))}
      </div>
      <ul className="color-contrast" aria-label="Text contrast">
        {contrast.map((c) => (
          <li key={c.mode} data-contrast={c.mode.toLowerCase()}>
            <span>{c.mode} text</span>
            <strong>{c.ratio.toFixed(2)}:1</strong>
            <span className="color-grade">{gradeFor(c.ratio)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
