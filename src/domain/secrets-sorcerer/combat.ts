import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { releaseStoredRecorderCombatRecord, storedRecorderCombatRecord, type RecorderRoundContext } from '../astrologer/combat.js';
import { TRAVELER_COUNT_WHEEL, travelerActionCount } from '../traveler/combat.js';
import type { SliceState, SliceStance, SliceWheelEntry } from '../slice/types.js';
import { currentSecretsSorcererAttempt, currentSecretsSorcererCase, currentSecretsSorcererTarget, hasSecretsSorcererOpponent } from './ritual.js';

export interface SecretsSorcererRoundOutcome {
  targetId: string; attemptId: string; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'DEAD' | 'SEALED'; caseId: string; charges: number; restraintMarks: number;
}
export const SECRETS_SORCERER_COUNT_WHEEL = TRAVELER_COUNT_WHEEL;
export const secretsSorcererActionCount = travelerActionCount;
export const SECRETS_SORCERER_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const SECRETS_SORCERER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'SS4-EDGE-CUT', label: '原刃切：2灵性，90×身体；不足时原爪24（G）', weight: 45 },
  { id: 'SS4-REFRACTION', label: '原身体一层折光：4灵性，挡下一普通打击（G）', weight: 35 },
  { id: 'SS4-DISPLACEMENT', label: '原拱内错位：5灵性，解除受限位置、增势30（G）', weight: 15 },
  { id: 'SS4-STUMBLE', label: '踉跄：0贡献，不回复灵性（G）', weight: 5 },
];
export type SecretsSorcererMoveId = 'STRIKE' | 'door.s6.release' | 'EVADE' | 'door.s4.space-hiding' | 'door.s5.travel' | 'SS4-CAPTURE' | 'ACCIDENT';
export type SecretsSorcererEnemyMoveId = 'SS4-EDGE-CUT' | 'SS4-REFRACTION' | 'SS4-DISPLACEMENT' | 'SS4-STUMBLE';
export interface SecretsSorcererCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; captured?: boolean }
export function isSecretsSorcerer(s: SliceState): boolean { return s.progression.pathwayId === 'door' && s.progression.sequence === 4; }
export function hasSecretsSorcererCombat(s: SliceState): boolean { return s.combat?.encounterId === 'SECRETS_SORCERER_RITUAL' || isSecretsSorcerer(s); }
interface Ability { id: SecretsSorcererMoveId; label: string; weight: number; stance: SliceStance | null }
function abilities(s: SliceState): Ability[] {
  return [
    { id: 'STRIKE', label: '原身体普通主攻（H；12/自有原棍16×身体，G）', weight: 30, stance: 'ATTACK' },
    { id: 'door.s6.release', label: '原STORED记录（J；2灵性，每轮至多首份一次）', weight: 15, stance: 'ATTACK' },
    isSecretsSorcerer(s) ? { id: 'door.s4.space-hiding', label: '原地短暂隐秘折叠（B；6灵性、意志18；经原门回场，G）', weight: 20, stance: 'DEFEND' }
      : { id: 'EVADE', label: '普通避让（B；减势10，G）', weight: 20, stance: 'DEFEND' },
    { id: 'door.s5.travel', label: '本人原侧点去返（K；2+2灵性、意志18，成功形成1受限位置）', weight: 20, stance: 'CONTROL' },
    { id: 'SS4-CAPTURE', label: '本人封合原框箱（R；先2受限位置、6灵性/2精神/1余量、意志22）', weight: 10, stance: 'PREPARE' },
    { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5，G）', weight: 5, stance: null },
  ];
}
function tickets(s: SliceState, stance: SliceStance | null): { entries: Ability[]; weights: number[] } {
  const entries = abilities(s); return { entries, weights: entries.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4)) };
}
export function secretsSorcererAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const { entries, weights } = tickets(s, stance), total = weights.reduce((a,b)=>a+b,0);
  return entries.map((a,i)=>({id:a.id,label:a.label,weight:weights[i]!/total*100}));
}
export function drawSecretsSorcererAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): SecretsSorcererMoveId {
  const { entries, weights } = tickets(s,stance); let roll = random.nextInt(1,weights.reduce((a,b)=>a+b,0));
  for (let i=0;i<entries.length;i++) { roll-=weights[i]!; if(roll<=0)return entries[i]!.id; } throw new Error('秘法师动作盘无效');
}
export const secretsSorcererEnemyActionCount = (roll:number):number => roll<=20?2:roll<=70?3:4;
export function drawSecretsSorcererEnemyAbility(random:ActionRandomStream):SecretsSorcererEnemyMoveId {
  const roll=random.nextInt(1,100); return roll<=45?'SS4-EDGE-CUT':roll<=80?'SS4-REFRACTION':roll<=95?'SS4-DISPLACEMENT':'SS4-STUMBLE';
}
export function currentSecretsSorcererCombatSource(s:SliceState) {
  if(!hasSecretsSorcererOpponent(s))return null;
  const r=s.secretsSorcerer.ritual,t=currentSecretsSorcererTarget(s)!,box=currentSecretsSorcererCase(s)!;
  return {runId:s.runId,revision:s.revision,week:s.week,round:s.combat!.round,encounterId:'SECRETS_SORCERER_RITUAL' as const,
    targetId:t.id,entityId:t.entityId,siteId:t.siteId,attemptId:r.attemptId!,caseId:box.id,startHistoryIndex:r.startHistoryIndex!,
    enemyHealth:s.combat!.enemyHealth,enemyMind:s.combat!.enemyMind,playerHealth:s.health,playerMind:s.mind,
    playerClubLocation:s.town.clubLocation,landing:'VERIFIED_DRY_TWO_METRE_FLANK_AND_RETURN' as const,
    exit:'ORIGINAL_GROUND_EXIT_OUTSIDE_EIGHT_METRE_BOUNDARY' as const,hiddenExit:'SAME_ORIGINAL_STONE_ARCH_DOOR' as const,externalCombatHelpers:0 as const};
}
export function createSecretsSorcererRecorderRound(s:SliceState):RecorderRoundContext {
  return {recordingId:hasSecretsSorcererCombat(s)?s.recorder.records.find(r=>storedRecorderCombatRecord(s,r.id)!==null)?.id??null:null,released:false};
}
const none=(label:string):SecretsSorcererCombatEffect=>({label,selfGain:0,enemyReduction:0,threatens:false});
const mastery=(s:SliceState,id:string):number=>0.65+0.35*Math.max(0,Math.min(500,Number.isFinite(s.progression.mastery[id])?s.progression.mastery[id]!:0))/500;
function check(s:SliceState,random:ActionRandomStream,difficulty:number):{success:boolean;chance:number} {
  const chance=computeCheckChance({ability:'will',baseAbility:s.character.coreStats.will,difficulty,modifiers:[]});
  return {success:random.nextInt(1,100)<=chance,chance};
}
export function resolveSecretsSorcererCombatAbility(s:SliceState,id:SecretsSorcererMoveId,physical:number,random:ActionRandomStream,
  source=currentSecretsSorcererCombatSource(s),recordRound:RecorderRoundContext=createSecretsSorcererRecorderRound(s)):SecretsSorcererCombatEffect {
  const current=currentSecretsSorcererCombatSource(s);
  if(!source||!current||Object.entries(current).some(([k,v])=>(source as unknown as Record<string,unknown>)[k]!==v))return none('原活敌、本人原身体、原框箱、当场退路或连续回合无效；0效果、0消耗，不补造来源。');
  const r=s.secretsSorcerer.ritual,a=currentSecretsSorcererAttempt(s)!,box=currentSecretsSorcererCase(s)!,t=currentSecretsSorcererTarget(s)!;
  if(id==='door.s5.travel') {
    if(s.spirituality<4)return none('去返原短旅行：不足去2与回2合计4灵性，本槽0效果，不只付单程、不额外移动。');
    s.spirituality-=4; const test=check(s,random,18);
    if(test.success){r.restraintMarks=Math.min(2,r.restraintMarks+1);a.travelSuccesses+=1;}
    return {...none(`已付去2与回2共4灵性，意志18检定${test.chance}%：${test.success?'原身体和自有原装备经灵界实际到达2米净空侧点，再沿核实返程回到原交手点；牵制同一原兽失衡并进入原箱框线，受限位置+1（最多2）':'失败，原身体和原装备仍在原交手点，已付成本不返'}。不搬走原兽、不追加行动或永久控制；对方实际错位可清除位置。`),enemyReduction:test.success?16*mastery(s,'door.s5.travel'):0};
  }
  if(id==='SS4-CAPTURE') {
    if(r.restraintMarks!==2 || !t.hostileVerified || box.charges<=0 || box.targetId!==null || box.location!=='FLOOR')return none('原箱封合：尚缺两次实际受限位置、空原地面框箱或封合余量，本槽只观察，0消耗；容器不代为抓取原敌。');
    if(s.spirituality<6||s.mind<=2)return none('原箱封合：不足6灵性或无力承受2精神负担，本槽观察，0消耗，不透支、不免费封印。');
    s.spirituality-=6;s.mind-=2;box.charges-=1;a.captureAttempts+=1;const test=check(s,random,22);
    if(!test.success){r.restraintMarks=0;return none(`本人付6灵性、2精神与同一原箱1次余量，意志22检定${test.chance}%失败。原活敌挣开框线，两受限位置消失，余量${box.charges}；原箱仍空，不返还成本。`);}
    box.targetId=t.id;box.sealsIntact=true;t.status='SEALED';
    a.captureEvidence={targetId:t.id,caseId:box.id,attemptId:a.id,equivalentSequence:4,hostileAtCapture:true,
      ownTravelControls:a.travelSuccesses,externalCombatHelpers:0,terminalHistoryIndex:s.combatHistory.length};
    return {...none(`本人付6灵性、2精神与1封合余量，意志22检定${test.chance}%成功，亲自把已受限的同一原活敌封入原箱${box.id}。它仍活着且敌对，原箱余量${box.charges}；封印立即结束交战，剩余动作与伤势盘均不执行。`),captured:true};
  }
  if(id==='door.s6.release') {
    const record=storedRecorderCombatRecord(s,recordRound.recordingId),effect=releaseStoredRecorderCombatRecord(s,recordRound.recordingId,t.name,recordRound);
    if(!effect)return none('本轮没有首份真实STORED旧记录、已释放一次或不足2灵性；本槽0效果，不补样本或重选第二份。');
    if(record?.sample==='FLASH'&&r.refraction){r.refraction=false;effect.label+='；这同一次原闪光也照明一层折光使其消散，不新增控制位置、攻击或捕获。';}
    return effect;
  }
  if(id==='door.s4.space-hiding') {
    if(!isSecretsSorcerer(s))return none('序列5没有隐秘空间，本槽0效果、0消耗。');
    if(s.spirituality<6)return {...none('灵性不足6，诚实回退普通避让，本槽对方−10，不建立隐秘空间。'),enemyReduction:10};
    s.spirituality-=6;const test=check(s,random,18);
    return {...none(`耗6灵性，意志18检定${test.chance}%：${test.success?'把本人原立足小段折成短暂隐秘部分，实际经该部分唯一原石拱门退出并在本槽结束前解除折叠，回到同一交手点；对方−24×掌握':'折叠失败，本人原身体仍在原交手点'}。不整场消失、不阻断原出口、不放逐原敌；实付成本保留（G）。`),enemyReduction:test.success?24*mastery(s,'door.s4.space-hiding'):0};
  }
  if(id==='ACCIDENT')return {...none('判断失衡：本槽固定优势−22.5（G），不重抽或另送行动。'),selfGain:-22.5};
  if(id==='EVADE')return {...none('本人原身体普通避让，对方优势−10（G），不耗灵性或保证免伤。'),enemyReduction:10};
  const factor=Math.max(0,Math.min(1,Number.isFinite(physical)?physical:0));
  if(r.refraction){r.refraction=false;return none('本人普通原身体打击击中同一原兽的一层折光，折光消耗，本次贡献与致伤许可0；不撤销此前攻击，不复制原兽。');}
  return {...none(`本人以${s.town.clubLocation==='HAND'?'自己的原普通短棍':'原身体'}普通主攻，真实伤势由共享胜负与后果盘结算；不是框箱自动攻击（G）。`),selfGain:(s.town.clubLocation==='HAND'?16:12)*factor,threatens:factor>0};
}
export function resolveSecretsSorcererEnemyAbility(s:SliceState,id:SecretsSorcererEnemyMoveId,physical:number):SecretsSorcererCombatEffect {
  if(!hasSecretsSorcererOpponent(s))return none('同场原兽来源失效，不生成新的敌人、替身或攻击。');
  const r=s.secretsSorcerer.ritual,factor=Math.max(0,Math.min(1,Number.isFinite(physical)?physical:0));
  if(id==='SS4-EDGE-CUT'){const powered=r.enemySpirituality>=2;if(powered)r.enemySpirituality-=2;
    return {...none(powered?'原兽耗2有限灵性施展真实刃切，优势+90×身体（G）。':'原兽灵性不足2，同一身体原爪+24×身体（G），不恢复灵性或重抽。'),selfGain:(powered?90:24)*factor,threatens:factor>0};}
  if(id==='SS4-REFRACTION'){if(r.enemySpirituality<4)return none('原兽不足4灵性，本槽观察，不补充灵性。');r.enemySpirituality-=4;r.refraction=true;
    return none('原兽耗4灵性维持同一身体的一层折光，只挡下一普通打击，不叠层、不复制原兽。');}
  if(id==='SS4-DISPLACEMENT'){if(r.enemySpirituality<5)return none('原兽不足5灵性，本槽观察，原受限位置保留。');r.enemySpirituality-=5;r.restraintMarks=0;
    return {...none('原兽耗5灵性在同一原石拱内真实错位，挣脱框线，清除本人累积的受限位置并增势30（G）；不跃出8米固有边界。'),selfGain:30};}
  return none('原兽踉跄：本槽0贡献，有限灵性不自动恢复。');
}
export function finishSecretsSorcererCombatRound(s:SliceState):SecretsSorcererRoundOutcome {
  const r=s.secretsSorcerer.ritual,c=s.combat!,t=currentSecretsSorcererTarget(s)!,box=currentSecretsSorcererCase(s)!;
  t.body={health:c.enemyHealth,mind:c.enemyMind,spirituality:r.enemySpirituality,injuries:c.enemyInjuries.map(i=>({...i})),risk:c.enemyRisk};
  return {targetId:t.id,attemptId:r.attemptId!,enemyHealth:c.enemyHealth,enemyMind:c.enemyMind,enemySpirituality:r.enemySpirituality,
    enemyStatus:t.status==='SEALED'&&box.targetId===t.id&&box.sealsIntact?'SEALED':c.enemyStatus==='DEAD'?'DEAD':'RESISTING',caseId:box.id,charges:box.charges,restraintMarks:r.restraintMarks};
}
export function projectSecretsSorcererCombat(s:SliceState) {
  const r=s.secretsSorcerer.ritual,t=currentSecretsSorcererTarget(s),box=currentSecretsSorcererCase(s);
  return {enemyName:`${t?.name??'磁门折光兽'}（原创G，序列4等价敌对生物）`,enemySpirituality:r.enemySpirituality,
    targetId:t?.id??'',entityId:t?.entityId??'',originalArchId:t?.siteId??'',mode:r.mode,hostileVerified:t?.hostileVerified??false,
    refraction:r.refraction,restraintMarks:r.restraintMarks,caseId:box?.id??null,charges:box?.charges??0,externalCombatHelpers:0};
}
