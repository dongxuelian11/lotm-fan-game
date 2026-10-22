import type { TyrantMaterialHost } from './material-types.js';
import type { TyrantHost as TyrantSceneHost } from './coasts.js';
export type { TyrantEffect } from './coasts.js';
export { emptyTyrantEffect } from './coasts.js';
export interface TyrantHost extends TyrantMaterialHost, Omit<TyrantSceneHost, 'status' | 'sequence'> {}
export interface TyrantModuleResult<T> { state: T; effect: import('./coasts.js').TyrantEffect; notes: string[] }
