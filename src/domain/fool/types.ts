import type { PublicCheckResult } from '../../shared/contracts.js';
import type { Place } from '../attendant-mysteries/town.js';
import type { ReceptionWorkLedger } from '../reception-economy.js';
import type { FoolSource, FoolBudget } from './source.js';
import type { FoolMaterialsState, FoolMaterialCommand, FoolMaterialHost, FoolMaterialConsumptionReceipt } from './materials.js';
import type { FogState, FogCommand } from './fog.js';
import type { FoolEscapeState, FoolEscapeCommand, FoolEscapeHost } from './escape.js';
import type { FoolFateHostState, FoolFateHostCommand, FoolFateHostReceipt } from './fate-host.js';
type WithoutId<T> = T extends {id:string} ? Omit<T,'id'> : never;
export type { FoolSource } from './source.js';
export type FoolCommand =
 | {type:'LEARN_GUIDANCE' | 'RECEPTION_WORK' | 'RECEPTION_REST' | 'RECEPTION_NEXT_WEEK' | 'ENTER_FATE' | 'LEAVE_FATE' | 'START_ESCAPE'}
 | {type:'MATERIAL'; command:Omit<Extract<FoolMaterialCommand,{itemId:string}>, 'proofId'> | {type:'INSPECT_UNIQUENESS'|'TAKE_UNIQUENESS'|'PREPARE_COMPOUND'}}
 | {type:'FOG'; command:Exclude<FogCommand,{type:'SYNC_HOST'|'ADVANCE_FOR_CONSUMPTION'}|{type:'APPLY_EVENT';eventId:string}>}
 | {type:'FATE';command:WithoutId<Exclude<FoolFateHostCommand,{type:'SYNC_WORLD'}>>}
 | {type:'CONSUME';compoundId:string;confirmed:true}
 | {type:'ESCAPE';command:FoolEscapeCommand};
export interface FoolFrame {
 budget:FoolBudget; nowSecond:number; activityEpoch:number; location:Place; cartLocation:Place; random:{seed:string;cursor:number};
}
export interface FoolCheckReceipt {kind:'CHECK';check:PublicCheckResult;cursorBefore:number;cursorAfter:number}
export interface FoolRollReceipt {kind:'ROLL';min:number;max:number;value:number;cursorBefore:number;cursorAfter:number}
export interface FoolEvent {
 id:string;revision:number;command:FoolCommand;before:FoolFrame;after:FoolFrame;randomReceipts:(FoolCheckReceipt|FoolRollReceipt)[];
 fateReceipts:FoolFateHostReceipt[];materialHost:FoolMaterialHost|null;consumption:FoolMaterialConsumptionReceipt|null;escapeHost:FoolEscapeHost|null;
 beforeDigest:string;afterDigest:string;
}
export interface FoolState {
 version:1;guidanceKnown:boolean;source:FoolSource|null;frame:FoolFrame|null;promotionWeek:number|null;
 fate:FoolFateHostState|null;atFate:boolean;fatePeople:Record<string,{health:number;injuries:string[]}>;materials:FoolMaterialsState|null;fog:FogState|null;escape:FoolEscapeState|null;
 reception:ReceptionWorkLedger;journal:FoolEvent[];
}
export interface FoolAction {id:string;label:string;cost:string;enabled:boolean;reason:string|null;command:FoolCommand;preferredAction?:boolean}
export interface FoolProjection {
 title:string;guidanceKnown:boolean;promoted:boolean;story:string;nextStep:string;risk:string;
 resources:{health:number;mind:number;spirituality:number;cash:string;actionsRemaining:number};
 abilities:{id:string;label:string;mastery:number;description:string}[];actions:FoolAction[];
 sections:{id:string;title:string;lines:string[]}[];insideCase:boolean;
}
