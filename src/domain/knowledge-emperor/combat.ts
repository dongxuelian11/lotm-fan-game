import { publicKnowledgeEmperorCombatNote, publicKnowledgeEmperorMark, publicKnowledgeEmperorForceReceipt } from './encounter.js';
import { publicPryerFields, publicPryerInjury, publicPryerScroll, publicPryerWorkshop, publicSageSite } from '../sage/life.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { ScrollProfessorScroll, ScrollProfessorWorkshop } from '../scroll-professor/types.js';
import type { SageSiteState } from '../sage/life.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { WIZARD_ABILITY_IDS } from '../wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS } from '../scroll-professor/types.js';
import { STAR_MYSTIC_ABILITY_IDS } from '../star-mystic/types.js';
import { MYSTIC_ABILITY_IDS } from '../mystic/types.js';
import { PROPHECY_MASTER_ABILITY_IDS } from '../prophecy-master/types.js';
import { SAGE_ABILITY_IDS } from '../sage/types.js';
import { validateKnowledgeEmperorCurrentSite, type KnowledgeEmperorOriginals } from './life.js';
import { KNOWLEDGE_EMPEROR_TARGET_ID, KNOWLEDGE_EMPEROR_SITE, KNOWLEDGE_EMPEROR_POWER_IDS, KNOWLEDGE_EMPEROR_POWERS, KNOWLEDGE_EMPEROR_POLICIES,
  hasKnowledgeEmperorDisputeOpponent, validateKnowledgeEmperorPreparation, validKnowledgeEmperorCombatNote, validKnowledgeEmperorMarks, knowledgeEmperorEncounterBudget, knowledgeEmperorFinanceSnapshot,
  type KnowledgeEmperorPreparation, type KnowledgeEmperorEnemyIntent, type KnowledgeEmperorPowerId, type KnowledgeEmperorPolicy, type KnowledgeEmperorCombatNote, type KnowledgeEmperorMark, type KnowledgeEmperorForceReceipt,
  type KnowledgeEmperorEncounterBudget, type KnowledgeEmperorFinanceSnapshot } from './encounter.js';

export const KNOWLEDGE_EMPEROR_COUNT_WHEEL=PYROMANIAC_COUNT_WHEEL;
export const KNOWLEDGE_EMPEROR_ENEMY_COUNT_WHEEL=PYROMANIAC_COUNT_WHEEL;
export const knowledgeEmperorActionCount=pyromaniacActionCount;
export const knowledgeEmperorEnemyActionCount=pyromaniacActionCount;
const FORM='hermit.s2.information-form', SIFT='hermit.s2.information-sift', IMPACT='hermit.s6.scrollcraft', BODY='BODY_FOLLOWUP', WARD='BRIEF_WARD', CAGE='hermit.s5.star-cage', ECHO='hermit.s4.mystical-reenactment', GLIMPSE='hermit.s3.prophetic-glimpse';
export const KNOWLEDGE_POWER='hermit.s1.knowledge-power', POWER_KNOWLEDGE='hermit.s1.power-knowledge';
const INHERITED_IDS=[...PRYER_ABILITY_IDS,...COMBAT_SCHOLAR_ABILITY_IDS,...WIZARD_ABILITY_IDS,...SCROLL_PROFESSOR_ABILITY_IDS,...STAR_MYSTIC_ABILITY_IDS,...MYSTIC_ABILITY_IDS,...PROPHECY_MASTER_ABILITY_IDS,...SAGE_ABILITY_IDS];
export type KnowledgeEmperorMoveId=typeof FORM|typeof SIFT|typeof IMPACT|typeof BODY|typeof WARD|typeof CAGE|typeof ECHO|typeof GLIMPSE|typeof KNOWLEDGE_POWER|typeof POWER_KNOWLEDGE|'ACCIDENT';
/** The actual nine Sage slots retain their relative tickets. The new two add20 each. */
const ABILITIES:readonly {id:KnowledgeEmperorMoveId;label:string;weight:number;stance:SliceStance|null}[]=[
 {id:IMPACT,label:'原冲力卷1灵性／本人已学冲力2灵性／实际棍或身体，继承预算',weight:30,stance:'ATTACK'},
 {id:BODY,label:'继承实练次击，沿用旧掌握与实际身体',weight:15,stance:'ATTACK'},
 {id:WARD,label:'原防护卷1灵性／本人已学防护2灵性／普通格挡，继承预算',weight:20,stance:'DEFEND'},
 {id:CAGE,label:'旧星光牢笼3灵性，知识14；下一身体棍击减半',weight:15,stance:'CONTROL'},
 {id:ECHO,label:'本人已学迟钟回声4灵性，知识18；沿用原公开程度',weight:10,stance:'PREPARE'},
 {id:GLIMPSE,label:'模糊预兆6灵性2精神，知识18；下一真实威胁×0.7',weight:5,stance:'PREPARE'},
 {id:'ACCIDENT',label:'动作偏差，优势−22.5',weight:5,stance:null},
 {id:FORM,label:'有限信息化6灵性2精神6精力；随后一次身体攻势最多减45',weight:20,stance:'DEFEND'},
 {id:SIFT,label:'筛取眼前棍势6灵性2精神；可能误读或抵抗，只准备下一真实攻击',weight:20,stance:'PREPARE'},
 {id:KNOWLEDGE_POWER,label:'知识赋力8灵性2精神，知识18；20秒内下一普通打击+35，实际用新便笺1次',weight:20,stance:'ATTACK'},
 {id:POWER_KNOWLEDGE,label:'循力求知8灵性2精神，知识18；须20秒内真实已付费力量凭据，下一同类冲击减30',weight:20,stance:'DEFEND'},
];
export const KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL:readonly SliceWheelEntry[]=[
 {id:'ARC_BOLT',label:'实际7灵性与1枚印记，身体弧光75；无资源普通棍击',weight:25},
 {id:'DREAD_MARK',label:'实际7灵性与1枚印记，精神压力65；无资源普通棍击',weight:20},
 {id:'WARD',label:'4灵性，一次屏护减随后真实攻击30',weight:20},
 {id:'BODY_STRIKE',label:'唯一原棍20×实际身体状态',weight:20},
 {id:'FEINT',label:'有窗口时3灵性真实遮挡变势，清除窗口；否则普通观察',weight:10},
 {id:'ACCIDENT',label:'实际失衡，无伤害与消耗',weight:5},
];
export const isKnowledgeEmperor=(s:SliceState)=>s.progression.pathwayId==='hermit'&&s.progression.sequence===1;
function enabled(id:KnowledgeEmperorMoveId,p:KnowledgeEmperorPolicy):boolean {if(p==='ORDINARY')return [IMPACT,BODY,WARD,'ACCIDENT'].includes(id);if(id===KNOWLEDGE_POWER)return p==='ALL'||p==='KNOWLEDGE_POWER';if(id===POWER_KNOWLEDGE)return p==='ALL'||p==='POWER_KNOWLEDGE';return true;}
function tickets(stance:SliceStance|null,p:KnowledgeEmperorPolicy){return ABILITIES.map(a=>enabled(a.id,p)?a.weight*(stance!==null&&a.stance===stance?5:4):0);}
export function knowledgeEmperorAbilityWheel(s:SliceState,stance:SliceStance|null):SliceWheelEntry[]{const p=s.knowledgeEmperor.encounter.policy,ws=tickets(stance,p),total=ws.reduce((n,w)=>n+w,0);return ABILITIES.flatMap((a,i)=>ws[i]===0?[]:[{id:a.id,weight:ws[i]!/total*100,label:p==='ORDINARY'&&a.id!==BODY&&a.id!=='ACCIDENT'?'只用实际身体、原棍或普通格挡，0灵性':stance==='DEFEND'&&(a.id===IMPACT||a.id===BODY)?'整轮专心防守，不攻击、不烧原卷':a.id===ECHO&&!s.mystic.life.echoLearned?'未实际学会迟钟回声，只普通观察':a.label}]);}
function drawPlayer(random:ActionRandomStream,stance:SliceStance|null,p:KnowledgeEmperorPolicy):KnowledgeEmperorMoveId {const ws=tickets(stance,p);let n=random.nextInt(1,ws.reduce((a,b)=>a+b,0));for(const[i,a]of ABILITIES.entries()){n-=ws[i]!;if(n<=0)return a.id;}throw new Error('能力盘无效。');}
export function drawKnowledgeEmperorAbility(random:ActionRandomStream,s:SliceState,stance:SliceStance|null){return drawPlayer(random,stance,s.knowledgeEmperor.encounter.policy);}
export function drawKnowledgeEmperorEnemyAbility(random:ActionRandomStream):KnowledgeEmperorEnemyIntent {let n=random.nextInt(1,100);for(const a of KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL){n-=a.weight;if(n<=0)return a.id as KnowledgeEmperorEnemyIntent;}throw new Error('对手盘无效。');}
export interface KnowledgeEmperorCombatSource {
 runId:string;revision:number;week:number;round:number;encounterId:'KNOWLEDGE_EMPEROR_DISPUTE';targetId:typeof KNOWLEDGE_EMPEROR_TARGET_ID;targetName:'达里安·洛克';targetAge:44;targetSequence:1;targetCore:24;
 maxActionCount:6;attemptWeek:number;startHistoryIndex:number;actualBody:true;independentMind:true;enemyWeapon:'KE1-DARIAN-ROD';weaponLocation:'HAND';yardId:typeof KNOWLEDGE_EMPEROR_SITE;playerPosition:'YARD';enemyDistanceMetres:2;ordinaryExit:'OPEN';pursuit:false;thirdPartiesInArea:0;automaticAllyImmunity:false;
 playerHealth:number;playerMind:number;playerSpirituality:number;enemyHealth:number;enemyMind:number;enemySpirituality:number;playerInjuries:SliceInjury[];enemyInjuries:SliceInjury[];playerRisk:number;enemyRisk:number;
 preparation:KnowledgeEmperorPreparation;site:SageSiteState;workshop:ScrollProfessorWorkshop;originals:KnowledgeEmperorOriginals;budget:KnowledgeEmperorEncounterBudget;finance:KnowledgeEmperorFinanceSnapshot;
 inheritedMastery:Record<string,number>;mastery:Record<string,number>;clubHeld:boolean;playerClubId:'town-short-club'|null;learnedImpact:boolean;learnedWard:boolean;echoLearned:boolean;publicDisclosed:boolean;
 physique:number;perception:number;knowledge:number;will:number;policy:KnowledgeEmperorPolicy;powerUses:Record<KnowledgeEmperorPowerId,number>;note:KnowledgeEmperorCombatNote;marks:KnowledgeEmperorMark[];lastForceReceipt:KnowledgeEmperorForceReceipt|null;conditionVersion:number;clockSeconds:number;randomSeed:string;randomCursor:number;
}
export interface KnowledgeEmperorCombatEffect {label:string;selfGain:number;enemyReduction:number;threatens:boolean;mentalPressure:boolean}
interface ActionEvidence extends KnowledgeEmperorCombatEffect {order:number;atSeconds:number;elapsedSeconds:5;paidCost:number;mindCost:number;physicalFactor:number;rolls:number[];randomCursorBefore:number;randomCursorAfter:number;playerHealthAfter:number;playerMindAfter:number;playerSpiritualityAfter:number;enemySpiritualityAfter:number;chargeGranted:boolean;chargeConsumedByOrder:number|null;chargeCancelledByOrder:number|null;appliedAmount:number;consumedEffectOrders:number[];expiresAt:number|null;receipt:KnowledgeEmperorForceReceipt|null;conditionVersion:number;noteChargePaid:number;noteWearPaid:number;masteryApplied:string[]}
export interface KnowledgeEmperorPlayerAction extends ActionEvidence {id:KnowledgeEmperorMoveId;attempted:boolean;succeeded:boolean;applied:boolean;resisted:boolean;mode:string;prepared:'FORM'|'SIFT'|'CAGE'|'ECHO'|'GLIMPSE'|'KNOWLEDGE_POWER'|'POWER_KNOWLEDGE'|null;formEnergyPaid:number;exposurePaid:number;observed:{weaponId:'KE1-DARIAN-ROD';position:'YARD';distanceMetres:2;pattern:'PRESENT_GRIP_AND_FOOTING'}|null;scroll:Pick<ScrollProfessorScroll,'id'|'materialId'|'makerSequence'|'inscriptionMastery'>|null}
export interface KnowledgeEmperorEnemyAction extends ActionEvidence {planned:KnowledgeEmperorEnemyIntent;actual:KnowledgeEmperorEnemyIntent|'OBSERVE';attackKind:'NONE'|'BODY'|'MENTAL';markId:string|null}
interface Runtime {playerS:number;playerM:number;playerH:number;enemyS:number;powers:Record<KnowledgeEmperorPowerId,number>;clockSeconds:number;site:SageSiteState;workshop:ScrollProfessorWorkshop;mastery:Record<string,number>;note:KnowledgeEmperorCombatNote;marks:KnowledgeEmperorMark[];receipt:KnowledgeEmperorForceReceipt|null;conditionVersion:number;formAttempted:boolean;siftAttempted:boolean;guardAttempted:boolean;form:KnowledgeEmperorPlayerAction|null;sift:KnowledgeEmperorPlayerAction|null;cage:KnowledgeEmperorPlayerAction|null;echo:KnowledgeEmperorPlayerAction|null;glimpse:KnowledgeEmperorPlayerAction|null;guard:KnowledgeEmperorEnemyAction|null;offensive:KnowledgeEmperorPlayerAction|null;defensive:KnowledgeEmperorPlayerAction|null;expiredEffectOrders:number[]}
const same=(a:unknown,b:unknown)=>a===b||(a!==undefined&&b!==undefined&&stableStringify(a)===stableStringify(b));
const integer=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const shape=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const none=(label:string):KnowledgeEmperorCombatEffect=>({label,selfGain:0,enemyReduction:0,threatens:false,mentalPressure:false});
const physicalAt=(health:number)=>health>75?1:health>50?.95:health>25?.9:.8;
const masteryFactor=(v:number)=>.65+.35*v/500;
export function currentKnowledgeEmperorCombatSource(s:SliceState):KnowledgeEmperorCombatSource|null {
 if(!hasKnowledgeEmperorDisputeOpponent(s))return null;const e=s.knowledgeEmperor.encounter,c=s.combat!,stats=s.character.coreStats,originals=s.knowledgeEmperor.sourceScene?.originals;
 if(!e.currentSite||!e.workshop||!e.preparation||!e.note||!originals)return null;const playerClubId=s.town.clubLocation==='HAND'?'town-short-club':null;
 return {runId:s.runId,revision:s.revision,week:s.week,round:c.round,encounterId:'KNOWLEDGE_EMPEROR_DISPUTE',targetId:KNOWLEDGE_EMPEROR_TARGET_ID,targetName:'达里安·洛克',targetAge:44,targetSequence:1,targetCore:24,maxActionCount:6,attemptWeek:e.attemptWeek!,startHistoryIndex:e.startHistoryIndex!,actualBody:true,independentMind:true,enemyWeapon:'KE1-DARIAN-ROD',weaponLocation:'HAND',yardId:KNOWLEDGE_EMPEROR_SITE,playerPosition:'YARD',enemyDistanceMetres:2,ordinaryExit:'OPEN',pursuit:false,thirdPartiesInArea:0,automaticAllyImmunity:false,
 playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:e.enemySpirituality,playerInjuries:structuredClone(s.injuries),enemyInjuries:structuredClone(c.enemyInjuries),playerRisk:s.injuryRisk,enemyRisk:c.enemyRisk,preparation:structuredClone(e.preparation),site:structuredClone(e.currentSite),workshop:structuredClone(e.workshop),originals:structuredClone(originals),budget:knowledgeEmperorEncounterBudget(s),finance:knowledgeEmperorFinanceSnapshot(s),inheritedMastery:Object.fromEntries(INHERITED_IDS.map(id=>[id,s.progression.mastery[id]!])),mastery:{...s.progression.mastery},clubHeld:playerClubId!==null,playerClubId,learnedImpact:s.wizard.lessons['light-touch']?.learned===true,learnedWard:s.wizard.lessons['brief-ward']?.learned===true,echoLearned:s.mystic.life.echoLearned,publicDisclosed:s.mystic.life.publicDisclosed,physique:stats.physique,perception:stats.perception,knowledge:stats.knowledge,will:stats.will,policy:e.policy,powerUses:{...e.powerUses},note:structuredClone(e.note),marks:structuredClone(e.marks),lastForceReceipt:structuredClone(e.lastForceReceipt),conditionVersion:e.conditionVersion,clockSeconds:e.currentSite.clockSeconds,randomSeed:s.random.seed,randomCursor:s.random.cursor};
}
function makeRuntime(x:KnowledgeEmperorCombatSource):Runtime {return {playerS:x.playerSpirituality,playerM:x.playerMind,playerH:x.playerHealth,enemyS:x.enemySpirituality,powers:{...x.powerUses},clockSeconds:x.clockSeconds,site:structuredClone(x.site),workshop:structuredClone(x.workshop),mastery:{...x.mastery},note:structuredClone(x.note),marks:structuredClone(x.marks),receipt:structuredClone(x.lastForceReceipt),conditionVersion:x.conditionVersion,formAttempted:false,siftAttempted:false,guardAttempted:false,form:null,sift:null,cage:null,echo:null,glimpse:null,guard:null,offensive:null,defensive:null,expiredEffectOrders:[]};}
function actionBase(r:Runtime,order:number,physical:number,cursor:number):ActionEvidence {return {...none(''),order,atSeconds:r.clockSeconds,elapsedSeconds:5,paidCost:0,mindCost:0,physicalFactor:physical,rolls:[],randomCursorBefore:cursor,randomCursorAfter:cursor,playerHealthAfter:r.playerH,playerMindAfter:r.playerM,playerSpiritualityAfter:r.playerS,enemySpiritualityAfter:r.enemyS,chargeGranted:false,chargeConsumedByOrder:null,chargeCancelledByOrder:null,appliedAmount:0,consumedEffectOrders:[],expiresAt:null,receipt:null,conditionVersion:r.conditionVersion,noteChargePaid:0,noteWearPaid:0,masteryApplied:[]};}
function expire(r:Runtime):void {for(const key of ['offensive','defensive'] as const){const a=r[key];if(a&&(a.expiresAt!<=r.clockSeconds||a.conditionVersion!==r.conditionVersion)){r.expiredEffectOrders.push(a.order);a.label+=' 20秒到期或现场变化，未用窗口失效，费用不退。';r[key]=null;}}}
function closeAction<T extends ActionEvidence>(a:T,r:Runtime,random:ActionRandomStream):T {r.clockSeconds+=5;r.site.clockSeconds=r.clockSeconds;a.randomCursorAfter=random.cursor;a.playerHealthAfter=r.playerH;a.playerMindAfter=r.playerM;a.playerSpiritualityAfter=r.playerS;a.enemySpiritualityAfter=r.enemyS;a.label+=` 本动作5秒；你余${r.playerS}灵性、${r.playerM}精神、${r.site.playerEnergy}精力，对手余${r.enemyS}灵性。`;return a;}
function consume(effect:KnowledgeEmperorPlayerAction|KnowledgeEmperorEnemyAction,a:ActionEvidence,amount:number,cancelled=false):void {a.consumedEffectOrders.push(effect.order);if(cancelled){effect.chargeCancelledByOrder=a.order;effect.label+=` 第${a.order+1}动作令窗口失效，费用不退。`;}else{effect.chargeConsumedByOrder=a.order;effect.appliedAmount=amount;if('applied'in effect)effect.applied=true;effect.label+=` 第${a.order+1}动作实际应用${amount}，仅一次。`;}}
function applyAttackWindows(r:Runtime,a:KnowledgeEmperorPlayerAction):void {
 if(!a.threatens)return;if(r.sift){const gain=a.selfGain*.2;consume(r.sift,a,gain);a.selfGain+=gain;r.sift=null;}
 if(r.offensive&&(a.mode==='ORDINARY'||a.mode==='INHERITED_BODY')&&r.note.charges>0){const effect=r.offensive;consume(effect,a,35);a.selfGain+=35;r.note.charges--;r.note.wear++;effect.masteryApplied.push(KNOWLEDGE_POWER);a.noteChargePaid=1;a.noteWearPaid=1;r.mastery[KNOWLEDGE_POWER]=Math.min(500,r.mastery[KNOWLEDGE_POWER]!+8);r.offensive=null;a.label+=' 同一便笺实际耗1次、磨损1，知识赋力只给本次普通打击+35。';}
 if(r.guard){const amount=Math.min(30,a.selfGain);consume(r.guard,a,amount);r.guard.enemyReduction=amount;r.guard=null;}
}
function authorizedOriginal(workshop: ScrollProfessorWorkshop, week: number, kind: ScrollProfessorScroll['kind']): ScrollProfessorScroll | null {
  const { scrolls, materials } = workshop;
  return scrolls.find(scroll => {
    if (scroll.kind !== kind || scroll.authorized !== true || scroll.status !== 'HELD' || scroll.usedWeek !== null || ![6, 5, 4, 3, 2].includes(scroll.makerSequence) ||
      !Number.isFinite(scroll.inscriptionMastery) || scroll.inscriptionMastery < 0 || scroll.inscriptionMastery > 500 || !integer(scroll.createdWeek, 1, week) ||
      !/^scroll-professor-scroll-[1-9]\d*$/.test(scroll.id) || !/^scroll-professor-material-[1-9]\d*$/.test(scroll.materialId) ||
      scrolls.filter(x => x.id === scroll.id).length !== 1 || scrolls.filter(x => x.materialId === scroll.materialId).length !== 1) return false;
    const inputs = materials.filter(m => m.id === scroll.materialId), input = inputs[0];
    return inputs.length === 1 && !!input && input.status === 'SPENT' && integer(input.acquiredWeek, 1, scroll.createdWeek) && input.spentWeek === scroll.createdWeek;
  }) ?? null;
}

function playerAction(x: KnowledgeEmperorCombatSource, r: Runtime, stance: SliceStance, id: KnowledgeEmperorMoveId, physical: number, order: number, random: ActionRandomStream): KnowledgeEmperorPlayerAction {
  expire(r);
  const a: KnowledgeEmperorPlayerAction = { ...actionBase(r, order, physical, random.cursor), id, attempted: false, succeeded: false, applied: false, resisted: false, mode: 'NONE', prepared: null, formEnergyPaid: 0, exposurePaid: 0, observed: null, scroll: null };
  const check = (difficulty: number) => { const roll = random.nextInt(1, 100); a.rolls.push(roll); return roll <= computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty, modifiers: [] }); };
  if (id === KNOWLEDGE_POWER || id === POWER_KNOWLEDGE) return knowledgeAction(x,r,a,random,check);
  if (stance === 'DEFEND' && (id === IMPACT || id === BODY)) { a.mode = 'HOLD_GUARD'; a.label = '整轮专心防守，本槽不攻击，不燃毁原卷或支付攻击法术费用。'; }
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本次动作偏差，优势−22.5，不重抽。'; }
  else if (id === BODY) {
    a.selfGain = 20.475 * masteryFactor(x.inheritedMastery['hermit.s8.combat-study']!) * physical; a.threatens = a.selfGain > 0; a.mode = 'INHERITED_BODY';
    a.label = `继承实练次击20.475×旧格斗掌握×实际身体，攻势${a.selfGain}，0灵性，独占一槽。`; applyAttackWindows(r, a); a.applied = a.threatens; a.appliedAmount = a.selfGain;
  } else if (id === IMPACT || id === WARD) {
    const impact = id === IMPACT, budget = impact ? 38.025 : 42.25, scroll = x.policy === 'ORDINARY' ? null : authorizedOriginal(r.workshop, x.week, impact ? 'IMPACT' : 'WARD'); let value: number;
    if (scroll && r.playerS >= 1) {
      a.paidCost = 1; a.mode = 'ORIGINAL_SCROLL'; scroll.status = 'USED'; scroll.usedWeek = x.week; scroll.authorized = false;
      a.scroll = { id: scroll.id, materialId: scroll.materialId, makerSequence: scroll.makerSequence, inscriptionMastery: scroll.inscriptionMastery };
      value = budget * masteryFactor(scroll.inscriptionMastery);
      a.label = `实际燃毁已授权${impact ? '冲力' : '防护'}原卷${scroll.id}，实付1灵性；材料${scroll.materialId}、制作者序列${scroll.makerSequence}、封存掌握${scroll.inscriptionMastery}不变。继承预算${budget}×刻录系数，没有生成新卷。`;
    } else if (x.policy !== 'ORDINARY' && (impact ? x.learnedImpact : x.learnedWard) && r.playerS >= 2) {
      a.paidCost = 2; a.mode = 'LEARNED_SPELL'; value = budget * masteryFactor(x.inheritedMastery['hermit.s7.spellcraft']!);
      a.label = `本人实际已学${impact ? '冲力' : '短暂防护'}实付2灵性，沿用${budget}×旧法术掌握；没有获得新法术。`;
    } else {
      a.mode = 'ORDINARY'; value = (impact ? x.clubHeld ? 16 : 12 : 10) * physical;
      a.label = `${impact ? x.clubHeld ? '自己的实际原短棍16' : '自己的身体12' : '普通格挡10'}×身体状态，0灵性，不借用对手的棍或未知卷轴。`;
    }
    r.playerS -= a.paidCost; a.selfGain = impact ? value : 0; a.enemyReduction = impact ? 0 : value; a.threatens = impact && value > 0; a.applied = value > 0; a.appliedAmount = value; applyAttackWindows(r, a); if (impact) a.appliedAmount = a.selfGain;
  } else if (id === FORM || id === SIFT) {
    const form = id === FORM, attempted = form ? r.formAttempted : r.siftAttempted;
    if (attempted) { a.mode = 'ALREADY_ATTEMPTED'; a.label = '本轮已经尝试过这项能力，只普通观察，不再收费或重抽。'; }
    else if (r.playerS < 6 || r.playerM <= 2 || form && r.site.playerEnergy < 8) { a.mode = 'LOW_RESOURCE'; a.label = '实际灵性、精神或返程精力不足，只普通观察，不免费施法或透支。'; }
    else {
      a.attempted = true; a.paidCost = 6; a.mindCost = 2; a.exposurePaid = 1; r.playerS -= 6; r.playerM -= 2;
      const difficulty = 20 + Math.min(20, r.site.assimilationExposure); r.site.assimilationExposure++;
      if (form) { r.formAttempted = true; a.formEnergyPaid = 6; r.site.formEnergySpent += 6; r.site.playerEnergy -= 6; }
      else { r.siftAttempted = true; a.observed = { weaponId: 'KE1-DARIAN-ROD', position: 'YARD', distanceMetres: 2, pattern: 'PRESENT_GRIP_AND_FOOTING' }; }
      a.succeeded = check(difficulty);
      if (!form && a.succeeded) { const resistance = random.nextInt(1, 100); a.rolls.push(resistance); a.resisted = resistance <= 25; }
      a.mode = !a.succeeded ? 'FAILED' : a.resisted ? 'RESISTED' : 'PREPARED';
      if (a.succeeded && !a.resisted) { a.chargeGranted = true; a.prepared = form ? 'FORM' : 'SIFT'; if (form) r.form = a; else r.sift = a; }
      a.label = `${form ? '有限信息化' : '筛取眼前棍势'}实际付6灵性、2精神${form ? '、6精力' : ''}，增加一次同化暴露；知识难度${difficulty}实抽${a.rolls[0]}，${a.mode === 'FAILED' ? '未形成可靠结果，费用不退' : a.resisted ? `对手调整握棍与步伐，抵抗实抽${a.rolls[1]}≤25，本次读势未生效` : form ? '仅准备本轮一次有限信息化与原地重组窗口，身体当前仍为实体；随后一次身体攻势来临才触发，最多减45，当前没有减势' : '只从眼前实际原棍与站姿取得有限线索，准备本轮下一次真实攻击增加其20%优势；当前没有发动攻击或直接伤害'}。${form ? '余精力保留普通离场，不免伤、不复活。' : '未读取未来动作、隐秘思想或场外事实，假动作可耗掉线索。'}失败、抵抗与过期都不退款。`;
    }
  } else {
    const ready = id === CAGE ? r.cage : id === ECHO ? r.echo : r.glimpse, cost = id === CAGE ? 3 : id === ECHO ? 4 : 6;
    if (id === ECHO && !x.echoLearned) { a.mode = 'NOT_LEARNED'; a.label = '未实际学会迟钟回声，只普通观察，不送未知故事或法术。'; }
    else if (ready) { a.mode = 'ALREADY_PREPARED'; a.label = '本轮同一旧效果尚待真实触发，不叠加、不再收费或抽检定。'; }
    else if (r.playerS < cost || id === GLIMPSE && r.playerM <= 2) { a.mode = 'LOW_RESOURCE'; a.label = '实际资源不足，只普通观察，不免费施法或预言。'; }
    else {
      a.attempted = true; a.paidCost = cost; a.mindCost = id === GLIMPSE ? 2 : 0; r.playerS -= cost; r.playerM -= a.mindCost; a.succeeded = check(id === CAGE ? 14 : 18);
      a.mode = a.succeeded ? 'PREPARED' : 'FAILED';
      if (a.succeeded) { a.chargeGranted = true; a.prepared = id === CAGE ? 'CAGE' : id === ECHO ? 'ECHO' : 'GLIMPSE'; if (id === CAGE) r.cage = a; else if (id === ECHO) r.echo = a; else r.glimpse = a; }
      a.label = `${id === CAGE ? '旧星光牢笼' : id === ECHO ? '本人已学迟钟回声' : '旧模糊预兆'}实付${cost}灵性${a.mindCost ? '与2精神' : ''}，实抽${a.rolls[0]}${a.succeeded ? '成功，只准备有限窗口' : '失败，无效果、费用不退'}。${id === CAGE ? '只将下一正贡献原棍身体打击减半。' : id === ECHO ? `只将下一真实付费弧光乘${x.publicDisclosed ? .955 : .7}；${x.publicDisclosed ? '旧故事已公开，效力只余15%。' : '沿用原未公开来源。'}` : '只将下一真实正贡献身体或付费弧光乘0.7，假动作也可耗窗；不提前知道动作或改写历史。'}`;
    }
  }
  return closeAction(a, r, random);
}
function knowledgeAction(x:KnowledgeEmperorCombatSource,r:Runtime,a:KnowledgeEmperorPlayerAction,random:ActionRandomStream,check:(difficulty:number)=>boolean):KnowledgeEmperorPlayerAction {
 const offensive=a.id===KNOWLEDGE_POWER,receipt=r.receipt;
 if(offensive&&r.note.charges===0){a.mode='EMPTY_NOTE';a.label='同一便笺3次已耗尽，只普通观察，不补纸或补次数。';}
 else if(!offensive&&(!receipt||receipt.targetId!==x.targetId||receipt.conditionVersion!==r.conditionVersion||receipt.position!=='YARD'||r.clockSeconds-receipt.atSeconds>=20||receipt.atSeconds>=r.clockSeconds)){a.mode='NO_ACTUAL_RECEIPT';a.label='没有当前20秒内亲见且已实际付费的力量凭据，只普通观察；不读取未来行动，不空扣费用。';}
 else if(offensive?r.offensive!==null:r.defensive!==null){a.mode='ALREADY_PREPARED';a.label='同一用途已经有一个待用窗口，不叠加、不重复收费。';}
 else if(r.playerS<8||r.playerM<=2){a.mode='LOW_RESOURCE';a.label='实际灵性或精神不足，只普通观察，不免费施法。';}
 else {a.attempted=true;a.paidCost=8;a.mindCost=2;r.playerS-=8;r.playerM-=2;a.receipt=offensive?null:structuredClone(receipt);a.succeeded=check(18);a.mode=a.succeeded?'PREPARED':'FAILED';
  if(a.succeeded){a.chargeGranted=true;a.prepared=offensive?'KNOWLEDGE_POWER':'POWER_KNOWLEDGE';a.expiresAt=r.clockSeconds+20;if(offensive)r.offensive=a;else r.defensive=a;}
  a.label=`${offensive?'知识赋力':'循力求知'}实付8灵性2精神，知识18实抽${a.rolls[0]}；${a.succeeded?offensive?'同一可见对手、同一位置20秒内下一次普通打击+35，应用时才耗便笺一次':'仅依已经发生的同一力量凭据，20秒内下一同类真实冲击减30':'检定失败，费用不退，无效果'}。没有发现缺文、隐藏意图或未来事实。`;
 }
 return closeAction(a,r,random);
}
function enemyAction(x:KnowledgeEmperorCombatSource,r:Runtime,planned:KnowledgeEmperorEnemyIntent,physical:number,order:number,random:ActionRandomStream):KnowledgeEmperorEnemyAction {
 expire(r);const a:KnowledgeEmperorEnemyAction={...actionBase(r,order,physical,random.cursor),planned,actual:planned,attackKind:'NONE',markId:null};
 const power=KNOWLEDGE_EMPEROR_POWERS.find(p=>p.id===planned),mark=r.marks.find(m=>m.status==='HELD');
 if(planned==='WARD'&&r.guardAttempted||planned==='FEINT'&&!r.sift&&!r.glimpse&&!r.offensive&&!r.defensive)a.actual='OBSERVE';
 else if(power&&(r.enemyS<power.cost||['ARC_BOLT','DREAD_MARK'].includes(planned)&&!mark))a.actual='BODY_STRIKE';
 if(a.actual==='ARC_BOLT'||a.actual==='DREAD_MARK'||a.actual==='BODY_STRIKE'){
  const mental=a.actual==='DREAD_MARK';let raw=a.actual==='ARC_BOLT'?75:mental?65:20*physical;a.attackKind=mental?'MENTAL':'BODY';
  if(a.actual!=='BODY_STRIKE'){
   r.enemyS-=7;r.powers[a.actual]++;a.paidCost=7;mark!.status='SPENT';mark!.usedRound=x.round;mark!.usedOrder=order;a.markId=mark!.id;
   r.receipt={id:`${mark!.id}:spent:${x.round}:${order}`,targetId:x.targetId,power:a.actual,kind:mental?'MENTAL':'BODY',markId:mark!.id,paidCost:7,round:x.round,order,atSeconds:r.clockSeconds,position:'YARD',visible:true,conditionVersion:r.conditionVersion};a.receipt=structuredClone(r.receipt);
   a.label=`达里安实际付7灵性并耗掉自己的${mark!.id}，${mental?'精神惊惧65':'身体弧光75'}已经发生；凭据只能证明这次可见支出。`;
  }else a.label=`${planned!=='BODY_STRIKE'?'有限灵性或3枚印记不足，0灵性普通回退；':''}达里安以唯一KE1-DARIAN-ROD作实际身体打击20×身体状态。`;
  const reduce=(effect:KnowledgeEmperorPlayerAction,multiplier:number)=>{const amount=raw*(1-multiplier);consume(effect,a,amount);raw*=multiplier;};
  if(a.actual==='BODY_STRIKE'&&raw>0&&r.cage){reduce(r.cage,.5);r.cage=null;}
  if(a.actual==='ARC_BOLT'&&raw>0&&r.echo){reduce(r.echo,x.publicDisclosed?.955:.7);r.echo=null;}
  if(raw>0&&r.glimpse){reduce(r.glimpse,.7);r.glimpse=null;}
  if(!mental&&raw>0&&r.form){const amount=Math.min(45,raw);consume(r.form,a,amount);raw-=amount;r.form=null;}
  if(raw>0&&r.defensive?.receipt?.power===a.actual){const effect=r.defensive,amount=Math.min(30,raw);consume(effect,a,amount);raw-=amount;effect.masteryApplied.push(POWER_KNOWLEDGE);r.mastery[POWER_KNOWLEDGE]=Math.min(500,r.mastery[POWER_KNOWLEDGE]!+8);r.defensive=null;a.label+=' 先前真实凭据对应同类冲击，循力求知仅本次减30以内，不恢复已经花掉的力量。';}
  a.selfGain=raw;a.appliedAmount=raw;a.threatens=!mental&&raw>0;a.mentalPressure=mental&&raw>0;
 }else if(a.actual==='WARD'){r.enemyS-=4;r.powers.WARD++;r.guardAttempted=true;a.paidCost=4;a.chargeGranted=true;r.guard=a;a.label='达里安实际付4灵性，准备一次屏护，仅削弱随后一次真实攻击最多30。';}
 else if(a.actual==='FEINT'){r.enemyS-=3;r.powers.FEINT++;a.paidCost=3;r.conditionVersion++;
  for(const key of ['sift','glimpse','offensive','defensive'] as const){if(r[key]){consume(r[key]!,a,0,true);r[key]=null;}}
  a.label='达里安实付3灵性，横棍短暂遮挡并改变握姿；现场条件改变，眼前读势、预兆与两种新能力的待用窗口失效，费用不退。';
 }else if(a.actual==='OBSERVE')a.label='没有可破坏的窗口或本轮已经屏护，仅普通观察，0费用0攻势。';
 else a.label='达里安实际失衡，0费用0攻势，不重抽、不恢复资源。';
 return closeAction(a,r,random);
}

export function validKnowledgeEmperorWorkshop(w: ScrollProfessorWorkshop, week: number): boolean {
  return !!w && integer(w.kitsBought) && integer(w.craftAttempts) && integer(w.craftFailures, 0, w.craftAttempts) &&
    (w.lastKitWeek === null || integer(w.lastKitWeek, 1, week)) && Array.isArray(w.materials) && Array.isArray(w.scrolls) &&
    new Set(w.materials.map(m => m.id)).size === w.materials.length && new Set(w.scrolls.map(s => s.id)).size === w.scrolls.length && new Set(w.scrolls.map(s => s.materialId)).size === w.scrolls.length &&
    w.materials.every(m => /^scroll-professor-material-[1-9]\d*$/.test(m.id) && integer(m.acquiredWeek, 1, week) &&
      (m.status === 'HELD' ? m.spentWeek === null : m.status === 'SPENT' && integer(m.spentWeek, m.acquiredWeek, week))) &&
    w.scrolls.every(s => /^scroll-professor-scroll-[1-9]\d*$/.test(s.id) && ['IMPACT', 'WARD'].includes(s.kind) && [6, 5, 4, 3, 2].includes(s.makerSequence) && integer(s.inscriptionMastery, 0, 500) &&
      integer(s.createdWeek, 1, week) && typeof s.authorized === 'boolean' && (s.status === 'HELD' ? s.usedWeek === null : s.status === 'USED' && integer(s.usedWeek, s.createdWeek, week) && !s.authorized) &&
      w.materials.some(m => m.id === s.materialId && m.status === 'SPENT' && m.spentWeek === s.createdWeek && m.acquiredWeek <= s.createdWeek));
}

export function validKnowledgeEmperorInjuries(v: SliceInjury[], revision: number): boolean {
  return Array.isArray(v) && new Set(v.map(i => i.id)).size === v.length && v.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 1, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
export const KNOWLEDGE_EMPEROR_SOURCE_KEYS=['runId','revision','week','round','encounterId','targetId','targetName','targetAge','targetSequence','targetCore','maxActionCount','attemptWeek','startHistoryIndex','actualBody','independentMind','enemyWeapon','weaponLocation','yardId','playerPosition','enemyDistanceMetres','ordinaryExit','pursuit','thirdPartiesInArea','automaticAllyImmunity','playerHealth','playerMind','playerSpirituality','enemyHealth','enemyMind','enemySpirituality','playerInjuries','enemyInjuries','playerRisk','enemyRisk','preparation','site','workshop','originals','budget','finance','inheritedMastery','mastery','clubHeld','playerClubId','learnedImpact','learnedWard','echoLearned','publicDisclosed','physique','perception','knowledge','will','policy','powerUses','note','marks','lastForceReceipt','conditionVersion','clockSeconds','randomSeed','randomCursor'] as const;
export function validKnowledgeEmperorCombatSource(x:KnowledgeEmperorCombatSource):boolean {try{
 const p=x.site,prep=x.preparation,b=x.budget;
 if(!shape(x,KNOWLEDGE_EMPEROR_SOURCE_KEYS)||typeof x.runId!=='string'||!x.runId||!integer(x.revision)||!integer(x.week,1)||!integer(x.round,1)||!integer(x.startHistoryIndex)||x.attemptWeek!==x.week||
 x.encounterId!=='KNOWLEDGE_EMPEROR_DISPUTE'||x.targetId!==KNOWLEDGE_EMPEROR_TARGET_ID||x.targetName!=='达里安·洛克'||x.targetAge!==44||x.targetSequence!==1||x.targetCore!==24||x.maxActionCount!==6||!x.actualBody||!x.independentMind||x.enemyWeapon!=='KE1-DARIAN-ROD'||x.weaponLocation!=='HAND'||x.yardId!==KNOWLEDGE_EMPEROR_SITE||x.playerPosition!=='YARD'||x.enemyDistanceMetres!==2||x.ordinaryExit!=='OPEN'||x.pursuit!==false||x.thirdPartiesInArea!==0||x.automaticAllyImmunity!==false)return false;
 if(![x.playerHealth,x.playerMind,x.enemyHealth,x.enemyMind].every(n=>integer(n,1,100))||![x.playerSpirituality,x.enemySpirituality].every(n=>integer(n,0,120))||!validateKnowledgeEmperorCurrentSite(p,x.originals)||p.playerLocation!=='YARD'||p.playerEnergy<2||p.iris?.location!=='OUTSIDE'||!p.iris.alive||p.body!=='SOLID'||p.form.active||p.record?.location!=='OWNER'||!p.materials.every(m=>m.status==='RETURNED'&&m.location==='OWNER')||p.clockSeconds!==x.clockSeconds)return false;
 if(!validateKnowledgeEmperorPreparation(prep)||prep.runId!==x.runId||prep.randomSeed!==x.randomSeed||prep.randomCursor>x.randomCursor||prep.revision>=x.revision||prep.week>x.week||x.clockSeconds!==prep.lifeClockSeconds+4+60*(x.round-1)||!same(x.originals,prep.originals)||!validKnowledgeEmperorWorkshop(x.workshop,x.week))return false;
 // Crafting is closed here: same original identities, with only actual HELD→USED consumption.
 if(!same({...x.workshop,scrolls:prep.workshop.scrolls},prep.workshop)||x.workshop.scrolls.length!==prep.workshop.scrolls.length||!x.workshop.scrolls.every((v,i)=>{const old=prep.workshop.scrolls[i]!;return old.status==='USED'?same(v,old):same(v,old)||same(v,{...old,status:'USED',authorized:false,usedWeek:x.week});}))return false;
 if(!shape(x.inheritedMastery,INHERITED_IDS)||!INHERITED_IDS.every(id=>integer(x.inheritedMastery[id],0,500)&&x.inheritedMastery[id]===x.mastery[id])||!integer(x.mastery[KNOWLEDGE_POWER],0,500)||!integer(x.mastery[POWER_KNOWLEDGE],0,500)||!Object.values(x.mastery).every(n=>integer(n,0,500)))return false;
 if(!same(b.mastery,x.mastery)||b.health!==x.playerHealth||b.mind!==x.playerMind||b.spirituality!==x.playerSpirituality||b.injuryRisk!==x.playerRisk||!same(b.injuries,x.playerInjuries)||b.sequence!==1||!same(b.coreStats,{physique:x.physique,perception:x.perception,will:x.will,knowledge:x.knowledge}))return false;
 if(![x.learnedImpact,x.learnedWard,x.echoLearned,x.publicDisclosed].every(v=>typeof v==='boolean')||x.publicDisclosed&&!x.echoLearned||!['town-short-club',null].includes(x.playerClubId)||x.clubHeld!==(x.playerClubId!==null)||![x.physique,x.perception,x.will,x.knowledge].every(n=>integer(n,0,500))||!KNOWLEDGE_EMPEROR_POLICIES.includes(x.policy)||!integer(x.playerRisk)||!integer(x.enemyRisk)||!validKnowledgeEmperorInjuries(x.playerInjuries,x.revision)||!validKnowledgeEmperorInjuries(x.enemyInjuries,x.revision))return false;
 if(!shape(x.powerUses,KNOWLEDGE_EMPEROR_POWER_IDS)||!KNOWLEDGE_EMPEROR_POWER_IDS.every(id=>integer(x.powerUses[id]))||x.powerUses.WARD>x.round-1||x.powerUses.FEINT>6*(x.round-1)||x.powerUses.ARC_BOLT+x.powerUses.DREAD_MARK>3||x.enemySpirituality!==120-KNOWLEDGE_EMPEROR_POWERS.reduce((n,p)=>n+p.cost*x.powerUses[p.id],0)||!validKnowledgeEmperorCombatNote(x.note)||!validKnowledgeEmperorMarks(x.marks)||x.marks.filter(m=>m.status==='SPENT').length!==x.powerUses.ARC_BOLT+x.powerUses.DREAD_MARK||x.conditionVersion!==1+x.powerUses.FEINT)return false;
 if(x.lastForceReceipt){const r=x.lastForceReceipt;if(!shape(r,['id','targetId','power','kind','markId','paidCost','round','order','atSeconds','position','visible','conditionVersion'])||r.targetId!==x.targetId||!['ARC_BOLT','DREAD_MARK'].includes(r.power)||r.kind!==(r.power==='ARC_BOLT'?'BODY':'MENTAL')||r.paidCost!==7||!integer(r.round,1,x.round-1)||!integer(r.order,0,11)||!integer(r.atSeconds,prep.lifeClockSeconds+4,x.clockSeconds)||r.position!=='YARD'||r.visible!==true||!integer(r.conditionVersion,1,x.conditionVersion)||!x.marks.some(m=>m.id===r.markId&&m.usedRound===r.round&&m.usedOrder===r.order)||r.id!==`${r.markId}:spent:${r.round}:${r.order}`)return false;}
 return typeof x.randomSeed==='string'&&x.randomSeed.length>0&&x.randomSeed.length<=256&&integer(x.randomCursor);
 }catch{return false;}}
export const validateKnowledgeEmperorCombatSource=validKnowledgeEmperorCombatSource;
export type KnowledgeEmperorResolution='CONTINUE'|'PLAYER_DEAD'|'ENEMY_DEAD'|'ENEMY_SURRENDERED'|'RETREATED';
export interface KnowledgeEmperorRoundOutcome {targetId:typeof KNOWLEDGE_EMPEROR_TARGET_ID;round:number;source:KnowledgeEmperorCombatSource;stance:SliceStance;continuing:boolean;enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';playerSpiritualityBefore:number;playerSpiritualityAfter:number;playerHealthAfter:number;playerMindAfter:number;enemySpiritualityBefore:number;playerInjuriesAfter:SliceInjury[];enemyInjuriesAfter:SliceInjury[];playerRiskAfter:number;enemyRiskAfter:number;powerUses:Record<KnowledgeEmperorPowerId,number>;formAttempted:boolean;siftAttempted:boolean;guardAttempted:boolean;expiredEffectOrders:number[];siteAfter:SageSiteState;workshopAfter:ScrollProfessorWorkshop;masteryAfter:Record<string,number>;noteAfter:KnowledgeEmperorCombatNote;marksAfter:KnowledgeEmperorMark[];lastForceReceipt:KnowledgeEmperorForceReceipt|null;conditionVersion:number;clockSecondsAfter:number;elapsedSeconds:60;randomCursorAfter:number;playerActions:KnowledgeEmperorPlayerAction[];enemyActions:KnowledgeEmperorEnemyAction[]}
function penalty(current:number,maximum:number){const f=Math.max(0,Math.min(1,current/maximum));return f>.75?0:f>.5?.05:f>.25?.1:.2;}
function base(core:number,h:number,m:number,s:number){return(1500+Math.min(core,300))*(1-Math.min(.4,penalty(h,100)+penalty(m,100)+penalty(s,120)));}
function weights(risk:number){const death=Math.min(100,5+Math.min(risk,10)*10),shifted=death-5;return{light:Math.max(0,65-shifted),heavy:Math.max(0,30-Math.max(0,shifted-65)),death};}
export function replayKnowledgeEmperorCombatRound(x:KnowledgeEmperorCombatSource,stance:SliceStance):{round:SliceCombatRound;outcome:KnowledgeEmperorResolution}{
 if(!validKnowledgeEmperorCombatSource(x)||!['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT'].includes(stance))throw new Error('缺少真实达里安、有限物资与连续身体来源。');
 const rng=new DeterministicActionRandomStream(x.randomSeed,x.randomCursor),r=makeRuntime(x),playerCountRoll=rng.nextInt(1,100),enemyCountRoll=rng.nextInt(1,100),playerCount=knowledgeEmperorActionCount(playerCountRoll),enemyCount=knowledgeEmperorEnemyActionCount(enemyCountRoll);
 const first=x.round%2===1?'PLAYER':'ENEMY',order=first==='PLAYER'?['PLAYER','ENEMY'] as const:['ENEMY','PLAYER'] as const,remaining={PLAYER:playerCount,ENEMY:enemyCount};const players:KnowledgeEmperorPlayerAction[]=[],enemies:KnowledgeEmperorEnemyAction[]=[];let retreat:SliceCombatRound['retreat']='NONE';
 while(remaining.PLAYER>0||remaining.ENEMY>0){for(const actor of order){if(!remaining[actor])continue;if(actor==='PLAYER'&&stance==='RETREAT'){remaining.PLAYER=0;retreat=rng.nextInt(1,100)<=50?'SUCCESS':'FAILURE';if(retreat==='SUCCESS'){remaining.ENEMY=0;break;}continue;}remaining[actor]--;if(actor==='PLAYER')players.push(playerAction(x,r,stance,drawPlayer(rng,stance,x.policy),physicalAt(r.playerH),players.length+enemies.length,rng));else enemies.push(enemyAction(x,r,drawKnowledgeEmperorEnemyAbility(rng),physicalAt(x.enemyHealth),players.length+enemies.length,rng));}}
 const sum=(as:KnowledgeEmperorCombatEffect[],k:'selfGain'|'enemyReduction')=>as.reduce((n,a)=>n+a[k],0),playerAdvantage=Math.max(150,base(x.physique*.10+x.perception*.30+x.will*.25+x.knowledge*.35,x.playerHealth,x.playerMind,x.playerSpirituality)+sum(players,'selfGain')-sum(enemies,'enemyReduction')),enemyAdvantage=Math.max(150,base(x.targetCore,x.enemyHealth,x.enemyMind,x.enemySpirituality)+sum(enemies,'selfGain')-sum(players,'enemyReduction')),winChance=playerAdvantage/(playerAdvantage+enemyAdvantage)*100;
 const winner=retreat==='SUCCESS'?'ENEMY':rng.nextInt(1,1_000_000)<=winChance*10_000?'PLAYER':'ENEMY';
 let playerHealth=r.playerH,enemyHealth=x.enemyHealth,enemyMind=x.enemyMind,playerRisk=x.playerRisk,enemyRisk=x.enemyRisk,enemyStatus:KnowledgeEmperorRoundOutcome['enemyStatus']='RESISTING',outcome:KnowledgeEmperorResolution=retreat==='SUCCESS'?'RETREATED':'CONTINUE';
 const playerInjuries=structuredClone(x.playerInjuries),enemyInjuries=structuredClone(x.enemyInjuries);let consequenceWeights:SliceCombatRound['consequenceWeights']=null,consequenceRoll:number|undefined,consequenceDomain:SliceCombatRound['consequenceDomain'];
 if(retreat!=='SUCCESS'){const loser=winner==='PLAYER'?'ENEMY':'PLAYER',attacks=loser==='PLAYER'?enemies:players,injuries=loser==='PLAYER'?playerInjuries:enemyInjuries;
  if(attacks.some(a=>a.threatens)){let risk=loser==='PLAYER'?playerRisk:enemyRisk;if(injuries.length)risk++;if(loser==='PLAYER')playerRisk=risk;else enemyRisk=risk;consequenceDomain='BODY';consequenceWeights=weights(risk);consequenceRoll=rng.nextInt(1,100);const severity=consequenceRoll<=consequenceWeights.light?'LIGHT':consequenceRoll<=consequenceWeights.light+consequenceWeights.heavy?'HEAVY':'DEATH';
   if(severity==='DEATH'){if(loser==='PLAYER')playerHealth=0;else{enemyHealth=0;enemyStatus='DEAD';}}else{injuries.push({id:`${x.runId}:combat:${x.round}:${loser}:${x.revision+1}:${injuries.length}`,severity,acquiredRevision:x.revision+1,treatedRevision:null});const damage=severity==='LIGHT'?10:30;if(loser==='PLAYER')playerHealth=Math.max(0,playerHealth-damage);else enemyHealth=Math.max(0,enemyHealth-damage);if(enemyHealth===0)enemyStatus='DEAD';else if(loser==='ENEMY'&&severity==='HEAVY')enemyStatus='SURRENDERED';}
  }else if(attacks.some(a=>a.mentalPressure)){consequenceDomain='MENTAL';if(loser==='PLAYER')r.playerM=Math.max(0,r.playerM-10);else{enemyMind=Math.max(0,enemyMind-10);if(enemyMind===0)enemyStatus='SURRENDERED';}}
  if(playerHealth===0)outcome='PLAYER_DEAD';else if(enemyHealth===0)outcome='ENEMY_DEAD';else if(enemyStatus==='SURRENDERED')outcome='ENEMY_SURRENDERED';else if(r.playerM===0)outcome='RETREATED';
 }
 const pending=[r.form,r.sift,r.cage,r.echo,r.glimpse,r.guard,r.offensive,r.defensive].filter((a):a is KnowledgeEmperorPlayerAction|KnowledgeEmperorEnemyAction=>a!==null).map(a=>a.order);r.site.clockSeconds=x.clockSeconds+60;
 const o:KnowledgeEmperorRoundOutcome={targetId:x.targetId,round:x.round,source:structuredClone(x),stance,continuing:outcome==='CONTINUE',enemyHealth,enemyMind,enemySpirituality:r.enemyS,enemyStatus,playerSpiritualityBefore:x.playerSpirituality,playerSpiritualityAfter:r.playerS,playerHealthAfter:playerHealth,playerMindAfter:r.playerM,enemySpiritualityBefore:x.enemySpirituality,playerInjuriesAfter:playerInjuries,enemyInjuriesAfter:enemyInjuries,playerRiskAfter:playerRisk,enemyRiskAfter:enemyRisk,powerUses:{...r.powers},formAttempted:r.formAttempted,siftAttempted:r.siftAttempted,guardAttempted:r.guardAttempted,expiredEffectOrders:[...r.expiredEffectOrders,...pending].sort((a,b)=>a-b),siteAfter:structuredClone(r.site),workshopAfter:structuredClone(r.workshop),masteryAfter:{...r.mastery},noteAfter:structuredClone(r.note),marksAfter:structuredClone(r.marks),lastForceReceipt:structuredClone(r.receipt),conditionVersion:r.conditionVersion,clockSecondsAfter:r.site.clockSeconds,elapsedSeconds:60,randomCursorAfter:rng.cursor,playerActions:players,enemyActions:enemies};
 const round:SliceCombatRound={round:x.round,stance,first,playerCount,enemyCount,playerCountRoll,enemyCountRoll,moves:[...players.map(a=>({...a,actor:'PLAYER' as const})),...enemies.map(a=>({...a,actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order).map(a=>({actor:a.actor,label:a.label,selfGain:a.selfGain,enemyReduction:a.enemyReduction})),playerAdvantage,enemyAdvantage,winChance,winner,consequence:'',consequenceWeights,retreat,...(consequenceDomain?{consequenceDomain}:{}),...(consequenceRoll===undefined?{}:{consequenceRoll}),knowledgeEmperorOutcome:o};round.consequence=knowledgeEmperorCombatConsequence(round);return{round,outcome};
}
export function validateKnowledgeEmperorRoundOutcome(v:unknown):v is KnowledgeEmperorRoundOutcome {try{const o=v as KnowledgeEmperorRoundOutcome;return same(o,replayKnowledgeEmperorCombatRound(o.source,o.stance).round.knowledgeEmperorOutcome);}catch{return false;}}
export function validateKnowledgeEmperorCombatRound(round:SliceCombatRound):boolean {try{const o=round.knowledgeEmperorOutcome;return !!o&&same(round,replayKnowledgeEmperorCombatRound(o.source,o.stance).round);}catch{return false;}}
export function nextKnowledgeEmperorCombatSource(o:KnowledgeEmperorRoundOutcome):KnowledgeEmperorCombatSource {const spirituality=Math.min(120,o.playerSpiritualityAfter+12);return {...structuredClone(o.source),revision:o.source.revision+1,round:o.round+1,playerHealth:o.playerHealthAfter,playerMind:o.playerMindAfter,playerSpirituality:spirituality,enemyHealth:o.enemyHealth,enemyMind:o.enemyMind,enemySpirituality:o.enemySpirituality,playerInjuries:structuredClone(o.playerInjuriesAfter),enemyInjuries:structuredClone(o.enemyInjuriesAfter),playerRisk:o.playerRiskAfter,enemyRisk:o.enemyRiskAfter,site:structuredClone(o.siteAfter),workshop:structuredClone(o.workshopAfter),mastery:{...o.masteryAfter},budget:{...structuredClone(o.source.budget),health:o.playerHealthAfter,mind:o.playerMindAfter,spirituality,mastery:{...o.masteryAfter},injuries:structuredClone(o.playerInjuriesAfter),injuryRisk:o.playerRiskAfter},powerUses:{...o.powerUses},note:structuredClone(o.noteAfter),marks:structuredClone(o.marksAfter),lastForceReceipt:structuredClone(o.lastForceReceipt),conditionVersion:o.conditionVersion,clockSeconds:o.clockSecondsAfter,randomCursor:o.randomCursorAfter};}
export function knowledgeEmperorCombatConsequence(round:SliceCombatRound):string {const o=round.knowledgeEmperorOutcome;if(!o)throw new Error('缺少知识皇帝真实回合来源。');const who=round.winner==='PLAYER'?'达里安':'你';let text=round.retreat==='SUCCESS'?'通过撤离判定，将沿4米普通通路退出，支付2精力。':round.consequenceDomain==='BODY'?`${who}承受实际身体攻势，身体伤势检验${round.consequenceRoll}/100（轻${round.consequenceWeights!.light}/重${round.consequenceWeights!.heavy}/死亡${round.consequenceWeights!.death}）。`:round.consequenceDomain==='MENTAL'?`${who}承受实际精神压力，精神−10，没有身体伤口或身体风险。`:'本轮没有实际致伤来源，不掷身体伤势盘。';if(o.playerHealthAfter===0)text+='你已死亡，原身体与持物留在庭院。';else if(o.enemyStatus==='DEAD')text+='达里安已死亡，原身体与原棍留在庭院。';else if(o.enemyStatus==='SURRENDERED')text+='达里安停止抵抗，亲自将自己的原棍放在脚边。';else if(o.playerMindAfter===0)text+='精神耗尽，停止交战并沿普通出口退出。';return `44岁的达里安·洛克持独立原棍；艾瑞丝与旧灾难中的成人实际在场外。${text} 本轮60秒；同一便笺余${o.noteAfter.charges}/3、磨损${o.noteAfter.wear}；对手印记余${o.marksAfter.filter(m=>m.status==='HELD').length}/3。实际支出、旧伤与旧物不回填；未用窗口轮末失效。`;}
export function projectKnowledgeEmperorCombat(s:SliceState){const e=s.knowledgeEmperor.encounter,visible=isKnowledgeEmperor(s),last=s.combat?.encounterId==='KNOWLEDGE_EMPEROR_DISPUTE'?s.combat.lastRound?.knowledgeEmperorOutcome:e.terminal?s.combatHistory[e.terminal.historyIndex]?.knowledgeEmperorOutcome:null;return{enemyName:visible?'达里安·洛克（44岁）':'',targetId:visible?e.targetId:null,playerHealth:s.health,playerMind:s.mind,playerSpirituality:s.spirituality,maxSpirituality:120,enemyHealth:visible?e.enemyHealth:null,enemyMind:visible?e.enemyMind:null,enemySpirituality:visible?e.enemySpirituality:null,powerUses:visible?publicPryerFields(e.powerUses, ['ARC_BOLT', 'DREAD_MARK', 'WARD', 'FEINT']):null,site:visible&&e.currentSite?publicSageSite(e.currentSite):null,note:visible&&e.note?publicKnowledgeEmperorCombatNote(e.note):null,marks:visible?e.marks.map(publicKnowledgeEmperorMark):[],policy:e.policy,originalExit:true,pursuit:false,distanceMetres:2,automaticAllyImmunity:false,alliesPresent:0,lastActionSequence:visible&&last?[...last.playerActions.map(a=>({...publicKnowledgeEmperorPlayerAction(a),actor:'PLAYER' as const})),...last.enemyActions.map(a=>({...publicKnowledgeEmperorEnemyAction(a),actor:'ENEMY' as const}))].sort((a,b)=>a.order-b.order):[],countWheel:KNOWLEDGE_EMPEROR_COUNT_WHEEL.map(x=>({...x})),enemyCountWheel:KNOWLEDGE_EMPEROR_ENEMY_COUNT_WHEEL.map(x=>({...x})),enemyAbilityWheel:KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL.map(x=>({...x})),summary:visible?'体10%感30%意25%知35%，基础1500、核心上限300、状态最多减40%、底150。双方1至6动作10/15/25/25/15/10；继承贤者9槽及实际旧物预算，再加两槽各20。每槽5秒、每轮60秒；仅继续战斗本人回12灵性。知识赋力实际用纸一次才+35；循力求知只依已经支付的同类力量凭据，下一同类冲击最多减30；都需8灵性2精神、知识18，20秒到期，不读取意图。':''};}
export type KnowledgeEmperorCombatProjection=ReturnType<typeof projectKnowledgeEmperorCombat>;

const publicKnowledgeEmperorAction = (a: ActionEvidence) => ({
  ...publicPryerFields(a, ['label', 'selfGain', 'enemyReduction', 'threatens', 'mentalPressure', 'order', 'atSeconds', 'elapsedSeconds', 'paidCost', 'mindCost', 'physicalFactor', 'playerHealthAfter', 'playerMindAfter', 'playerSpiritualityAfter', 'enemySpiritualityAfter', 'chargeGranted', 'chargeConsumedByOrder', 'chargeCancelledByOrder', 'appliedAmount', 'expiresAt', 'conditionVersion', 'noteChargePaid', 'noteWearPaid']), rolls: [...a.rolls], consumedEffectOrders: [...a.consumedEffectOrders],
  receipt: a.receipt ? publicKnowledgeEmperorForceReceipt(a.receipt) : null, masteryApplied: [...a.masteryApplied],
});
export const publicKnowledgeEmperorPlayerAction = (a: KnowledgeEmperorPlayerAction) => ({
  ...publicKnowledgeEmperorAction(a), ...publicPryerFields(a, ['id', 'attempted', 'succeeded', 'applied', 'resisted', 'mode', 'prepared', 'formEnergyPaid', 'exposurePaid']),
  observed: a.observed ? publicPryerFields(a.observed, ['weaponId', 'position', 'distanceMetres', 'pattern']) : null,
  scroll: a.scroll ? publicPryerScroll(a.scroll) : null,
});
export const publicKnowledgeEmperorEnemyAction = (a: KnowledgeEmperorEnemyAction) => ({ ...publicKnowledgeEmperorAction(a), ...publicPryerFields(a, ['planned', 'actual', 'attackKind', 'markId']) });
export function publicKnowledgeEmperorRound(o: KnowledgeEmperorRoundOutcome) { return {
  ...publicPryerFields(o, ['targetId', 'round', 'stance', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'playerRiskAfter', 'enemyRiskAfter', 'formAttempted', 'siftAttempted', 'guardAttempted', 'clockSecondsAfter', 'elapsedSeconds', 'conditionVersion']),
  playerInjuriesAfter: o.playerInjuriesAfter.map(publicPryerInjury), enemyInjuriesAfter: o.enemyInjuriesAfter.map(publicPryerInjury),
  powerUses: publicPryerFields(o.powerUses, ['ARC_BOLT', 'WARD', 'FEINT', 'DREAD_MARK']),
  expiredEffectOrders: [...o.expiredEffectOrders], siteAfter: publicSageSite(o.siteAfter), workshopAfter: publicPryerWorkshop(o.workshopAfter),
  playerActions: o.playerActions.map(publicKnowledgeEmperorPlayerAction), enemyActions: o.enemyActions.map(publicKnowledgeEmperorEnemyAction),
  masteryAfter: Object.fromEntries([...INHERITED_IDS, KNOWLEDGE_POWER, POWER_KNOWLEDGE].filter(id => Object.hasOwn(o.masteryAfter, id)).map(id => [id, o.masteryAfter[id]!])),
  noteAfter: publicKnowledgeEmperorCombatNote(o.noteAfter), marksAfter: o.marksAfter.map(publicKnowledgeEmperorMark), lastForceReceipt: o.lastForceReceipt ? publicKnowledgeEmperorForceReceipt(o.lastForceReceipt) : null,
}; }
export type KnowledgeEmperorPublicRoundOutcome = ReturnType<typeof publicKnowledgeEmperorRound>;
