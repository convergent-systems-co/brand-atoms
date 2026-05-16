import { jsonEmitter } from './json.js';
import type { Emitter } from './types.js';
import { w3cTokensEmitter } from './w3c-tokens.js';

export const emitters: Emitter[] = [w3cTokensEmitter, jsonEmitter];

export const emitterMap: Map<string, Emitter> = new Map(emitters.map((e) => [e.name, e]));

export type { Emitter, EmittedFile } from './types.js';
