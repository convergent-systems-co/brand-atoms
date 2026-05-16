import { marked } from 'marked';
import { markdownEmitter } from '../../../tools/emitters/markdown.js';
import type { ResolvedBrand } from './encyclopedia.js';

/**
 * Render the brand guide for a brand as HTML by piping the markdown
 * emitter's output through `marked`. Single source of truth: whatever
 * the emitter produces is what users see on /brands/[slug] and what
 * they get when they download markdown/brand-guide.md.
 *
 * Synchronous because both `markdownEmitter.emit` and `marked.parse`
 * (with `async: false`) are synchronous, and Astro's templating needs
 * a string at frontmatter evaluation time.
 */
export const renderBrandGuideHtml = (brand: ResolvedBrand): string => {
  const files = markdownEmitter.emit(brand);
  const first = files[0];
  if (!first) {
    throw new Error(`markdownEmitter produced no files for ${brand.id}@${brand.version}`);
  }
  return marked.parse(first.contents, { async: false }) as string;
};
