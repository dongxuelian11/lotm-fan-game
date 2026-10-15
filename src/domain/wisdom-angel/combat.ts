import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { PolymathSampleState } from '../polymath/types.js';
import type { MysticismMagisterCraft } from '../mysticism-magister/types.js';
import { WISDOM_ANGEL_TARGET_ID, WISDOM_ANGEL_POWERS, WISDOM_ANGEL_POWER_IDS, hasWisdomAngelDisputeOpponent,
  type WisdomAngelEnemyIntent, type WisdomAngelPowerId, type WisdomAngelAbilityUses, type WisdomAngelObservation, type WisdomAngelResponseWindow } from './encounter.js';

/** Candidate White Tower2: all new names, numbers, conditions and effects are unverified G.
 * Inherits the existing 35/25/25/15 core, 1250/floor125, S120 and shared injury consequences. */
export const WISDOM_ANGEL_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const WISDOM_ANGEL_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const wisdomAngelActionCount = pyromaniacActionCount;
export const wisdomAngelEnemyActionCount = pyromaniacActionCount;
export type WisdomAngelMoveId = 'STRIKE' | 'reader.s2.conditional-synthesis' | 'reader.s2.observed-response' | 'reader.s3.method-analysis'
  | 'reader.s6.limited-imitation' | 'reader.s5.material-imitation' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const SYNTHESIS = 'reader.s2.conditional-synthesis', RESPONSE = 'reader.s2.observed-response', METHOD = 'reader.s3.method-analysis';
const FLASH = 'reader.s6.limited-imitation', MATERIAL = 'reader.s5.material-imitation';
const ABILITIES: readonly { id: WisdomAngelMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: SYNTHESIS, label: '条件综合（5S/知识20；当前条件已见FLASH+WARD才可用，成功65G）', weight: 20, stance: 'ATTACK' },
  { id: RESPONSE, label: '已见方法应对（6S/知识20；20秒内下一实际敌槽，匹配实付原法术减45G）', weight: 20, stance: 'DEFEND' },
  { id: METHOD, label: '继承方法辨析（本场实际已见FLASH/WARD，5S/知识18减35G）', weight: 15, stance: 'CONTROL' },
  { id: FLASH, label: '继承实际学会原FLASH（2S/知识14，减12×旧掌握G）', weight: 15, stance: 'CONTROL' },
  { id: MATERIAL, label: '消耗最早合格自持原微光片（0S，减18×制作固定效力G）', weight: 15, stance: 'PREPARE' },
  { id: 'STRIKE', label: '本人普通打击（原身体12/实际在手原棍16×身体G）', weight: 15, stance: 'ATTACK' },
];
export const WISDOM_ANGEL_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FLASH', label: '原有限闪光：7S/105G', weight: 35 }, { id: 'WARD', label: '原有限护术：6S/减60G', weight: 25 },
  { id: 'BODY_STRIKE', label: '原棍普通打击：20×身体G', weight: 20 },
  { id: 'FEINT', label: '实际变换节奏：3S/每轮一次，当前条件版本+1并结束当前应对窗', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isWisdomAngel = (s: SliceState): boolean => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function wisdomAngelAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a,b) => a+b,0);
  return ABILITIES.map((a,i) => ({ id: a.id, label: a.label, weight: weights[i]!/total*100 }));
}
function drawPlayer(random: ActionRandomStream, stance: SliceStance | null): WisdomAngelMoveId {
  const weights = tickets(stance); let n = random.nextInt(1,weights.reduce((a,b) => a+b,0));
  for (const [i,a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('智慧天使候选G能力盘无效。');
}
export function drawWisdomAngelAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): WisdomAngelMoveId { return drawPlayer(random,stance); }
export function drawWisdomAngelEnemyAbility(random: ActionRandomStream): WisdomAngelEnemyIntent {
  let n = random.nextInt(1,100); for (const a of WISDOM_ANGEL_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as WisdomAngelEnemyIntent; }
  throw new Error('维克托原五类能力盘无效。');
}
export interface WisdomAngelCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'WISDOM_ANGEL_DISPUTE'; targetId: typeof WISDOM_ANGEL_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 49; targetSequence: 2; targetCore: 24; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'WA2-VICTOR-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'WA2-COURT'; door: 'WA2-COURT-DOOR'; doorStatus: 'OPEN';
  playerLocation: 'DOORSTEP'; ordinaryExit: true; pursuit: false; playerTravelMetres: number; clockSeconds: number;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  clubHeld: boolean; physique: number; perception: number; knowledge: number; will: number; imitationMastery: number;
  powerUses: Record<WisdomAngelPowerId,number>; abilityUses: WisdomAngelAbilityUses; conditionVersion: number; observations: WisdomAngelObservation[];
  flashSample: PolymathSampleState; crafts: MysticismMagisterCraft[]; craftingPromotionWeek: number | null; craftingCaseStatus: string; kitsUsed: number;
  randomSeed: string; randomCursor: number;
}
export interface WisdomAngelCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends WisdomAngelCombatEffect {
  order: number; atSeconds: number; paidCost: number; physicalFactor: number; rolls: number[]; randomCursorBefore: number; randomCursorAfter: number;
  playerSpiritualityAfter: number; enemySpiritualityAfter: number; conditionVersionBefore: number; conditionVersionAfter: number;
  responseWindowBefore: WisdomAngelResponseWindow | null; responseWindowAfter: WisdomAngelResponseWindow | null; responseExpired: boolean;
}
export interface WisdomAngelPlayerAction extends ActionEvidence {
  id: WisdomAngelMoveId; requiredObservations: WisdomAngelObservation[]; consumedCraftId: string | null; attempted: boolean; succeeded: boolean; applied: boolean;
}
export interface WisdomAngelEnemyAction extends ActionEvidence {
  planned: WisdomAngelEnemyIntent; actual: WisdomAngelEnemyIntent; observation: WisdomAngelObservation | null;
  changedCondition: boolean; responseConsumed: boolean; responseApplied: boolean; responseInvalidated: boolean; responseReduction: number;
}
interface Runtime {
  playerS: number; enemyS: number; powers: Record<WisdomAngelPowerId,number>; uses: WisdomAngelAbilityUses;
  conditionVersion: number; observations: WisdomAngelObservation[]; responseWindow: WisdomAngelResponseWindow | null; feintUsed: boolean; crafts: MysticismMagisterCraft[];
}
export interface WisdomAngelRoundContext {
  source: WisdomAngelCombatSource; stance: SliceStance; finished: boolean; liveState: string; runtime: Runtime;
  playerActions: WisdomAngelPlayerAction[]; enemyActions: WisdomAngelEnemyAction[]; label: string; outcome: WisdomAngelRoundOutcome | null;
}
const same = (a: unknown,b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown,min=0,max=Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown,keys: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(),[...keys].sort());
const none = (label: string): WisdomAngelCombatEffect => ({ label,selfGain: 0,enemyReduction: 0,threatens: false,mentalPressure: false });
function hasLearnedFlash(sample: PolymathSampleState,week: number): boolean {
  const { observedWeek,understoodWeek,learnedWeek,analysisAttemptWeek } = sample;
  return [observedWeek,understoodWeek,learnedWeek,analysisAttemptWeek].every(w => integer(w,1,week)) &&
    observedWeek! <= understoodWeek! && understoodWeek! <= learnedWeek! && observedWeek! <= analysisAttemptWeek! && analysisAttemptWeek! <= learnedWeek!;
}
/** Consume one real surviving original; never synthesize a library entry or recalculate its manufacture power. */
function oldestPreparedFlash(x: Pick<WisdomAngelCombatSource,'crafts'|'craftingPromotionWeek'|'craftingCaseStatus'|'kitsUsed'|'week'>): MysticismMagisterCraft | null {
  if (x.craftingCaseStatus !== 'RESOLVED') return null;
  return x.crafts.filter(c => {
    const kit = /^MM5-KIT-([1-9]\d*)$/.exec(c.sourceKitId);
    return /^MM5-FLASH-[1-9]\d*$/.test(c.id) && kit !== null && Number.isSafeInteger(Number(kit[1])) && c.id === `MM5-FLASH-${kit[1]}` &&
      integer(x.kitsUsed) && Number(kit[1]) <= x.kitsUsed && c.status === 'PLAYER' && c.usedWeek === null && integer(c.createdWeek,1,x.week) &&
      x.craftingPromotionWeek !== null && c.createdWeek >= x.craftingPromotionWeek && Number.isFinite(c.power) && c.power >= .65 && c.power <= 1 &&
      x.crafts.filter(other => other.id === c.id || other.sourceKitId === c.sourceKitId).length === 1;
  }).sort((a,b) => a.createdWeek-b.createdWeek || Number(a.id.slice('MM5-FLASH-'.length))-Number(b.id.slice('MM5-FLASH-'.length)))[0] ?? null;
}
export function currentWisdomAngelCombatSource(s: SliceState): WisdomAngelCombatSource | null {
  if (!hasWisdomAngelDisputeOpponent(s)) return null;
  const e = s.wisdomAngel.encounter,c = s.combat!,stats = s.character.coreStats,m = s.mysticismMagister;
  return { runId:s.runId,revision:s.revision,week:s.week,round:c.round,encounterId:'WISDOM_ANGEL_DISPUTE',targetId:WISDOM_ANGEL_TARGET_ID,
    attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,targetAge:49,targetSequence:2,targetCore:24,actualOriginalBody:true,independentMind:true,
    enemyWeapon:'WA2-VICTOR-CLUB',weaponLocation:'HAND',distanceMetres:2,space:'WA2-COURT',door:'WA2-COURT-DOOR',doorStatus:'OPEN',
    playerLocation:'DOORSTEP',ordinaryExit:true,pursuit:false,playerTravelMetres:e.playerTravelMetres,clockSeconds:e.clockSeconds,
    playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,
    playerInjuries:structuredClone(s.injuries),enemyInjuries:structuredClone(c.enemyInjuries),playerRisk:s.injuryRisk,enemyRisk:c.enemyRisk,
    clubHeld:s.town.clubLocation === 'HAND',physique:stats.physique,perception:stats.perception,knowledge:stats.knowledge,will:stats.will,
    imitationMastery:s.progression.mastery[FLASH] ?? 0,powerUses:{...e.powerUses},abilityUses:structuredClone(e.abilityUses),
    conditionVersion:e.conditionVersion,observations:structuredClone(e.observations),flashSample:structuredClone(s.polymath.samples.FLASH),crafts:structuredClone(m.crafts),
    craftingPromotionWeek:m.promotionWeek,craftingCaseStatus:m.cases['modest-craft']!.status,kitsUsed:m.practice.kitsUsed,randomSeed:s.random.seed,randomCursor:s.random.cursor };
}
function makeRuntime(x: WisdomAngelCombatSource): Runtime { return { playerS:x.playerSpirituality,enemyS:x.enemySpirituality,powers:{...x.powerUses},uses:structuredClone(x.abilityUses),
  conditionVersion:x.conditionVersion,observations:structuredClone(x.observations),responseWindow:null,feintUsed:false,crafts:structuredClone(x.crafts) }; }
function liveState(s: SliceState): string { const e = s.wisdomAngel.encounter; return stableStringify({ spirituality:s.spirituality,enemySpirituality:e.enemySpirituality,
  powerUses:e.powerUses,abilityUses:e.abilityUses,conditionVersion:e.conditionVersion,observations:e.observations,responseWindow:e.responseWindow,crafts:s.mysticismMagister.crafts }); }
const dynamicSource = new Set(['playerSpirituality','enemySpirituality','powerUses','abilityUses','conditionVersion','observations','crafts']);
function validRound(s: SliceState,r: WisdomAngelRoundContext,supplied: WisdomAngelCombatSource | null): boolean {
  const actual = currentWisdomAngelCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied,r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key,value]) => dynamicSource.has(key) || same(actual[key as keyof WisdomAngelCombatSource],value));
}
export function beginWisdomAngelCombatRound(s: SliceState,stance: SliceStance,random: ActionRandomStream): WisdomAngelRoundContext {
  if (!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance)) throw new TypeError('智慧天使候选G姿态无效。');
  const source = currentWisdomAngelCombatSource(s);
  if (!source || !validSource(source) || s.wisdomAngel.encounter.responseWindow !== null || random.seed !== source.randomSeed || random.cursor !== source.randomCursor)
    throw new Error('缺少同一原维克托、实际原样本/原片、当前条件或原随机来源。');
  return { source,stance,finished:false,liveState:liveState(s),runtime:makeRuntime(source),playerActions:[],enemyActions:[],outcome:null,
    label:`原49岁维克托持唯一原棍在2米可达原门口，独立H${source.enemyHealth}/M${source.enemyMind}/S${source.enemySpirituality}；当前条件v${source.conditionVersion}，只用实际已见资料。` };
}
export const createWisdomAngelCombatRound = beginWisdomAngelCombatRound;
function expire(runtime: Runtime,atSeconds: number): boolean {
  if (runtime.responseWindow && runtime.responseWindow.expiresAt <= atSeconds) { runtime.responseWindow = null; return true; } return false;
}
function actionBase(runtime: Runtime,order: number,physical: number,cursor: number): ActionEvidence {
  const responseWindowBefore = structuredClone(runtime.responseWindow), responseExpired = expire(runtime,order*5);
  return { ...none(''),order,atSeconds:order*5,paidCost:0,physicalFactor:physical,rolls:[],randomCursorBefore:cursor,randomCursorAfter:cursor,
    playerSpiritualityAfter:runtime.playerS,enemySpiritualityAfter:runtime.enemyS,conditionVersionBefore:runtime.conditionVersion,conditionVersionAfter:runtime.conditionVersion,
    responseWindowBefore,responseWindowAfter:structuredClone(runtime.responseWindow),responseExpired };
}
function closeAction<T extends ActionEvidence>(a:T,runtime:Runtime,random:ActionRandomStream):T {
  a.randomCursorAfter=random.cursor;a.playerSpiritualityAfter=runtime.playerS;a.enemySpiritualityAfter=runtime.enemyS;a.conditionVersionAfter=runtime.conditionVersion;
  a.responseWindowAfter=structuredClone(runtime.responseWindow);a.label+=` 本槽后本人S${runtime.playerS}/120，原敌S${runtime.enemyS}/120，条件v${runtime.conditionVersion}。`;return a;
}
function playerAction(x:WisdomAngelCombatSource,runtime:Runtime,id:WisdomAngelMoveId,physical:number,order:number,random:ActionRandomStream):WisdomAngelPlayerAction {
  const a:WisdomAngelPlayerAction={...actionBase(runtime,order,physical,random.cursor),id,requiredObservations:[],consumedCraftId:null,attempted:false,succeeded:false,applied:false};
  const pay=(cost:number)=>{runtime.playerS-=cost;a.paidCost=cost;};
  const strike=(why='')=>{a.selfGain=(x.clubHeld?16:12)*physical;a.threatens=a.selfGain>0;a.label=`${why}本人以${x.clubHeld?'实际在手的原棍16':'自己的原身体12'}×身体普通打击G，0S，不补动作。`;};
  const evade=(why='')=>{a.enemyReduction=10;a.label=`${why}本人普通避让减势10G、0S，不预读未来动作或保证免伤。`;};
  const check=(difficulty:number)=>{const roll=random.nextInt(1,100);a.rolls.push(roll);return roll<=computeCheckChance({ability:'knowledge',baseAbility:x.knowledge,difficulty,modifiers:[]});};
  const current=runtime.observations.filter(v=>v.conditionVersion===runtime.conditionVersion);
  if(id==='STRIKE')strike();
  else if(id==='EVADE')evade();
  else if(id==='OBSERVE')a.label='本人普通观察，0贡献0S；没有亲见实际施法，不生成方法记录。';
  else if(id==='ACCIDENT'){a.selfGain=-22.5;a.label='判断失衡固定−22.5G。';}
  else if(id===SYNTHESIS||id===RESPONSE){
    const synthesis=id===SYNTHESIS,cost=synthesis?5:6,key=synthesis?'SYNTHESIS':'RESPONSE';
    a.requiredObservations=synthesis?['FLASH','WARD'].flatMap(power=>{const v=current.filter(o=>o.power===power).at(-1);return v?[structuredClone(v)]:[];}):current.length?[structuredClone(current.at(-1)!)]:[];
    if(a.requiredObservations.length!==(synthesis?2:1))evade(`当前条件v${runtime.conditionVersion}缺少${synthesis?'两种':'一种'}实际已见原术，未尝试新能力；`);
    else if(runtime.playerS<cost)strike(`不足${cost}S，未尝试新能力；`);
    else{pay(cost);a.attempted=true;runtime.uses[key].attempts++;a.succeeded=check(20);
      if(!a.succeeded)a.label=`只据当前条件实际记录作知识20检验失败，${cost}S照耗，0效果，不补重抽。`;
      else{runtime.uses[key].successes++;
        if(synthesis){a.selfGain=65;a.applied=true;runtime.uses.SYNTHESIS.effects++;a.label='5S/知识20条件综合成功：只综合当前条件实际FLASH与WARD，取得有限站位/方法优势65G；不是直接致伤、真相或未来答案。';}
        else{const observed=a.requiredObservations[0]!;runtime.responseWindow={openedRound:x.round,openedOrder:order,expiresAt:Math.min(60,order*5+20),conditionVersion:runtime.conditionVersion,targetPower:observed.power,observation:structuredClone(observed)};
          a.label=`6S/知识20成功，以最近实际已见${observed.power}开≤20秒应对窗，本槽0效果；下一实际敌槽消费，只有当前条件匹配且实付的原术减45G。`;}
      }
    }
  }else if(id===METHOD){
    const observed=runtime.observations.at(-1);if(observed)a.requiredObservations=[structuredClone(observed)];
    if(!observed)evade('本场尚未实际亲见FLASH/WARD，旧方法辨析未施放；');
    else if(runtime.playerS<5)strike('不足5S，旧方法辨析未施放；');
    else{pay(5);a.attempted=true;a.succeeded=check(18);if(a.succeeded){a.enemyReduction=35;a.applied=true;}a.label=`继承原方法辨析只用本场实际已见${observed.power}旧记录，5S/知识18${a.succeeded?'成功减35G':'失败，成本保留、0效果'}；不更新当前条件资料。`;}
  }else if(id===FLASH){
    if(!hasLearnedFlash(x.flashSample,x.week)||runtime.playerS<2)strike('缺少早先真实学会的原FLASH样本或不足2S；');
    else{pay(2);a.attempted=true;a.succeeded=check(14);if(a.succeeded){a.enemyReduction=12*(.65+.35*x.imitationMastery/500);a.applied=true;}
      a.label=`继承实际旧FLASH，2S/知识14${a.succeeded?'成功减12×旧掌握G':'失败，成本保留、0效果'}；不增加新样本。`;}
  }else{
    const craft=oldestPreparedFlash({...x,crafts:runtime.crafts});
    if(!craft)strike('没有仍持有且已安全测试报告的合格原微光片；');
    else{craft.status='CONSUMED';craft.usedWeek=x.week;a.consumedCraftId=craft.id;a.applied=true;a.enemyReduction=18*craft.power;
      a.label=`实际一次耗尽最早合格原片${craft.id}（原材料${craft.sourceKitId}），0额外S、减18×制作固定效力${craft.power}G；不补库存或改旧掌握。`;}
  }
  return closeAction(a,runtime,random);
}
function enemyAction(x:WisdomAngelCombatSource,runtime:Runtime,planned:WisdomAngelEnemyIntent,physical:number,order:number,random:ActionRandomStream):WisdomAngelEnemyAction {
  const a:WisdomAngelEnemyAction={...actionBase(runtime,order,physical,random.cursor),planned,actual:planned,observation:null,
    changedCondition:false,responseConsumed:false,responseApplied:false,responseInvalidated:false,responseReduction:0};
  const power=WISDOM_ANGEL_POWERS.find(v=>v.id===planned);
  if(power&&(runtime.enemyS<power.cost||planned==='FEINT'&&runtime.feintUsed))a.actual='BODY_STRIKE';
  if(power&&a.actual===planned){runtime.enemyS-=power.cost;runtime.powers[power.id]++;a.paidCost=power.cost;a.selfGain=power.selfGain;a.enemyReduction=power.enemyReduction;}
  const window=runtime.responseWindow;
  if(window){a.responseConsumed=true;runtime.responseWindow=null;
    if(a.actual==='FEINT')a.responseInvalidated=true;
    else if(window.conditionVersion===runtime.conditionVersion&&window.targetPower===a.actual&&a.paidCost>0){a.responseApplied=true;a.responseReduction=45;runtime.uses.RESPONSE.effects++;
      if(a.actual==='FLASH')a.selfGain-=45;else a.enemyReduction-=45;}
  }
  if(a.actual==='BODY_STRIKE'){a.selfGain=20*physical;a.threatens=a.selfGain>0;a.label=`${power?'资源不足或本轮已变招，同槽普通回退；':''}维克托持唯一WA2-VICTOR-CLUB普通打击20×身体G，原身体始终2米可达。`;}
  else if(a.actual==='ACCIDENT'){a.selfGain=-22.5;a.label='原维克托判断偏差，固定−22.5G。';}
  else if(a.actual==='FEINT'){runtime.feintUsed=true;runtime.conditionVersion++;a.changedCondition=true;
    a.label='原维克托实付3S，本轮一次实际改变动作节奏；条件版本+1，当前应对窗终止，旧观察保留但不再是新条件证据；不撤销此前已结算效果。';}
  else{a.threatens=a.actual==='FLASH';a.observation={power:a.actual,round:x.round,order,atSeconds:x.clockSeconds+order*5,conditionVersion:runtime.conditionVersion,paidCost:a.actual==='FLASH'?7:6};
    runtime.observations.push(structuredClone(a.observation));a.label=`原${a.actual}实际支付${a.paidCost}S，${a.actual==='FLASH'?`有限优势${a.selfGain}`:`有限减势${a.enemyReduction}`}G；完成实际施展后才登记当前条件亲见记录，不能倒用于先前玩家槽。`;}
  if(a.responseConsumed)a.label+=a.responseApplied?' 现存应对窗仅对本次匹配实付原术实际减45G并消耗。':a.responseInvalidated?' 现存窗口因实际变招失效，0应用。':' 下一实际敌槽与窗口目标不匹配，窗口消耗、0应用。';
  return closeAction(a,runtime,random);
}
function commitRuntime(s:SliceState,r:WisdomAngelRoundContext):void{
  const e=s.wisdomAngel.encounter;s.spirituality=r.runtime.playerS;e.enemySpirituality=r.runtime.enemyS;e.powerUses={...r.runtime.powers};e.abilityUses=structuredClone(r.runtime.uses);
  e.conditionVersion=r.runtime.conditionVersion;e.observations=structuredClone(r.runtime.observations);e.responseWindow=structuredClone(r.runtime.responseWindow);
  // Update only the actual original object that was consumed; preserve the old array and every unrelated field/object.
  for(const after of r.runtime.crafts){const original=s.mysticismMagister.crafts.find(c=>c.id===after.id);if(original&&original.status!==after.status){original.status=after.status;original.usedWeek=after.usedWeek;}}
  r.liveState=liveState(s);
}
const physicalAt=(health:number):number=>health>75?1:health>50?.95:health>25?.9:.8;
export function resolveWisdomAngelCombatAbility(s:SliceState,id:WisdomAngelMoveId,physical:number,random:ActionRandomStream,r:WisdomAngelRoundContext,source:WisdomAngelCombatSource|null=r.source):WisdomAngelCombatEffect{
  if(!validRound(s,r,source)||r.playerActions.length>=6||physical!==physicalAt(r.source.playerHealth)||random.seed!==r.source.randomSeed||
    ![...ABILITIES.map(v=>v.id),'EVADE','OBSERVE','ACCIDENT'].includes(id))return none('缺少当前原身体/条件/资源来源，0贡献0消耗，不重抽。');
  const a=playerAction(r.source,r.runtime,id,physical,r.playerActions.length+r.enemyActions.length,random);r.playerActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export function resolveWisdomAngelEnemyAbility(s:SliceState,planned:WisdomAngelEnemyIntent,physical:number,random:ActionRandomStream,r:WisdomAngelRoundContext,source:WisdomAngelCombatSource|null=r.source):WisdomAngelCombatEffect{
  if(!validRound(s,r,source)||r.enemyActions.length>=6||physical!==physicalAt(r.source.enemyHealth)||random.seed!==r.source.randomSeed||
    ![...WISDOM_ANGEL_POWER_IDS,'BODY_STRIKE','ACCIDENT'].includes(planned))return none('缺少当前原维克托/原棍/实际资源来源，0贡献0消耗，不重抽。');
  const a=enemyAction(r.source,r.runtime,planned,physical,r.playerActions.length+r.enemyActions.length,random);r.enemyActions.push(a);commitRuntime(s,r);return{label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction,threatens:a.threatens,mentalPressure:false};
}
export interface WisdomAngelRoundOutcome{
  targetId:typeof WISDOM_ANGEL_TARGET_ID;round:number;source:WisdomAngelCombatSource;stance:SliceStance;continuing:boolean;
  enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';
  playerSpiritualityBefore:number;playerSpiritualityAfter:number;playerHealthAfter:number;playerMindAfter:number;enemySpiritualityBefore:number;
  playerInjuriesAfter:SliceInjury[];enemyInjuriesAfter:SliceInjury[];playerRiskAfter:number;enemyRiskAfter:number;
  powerUses:Record<WisdomAngelPowerId,number>;abilityUses:WisdomAngelAbilityUses;conditionVersion:number;observations:WisdomAngelObservation[];
  craftsAfter:MysticismMagisterCraft[];consumedCraftIds:string[];responseWindowBeforeClose:WisdomAngelResponseWindow|null;responseWindowAfter:null;feintUsed:boolean;
  elapsedSeconds:60|62;playerLocationAfter:'DOORSTEP'|'OUTSIDE';playerTravelMetresAfter:number;clockSecondsAfter:number;randomCursorAfter:number;
  playerActions:WisdomAngelPlayerAction[];enemyActions:WisdomAngelEnemyAction[];
}
export function finishWisdomAngelCombatRound(s:SliceState,r:WisdomAngelRoundContext,continuing=true,randomCursorAfter=s.random.cursor):WisdomAngelRoundOutcome{
  const e=s.wisdomAngel.encounter,c=s.combat;
  if(r.finished||!c||c.encounterId!=='WISDOM_ANGEL_DISPUTE'||c.round!==r.source.round||r.liveState!==liveState(s))throw new Error('原智慧天使候选G回合已结束或资源被改写。');
  e.enemyHealth=c.enemyHealth;e.enemyMind=c.enemyMind;e.enemyStatus=c.enemyStatus;e.enemyInjuries=structuredClone(c.enemyInjuries);e.enemyRisk=c.enemyRisk;
  if(e.enemyStatus!=='RESISTING')e.weaponLocation='YARD';
  const responseWindowBeforeClose=structuredClone(r.runtime.responseWindow);expire(r.runtime,60);r.runtime.responseWindow=null;e.responseWindow=null;
  const leave=!continuing&&s.health>0;if(leave){if(e.room.doorStatus!=='OPEN'||e.playerLocation!=='DOORSTEP')throw new Error('原门不通，不能以知识能力瞬移离场。');e.playerLocation='OUTSIDE';e.playerTravelMetres+=2;}
  const elapsedSeconds=leave?62:60;e.clockSeconds+=elapsedSeconds;r.finished=true;
  r.outcome={targetId:WISDOM_ANGEL_TARGET_ID,round:c.round,source:structuredClone(r.source),stance:r.stance,continuing,
    enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,enemyStatus:c.enemyStatus,
    playerSpiritualityBefore:r.source.playerSpirituality,playerSpiritualityAfter:s.spirituality,playerHealthAfter:s.health,playerMindAfter:s.mind,enemySpiritualityBefore:r.source.enemySpirituality,
    playerInjuriesAfter:structuredClone(s.injuries),enemyInjuriesAfter:structuredClone(c.enemyInjuries),playerRiskAfter:s.injuryRisk,enemyRiskAfter:c.enemyRisk,
    powerUses:{...e.powerUses},abilityUses:structuredClone(e.abilityUses),conditionVersion:e.conditionVersion,observations:structuredClone(e.observations),
    craftsAfter:structuredClone(s.mysticismMagister.crafts),consumedCraftIds:r.playerActions.flatMap(a=>a.consumedCraftId?[a.consumedCraftId]:[]),
    responseWindowBeforeClose,responseWindowAfter:null,feintUsed:r.runtime.feintUsed,elapsedSeconds,playerLocationAfter:e.playerLocation,playerTravelMetresAfter:e.playerTravelMetres,clockSecondsAfter:e.clockSeconds,randomCursorAfter,
    playerActions:structuredClone(r.playerActions),enemyActions:structuredClone(r.enemyActions)};return structuredClone(r.outcome);
}
export function wisdomAngelRoundOutcome(r:WisdomAngelRoundContext):WisdomAngelRoundOutcome{if(!r.outcome)throw new Error('先实际结束当前原回合。');return structuredClone(r.outcome);}
export function projectWisdomAngelCombat(s:SliceState){
  const e=s.wisdomAngel.encounter,visible=isWisdomAngel(s),last=s.combat?.encounterId==='WISDOM_ANGEL_DISPUTE'?s.combat.lastRound?.wisdomAngelOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.wisdomAngelOutcome:null;
  return{enemyName:visible?'维克托（49岁）':'',targetId:visible?e.targetId:null,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,maxSpirituality:120,
    enemyHealth:visible?e.enemyHealth:null,enemyMind:visible?e.enemyMind:null,enemySpirituality:visible?e.enemySpirituality:null,powerUses:visible?{...e.powerUses}:null,
    abilityUses:visible?structuredClone(e.abilityUses):null,conditionVersion:e.conditionVersion,observations:visible?structuredClone(e.observations):[],currentObservations:visible?structuredClone(e.observations.filter(o=>o.conditionVersion===e.conditionVersion)):[],
    responseWindow:visible?structuredClone(e.responseWindow):null,responseRemainingSeconds:0,room:visible?{...e.room}:null,playerLocation:e.playerLocation,playerTravelMetres:e.playerTravelMetres,clockSeconds:e.clockSeconds,
    crafts:visible?structuredClone(s.mysticismMagister.crafts):[],remainingCraftIds:visible?s.mysticismMagister.crafts.filter(c=>c.status==='PLAYER').map(c=>c.id):[],
    windowStatus:'回合结算边界：应对窗已实际收束；下次仍须当前条件的真实已见证据与付费检验。',
    lastWindowSequence:visible&&last?[...last.playerActions.map(a=>({...structuredClone(a),actor:'PLAYER' as const})),...last.enemyActions.map(a=>({...structuredClone(a),actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order):[],
    originalExit:e.room.doorStatus==='OPEN',pursuit:false,distanceMetres:2,source:visible?currentWisdomAngelCombatSource(s):null,
    countWheel:WISDOM_ANGEL_COUNT_WHEEL.map(x=>({...x})),enemyCountWheel:WISDOM_ANGEL_ENEMY_COUNT_WHEEL.map(x=>({...x})),enemyAbilityWheel:WISDOM_ANGEL_ENEMY_ABILITY_WHEEL.map(x=>({...x})),
    summary:visible?'智慧天使·阅读者序列2候选，名称编号与新能力未原著核实，全部新量化为G。继承35/25/25/15核心、1250/底125、S120，仅继续轮恢复12。每槽5秒、轮60秒；综合须当前条件已见两种原术，应对只影响后续匹配实际付费原术。3S变招每轮一次，条件改变不改旧结果。原FLASH样本与原微光片有真实来源、成本及耗尽；原人原物与共同伤势保留。':''};
}

const SOURCE_KEYS=['runId','revision','week','round','encounterId','targetId','attemptWeek','startHistoryIndex','targetAge','targetSequence','targetCore','actualOriginalBody','independentMind','enemyWeapon','weaponLocation','distanceMetres','space','door','doorStatus','playerLocation','ordinaryExit','pursuit','playerTravelMetres','clockSeconds','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','clubHeld','physique','perception','knowledge','will','imitationMastery','powerUses','abilityUses','conditionVersion','observations','flashSample','crafts','craftingPromotionWeek','craftingCaseStatus','kitsUsed','randomSeed','randomCursor'] as const;
export function validateWisdomAngelAbilityUses(v:WisdomAngelAbilityUses):boolean{
  return shape(v,['SYNTHESIS','RESPONSE'])&&Object.values(v).every(u=>shape(u,['attempts','successes','effects'])&&integer(u.attempts)&&integer(u.successes,0,u.attempts)&&integer(u.effects,0,u.successes))&&v.SYNTHESIS.effects===v.SYNTHESIS.successes;
}
export function validateWisdomAngelObservations(v:WisdomAngelObservation[],version:number,powers:Record<WisdomAngelPowerId,number>,maxRound:number):boolean{
  if(!Array.isArray(v)||!integer(version,1)||version!==powers.FEINT+1||!integer(maxRound))return false;
  return v.every((o,i)=>shape(o,['power','round','order','atSeconds','conditionVersion','paidCost'])&&['FLASH','WARD'].includes(o.power)&&integer(o.round,1,maxRound)&&integer(o.order,0,11)&&
    o.atSeconds===2+(o.round-1)*60+o.order*5&&integer(o.conditionVersion,1,version)&&o.paidCost===(o.power==='FLASH'?7:6)&&
    (i===0||(v[i-1]!.round<o.round||v[i-1]!.round===o.round&&v[i-1]!.order<o.order)&&v[i-1]!.conditionVersion<=o.conditionVersion))&&
    v.filter(o=>o.power==='FLASH').length===powers.FLASH&&v.filter(o=>o.power==='WARD').length===powers.WARD;
}
function validInjuries(v:SliceInjury[],revision:number):boolean{
  return Array.isArray(v)&&new Set(v.map(i=>i.id)).size===v.length&&v.every(i=>shape(i,['id','severity','acquiredRevision','treatedRevision'])&&typeof i.id==='string'&&i.id.length>0&&['LIGHT','HEAVY'].includes(i.severity)&&integer(i.acquiredRevision,1,revision)&&(i.treatedRevision===null||integer(i.treatedRevision,i.acquiredRevision,revision)));
}
function validSample(sample:PolymathSampleState,week:number):boolean{
  return shape(sample,['observedWeek','understoodWeek','learnedWeek','analysisAttemptWeek'])&&Object.values(sample).every(w=>w===null||integer(w,1,week))&&
    (sample.understoodWeek===null||sample.observedWeek!==null&&sample.observedWeek<=sample.understoodWeek)&&
    (sample.analysisAttemptWeek===null||sample.observedWeek!==null&&sample.observedWeek<=sample.analysisAttemptWeek)&&
    (sample.learnedWeek===null||hasLearnedFlash(sample,week));
}
function validCrafts(x:WisdomAngelCombatSource):boolean{
  return Array.isArray(x.crafts)&&integer(x.kitsUsed)&&(x.craftingPromotionWeek===null||integer(x.craftingPromotionWeek,1,x.week))&&
    ['AVAILABLE','OBSERVED','PREPARED','EXAMINED','RESOLVED'].includes(x.craftingCaseStatus)&&new Set(x.crafts.map(c=>c.id)).size===x.crafts.length&&new Set(x.crafts.map(c=>c.sourceKitId)).size===x.crafts.length&&
    x.crafts.every(c=>{const kit=/^MM5-KIT-([1-9]\d*)$/.exec(c.sourceKitId);return shape(c,['id','sourceKitId','createdWeek','usedWeek','status','power'])&&kit!==null&&integer(Number(kit[1]),1,x.kitsUsed)&&c.id===`MM5-FLASH-${kit[1]}`&&
      integer(x.craftingPromotionWeek,1,x.week)&&integer(c.createdWeek,x.craftingPromotionWeek,x.week)&&Number.isFinite(c.power)&&c.power>=.65&&c.power<=1&&
      (c.status==='PLAYER'?c.usedWeek===null:c.status==='CONSUMED'&&integer(c.usedWeek,c.createdWeek,x.week));});
}
function validSource(x:WisdomAngelCombatSource):boolean{
  return shape(x,SOURCE_KEYS)&&typeof x.runId==='string'&&x.runId.length>0&&integer(x.revision)&&integer(x.week,1)&&integer(x.round,1)&&integer(x.startHistoryIndex)&&x.attemptWeek===x.week&&
    x.encounterId==='WISDOM_ANGEL_DISPUTE'&&x.targetId===WISDOM_ANGEL_TARGET_ID&&x.targetAge===49&&x.targetSequence===2&&x.targetCore===24&&x.actualOriginalBody===true&&x.independentMind===true&&
    x.enemyWeapon==='WA2-VICTOR-CLUB'&&x.weaponLocation==='HAND'&&x.distanceMetres===2&&x.space==='WA2-COURT'&&x.door==='WA2-COURT-DOOR'&&x.doorStatus==='OPEN'&&x.playerLocation==='DOORSTEP'&&x.ordinaryExit===true&&x.pursuit===false&&
    x.playerTravelMetres===2&&x.clockSeconds===2+(x.round-1)*60&&[x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n=>integer(n,1,100))&&x.enemyMind===100&&
    [x.playerSpirituality,x.enemySpirituality].every(n=>integer(n,0,120))&&[x.physique,x.perception,x.knowledge,x.will,x.imitationMastery].every(n=>integer(n,0,500))&&typeof x.clubHeld==='boolean'&&
    integer(x.playerRisk)&&integer(x.enemyRisk)&&validInjuries(x.playerInjuries,x.revision)&&validInjuries(x.enemyInjuries,x.revision)&&
    shape(x.powerUses,WISDOM_ANGEL_POWER_IDS)&&WISDOM_ANGEL_POWER_IDS.every(id=>integer(x.powerUses[id]))&&x.powerUses.FEINT<=x.round-1&&
    x.enemySpirituality===120-WISDOM_ANGEL_POWERS.reduce((n,p)=>n+p.cost*x.powerUses[p.id],0)&&validateWisdomAngelAbilityUses(x.abilityUses)&&x.abilityUses.SYNTHESIS.attempts+x.abilityUses.RESPONSE.attempts<=6*(x.round-1)&&
    validateWisdomAngelObservations(x.observations,x.conditionVersion,x.powerUses,x.round-1)&&validSample(x.flashSample,x.week)&&validCrafts(x)&&
    typeof x.randomSeed==='string'&&x.randomSeed.length>0&&x.randomSeed.length<=256&&integer(x.randomCursor);
}

/** Same common formula, expressed using the source snapshot so historical validation never reads new stats. */
function sourcePenalty(current: number, maximum: number): number {
  const fraction = Math.max(0, Math.min(1, current / maximum));
  return fraction > .75 ? 0 : fraction > .5 ? .05 : fraction > .25 ? .1 : .2;
}
function sourceBase(core: number, health: number, mind: number, spirituality: number): number {
  const penalty = Math.min(.4, sourcePenalty(health,100) + sourcePenalty(mind,100) + sourcePenalty(spirituality,120));
  return (1250 + Math.min(core,1250 * .2)) * (1 - penalty);
}
function sourceWeights(risk: number): { light: number; heavy: number; death: number } {
  const death = Math.min(100,5 + Math.min(risk,10) * 10), shifted = death - 5;
  return { light: Math.max(0,65 - shifted), heavy: Math.max(0,30 - Math.max(0,shifted - 65)), death };
}
interface ReplayedRound {
  outcome: WisdomAngelRoundOutcome; playerCount: number; enemyCount: number; playerCountRoll: number; enemyCountRoll: number;
  first: 'PLAYER' | 'ENEMY'; retreat: 'NONE' | 'SUCCESS' | 'FAILURE'; winner: 'PLAYER' | 'ENEMY';
  playerAdvantage: number; enemyAdvantage: number; winChance: number; consequenceWeights: { light: number; heavy: number; death: number } | null; consequenceRoll?: number;
}
function replayOutcome(o: WisdomAngelRoundOutcome): ReplayedRound | null {
  const x = o?.source;
  if (!x || !validSource(x) || !['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(o.stance) || !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6) return null;
  const rng = new DeterministicActionRandomStream(x.randomSeed,x.randomCursor), runtime = makeRuntime(x);
  const playerCountRoll = rng.nextInt(1,100), enemyCountRoll = rng.nextInt(1,100), playerCount = wisdomAngelActionCount(playerCountRoll), enemyCount = wisdomAngelEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER','ENEMY'] as const : ['ENEMY','PLAYER'] as const;
  const remaining = { PLAYER: playerCount, ENEMY: enemyCount }, players: WisdomAngelPlayerAction[] = [], enemies: WisdomAngelEnemyAction[] = [];
  let retreat: ReplayedRound['retreat'] = 'NONE';
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && o.stance === 'RETREAT') {
        remaining.PLAYER = 0; retreat = rng.nextInt(1,100) <= 50 ? 'SUCCESS' : 'FAILURE';
        if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue;
      }
      remaining[actor]--;
      if (actor === 'PLAYER') players.push(playerAction(x,runtime,drawPlayer(rng,o.stance),physicalAt(x.playerHealth),players.length + enemies.length,rng));
      else enemies.push(enemyAction(x,runtime,drawWisdomAngelEnemyAbility(rng),physicalAt(x.enemyHealth),players.length + enemies.length,rng));
    }
  }
  if (!same(players,o.playerActions) || !same(enemies,o.enemyActions)) return null;
  const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n,a) => n + a[key],0);
  const playerAdvantage = Math.max(125,sourceBase(x.physique*.35+x.perception*.25+x.will*.25+x.knowledge*.15,x.playerHealth,x.playerMind,x.playerSpirituality) + sum(players,'selfGain') - sum(enemies,'enemyReduction'));
  const enemyAdvantage = Math.max(125,sourceBase(24,x.enemyHealth,x.enemyMind,x.enemySpirituality) + sum(enemies,'selfGain') - sum(players,'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100;
  const winner = retreat === 'SUCCESS' ? 'ENEMY' : rng.nextInt(1,1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = x.playerHealth, enemyHealth = x.enemyHealth, playerRisk = x.playerRisk, enemyRisk = x.enemyRisk;
  let enemyStatus: WisdomAngelRoundOutcome['enemyStatus'] = 'RESISTING', continuing = retreat !== 'SUCCESS';
  const playerInjuries = structuredClone(x.playerInjuries), enemyInjuries = structuredClone(x.enemyInjuries);
  let consequenceWeights: ReplayedRound['consequenceWeights'] = null, consequenceRoll: number | undefined;
  if (retreat !== 'SUCCESS') {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', injuries = loser === 'PLAYER' ? playerInjuries : enemyInjuries;
    let risk = loser === 'PLAYER' ? playerRisk : enemyRisk;
    if (injuries.length) risk++;
    if (loser === 'PLAYER') playerRisk = risk; else enemyRisk = risk;
    const threatened = loser === 'PLAYER' ? enemies.some(a => a.threatens) : players.some(a => a.threatens);
    if (threatened) {
      consequenceWeights = sourceWeights(risk); consequenceRoll = rng.nextInt(1,100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { enemyHealth = 0; enemyStatus = 'DEAD'; } continuing = false; }
      else {
        injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30;
        if (loser === 'PLAYER') playerHealth = Math.max(0,playerHealth - damage); else enemyHealth = Math.max(0,enemyHealth - damage);
        if (playerHealth === 0 || enemyHealth === 0) { if (enemyHealth === 0) enemyStatus = 'DEAD'; continuing = false; }
        else if (loser === 'ENEMY' && severity === 'HEAVY') { enemyStatus = 'SURRENDERED'; continuing = false; }
      }
    }
  }
  const responseWindowBeforeClose = structuredClone(runtime.responseWindow);
  expire(runtime,60);
  const leave = !continuing && playerHealth > 0, elapsedSeconds = leave ? 62 : 60;
  const expected: WisdomAngelRoundOutcome = { targetId: WISDOM_ANGEL_TARGET_ID, round: x.round, source: structuredClone(x), stance: o.stance, continuing,
    enemyHealth, enemyMind: x.enemyMind, enemySpirituality: runtime.enemyS, enemyStatus, playerSpiritualityBefore: x.playerSpirituality,
    playerSpiritualityAfter: runtime.playerS, playerHealthAfter: playerHealth, playerMindAfter: x.playerMind, enemySpiritualityBefore: x.enemySpirituality,
    playerInjuriesAfter: playerInjuries, enemyInjuriesAfter: enemyInjuries, playerRiskAfter: playerRisk, enemyRiskAfter: enemyRisk,
    powerUses: runtime.powers, abilityUses: runtime.uses, conditionVersion: runtime.conditionVersion, observations: runtime.observations,
    craftsAfter: runtime.crafts, consumedCraftIds: players.flatMap(a => a.consumedCraftId ? [a.consumedCraftId] : []),
    responseWindowBeforeClose, responseWindowAfter: null, feintUsed: runtime.feintUsed, elapsedSeconds, playerLocationAfter: leave ? 'OUTSIDE' : 'DOORSTEP', playerTravelMetresAfter: x.playerTravelMetres + (leave ? 2 : 0),
    clockSecondsAfter: x.clockSeconds + elapsedSeconds, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies };
  if (!same(o,expected)) return null;
  return { outcome: expected,playerCount,enemyCount,playerCountRoll,enemyCountRoll,first,retreat,winner,playerAdvantage,enemyAdvantage,winChance,consequenceWeights,
    ...(consequenceRoll === undefined ? {} : { consequenceRoll }) };
}
/** Exact deterministic replay validates action order, every RNG draw, expiry, costs, actual effects, injuries and the terminal result. */
export function validateWisdomAngelRoundOutcome(value: unknown): value is WisdomAngelRoundOutcome {
  try { return replayOutcome(value as WisdomAngelRoundOutcome) !== null; } catch { return false; }
}
export function validateWisdomAngelCombatRound(round: SliceCombatRound): boolean {
  try {
    const o = round.wisdomAngelOutcome, replay = o ? replayOutcome(o) : null;
    if (!o || !replay || round.round !== o.round || round.stance !== o.stance || typeof round.consequence !== 'string') return false;
    for (const key of ['playerCount','enemyCount','playerCountRoll','enemyCountRoll','first','retreat','winner','playerAdvantage','enemyAdvantage','winChance','consequenceWeights','consequenceRoll'] as const)
      if (!same(round[key],replay[key])) return false;
    const moves = [...o.playerActions.map(a => ({ ...a,actor: 'PLAYER' as const })),...o.enemyActions.map(a => ({ ...a,actor: 'ENEMY' as const }))].sort((a,b) => a.order-b.order)
      .map(a => ({ actor: a.actor,label: a.label,selfGain: a.selfGain,enemyReduction: a.enemyReduction }));
    return same(round.moves,moves);
  } catch { return false; }
}
