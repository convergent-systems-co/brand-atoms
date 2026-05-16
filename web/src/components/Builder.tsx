import { useEffect, useMemo, useState } from 'react';
import { strToU8, zipSync } from 'fflate';
import { emitters } from '../../../tools/emitters/index.js';
import {
  type AtomCatalog,
  composeBrand,
  toBrandDefinitionYaml,
} from '../lib/composeBrand.js';
import { Preview } from './Preview.js';

const EMPTY_CATALOG: AtomCatalog = { palettes: [], fonts: [] };

const triggerDownload = (filename: string, contents: Uint8Array | string, mime: string): void => {
  const bytes =
    typeof contents === 'string' ? new TextEncoder().encode(contents) : contents;
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Free the blob URL after a tick so older browsers can still process it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const loadAtoms = (): AtomCatalog => {
  if (typeof document === 'undefined') return EMPTY_CATALOG;
  const node = document.getElementById('brand-atoms-data');
  if (!node || !node.textContent) return EMPTY_CATALOG;
  try {
    return JSON.parse(node.textContent) as AtomCatalog;
  } catch {
    return EMPTY_CATALOG;
  }
};

const slugifyBrandName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'composed-brand';

export default function Builder(): JSX.Element {
  const [atoms, setAtoms] = useState<AtomCatalog>(EMPTY_CATALOG);

  useEffect(() => {
    setAtoms(loadAtoms());
  }, []);

  const paletteSlug = useState<string>('');
  const headingSlug = useState<string>('');
  const bodySlug = useState<string>('');
  const monoSlug = useState<string>('');
  const brandName = useState<string>('My Brand');
  const previewMode = useState<'light' | 'dark'>('light');

  // Auto-default selections once atoms load.
  useEffect(() => {
    if (atoms.palettes.length === 0 || atoms.fonts.length === 0) return;
    if (!paletteSlug[0]) paletteSlug[1](atoms.palettes[0]!.slug);
    const sansLike = atoms.fonts.find((f) =>
      ['sans-serif', 'serif', 'display'].includes(f.data.classification ?? ''),
    );
    const mono = atoms.fonts.find((f) => f.data.classification === 'monospace');
    if (!headingSlug[0]) headingSlug[1](sansLike?.slug ?? atoms.fonts[0]!.slug);
    if (!bodySlug[0]) bodySlug[1](sansLike?.slug ?? atoms.fonts[0]!.slug);
    if (!monoSlug[0]) monoSlug[1](mono?.slug ?? atoms.fonts[0]!.slug);
  }, [atoms]);

  const composed = useMemo(() => {
    if (!paletteSlug[0] || !headingSlug[0] || !bodySlug[0] || !monoSlug[0]) return null;
    return composeBrand({
      id: slugifyBrandName(brandName[0]),
      version: '0.1.0',
      name: brandName[0],
      paletteSlug: paletteSlug[0],
      headingSlug: headingSlug[0],
      bodySlug: bodySlug[0],
      monoSlug: monoSlug[0],
      atoms,
    });
  }, [
    atoms,
    brandName[0],
    paletteSlug[0],
    headingSlug[0],
    bodySlug[0],
    monoSlug[0],
  ]);

  const handleYamlDownload = (): void => {
    if (!composed) return;
    const palette = atoms.palettes.find((p) => p.slug === paletteSlug[0])!;
    const heading = atoms.fonts.find((f) => f.slug === headingSlug[0])!;
    const body = atoms.fonts.find((f) => f.slug === bodySlug[0])!;
    const mono = atoms.fonts.find((f) => f.slug === monoSlug[0])!;
    const yaml = toBrandDefinitionYaml({
      id: composed.id,
      version: composed.version,
      name: composed.name,
      paletteSlug: palette.slug,
      paletteVersion: palette.version,
      headingSlug: heading.slug,
      headingVersion: heading.version,
      bodySlug: body.slug,
      bodyVersion: body.version,
      monoSlug: mono.slug,
      monoVersion: mono.version,
    });
    triggerDownload(`${composed.id}.brand.yaml`, yaml, 'text/yaml');
  };

  const handleAllFormatsDownload = (): void => {
    if (!composed) return;
    const files: Record<string, Uint8Array> = {};
    for (const emitter of emitters) {
      const emitted = emitter.emit(composed);
      for (const file of emitted) {
        files[file.path] = strToU8(file.contents);
      }
    }
    const zipped = zipSync(files);
    triggerDownload(`${composed.id}-all-formats.zip`, zipped, 'application/zip');
  };

  if (atoms.palettes.length === 0 || atoms.fonts.length === 0) {
    return <p className="builder-empty">Loading atom catalog…</p>;
  }

  return (
    <div className="builder">
      <section className="builder-controls">
        <div className="control-row">
          <label htmlFor="brand-name-input">Brand name</label>
          <input
            id="brand-name-input"
            type="text"
            value={brandName[0]}
            onChange={(e) => brandName[1](e.target.value)}
          />
        </div>

        <div className="control-grid">
          <div className="control">
            <label htmlFor="palette-select">Palette</label>
            <select
              id="palette-select"
              value={paletteSlug[0]}
              onChange={(e) => paletteSlug[1](e.target.value)}
              data-control="palette"
            >
              {atoms.palettes.map((p) => (
                <option key={`${p.slug}@${p.version}`} value={p.slug}>
                  {p.data.name} ({p.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="control">
            <label htmlFor="heading-select">Heading font</label>
            <select
              id="heading-select"
              value={headingSlug[0]}
              onChange={(e) => headingSlug[1](e.target.value)}
              data-control="heading"
            >
              {atoms.fonts.map((f) => (
                <option key={`heading-${f.slug}`} value={f.slug}>
                  {f.data.name} · {f.data.classification ?? 'unknown'}
                </option>
              ))}
            </select>
          </div>

          <div className="control">
            <label htmlFor="body-select">Body font</label>
            <select
              id="body-select"
              value={bodySlug[0]}
              onChange={(e) => bodySlug[1](e.target.value)}
              data-control="body"
            >
              {atoms.fonts.map((f) => (
                <option key={`body-${f.slug}`} value={f.slug}>
                  {f.data.name} · {f.data.classification ?? 'unknown'}
                </option>
              ))}
            </select>
          </div>

          <div className="control">
            <label htmlFor="mono-select">Mono font</label>
            <select
              id="mono-select"
              value={monoSlug[0]}
              onChange={(e) => monoSlug[1](e.target.value)}
              data-control="mono"
            >
              {atoms.fonts.map((f) => (
                <option key={`mono-${f.slug}`} value={f.slug}>
                  {f.data.name} · {f.data.classification ?? 'unknown'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="builder-actions">
          <button
            type="button"
            onClick={handleYamlDownload}
            disabled={!composed}
            data-action="download-yaml"
          >
            Download YAML
          </button>
          <button
            type="button"
            onClick={handleAllFormatsDownload}
            disabled={!composed}
            data-action="download-all"
          >
            Download all formats (.zip)
          </button>
        </div>
      </section>

      {composed && (
        <Preview
          brand={composed}
          mode={previewMode[0]}
          onModeChange={previewMode[1]}
        />
      )}
    </div>
  );
}
