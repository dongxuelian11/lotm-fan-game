import type {PublicResolutionTier} from '../../shared/contracts.js';
import type {MiracleWorkerLifeState,MiracleWorkerLifeProjection,MiracleWorkerActivityCommand} from './life.js';
import type {MiracleWorkerRitualState,MiracleWorkerRitualCommand,MiracleWorkerRitualProjection} from './ritual.js';
import type {MiracleWorkerEncounterState,MiracleWorkerEncounterCommand,MiracleWorkerEncounterProjection} from './encounter.js';
import type {MiracleWorkerRevivalState,MiracleWorkerRevivalCommand,MiracleWorkerRevivalProjection} from './revival.js';
export type MiracleWorkerAcquisitionCommand={type:'LEARN_FORMULA'}|{type:'MATERIAL_WORK'|'BUY_MATERIALS'|'BREW';batchId:string}|{type:'CONSUME';bottleId:string;confirmed:true};
export type MiracleWorkerCommand=MiracleWorkerAcquisitionCommand|MiracleWorkerRitualCommand|MiracleWorkerActivityCommand|MiracleWorkerEncounterCommand|MiracleWorkerRevivalCommand;
export interface MiracleWorkerBatch {id:string;labourSteps:number;acquiredWeek:number|null;brewedWeek:number|null;materials:{id:string;name:string;quantity:number;unit:string;source:string;holder:'SUPPLIER'|'PLAYER'|'CONSUMED'}[]}
export interface MiracleWorkerBottle {id:string;batchId:string;inputIds:string[];brewedWeek:number;status:'PREPARED'|'CONSUMED';consumedWeek:number|null;outcome:PublicResolutionTier|null;restorationId:string|null}
export interface MiracleWorkerState {formulaKnown:boolean;batches:MiracleWorkerBatch[];bottles:MiracleWorkerBottle[];promotionWeek:number|null;ancientActingAtPromotion:number|null;ritual:MiracleWorkerRitualState;life:MiracleWorkerLifeState;encounter:MiracleWorkerEncounterState;revival:MiracleWorkerRevivalState}
export interface MiracleWorkerAction{id:string;label:string;cost:string;enabled:boolean;reason:string|null;command:MiracleWorkerCommand}
export interface MiracleWorkerProjection {title:string;discovered:boolean;promoted:boolean;formulaKnown:boolean;formula:{name:string;quantity:number;unit:string;note?:string}[];story:string;boundary:string;risk:string;acting:number;digestion:string;supplies:string;actions:MiracleWorkerAction[];abilities:{id:string;label:string;description:string;mastery:number}[];insideCase:boolean;environment:string;ritual:MiracleWorkerRitualProjection;life:MiracleWorkerLifeProjection;encounter:MiracleWorkerEncounterProjection;revival:MiracleWorkerRevivalProjection}
