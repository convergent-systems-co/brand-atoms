import type { ResolvedBrand } from '../resolver.js';

export type EmittedFile = {
  /** Path relative to the brand's output dir, e.g. "w3c.tokens.json" or "css/tokens.css" */
  path: string;
  contents: string;
};

export type Emitter = {
  /** Stable identifier used in CLI args and output paths. */
  name: string;

  /** One-line description shown in --help. */
  description: string;

  emit(brand: ResolvedBrand): EmittedFile[];
};
