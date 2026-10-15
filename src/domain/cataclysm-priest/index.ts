import { CATASTROPHE_ABILITY_IDS } from '../catastrophe/types.js';
import {SEA_KING_ABILITY_IDS} from '../sea-king/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAILOR_ABILITY_IDS } from '../sailor/types.js';
import { RAGER_ABILITY_IDS } from '../rager/types.js';
import { NAVIGATOR_ABILITY_IDS } from '../navigator/types.js';
import { WIND_BLESSED_ABILITY_IDS } from '../wind-blessed/types.js';
import { OCEAN_SINGER_ABILITY_IDS } from '../ocean-singer/types.js';
import { oceanSingerInside } from '../ocean-singer/life.js';
import { windBlessedInside } from '../wind-blessed/life.js';
import {
  createCataclysmPriestRitualState, currentCataclysmPriestVisit, hasCataclysmPriestRitualLock, canConsumeCataclysmPriestRitual,
  recordCataclysmPriestRitualDrink, validateCataclysmPriestRitualState, validateCataclysmPriestRitualCommand,
  applyCataclysmPriestRitualCommand, cataclysmPriestRitualActions, projectCataclysmPriestRitual,
} from './ritual.js';
import {
  createCataclysmPriestLifeState, validateCataclysmPriestLife, projectCataclysmPriestLife, cataclysmPriestLifeActions,
  hasCataclysmPriestLifeLock, validateCataclysmPriestActivityCommand,
} from './life.js';
import {
  createCataclysmPriestEncounterState, validateCataclysmPriestEncounter, projectCataclysmPriestEncounter,
  cataclysmPriestEncounterActions, hasCataclysmPriestEncounterLock, validateCataclysmPriestEncounterCommand, applyCataclysmPriestEncounter,
} from './encounter.js';
import {
  CATACLYSM_PRIEST_ABILITIES, CATACLYSM_PRIEST_POTION_SOURCES, CATACLYSM_PRIEST_PRICES, CATACLYSM_PRIEST_LABOUR_STEPS,
  CATACLYSM_PRIEST_LABOUR_TASKS, CATACLYSM_PRIEST_GUIDE, CATACLYSM_PRIEST_MIN_OCEAN_SINGER_WEEKS,
  CATACLYSM_PRIEST_FORMULA_STATUS, CATACLYSM_PRIEST_RITUAL_SOURCE, CATACLYSM_PRIEST_SOURCE_STATUS, CATACLYSM_PRIEST_CONSUMPTION_RISK,
} from './content.js';
import { CATACLYSM_PRIEST_ABILITY_IDS, type CataclysmPriestAcquisitionCommand, type CataclysmPriestAction, type CataclysmPriestBottle, type CataclysmPriestCommand, type CataclysmPriestProjection, type CataclysmPriestState } from './types.js';

const freshBottle = (id: string, source: string, stockedWeek: number | null): CataclysmPriestBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null, ritualId: null, ritualWindowWeek: null });
export function createCataclysmPriestState(): CataclysmPriestState {
  return { guidanceKnown: false, bottles: CATACLYSM_PRIEST_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)), resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, oceanSingerActingAtPromotion: null, ritual: createCataclysmPriestRitualState(), life: createCataclysmPriestLifeState(), encounter: createCataclysmPriestEncounterState() };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isCataclysmPriest = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 4;
const hasCataclysmPriestHistory = (s:SliceState) => isCataclysmPriest(s)||(s.progression.pathwayId==='tyrant'&&(s.progression.sequence===3||s.progression.sequence===2));
const isOceanSinger = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.sailor.discovered && s.sailor.guidanceKnown && s.rager.guidanceKnown && s.navigator.guidanceKnown && s.windBlessed.guidanceKnown && s.oceanSinger.guidanceKnown && s.oceanSinger.promotionWeek !== null && (isOceanSinger(s) || hasCataclysmPriestHistory(s));
const numberOf = (b: Pick<CataclysmPriestBottle, 'id'>) => Number(b.id.slice('cataclysm-priest-potion-'.length));
const potionPrice = (b: CataclysmPriestBottle) => CATACLYSM_PRIEST_PRICES.potion - (b.labourSteps === CATACLYSM_PRIEST_LABOUR_STEPS ? CATACLYSM_PRIEST_PRICES.labourCredit : 0);
const oceanSingerWeeks = (s: SliceState) => Math.max(0, (s.cataclysmPriest.promotionWeek ?? s.week) - (s.oceanSinger.promotionWeek ?? s.week));
/** A raw successful potion followed by withdrawal is still spent and can be replenished. */
const exhaustedSupply = (state: CataclysmPriestState) => state.promotionWeek === null && state.ritual.activeVisitId === null && state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED');
const deliverySource = (n: number, week: number) => `${CATACLYSM_PRIEST_GUIDE}的独立灾难主祭成品交接渠道本作G第${Math.ceil(n / 3)}批，第${week}周实际入库；独立序列4原瓶cataclysm-priest-potion-${n}，非旧瓶改装。完整配方未知，另需新原场地与撑至海啸结束。`;
export function cataclysmPriestAcquisitionBlock(s: SliceState, command: CataclysmPriestAcquisitionCommand): string | null {
  const state = s.cataclysmPriest, ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '本人须仍活着且能够行动。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (oceanSingerInside(s) || windBlessedInside(s) || hasCataclysmPriestLifeLock(s) || hasCataclysmPriestEncounterLock(s)) return '先实际结束当前原现场、停止效果并沿原路返回。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须实际返回贝克兰德原渠道与近岸。';
  if (!knownChannel(s)) return '先成为海洋歌者并保有艾洛的原指导渠道。';
  if (hasCataclysmPriestHistory(s)) return '已经完成灾难主祭晋升，未用原瓶保留，不能重复服药。';
  if (hasCataclysmPriestRitualLock(s) && command.type !== 'CONSUME') return '本人仍在实际仪式平台，须撑至结束或沿原阶撤离后再筹备。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听过本阶成品来源、真实仪式与风险。' : s.cash < 520 ? '本次指导需要520便士。' : null;
  if (!state.guidanceKnown) return '先听艾洛说明原瓶来源与真实地震海啸风险。';
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已申请，须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '所有现有原瓶须已耗尽、本场已实际结束且尚未晋升，才能申请新批次。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请后续原瓶。' : s.week <= state.resupply.requestedWeek ? '须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '当前原瓶或本场尚未结清，不能补货。';
  const b = state.bottles.find(item => item.id === command.bottleId);
  if (!b) return '所选灾难主祭原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '须独立确认饮用本瓶，启动地震的确认不能替代。';
    if (b.status !== 'PLAYER') return '所选原瓶未实际交付或已耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药前须健康>20、精神>40；可以实际撤退后休养。';
    if (s.progression.acting !== 100) return `海洋歌者须消化100，当前${s.progression.acting}/100。`;
    if (oceanSingerWeeks(s) < CATACLYSM_PRIEST_MIN_OCEAN_SINGER_WEEKS) return `成为海洋歌者后仅${oceanSingerWeeks(s)}/12整周。`;
    return canConsumeCataclysmPriestRitual(s) ? null : '须本人在本周原平台，原人员已实际撤离，核验后引发真实地震海啸并处于本次第一波前窗口。';
  }
  if (b.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯劳动。';
  if (command.type === 'POTION_WORK') return b.labourSteps >= 5 ? '本瓶五次实际劳务已完成。' : null;
  return s.cash < potionPrice(b) ? `领取本瓶需要${potionPrice(b)}便士。` : null;
}
export function applyCataclysmPriestAcquisition(s: SliceState, command: CataclysmPriestAcquisitionCommand, c: SeerContext): void {
  rule(validateCataclysmPriestAcquisitionCommand(command), '灾难主祭筹备命令无效。');
  const blocked = cataclysmPriestAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法筹备。');
  const state = s.cataclysmPriest;
  switch (command.type) {
    case 'LEARN_GUIDANCE': s.actionsRemaining -= 1; s.cash -= 520; state.guidanceKnown = true; c.note('了解灾难主祭原瓶与真实仪式风险', `1行动520便士。${CATACLYSM_PRIEST_FORMULA_STATUS}${CATACLYSM_PRIEST_RITUAL_SOURCE}`); return;
    case 'POTION_WORK': { const b = state.bottles.find(b => b.id === command.bottleId)!; s.actionsRemaining -= 1; b.labourSteps += 1; c.note(CATACLYSM_PRIEST_LABOUR_TASKS[b.labourSteps - 1]!, `1行动，为${b.id}完成本瓶第${b.labourSteps}/5次实际劳动；五次只抵本瓶6300便士，另付900便士。不跨瓶转移或折现。`); return; }
    case 'BUY_POTION': { const b = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(b); s.cash -= paid; b.status = 'PLAYER'; b.acquiredWeek = s.week; c.note('独立灾难主祭原瓶实际交付', `0行动支付${paid}便士，取得${b.id}；没有附送场地、原包、完整配方或完成的仪式。`); return; }
    case 'REQUEST_SUPPLY': s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week; c.note('申请后续三瓶独立原瓶', `1行动。旧瓶全部真实耗尽且无未结束本场，最早第${s.week + 1}周实到；药效成功但中途撤退的旧瓶同样不复原。`); return;
    case 'RECEIVE_SUPPLY': { const start = state.bottles.length + 1; for (let i = 0; i < 3; i++) state.bottles.push(freshBottle(`cataclysm-priest-potion-${start + i}`, deliverySource(start + i, s.week), s.week)); state.resupply.deliveries += 1; state.resupply.requestedWeek = null; c.note('新批灾难主祭原瓶实际入库', `0行动，第${start}至${start + 2}瓶实际到供应方；每瓶仍需独立付费或完成本瓶劳务。旧瓶、旧场损伤和旧失败记录保留。`); return; }
    case 'CONSUME': {
      const b = state.bottles.find(b => b.id === command.bottleId)!, v = currentCataclysmPriestVisit(s)!;
      const result = c.check('will', 28), success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      b.status = 'CONSUMED'; b.consumedWeek = s.week; b.outcome = result.tier; b.ritualId = v.id; b.ritualWindowWeek = s.week;
      const healthCost = success ? 0 : result.tier === 'GREAT_FAILURE' ? 25 : 15, mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : result.tier === 'SUCCESS' ? 15 : result.tier === 'GREAT_FAILURE' ? 45 : 25;
      s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost);
      if (!success) s.seer.pollution = Math.min(100, s.seer.pollution + (result.tier === 'GREAT_FAILURE' ? 60 : 30));
      recordCataclysmPriestRitualDrink(s, b.id);
      c.note(success ? '原瓶药效成功，但尚未撑至结束' : '原瓶发生排异，仍须面对实际海潮', `0行动，意志${result.roll}/${result.chance}，原始结果${result.tier}；健康−${healthCost}、精神−${mindCost}。${b.id}与${v.kit.id}实际耗尽，仍为海洋歌者，旧扮演100与所有掌握不变。${success ? '本场成功仅暂定；必须实际撑过两次各60秒海浪至退潮才晋升。' : '此次药效不能晋升；可实际撤至高脊，或继续面对海浪直到结束。'}仅药物排异保底1，之后海浪没有保命下限。`); return;
    }
  }
}
/** The second actual hazard has ended. This is the sole S4 promotion boundary. */
function finalizePromotion(s: SliceState, c: SeerContext): void {
  const state = s.cataclysmPriest, v = currentCataclysmPriestVisit(s);
  if (!v || v.phase !== 'ENDED' || v.finishedSuccess || (v.rawOutcome !== 'SUCCESS' && v.rawOutcome !== 'GREAT_SUCCESS')) return;
  rule(s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && v.hazards.length === 2 && v.hazards.every(h => h.healthAfter > 0) && v.elapsedSeconds === 120 && v.site.sea === 'RECEDED' && isOceanSinger(s) && s.progression.acting === 100 && state.promotionWeek === null, '须本次真实撑过两次海浪至退潮才能晋升。');
  v.finishedSuccess = true; state.promotionWeek = s.week; state.oceanSingerActingAtPromotion = s.progression.acting; s.progression.sequence = 4; s.progression.acting = 0;
  for (const id of CATACLYSM_PRIEST_ABILITY_IDS) s.progression.mastery[id] = 0;
  for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
  c.note('真正撑到地震海啸结束，晋升灾难主祭', `本场${v.id}原始药效${v.rawOutcome}且两次真实海浪后仍活着，才在本周完成序列4。四属性各+1，旧掌握与海洋歌者消化100保留，三项新掌握0、扮演0；灵性上限120但当前不补满、身体性别不变。本人仍在原平台，须沿仍通畅上侧回阶实际走到高脊；原环境破坏永久记录。`);
}
export function applyCataclysmPriestCommand(s: SliceState, command: CataclysmPriestCommand, c: SeerContext): void {
  rule(validateCataclysmPriestCommand(command), '灾难主祭命令无效。');
  if (validateCataclysmPriestAcquisitionCommand(command)) return applyCataclysmPriestAcquisition(s, command, c);
  if (validateCataclysmPriestRitualCommand(command)) { applyCataclysmPriestRitualCommand(s, command, c); finalizePromotion(s, c); return; }
  if (validateCataclysmPriestEncounterCommand(command)) return applyCataclysmPriestEncounter(s, command, c);
  throw new Error('灾难主祭生活实践须由共享入口结算实际掌握与消化。');
}
export function projectCataclysmPriest(s: SliceState): CataclysmPriestProjection {
  const state = s.cataclysmPriest, available = knownChannel(s), promoted = hasCataclysmPriestHistory(s), known = available && state.guidanceKnown, actions: CataclysmPriestAction[] = [];
  const add = (id: string, label: string, cost: string, command: CataclysmPriestAcquisitionCommand) => { const reason = cataclysmPriestAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!known) add('learn-cataclysm-priest-guidance', '了解灾难主祭原瓶与地震海啸仪式', '1行动 · 520便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-cataclysm-priest-supply', '接收实际到货的后三瓶原瓶', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-cataclysm-priest-supply', '申请后三瓶独立原瓶', '1行动 · 下一真实周到货', { type: 'REQUEST_SUPPLY' });
      for (const b of state.bottles) {
        if (b.status === 'SUPPLIER') { if (b.labourSteps < 5) add(`work-${b.id}`, `第${numberOf(b)}瓶 · ${CATACLYSM_PRIEST_LABOUR_TASKS[b.labourSteps]}`, `1行动 · 劳动${b.labourSteps}/5`, { type: 'POTION_WORK', bottleId: b.id }); add(`buy-${b.id}`, `领取第${numberOf(b)}瓶灾难主祭魔药`, `0行动 · ${potionPrice(b)}便士`, { type: 'BUY_POTION', bottleId: b.id }); }
        else if (b.status === 'PLAYER') add(`consume-${b.id}`, `在真实地震海啸中服用第${numberOf(b)}原瓶`, `0行动 · 独立确认 · 海洋歌者${s.progression.acting}/100 · ${oceanSingerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: b.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '灾难主祭 · 序列4' : '灾难主祭之路', discovered: available, guidanceKnown: known, promoted, formulaKnown: false, formula: [],
    actions: available && ![3, 2].includes(s.progression.sequence ?? 0) ? [...actions, ...cataclysmPriestRitualActions(s), ...cataclysmPriestLifeActions(s), ...cataclysmPriestEncounterActions(s)] : [],
    bottles: known ? state.bottles.map(b => { const v = state.ritual.visits.find(v => v.id === b.ritualId); return { id: b.id, title: `第${numberOf(b)}瓶 · 独立灾难主祭成品`, source: b.source + (v ? ` 第${b.consumedWeek}周于${v.siteId}/${v.id}服用，原包${v.kit.id}已耗。` : ''), status: b.status === 'SUPPLIER' ? '原供应方持有，未交付' : b.status === 'PLAYER' ? '你实际持有，未服用' : `原瓶已耗 · 原始药效${b.outcome} · ${v?.finishedSuccess ? '撑至结束后已完成晋升' : v && ['DRUNK', 'FIRST_WAVE'].includes(v.phase) ? '仍在真实海潮中，药效暂定，尚未晋升' : '本场未完成晋升'}`, chance, command: { type: 'CONSUME' as const, bottleId: b.id, confirmed: true as const } }; }) : [],
    abilities: promoted ? CATACLYSM_PRIEST_ABILITIES.filter(a => Object.hasOwn(s.progression.mastery, a.id)).map(a => ({ ...a, mastery: s.progression.mastery[a.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.seaKing.cataclysmPriestActingAtPromotion??100:s.progression.acting) : 0, digestion: promoted ? `海洋歌者消化${state.oceanSingerActingAtPromotion}/100与旧掌握保留，灾难主祭${(s.progression.sequence===3||s.progression.sequence===2)?s.seaKing.cataclysmPriestActingAtPromotion:s.progression.acting}/100。` : available ? `海洋歌者需消化100（当前${s.progression.acting}/100），满12整周（${oceanSingerWeeks(s)}/12）；服药成功仍须在本场撑至结束。` : '先完成海洋歌者之路。',
    pollution: s.seer.pollution, risk: known ? CATACLYSM_PRIEST_CONSUMPTION_RISK : '先通过艾洛了解本阶真实风险。', supplies: known ? `供应方${state.bottles.filter(b => b.status === 'SUPPLIER').length}原瓶；你持有${state.bottles.filter(b => b.status === 'PLAYER').length}未用原瓶；后续已实到${state.resupply.deliveries}批。${state.resupply.requestedWeek === null ? '' : `第${state.resupply.requestedWeek}周申请，下一真实周起实到。`}原瓶、新场地、原包与真实仪式分别记账。` : '',
    ...(available ? { story: CATACLYSM_PRIEST_FORMULA_STATUS + CATACLYSM_PRIEST_RITUAL_SOURCE + CATACLYSM_PRIEST_SOURCE_STATUS } : {}),
    ritual: projectCataclysmPriestRitual(s), life: projectCataclysmPriestLife(s), encounter: projectCataclysmPriestEncounter(s), insideCase: hasCataclysmPriestRitualLock(s) || hasCataclysmPriestLifeLock(s) || hasCataclysmPriestEncounterLock(s),
    environment: available ? '真实持照无人海湾与有限原练习海岸；原潮尺、下步道、浮具、绳与石靶的改变保留。海洋歌者旧原海怪、原船员和历史不被本场重用或改写。' : '',
  };
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateCataclysmPriestAcquisitionCommand(v: unknown): v is CataclysmPriestAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (typeof v.bottleId !== 'string' || !/^cataclysm-priest-potion-[1-9]\d*$/.test(v.bottleId)) return false;
  if (v.type === 'POTION_WORK' || v.type === 'BUY_POTION') return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isCataclysmPriestAcquisitionCommand = validateCataclysmPriestAcquisitionCommand;
export function validateCataclysmPriestCommand(v: unknown): v is CataclysmPriestCommand { return validateCataclysmPriestAcquisitionCommand(v) || validateCataclysmPriestRitualCommand(v) || validateCataclysmPriestActivityCommand(v) || validateCataclysmPriestEncounterCommand(v); }
export function validateCataclysmPriestState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.cataclysmPriest;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'oceanSingerActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || !record(s.progression) || !record(s.progression.mastery) || !record(s.oceanSinger)) return false;
  const first = s.oceanSinger.promotionWeek ?? s.week, earliest = first + 12;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - earliest)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, earliest, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1)) return false;
  const state = raw as unknown as CataclysmPriestState, promoted = hasCataclysmPriestHistory(s), latest = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(state.promotionWeek, earliest, s.week) || state.oceanSingerActingAtPromotion !== 100 || !shape(s.progression.mastery, [...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS, ...NAVIGATOR_ABILITY_IDS, ...WIND_BLESSED_ABILITY_IDS, ...OCEAN_SINGER_ABILITY_IDS, ...CATACLYSM_PRIEST_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?SEA_KING_ABILITY_IDS:[]),...(s.progression.sequence===2?CATASTROPHE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(n => integer(n, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.oceanSingerActingAtPromotion !== null || CATACLYSM_PRIEST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [i, b] of state.bottles.entries()) if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome', 'ritualId', 'ritualWindowWeek']) || b.id !== `cataclysm-priest-potion-${i + 1}` || typeof b.source !== 'string' || !integer(b.labourSteps, 0, 5)) return false;
  if (!validateCataclysmPriestRitualState(s) || !validateCataclysmPriestLife(s) || !validateCataclysmPriestEncounter(s)) return false;
  const used = new Set<string>();
  for (const [i, b] of state.bottles.entries()) {
    if (i < 3) { if (b.stockedWeek !== null || b.source !== CATACLYSM_PRIEST_POTION_SOURCES[i]!.source) return false; }
    else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, earliest + 1, latest) || b.source !== deliverySource(i + 1, b.stockedWeek)) return false;
      const start = Math.floor(i / 3) * 3;
      if (b.stockedWeek !== state.bottles[start]!.stockedWeek || state.bottles.slice(0, start).some(old => old.status !== 'CONSUMED' || !integer(old.consumedWeek, earliest, b.stockedWeek! - 1) || state.ritual.visits.some(v => v.id === old.ritualId && (v.finishedSuccess || v.closedWeek === null || v.closedWeek >= b.stockedWeek!)))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') { if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null) return false; }
    else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, b.stockedWeek ?? first, latest)) return false;
      if (b.status === 'PLAYER') { if (b.consumedWeek !== null || b.outcome !== null) return false; }
      else if (b.status === 'CONSUMED') {
        if (!integer(b.consumedWeek, Math.max(earliest, b.acquiredWeek), latest) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !promoted && s.progression.acting !== 100 || typeof b.ritualId !== 'string' || used.has(b.ritualId) || b.ritualWindowWeek !== b.consumedWeek) return false;
        used.add(b.ritualId); const v = state.ritual.visits.find(v => v.id === b.ritualId);
        if (!v || v.pendingBottleId !== b.id || v.windowWeek !== b.consumedWeek || v.rawOutcome !== b.outcome) return false;
      } else return false;
    }
    if (b.status !== 'CONSUMED' && (b.ritualId !== null || b.ritualWindowWeek !== null)) return false;
  }
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return state.ritual.visits.filter(v => v.finishedSuccess).length === (promoted ? 1 : 0);
}
export { CATACLYSM_PRIEST_ABILITIES } from './content.js';
export { createCataclysmPriestRitualState, currentCataclysmPriestVisit, hasCataclysmPriestRitualLock, canConsumeCataclysmPriestRitual, validateCataclysmPriestRitualState, validateCataclysmPriestRitualCommand, applyCataclysmPriestRitualCommand, cataclysmPriestRitualActions, projectCataclysmPriestRitual } from './ritual.js';
export type * from './types.js';
