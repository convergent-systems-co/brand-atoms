import { cssEmitter } from './css.js';
import { figmaTokensEmitter } from './figma.js';
import { jsonEmitter } from './json.js';
import { kotlinEmitter } from './kotlin.js';
import { markdownEmitter } from './markdown.js';
import { scssEmitter } from './scss.js';
import { swiftEmitter } from './swift.js';
import { tailwindEmitter } from './tailwind.js';
import type { Emitter } from './types.js';
import { w3cTokensEmitter } from './w3c-tokens.js';

export const emitters: Emitter[] = [
  w3cTokensEmitter,
  jsonEmitter,
  cssEmitter,
  scssEmitter,
  tailwindEmitter,
  figmaTokensEmitter,
  swiftEmitter,
  kotlinEmitter,
  markdownEmitter,
];

export const emitterMap: Map<string, Emitter> = new Map(emitters.map((e) => [e.name, e]));

export type { Emitter, EmittedFile } from './types.js';
