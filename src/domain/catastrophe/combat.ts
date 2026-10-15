import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { CATASTROPHE_TARGET_ID, CATASTROPHE_POWER_IDS, CATASTROPHE_POWERS, hasCatastropheDisputeOpponent,
  type CatastropheEnemyIntent, type CatastrophePowerId } from './encounter.js';
import { validateCatastropheSiteState, type CatastropheSiteState } from './resources.js';

/** Finite original G cove only. Names S2/S1 have source support; none of these numerical rules claims canonical scope. */
export const CATASTROPHE_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const CATASTROPHE_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const catastropheActionCount = pyromaniacActionCount;
export const catastropheEnemyActionCount = pyromaniacActionCount;
const STORM = 'tyrant.s2.storm-field', PRESSURE = 'tyrant.s2.water-pressure';
const WIND = 'tyrant.s6.wind-control', LIGHTNING = 'tyrant.s4.great-lightning';
export type CatastropheMoveId = typeof STORM | typeof PRESSURE | typeof WIND | typeof LIGHTNING | 'EVADE' | 'ACCIDENT';
const ABILITIES: readonly { id: CatastropheMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: STORM, label: '有限风暴场（7S/意志20；真实湾水与原系索约束，成功75G、系索耐久−1）', weight: 25, stance: 'ATTACK' },
  { id: PRESSURE, label: '有限水压（6S/知识20；开闸且原渠水≥1，成功减45G、回流1单位）', weight: 20, stance: 'CONTROL' },
  { id: WIND, label: '继承控风（4S/意志16，减18×原掌握G）', weight: 15, stance: 'DEFEND' },
  { id: LIGHTNING, label: '继承强雷（6S/意志18，优势38×原掌握G）', weight: 20, stance: 'CONTROL' },
  { id: 'EVADE', label: '普通避让（减10G、0S）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断偏差（−22.5G）', weight: 5, stance: null },
];
export const CATASTROPHE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'STORM', label: '原风暴：7S/105G；真实湾水、系索耐久−1', weight: 35 },
  { id: 'PRESSURE', label: '原水压：6S/减60G；开闸原渠水≥1、回流1单位', weight: 25 },
  { id: 'BODY_STRIKE', label: '唯一原棍普通打击：20×身体G', weight: 20 },
  { id: 'GATE', label: '普通切换原闸：0S、每轮一次、耐久−1；初次空渠开闸引4单位', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isCatastrophe = (s: SliceState): boolean => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function catastropheAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a,b) => a+b,0);
  return ABILITIES.map((a,i) => ({ id:a.id,label:a.label,weight:weights[i]!/total*100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): CatastropheMoveId {
  const weights = tickets(stance); let n = random.nextInt(1,weights.reduce((a,b) => a+b,0));
  for (const [i,a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('天灾六槽能力盘无效。');
}
export function drawCatastropheAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): CatastropheMoveId { return drawPlayer(random,stance); }
export function drawCatastropheEnemyAbility(random: ActionRandomStream): CatastropheEnemyIntent {
  let n = random.nextInt(1,100); for (const a of CATASTROPHE_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as CatastropheEnemyIntent; }
  throw new Error('维尔原五类能力盘无效。');
}
export interface CatastropheCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'CATASTROPHE_DISPUTE'; targetId: typeof CATASTROPHE_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 47; targetSequence: 2; targetCore: 24; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'CT2-VALE-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; ordinaryExit: true; pursuit: false;
  thirdPartiesInArea: 0; automaticAllyImmunity: false; site: CatastropheSiteState;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  clubHeld: boolean; physique: number; perception: number; knowledge: number; will: number; windMastery: number; lightningMastery: number;
  powerUses: Record<CatastrophePowerId,number>; randomSeed: string; randomCursor: number;
}
export interface CatastropheCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends CatastropheCombatEffect {
  order: number; atSeconds: number; elapsedSeconds: 5; paidCost: number; physicalFactor: number; rolls: number[];
  randomCursorBefore: number; randomCursorAfter: number; playerSpiritualityAfter: number; enemySpiritualityAfter: number;
  siteBefore: CatastropheSiteState; siteAfter: CatastropheSiteState; gateOperationSeconds: 0 | 2; waterTransferSeconds: 0 | 3;
  admittedUnits: 0 | 4; dischargedUnits: 0 | 1; mooringWear: 0 | 1;
}
export interface CatastrophePlayerAction extends ActionEvidence {
  id: CatastropheMoveId; attempted: boolean; succeeded: boolean; applied: boolean; fallback: 'NONE' | 'STRIKE' | 'EVADE' | 'OBSERVE' | 'GATE_PREPARATION';
}
export interface CatastropheEnemyAction extends ActionEvidence { planned: CatastropheEnemyIntent; actual: CatastropheEnemyIntent; gateChanged: boolean }
interface Runtime { playerS: number; enemyS: number; powers: Record<CatastrophePowerId,number>; site: CatastropheSiteState; gateUsed: boolean }
export interface CatastropheRoundContext {
  source: CatastropheCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: CatastrophePlayerAction[]; enemyActions: CatastropheEnemyAction[]; label: string; outcome: CatastropheRoundOutcome | null;
}
const same = (a: unknown,b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown,min=0,max=Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown,keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(),[...keys].sort());
const none = (label: string): CatastropheCombatEffect => ({ label,selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false });
const physicalAt = (health:number):number => health>75?1:health>50?.95:health>25?.9:.8;
export function currentCatastropheCombatSource(s: SliceState): CatastropheCombatSource | null {
  if (!hasCatastropheDisputeOpponent(s)) return null;
  const e=s.catastrophe.encounter,c=s.combat!,stats=s.character.coreStats;
  return { runId:s.runId,revision:s.revision,week:s.week,round:c.round,encounterId:'CATASTROPHE_DISPUTE',targetId:CATASTROPHE_TARGET_ID,
    attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetAge:47,targetSequence:2,targetCore:24,actualOriginalBody:true,independentMind:true,
    enemyWeapon:'CT2-VALE-CLUB',weaponLocation:'HAND',distanceMetres:2,ordinaryExit:true,pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,
    site:structuredClone(s.catastrophe.life.site),playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,playerInjuries:structuredClone(s.injuries),enemyInjuries:structuredClone(c.enemyInjuries),playerRisk:s.injuryRisk,enemyRisk:c.enemyRisk,
    clubHeld:s.town.clubLocation==='HAND',physique:stats.physique,perception:stats.perception,knowledge:stats.knowledge,will:stats.will,
    windMastery:s.progression.mastery[WIND]??0,lightningMastery:s.progression.mastery[LIGHTNING]??0,powerUses:{...e.powerUses},randomSeed:s.random.seed,randomCursor:s.random.cursor };
}
function makeRuntime(x:CatastropheCombatSource):Runtime { return {playerS:x.playerSpirituality,enemyS:x.enemySpirituality,powers:{...x.powerUses},site:structuredClone(x.site),gateUsed:false}; }
function liveState(s:SliceState):string { const e=s.catastrophe.encounter; return stableStringify({spirituality:s.spirituality,enemySpirituality:e.enemySpirituality,powerUses:e.powerUses,site:s.catastrophe.life.site}); }
const dynamicSource = new Set(['playerSpirituality','enemySpirituality','powerUses','site']);
function validRound(s:SliceState,r:CatastropheRoundContext,supplied:CatastropheCombatSource|null):boolean {
  const actual=currentCatastropheCombatSource(s);
  return !r.finished&&actual!==null&&supplied!==null&&same(supplied,r.source)&&r.liveState===liveState(s)&&
    Object.entries(r.source).every(([key,value])=>dynamicSource.has(key)||same(actual[key as keyof CatastropheCombatSource],value));
}
export function beginCatastropheCombatRound(s:SliceState,stance:SliceStance,random:ActionRandomStream):CatastropheRoundContext {
  const source=currentCatastropheCombatSource(s);
  if(!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance)||!source||!validSource(source)||random.seed!==source.randomSeed||random.cursor!==source.randomCursor)
    throw new Error('天灾缺少原维尔、当前原海湾、实际资源或原随机来源。');
  return {source,stance,finished:false,liveState:liveState(s),runtime:makeRuntime(source),playerActions:[],enemyActions:[],outcome:null,
    label:`原47岁维尔持唯一原棍在同一CT2-COVE干台2米外，独立H${source.enemyHealth}/M100/S${source.enemySpirituality}。诺拉已真实步行清场；12米有限G边界不是自动友军免疫。`};
}
export const createCatastropheCombatRound=beginCatastropheCombatRound;
function actionBase(r:Runtime,order:number,physical:number,cursor:number):ActionEvidence {
  return {...none(''),order,atSeconds:r.site.clockSeconds,elapsedSeconds:5,paidCost:0,physicalFactor:physical,rolls:[],randomCursorBefore:cursor,randomCursorAfter:cursor,
    playerSpiritualityAfter:r.playerS,enemySpiritualityAfter:r.enemyS,siteBefore:structuredClone(r.site),siteAfter:structuredClone(r.site),
    gateOperationSeconds:0,waterTransferSeconds:0,admittedUnits:0,dischargedUnits:0,mooringWear:0};
}
function closeAction<T extends ActionEvidence>(a:T,r:Runtime,random:ActionRandomStream):T {
  r.site.clockSeconds+=5;a.siteAfter=structuredClone(r.site);a.randomCursorAfter=random.cursor;a.playerSpiritualityAfter=r.playerS;a.enemySpiritualityAfter=r.enemyS;
  a.label+=` 本槽5秒后本人S${r.playerS}、维尔S${r.enemyS}；原湾/渠${r.site.water.bayUnits}/${r.site.water.channelUnits}，闸${r.site.gate.position}/耐${r.site.gate.durability}、系索耐${r.site.mooring.durability}。`;return a;
}
const canStorm=(site:CatastropheSiteState)=>site.water.bayUnits>=1&&site.mooring.durability>0;
const canPressure=(site:CatastropheSiteState)=>site.gate.position==='OPEN'&&site.water.channelUnits>=1;
function toggleGate(site:CatastropheSiteState,a:ActionEvidence):boolean {
  if(site.gate.position==='BROKEN'||site.gate.durability<=0)return false;
  const next=site.gate.position==='OPEN'?'CLOSED':'OPEN';site.gate.operations++;site.gate.durability--;a.gateOperationSeconds=2;
  site.gate.position=site.gate.durability===0?'BROKEN':next;return true;
}
function admitWater(site:CatastropheSiteState,a:ActionEvidence):void {
  if(site.gate.position==='OPEN'&&site.water.channelUnits===0&&site.water.bayUnits>=4){site.water.bayUnits-=4;site.water.channelUnits+=4;a.admittedUnits=4;a.waterTransferSeconds=3;}
}
function discharge(site:CatastropheSiteState,a:ActionEvidence):void {site.water.channelUnits--;site.water.bayUnits++;a.dischargedUnits=1;a.waterTransferSeconds=3;}
function playerAction(x:CatastropheCombatSource,r:Runtime,id:CatastropheMoveId,physical:number,order:number,random:ActionRandomStream):CatastrophePlayerAction {
  const a:CatastrophePlayerAction={...actionBase(r,order,physical,random.cursor),id,attempted:false,succeeded:false,applied:false,fallback:'NONE'};
  const strike=(why:string)=>{a.fallback='STRIKE';a.selfGain=(x.clubHeld?16:12)*physical;a.threatens=a.selfGain>0;a.label=why+`本人以${x.clubHeld?'实际HAND原棍16':'原身体12'}×身体普通打击G，0S，不补抽。`;};
  const evade=(why:string)=>{a.fallback='EVADE';a.enemyReduction=10;a.label=why+'本人普通避让减势10G、0S，不施免费法术。';};
  if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='本槽判断偏差固定−22.5G。';}
  else if(id==='EVADE'){a.enemyReduction=10;a.label='本人留在原干台普通避让，减势10G、0S。';}
  else if(id===PRESSURE&&!canPressure(r.site)){
    a.fallback='GATE_PREPARATION';a.enemyReduction=10;
    if(r.site.gate.position==='CLOSED')toggleGate(r.site,a);admitWater(r.site,a);
    a.label=`水压当前缺少开闸/原渠水，选中槽只作普通准备与避让减10G、0S：${a.gateOperationSeconds?'实际操作原闸2秒、耐久−1；':''}${a.admittedUnits?'同一原湾4单位用3秒引入原空渠；':'没有补水；'}${r.site.gate.position==='BROKEN'?'坏闸仍坏，不能修复。':''}本槽没有魔法成功或应用，不重抽。`;
  }else{
    const storm=id===STORM,pressure=id===PRESSURE,wind=id===WIND,cost=storm?7:wind?4:6;
    if(storm&&!canStorm(r.site))strike('原湾无水或本作有限G边界的原系索已耗尽，风暴未施放；');
    else if(r.playerS<cost){if(storm)strike(`不足${cost}S，法术未施放；`);else if(pressure||wind)evade(`不足${cost}S，法术未施放；`);else{a.fallback='OBSERVE';a.label='不足6S，强雷未施放；只普通观察，0S/0贡献。';}}
    else{
      r.playerS-=cost;a.paidCost=cost;a.attempted=true;const ability=pressure?'knowledge':'will',difficulty=storm||pressure?20:wind?16:18;
      const roll=random.nextInt(1,100);a.rolls.push(roll);a.succeeded=roll<=computeCheckChance({ability,baseAbility:x[ability],difficulty,modifiers:[]});
      if(a.succeeded){a.applied=true;if(storm){a.selfGain=75;r.site.mooring.durability--;a.mooringWear=1;}
        else if(pressure){a.enemyReduction=45;discharge(r.site,a);}else if(wind)a.enemyReduction=18*(.65+.35*x.windMastery/500);else a.selfGain=38*(.65+.35*x.lightningMastery/500);a.threatens=a.selfGain>0;}
      a.label=`${storm?'有限风暴场':pressure?'有限水压':wind?'继承原控风':'继承原强雷'}实付${cost}S/${pressure?'知识':'意志'}${difficulty}，检验${roll}${a.succeeded?`成功，优势${a.selfGain}/减势${a.enemyReduction}G`:'失败，成本保留、0效果'}。`;
      if(a.mooringWear)a.label+='风浪使同一原系索耐久−1；这是本作G约束边界，不是原著施法必须绳子，不移水越闭闸。';
      if(a.dischargedUnits)a.label+='实际用3秒把原渠1单位泄回原湾；总水量不变。';
    }
  }
  return closeAction(a,r,random);
}
function enemyAction(_x:CatastropheCombatSource,r:Runtime,planned:CatastropheEnemyIntent,physical:number,order:number,random:ActionRandomStream):CatastropheEnemyAction {
  const a:CatastropheEnemyAction={...actionBase(r,order,physical,random.cursor),planned,actual:planned,gateChanged:false};
  if(planned==='STORM'&&(r.enemyS<7||!canStorm(r.site))||planned==='PRESSURE'&&(r.enemyS<6||!canPressure(r.site))||planned==='GATE'&&(r.gateUsed||r.site.gate.position==='BROKEN'))a.actual='BODY_STRIKE';
  if(a.actual==='STORM'){r.enemyS-=7;r.powers.STORM++;a.paidCost=7;a.selfGain=105;a.threatens=true;r.site.mooring.durability--;a.mooringWear=1;
    a.label='原维尔付自己7S、有限风暴优势105G，同一原系索耐久−1；原湾实际有水。系索是本作G环境边界，不外推原著法术条件。';}
  else if(a.actual==='PRESSURE'){r.enemyS-=6;r.powers.PRESSURE++;a.paidCost=6;a.enemyReduction=60;discharge(r.site,a);a.label='原维尔付自己6S、原闸实际开且原渠有水，有限水压减60G；用3秒实际泄回原湾1单位，不补水。';}
  else if(a.actual==='GATE'){r.gateUsed=true;r.powers.GATE++;a.gateChanged=toggleGate(r.site,a);admitWater(r.site,a);
    a.label=`原维尔本轮一次普通原闸操作：2秒、耐久−1、0S/0直接优势；${r.site.gate.position==='CLOSED'?'关闸保留全部原渠水。':r.site.gate.position==='BROKEN'?'原闸实际耗尽而损坏，没有修复或引水。':a.admittedUnits?'原渠原本为0，再用3秒从原湾引4单位。':'开闸后既有渠水保留，没有额外补满。'}`;}
  else if(a.actual==='BODY_STRIKE'){a.selfGain=20*physical;a.threatens=a.selfGain>0;a.label=`${planned!=='BODY_STRIKE'?'真实水/灵性不足，或闸已坏/本轮已操作，同槽普通回退；':''}维尔持唯一CT2-VALE-CLUB普通打击20×身体G，0S。`;}
  else{a.selfGain=-22.5;a.label='原维尔判断偏差，本槽固定−22.5G。';}
  return closeAction(a,r,random);
}
function commitRuntime(s:SliceState,r:CatastropheRoundContext):void {
  s.spirituality=r.runtime.playerS;s.catastrophe.encounter.enemySpirituality=r.runtime.enemyS;s.catastrophe.encounter.powerUses={...r.runtime.powers};
  s.catastrophe.life.site=structuredClone(r.runtime.site);r.liveState=liveState(s);
}
export function resolveCatastropheCombatAbility(s:SliceState,id:CatastropheMoveId,physical:number,random:ActionRandomStream,r:CatastropheRoundContext,source:CatastropheCombatSource|null=r.source):CatastropheCombatEffect {
  if(!validRound(s,r,source)||r.playerActions.length>=6||physical!==physicalAt(r.source.playerHealth)||random.seed!==r.source.randomSeed||!ABILITIES.some(a=>a.id===id))return none('缺少当前原身体/原海湾/原资源来源，0贡献0消耗，不重抽。');
  const a=playerAction(r.source,r.runtime,id,physical,r.playerActions.length+r.enemyActions.length,random);r.playerActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export function resolveCatastropheEnemyAbility(s:SliceState,planned:CatastropheEnemyIntent,physical:number,random:ActionRandomStream,r:CatastropheRoundContext,source:CatastropheCombatSource|null=r.source):CatastropheCombatEffect {
  if(!validRound(s,r,source)||r.enemyActions.length>=6||physical!==physicalAt(r.source.enemyHealth)||random.seed!==r.source.randomSeed||![...CATASTROPHE_POWER_IDS,'BODY_STRIKE','ACCIDENT'].includes(planned))return none('缺少当前原维尔/原棍/原资源来源，0贡献0消耗，不重抽。');
  const a=enemyAction(r.source,r.runtime,planned,physical,r.playerActions.length+r.enemyActions.length,random);r.enemyActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export interface CatastropheRoundOutcome {
  targetId:typeof CATASTROPHE_TARGET_ID;round:number;source:CatastropheCombatSource;stance:SliceStance;continuing:boolean;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  playerSpiritualityBefore:number;playerSpiritualityAfter:number;playerHealthAfter:number;playerMindAfter:number;enemySpiritualityBefore:number;
  playerInjuriesAfter:SliceInjury[];enemyInjuriesAfter:SliceInjury[];playerRiskAfter:number;enemyRiskAfter:number;
  powerUses:Record<CatastrophePowerId,number>;gateUsed:boolean;siteAfter:CatastropheSiteState;elapsedSeconds:60|62;randomCursorAfter:number;
  playerActions:CatastrophePlayerAction[];enemyActions:CatastropheEnemyAction[];
}
export function finishCatastropheCombatRound(s:SliceState,r:CatastropheRoundContext,continuing=true,randomCursorAfter=s.random.cursor):CatastropheRoundOutcome {
  const e=s.catastrophe.encounter,c=s.combat;
  if(r.finished||!c||c.encounterId!=='CATASTROPHE_DISPUTE'||c.round!==r.source.round||r.liveState!==liveState(s))throw new Error('天灾原回合已结束或原资源已改写。');
  e.enemyHealth=c.enemyHealth;e.enemyMind=c.enemyMind;e.enemyStatus=c.enemyStatus;e.enemyInjuries=structuredClone(c.enemyInjuries);e.enemyRisk=c.enemyRisk;if(e.enemyStatus!=='RESISTING')e.weaponLocation='PLATFORM';
  const site=s.catastrophe.life.site,leave=!continuing&&s.health>0;if(leave){if(site.playerPosition!=='PLATFORM')throw new Error('本人不在原干台，不能瞬移离场。');site.playerPosition='EXIT';site.playerTravelMetres+=2;}
  const elapsedSeconds=leave?62:60;site.clockSeconds=r.source.site.clockSeconds+elapsedSeconds;r.finished=true;
  r.outcome={targetId:CATASTROPHE_TARGET_ID,round:c.round,source:structuredClone(r.source),stance:r.stance,continuing,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:c.enemyStatus,
    playerSpiritualityBefore:r.source.playerSpirituality,playerSpiritualityAfter:s.spirituality,playerHealthAfter:s.health,playerMindAfter:s.mind,enemySpiritualityBefore:r.source.enemySpirituality,
    playerInjuriesAfter:structuredClone(s.injuries),enemyInjuriesAfter:structuredClone(c.enemyInjuries),playerRiskAfter:s.injuryRisk,enemyRiskAfter:c.enemyRisk,
    powerUses:{...e.powerUses},gateUsed:r.runtime.gateUsed,siteAfter:structuredClone(site),elapsedSeconds,randomCursorAfter,
    playerActions:structuredClone(r.playerActions),enemyActions:structuredClone(r.enemyActions)};return structuredClone(r.outcome);
}
export function catastropheRoundOutcome(r:CatastropheRoundContext):CatastropheRoundOutcome {if(!r.outcome)throw new Error('先结束原天灾回合。');return structuredClone(r.outcome);}
export function projectCatastropheCombat(s:SliceState){
  const e=s.catastrophe.encounter,visible=isCatastrophe(s),last=s.combat?.encounterId==='CATASTROPHE_DISPUTE'?s.combat.lastRound?.catastropheOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.catastropheOutcome:null;
  return {enemyName:visible?'维尔（47岁，原创有限G2非凡者）':'',targetId:visible?e.targetId:null,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,maxSpirituality:120,
    enemyHealth:visible?e.enemyHealth:null,enemyMind:visible?e.enemyMind:null,enemySpirituality:visible?e.enemySpirituality:null,powerUses:visible?{...e.powerUses}:null,
    site:visible?structuredClone(s.catastrophe.life.site):null,startSite:visible?structuredClone(e.startSite):null,originalExit:true,pursuit:false,distanceMetres:2,automaticAllyImmunity:false,
    source:visible?currentCatastropheCombatSource(s):null,lastActionSequence:visible&&last?[...last.playerActions.map(a=>({...structuredClone(a),actor:'PLAYER' as const})),...last.enemyActions.map(a=>({...structuredClone(a),actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order):[],
    countWheel:CATASTROPHE_COUNT_WHEEL.map(x=>({...x})),enemyCountWheel:CATASTROPHE_ENEMY_COUNT_WHEEL.map(x=>({...x})),enemyAbilityWheel:CATASTROPHE_ENEMY_ABILITY_WHEEL.map(x=>({...x})),
    summary:visible?'天灾·暴君序列2，名称有原著依据，本场人物、能力定量与12米范围均为有限G。核心35/25/25/15、1250/底125、S120，仅CONTINUE玩家+12S；敌S从原120实扣，不恢复。每实际槽5秒、每轮60秒；终局活着本人再普通步行2米/2秒。双方共用原湾20水单位、原闸与系索损耗，源自已关闭三案，既有原水/轮具绝不重置。风暴成功原系索−1是本作环境边界，不是原著施法必需绳子；水压实际回流1单位。闭闸/空渠玩家槽只普通准备，坏闸仍坏。共同伤势/死亡、旧20掌握不变，无战斗掌握奖励。':''};
}
const SOURCE_KEYS=['runId','revision','week','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetAge','targetSequence','targetCore','actualOriginalBody','independentMind','enemyWeapon','weaponLocation','distanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','site','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','clubHeld','physique','perception','knowledge','will','windMastery','lightningMastery','powerUses','randomSeed','randomCursor'] as const;
function validInjuries(v:SliceInjury[],revision:number):boolean {
  return Array.isArray(v)&&new Set(v.map(i=>i.id)).size===v.length&&v.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&i.id.length>0&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,1,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));
}
function validSource(x:CatastropheCombatSource):boolean {
  return shape(x,SOURCE_KEYS)&&typeof x.runId==='string'&&x.runId.length>0&&integer(x.revision)&&integer(x.week,1)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&
    x.encounterId==='CATASTROPHE_DISPUTE'&&x.targetId===CATASTROPHE_TARGET_ID&&x.targetAge===47&&x.targetSequence===2&&x.targetCore===24&&x.actualOriginalBody===true&&x.independentMind===true&&
    x.enemyWeapon==='CT2-VALE-CLUB'&&x.weaponLocation==='HAND'&&x.distanceMetres===2&&x.ordinaryExit===true&&x.pursuit===false&&x.thirdPartiesInArea===0&&x.automaticAllyImmunity===false&&
    validateCatastropheSiteState(x.site)&&x.site.playerPosition==='PLATFORM'&&x.site.keeper.position==='EXIT'&&x.site.buoy.offsetMetres===0&&
    [x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n=>integer(n,1,100))&&x.enemyMind===100&&[x.playerSpirituality,x.enemySpirituality].every(n=>integer(n,0,120))&&
    [x.physique,x.perception,x.knowledge,x.will,x.windMastery,x.lightningMastery].every(n=>integer(n,0,500))&&typeof x.clubHeld==='boolean'&&integer(x.playerRisk)&&integer(x.enemyRisk)&&
    validInjuries(x.playerInjuries,x.revision)&&validInjuries(x.enemyInjuries,x.revision)&&shape(x.powerUses,CATASTROPHE_POWER_IDS)&&CATASTROPHE_POWER_IDS.every(id=>integer(x.powerUses[id]))&&x.powerUses.GATE<=x.round-1&&
    x.enemySpirituality===120-CATASTROPHE_POWERS.reduce((n,p)=>n+p.cost*x.powerUses[p.id],0)&&typeof x.randomSeed==='string'&&x.randomSeed.length>0&&x.randomSeed.length<=256&&integer(x.randomCursor);
}
/** Exact inherited common formulas, applied to immutable historical source rather than later live stats. */
function sourcePenalty(current:number,maximum:number):number {const f=Math.max(0,Math.min(1,current/maximum));return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function sourceBase(core:number,health:number,mind:number,spirituality:number):number {return(1250+Math.min(core,250))*(1-Math.min(.4,sourcePenalty(health,100)+sourcePenalty(mind,100)+sourcePenalty(spirituality,120)));}
function sourceWeights(risk:number):{light:number;heavy:number;death:number}{const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
interface ReplayedRound {outcome:CatastropheRoundOutcome;playerCount:number;enemyCount:number;playerCountRoll:number;enemyCountRoll:number;first:'PLAYER'|'ENEMY';retreat:'NONE'|'SUCCESS'|'FAILURE';winner:'PLAYER'|'ENEMY';playerAdvantage:number;enemyAdvantage:number;winChance:number;consequenceWeights:{light:number;heavy:number;death:number}|null;consequenceRoll?:number}
function replayOutcome(o:CatastropheRoundOutcome):ReplayedRound|null {
  const x=o?.source;if(!x||!validSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(o.stance)||!Array.isArray(o.playerActions)||!Array.isArray(o.enemyActions)||o.playerActions.length>6||o.enemyActions.length>6)return null;
  const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=makeRuntime(x),playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=catastropheActionCount(playerCountRoll),enemyCount=catastropheEnemyActionCount(enemyCountRoll);
  const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const,remaining={PLAYER:playerCount,ENEMY:enemyCount};
  const players:CatastrophePlayerAction[]=[],enemies:CatastropheEnemyAction[]=[];let retreat:ReplayedRound['retreat']='NONE';
  while(remaining.PLAYER>0||remaining.ENEMY>0){for(const actor of order){if(remaining[actor]===0)continue;if(actor==='PLAYER'&&o.stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}remaining[actor]--;
    if(actor==='PLAYER')players.push(playerAction(x,r,drawPlayer(rng,o.stance),physicalAt(x.playerHealth),players.length+enemies.length,rng));else enemies.push(enemyAction(x,r,drawCatastropheEnemyAbility(rng),physicalAt(x.enemyHealth),players.length+enemies.length,rng));}}
  if(!same(players,o.playerActions)||!same(enemies,o.enemyActions))return null;
  const sum=(actions:{selfGain:number;enemyReduction:number}[],key:'selfGain'|'enemyReduction')=>actions.reduce((n,a)=>n+a[key],0);
  const playerAdvantage=Math.max(125,sourceBase(x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction'));
  const enemyAdvantage=Math.max(125,sourceBase(24,x.enemyHealth,x.enemyMind,x.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction')),winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100;
  const winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
  let playerHealth=x.playerHealth,enemyHealth=x.enemyHealth,playerRisk=x.playerRisk,enemyRisk=x.enemyRisk,enemyStatus:CatastropheRoundOutcome['enemyStatus']='RESISTING',continuing=retreat!=='SUCCESS';
  const playerInjuries=structuredClone(x.playerInjuries),enemyInjuries=structuredClone(x.enemyInjuries);let consequenceWeights:ReplayedRound['consequenceWeights']=null,consequenceRoll:number|undefined;
  if(retreat!=='SUCCESS'){const loser=winner==='PLAYER'?'ENEMY':'PLAYER',injuries=loser==='PLAYER'?playerInjuries:enemyInjuries;let risk=loser==='PLAYER'?playerRisk:enemyRisk;if(injuries.length)risk++;if(loser==='PLAYER')playerRisk=risk;else enemyRisk=risk;
    if(loser==='PLAYER'?enemies.some(a=>a.threatens):players.some(a=>a.threatens)){consequenceWeights=sourceWeights(risk);consequenceRoll=rng.nextInt(1,100);const severity=consequenceRoll<=consequenceWeights.light?'LIGHT':consequenceRoll<=consequenceWeights.light+consequenceWeights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH'){if(loser==='PLAYER')playerHealth=0;else{enemyHealth=0;enemyStatus='DEAD';}continuing=false;}
      else{injuries.push({id:`${x.runId}:combat:${x.round}:${loser}:${x.revision+1}:${injuries.length}`,severity,acquiredRevision:x.revision+1,treatedRevision:null});const damage=severity==='LIGHT'?10:30;if(loser==='PLAYER')playerHealth=Math.max(0,playerHealth-damage);else enemyHealth=Math.max(0,enemyHealth-damage);
        if(playerHealth===0||enemyHealth===0){if(enemyHealth===0)enemyStatus='DEAD';continuing=false;}else if(loser==='ENEMY'&&severity==='HEAVY'){enemyStatus='SURRENDERED';continuing=false;}}}}
  const leave=!continuing&&playerHealth>0,elapsedSeconds=leave?62:60;r.site.clockSeconds=x.site.clockSeconds+elapsedSeconds;if(leave){r.site.playerPosition='EXIT';r.site.playerTravelMetres+=2;}
  const expected:CatastropheRoundOutcome={targetId:CATASTROPHE_TARGET_ID,round:x.round,source:structuredClone(x),stance:o.stance,continuing,enemyHealth,enemyMind:x.enemyMind,enemySpirituality:r.enemyS,enemyStatus,
    playerSpiritualityBefore:x.playerSpirituality,playerSpiritualityAfter:r.playerS,playerHealthAfter:playerHealth,playerMindAfter:x.playerMind,enemySpiritualityBefore:x.enemySpirituality,
    playerInjuriesAfter:playerInjuries,enemyInjuriesAfter:enemyInjuries,playerRiskAfter:playerRisk,enemyRiskAfter:enemyRisk,powerUses:r.powers,gateUsed:r.gateUsed,siteAfter:r.site,elapsedSeconds,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies};
  if(!same(o,expected))return null;return{outcome:expected,playerCount,enemyCount,playerCountRoll,enemyCountRoll,first,retreat,winner,playerAdvantage,enemyAdvantage,winChance,consequenceWeights,...(consequenceRoll===undefined?{}:{consequenceRoll})};
}
export function validateCatastropheRoundOutcome(value:unknown):value is CatastropheRoundOutcome {try{return replayOutcome(value as CatastropheRoundOutcome)!==null;}catch{return false;}}
export function validateCatastropheCombatRound(round:SliceCombatRound):boolean {try{const o=round.catastropheOutcome,replay=o?replayOutcome(o):null;if(!o||!replay||round.round!==o.round||round.stance!==o.stance||round.consequence!==catastropheCombatConsequence(round)||!shape(round,['round','stance','first','playerCount','enemyCount','playerCountRoll','enemyCountRoll','moves','playerAdvantage','enemyAdvantage','winChance','winner','consequence','consequenceWeights','retreat','catastropheOutcome',...(replay.consequenceRoll===undefined?[]:['consequenceRoll'])]))return false;
  for(const key of ['playerCount','enemyCount','playerCountRoll','enemyCountRoll','first','retreat','winner','playerAdvantage','enemyAdvantage','winChance','consequenceWeights','consequenceRoll'] as const)if(!same(round[key],replay[key]))return false;
  const moves=[...o.playerActions.map(a=>({...a,actor:'PLAYER' as const})),...o.enemyActions.map(a=>({...a,actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction}));return same(round.moves,moves);
}catch{return false;}}

/** Renderer text is derived from the same real result; save validation never accepts arbitrary appended consequences. */
export function catastropheCombatConsequence(round:SliceCombatRound):string {
  const o=round.catastropheOutcome;if(!o)throw new Error('缺少天灾原回合结果。');const x=o.source;
  const prefix=`原47岁维尔持唯一原棍在同一CT2-COVE干台2米外，独立H${x.enemyHealth}/M100/S${x.enemySpirituality}。诺拉已真实步行清场；12米有限G边界不是自动友军免疫。`;
  let text:string;
  if(round.retreat==='SUCCESS')text='本人通过50%普通撤离判定，沿原干路实际步行2米/2秒到EXIT。没有追逐、瞬移或夺取原棍。';
  else {
    const loser=round.winner==='PLAYER'?'ENEMY':'PLAYER',subject=loser==='PLAYER'?'你':'同一原维尔',risk=loser==='PLAYER'?o.playerRiskAfter:o.enemyRiskAfter;
    if(round.consequenceRoll===undefined)text=`${subject}本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。已有伤势下再败累计风险${risk}保留。`;
    else {
      const weights=round.consequenceWeights!;const severity=round.consequenceRoll<=weights.light?'LIGHT':round.consequenceRoll<=weights.light+weights.heavy?'HEAVY':'DEATH';
      if(severity==='DEATH')text=`${subject}在共同伤势盘${round.consequenceRoll}/100进入真实死亡分支，原身体留在原干台。`;
      else {text=`${subject}在共同伤势盘${round.consequenceRoll}/100受到${severity==='LIGHT'?'轻':'重'}伤，原健康实际−${severity==='LIGHT'?10:30}；原伤势保留。`;
        if(o.playerHealthAfter===0||o.enemyHealth===0)text+='原身体健康降0，真实死亡。';else if(o.enemyStatus==='SURRENDERED')text+='原维尔因真实重伤自行停止抵抗，把自己的唯一原棍放在PLATFORM；不是强迫服从或战利品。';}
    }
    if(!o.continuing&&o.playerHealthAfter>0)text+='活着的本人沿原干路实际步行2米/2秒到EXIT。';
  }
  return prefix+text+'本轮有限风水结束；同一原湾/渠水、闸、系索、轮具和真实伤势/施术消耗保留，不免费排水、修复、治疗或复活。';
}
