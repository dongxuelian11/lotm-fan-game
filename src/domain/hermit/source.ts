import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { validateKnowledgeEmperorState, hasKnowledgeEmperorLock, hasKnowledgeEmperorOldPractice, resolveKnowledgeEmperorOriginalsSnapshot } from '../knowledge-emperor/index.js';
import { getKnowledgeEmperorCurrentSite } from '../knowledge-emperor/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { HERMIT_SUCCESSION } from './content.js';
export const HERMIT_FROZEN_SOURCE_KEYS = ['pryer','combatScholar','wizard','scrollProfessor','starMystic','mystic','prophecyMaster','sage','knowledgeEmperor'] as const;
const digest=(value:unknown)=>sha256Hex(stableStringify(value));
const same=(a:unknown,b:unknown)=>stableStringify(a)===stableStringify(b);
export interface HermitBudget {
 week:number; date:PublicGameDate; actions:number; cash:number; health:number; mind:number; spirituality:number; pollution:number;
 injuries:SliceState['injuries']; injuryRisk:number; status:SliceState['status']; sequence:1|0; acting:number;
 mastery:Record<string,number>; coreStats:SliceState['character']['coreStats']; completedSources:string[];
}
export type HermitFinance=Pick<SliceState,'weeklyBudget'|'wagePaidWeek'|'lifeTier'|'nextLifeTier'|'debts'|'missedWeeks'|'credit'>;
export const hermitBudget=(s:SliceState):HermitBudget=>({week:s.week,date:structuredClone(s.date),actions:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,spirituality:s.spirituality,pollution:s.seer.pollution,injuries:structuredClone(s.injuries),injuryRisk:s.injuryRisk,status:s.status,sequence:s.progression.sequence as 1|0,acting:s.progression.acting,mastery:{...s.progression.mastery},coreStats:{...s.character.coreStats},completedSources:[...s.seer.completedSources]});
export const hermitHistoryDigest=(s:SliceState)=>digest(Object.fromEntries(HERMIT_FROZEN_SOURCE_KEYS.map(k=>[k,s[k]])));
export const hermitAcquisitionSnapshot=(s:SliceState)=>({bottles:structuredClone(s.knowledgeEmperor.bottles),resupply:structuredClone(s.knowledgeEmperor.resupply),promotionWeek:s.knowledgeEmperor.promotionWeek!,acquisitionJournal:structuredClone(s.knowledgeEmperor.acquisitionJournal)});
/** The life continuation is authoritative until an actual encounter exists. */
export const hermitOriginalPeopleAndObjects=(s:SliceState)=>({site:structuredClone(getKnowledgeEmperorCurrentSite(s)),workshop:structuredClone(s.scrollProfessor.workshop),notes:structuredClone(s.knowledgeEmperor.life.notes)});
export interface HermitSource {
 runId:string;actorId:string;revision:number;budget:HermitBudget;character:SliceState['character'];finance:HermitFinance;random:SliceState['random'];
 historyDigest:string;originalWorldDigest:string;combatHistoryLength:number;combatHistoryDigest:string;
 originals:ReturnType<typeof hermitOriginalPeopleAndObjects>;originalsDigest:string;
 acquisition:ReturnType<typeof hermitAcquisitionSnapshot>;acquisitionDigest:string;
 originalCharacteristics:NonNullable<ReturnType<typeof resolveKnowledgeEmperorOriginalsSnapshot>>;
}
export function hermitSourceBlock(s:SliceState):string|null {
 if(s.progression.pathwayId!=='hermit'||s.progression.sequence!==1||s.status!=='ACTIVE')return '须由仍活着的知识皇帝本人继续。';
 if(!validateKnowledgeEmperorState(s)||s.knowledgeEmperor.promotionWeek===null)return '原晋升、原人物与实际履历未通过核验。';
 if(s.progression.acting!==100||!s.knowledgeEmperor.life.reflected)return '先完成知识皇帝的实际实践、报告与消化。';
 if(hasKnowledgeEmperorLock(s)||hasKnowledgeEmperorOldPractice(s)||s.combat||s.activeEvent||s.eventQueue.length||s.pulse!=='NONE')return '先停止旧能力、归还原物并沿普通路离开旧现场。';
 const site=getKnowledgeEmperorCurrentSite(s);
 if(site.playerLocation!=='OUTSIDE'||site.body!=='SOLID'||site.form.active||site.iris?.location!=='OUTSIDE'||!site.iris.alive||site.record?.location!=='OWNER'||site.record.quantity!==1||site.materials.some(x=>x.status!=='RETURNED'||x.location!=='OWNER'))return '本人、艾瑞丝和同一份已归还记录须实际在馆外。';
 const first=s.knowledgeEmperor.acquisitionJournal.find(e=>e.command.type==='LEARN_GUIDANCE');
 if(!first||compareGameDates(HERMIT_SUCCESSION.custody.date,first.date)>=0)return '前任退出与唯一性的实际封存须早于本人最初取得成品指导。';
 if(!resolveKnowledgeEmperorOriginalsSnapshot(s.knowledgeEmperor))return '三份原特性的实际去向尚未核清，不能把额外独立库存改成旧原件。';
 return null;
}
export function createHermitSource(s:SliceState):HermitSource {
 const reason=hermitSourceBlock(s);if(reason)throw Error(reason);
 const acquisition=hermitAcquisitionSnapshot(s),originals=hermitOriginalPeopleAndObjects(s);
 return {runId:s.runId,actorId:`${s.runId}:original-player`,revision:s.revision,budget:hermitBudget(s),character:structuredClone(s.character),finance:structuredClone({weeklyBudget:s.weeklyBudget,wagePaidWeek:s.wagePaidWeek,lifeTier:s.lifeTier,nextLifeTier:s.nextLifeTier,debts:s.debts,missedWeeks:s.missedWeeks,credit:s.credit}),random:{...s.random},historyDigest:hermitHistoryDigest(s),originalWorldDigest:digest(s.world),combatHistoryLength:s.combatHistory.length,combatHistoryDigest:digest(s.combatHistory),originals,originalsDigest:digest(originals),acquisition,acquisitionDigest:digest(acquisition),originalCharacteristics:resolveKnowledgeEmperorOriginalsSnapshot(s.knowledgeEmperor)!};
}
export function hermitSourceView(s:SliceState,source:HermitSource):SliceState {
 const b=source.budget;
 return {...s,...structuredClone(source.finance),revision:source.revision,week:b.week,date:structuredClone(b.date),actionsRemaining:b.actions,cash:b.cash,health:b.health,mind:b.mind,spirituality:b.spirituality,status:b.status,injuries:structuredClone(b.injuries),injuryRisk:b.injuryRisk,character:structuredClone(source.character),random:{...source.random},progression:{...s.progression,pathwayId:'hermit',sequence:1,acting:b.acting,mastery:{...b.mastery}},seer:{...s.seer,pollution:b.pollution,completedSources:[...b.completedSources]},combatHistory:s.combatHistory.slice(0,source.combatHistoryLength),combat:null,activeEvent:null,eventQueue:[],pulse:'NONE',billAmount:0,ending:null};
}
export function validateHermitSource(s:SliceState,source:HermitSource,phase:'HANDOFF'|'COLD_REOPEN'):boolean {
 try {
  if(phase==='HANDOFF')return same(createHermitSource(s),source);
  if(source.runId!==s.runId||source.actorId!==`${s.runId}:original-player`||source.revision>s.revision||source.random.seed!==s.random.seed||source.random.cursor>s.random.cursor||source.budget.status!=='ACTIVE'||source.budget.sequence!==1||source.historyDigest!==hermitHistoryDigest(s)||source.originalWorldDigest!==digest(s.world)||source.combatHistoryLength!==s.combatHistory.length||source.combatHistoryDigest!==digest(s.combatHistory)||!same(source.originals,hermitOriginalPeopleAndObjects(s))||source.originalsDigest!==digest(source.originals)||!same(source.acquisition,hermitAcquisitionSnapshot(s))||source.acquisitionDigest!==digest(source.acquisition))return false;
  return same(createHermitSource(hermitSourceView(s,source)),source);
 }catch{return false;}
}
