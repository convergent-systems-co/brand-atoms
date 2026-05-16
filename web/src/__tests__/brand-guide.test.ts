import { describe, expect, it } from 'vitest';
import { renderBrandGuideHtml } from '../lib/brandGuide.js';
import { markdownEmitter } from '../../../tools/emitters/markdown.js';
import { fixtureBrand } from './fixtures/brand.js';

describe('renderBrandGuideHtml', () => {
  it('renders the markdown emitter output as HTML (headings turn into <h2>)', () => {
    const html = renderBrandGuideHtml(fixtureBrand);
    expect(html).toMatch(/<h2[^>]*>\s*Swatches\s*<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>\s*Mode role mappings\s*<\/h2>/);
  });

  it('renders the swatch markdown table as an HTML <table>', () => {
    const html = renderBrandGuideHtml(fixtureBrand);
    expect(html).toContain('<table');
    expect(html).toMatch(/<th[^>]*>\s*ID\s*<\/th>/);
    expect(html).toMatch(/<th[^>]*>\s*Name\s*<\/th>/);
    expect(html).toMatch(/<th[^>]*>\s*Value\s*<\/th>/);
  });

  it('renders one row per swatch in the fixture brand', () => {
    const html = renderBrandGuideHtml(fixtureBrand);
    for (const swatch of fixtureBrand.palette.data.swatches) {
      expect(html).toContain(swatch.id);
    }
  });

  it('strips raw markdown — no "## " heading prefixes leak through', () => {
    const html = renderBrandGuideHtml(fixtureBrand);
    expect(html).not.toMatch(/^##\s/m);
  });

  it('feeds the exact markdownEmitter contract — first file, brand-guide.md', () => {
    const emitted = markdownEmitter.emit(fixtureBrand);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.path).toBe('markdown/brand-guide.md');
    expect(emitted[0]?.contents).toContain('## Swatches');
  });
});
