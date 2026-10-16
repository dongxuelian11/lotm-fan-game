import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from '../civilization-enlightener/types.js';
import {KNOWLEDGE_MENTOR_ABILITY_IDS} from '../knowledge-mentor/types.js';
import {ARCANE_SCHOLAR_ABILITY_IDS} from '../arcane-scholar/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAVANT_ABILITY_IDS } from '../savant/types.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../archaeologist/types.js';
import { APPRAISER_ABILITY_IDS } from '../appraiser/types.js';
import { ARTISAN_ABILITY_IDS } from '../artisan/types.js';
import { ASTRONOMER_ABILITY_IDS } from '../astronomer/types.js';
import {
  createAlchemistRitualState, currentAlchemistPlot, hasAlchemistRitualLock, canConsumeAlchemistRitual,
  closeAlchemistRitual, validateAlchemistRitualState, validateAlchemistRitualCommand,
  applyAlchemistRitualCommand, alchemistRitualActions, projectAlchemistRitual,
} from './ritual.js';
import {
  createAlchemistLifeState, validateAlchemistLife, projectAlchemistLife, alchemistLifeActions,
  hasAlchemistLifeLock, validateAlchemistActivityCommand,
} from './life.js';
import {
  createAlchemistEncounterState, validateAlchemistEncounter, projectAlchemistEncounter,
  alchemistEncounterActions, hasAlchemistEncounterLock, validateAlchemistEncounterCommand,
  applyAlchemistEncounter,
} from './encounter.js';
import {
  ALCHEMIST_ABILITIES, ALCHEMIST_BOTTLE_IDS, ALCHEMIST_CONSUMPTION_RISK, ALCHEMIST_FORMULA_STATUS,
  ALCHEMIST_GUIDE, ALCHEMIST_LABOUR_STEPS, ALCHEMIST_LABOUR_TASKS, ALCHEMIST_MIN_ASTRONOMER_WEEKS,
  ALCHEMIST_POTION_SOURCES, ALCHEMIST_PRICES, ALCHEMIST_RITUAL_SOURCE, ALCHEMIST_SOURCE_STATUS,
} from './content.js';
import {
  ALCHEMIST_ABILITY_IDS, type AlchemistAcquisitionCommand, type AlchemistAction, type AlchemistBottle,
  type AlchemistCommand, type AlchemistProjection, type AlchemistState,
} from './types.js';

const freshBottle = (id: string, source: string, stockedWeek: number | null): AlchemistBottle => ({
  id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
  ritualId: null, ritualWindowWeek: null,
});
export function createAlchemistState(): AlchemistState {
  return {
    guidanceKnown: false, bottles: ALCHEMIST_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, astronomerActingAtPromotion: null,
    ritual: createAlchemistRitualState(), life: createAlchemistLifeState(), encounter: createAlchemistEncounterState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isAlchemist = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 4;
const hasAlchemistHistory = (s:SliceState) => isAlchemist(s)||(s.progression.pathwayId==='paragon'&&(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)));
const isAstronomer = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.savant.discovered && s.astronomer.guidanceKnown && s.astronomer.promotionWeek !== null && (isAstronomer(s) || hasAlchemistHistory(s));
const bottleNumber = (bottle: Pick<AlchemistBottle, 'id'>) => Number(bottle.id.slice('alchemist-potion-'.length));
const potionPrice = (bottle: AlchemistBottle) => ALCHEMIST_PRICES.potion - (bottle.labourSteps === ALCHEMIST_LABOUR_STEPS ? ALCHEMIST_PRICES.labourCredit : 0);
const astronomerWeeks = (s: SliceState) => Math.max(0, (s.alchemist.promotionWeek ?? s.week) - (s.astronomer.promotionWeek ?? s.week));
const exhaustedSupply = (state: AlchemistState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ALCHEMIST_GUIDE}的独立炼金术士成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4炼金术士原瓶alchemist-potion-${number}，非通识者至天文学家旧瓶改装。完整配方仍未知，真实活园投入与仪式另行完成。`;

export function alchemistAcquisitionBlock(s: SliceState, command: AlchemistAcquisitionCommand): string | null {
  const state = s.alchemist, ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (Object.values(s.astronomer.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED') || hasAlchemistLifeLock(s) || hasAlchemistEncounterLock(s)) return '先实际结束原天文学家现场、自制造物实践或当前冲突。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须实际返回贝克兰德的原导师与独立研究园。';
  if (!knownChannel(s)) return '先成为天文学家并保有埃德温·沃德的原指导渠道。';
  if (hasAlchemistHistory(s)) return '已经完成炼金术士晋升，不能重复准备或服药；未用原瓶保留。';
  if (hasAlchemistRitualLock(s) && command.type !== 'CONSUME') return '你仍实际在当前研究园内；先独立确认饮药，或0行动沿原路离场。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (state.guidanceKnown) return '已经听过已知仪式特征、未知边界与导师方案G风险。';
    return s.cash < ALCHEMIST_PRICES.guidance ? '本次指导需要520便士。' : null;
  }
  if (!state.guidanceKnown) return '先听原导师说明成品来源、研究园实际损毁与四档风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已申请后续三瓶，须等下一真实周实际到货。';
    return exhaustedSupply(state) ? null : '现有全部原瓶须真实耗尽且失败，才能申请后续供给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '尚未申请后续炼金术士原瓶。';
    if (s.week <= state.resupply.requestedWeek) return '下一真实周起才能实际接收后续原瓶。';
    return exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = state.bottles.find(item => item.id === command.bottleId);
  if (!bottle) return '所选炼金术士原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '须独立确认本次饮用这瓶原魔药；抽取生命的确认不能替代。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未实际交付，或已经耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药前须健康>20且精神>40；可0行动退出后正常休养，损毁土地不会恢复。';
    if (s.progression.acting !== 100) return `天文学家尚未完全消化，当前扮演${s.progression.acting}/100。`;
    if (s.astronomer.promotionWeek === null || astronomerWeeks(s) < ALCHEMIST_MIN_ASTRONOMER_WEEKS) return `成为天文学家后已度过${astronomerWeeks(s)}/12整周。`;
    return canConsumeAlchemistRitual(s) ? null : '须本周亲自在实际抽取全部生命力的原研究园内服药；未抽取、离场、旧枯地或过期窗口都不能替代。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯抵扣劳动。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= ALCHEMIST_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the working copy supplied by the shared, atomic intent boundary. */
export function applyAlchemistAcquisition(s: SliceState, command: AlchemistAcquisitionCommand, c: SeerContext): void {
  rule(validateAlchemistAcquisitionCommand(command), '炼金术士准备命令无效。');
  const blocked = alchemistAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法继续。');
  const state = s.alchemist;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= ALCHEMIST_PRICES.guidance; state.guidanceKnown = true;
      c.note('听取炼金术士导师方案G', `花1行动、520便士，向原导师${ALCHEMIST_GUIDE}了解原瓶来源、实际损毁与四档风险。${ALCHEMIST_FORMULA_STATUS}${ALCHEMIST_RITUAL_SOURCE}`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!;
      s.actionsRemaining -= 1; bottle.labourSteps += 1;
      c.note(ALCHEMIST_LABOUR_TASKS[bottle.labourSteps - 1]!, `为第${bottleNumber(bottle)}原瓶实际完成一次对应劳务，花1行动，现为${bottle.labourSteps}/5。完成五次仅抵本瓶6300便士，仍须支付900便士；部分劳动不折现或转移。原瓶仍在供应方，不产生配方、活园或完成的仪式。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      c.note('炼金术士独立原瓶实际交付', `支付${paid}便士、0行动，实际取得${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五次劳动抵6300便士，另付900便士。' : '原价7200便士，未完成五次劳动不部分抵扣。'}没有附送活园、材料配方或生命力；尚未服用。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请后三瓶炼金术士成品', `现有全部原瓶已耗尽失败。花1行动核对原记录，最早第${s.week + 1}周实际到货三瓶；此刻没有新瓶。每瓶仍需7200便士或本瓶五次劳动后900便士，旧损毁土地不会重置。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < ALCHEMIST_BOTTLE_IDS.length; offset += 1) {
        const number = first + offset; state.bottles.push(freshBottle(`alchemist-potion-${number}`, deliverySource(number, s.week), s.week));
      }
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('后续三瓶炼金术士成品实际到货', `第${s.week}周，第${first}至${first + 2}独立原瓶实际入供应方库存，0行动，尚未付费交付。所有旧失败原瓶、死亡植物、沙土和干池完整保留。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, plot = currentAlchemistPlot(s);
      rule(plot !== undefined && plot.windowWeek === s.week, '缺少本周当前原研究园的真实抽取窗口。');
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier;
      bottle.ritualId = plot.id; bottle.ritualWindowWeek = plot.windowWeek;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mindCost); state.astronomerActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of ALCHEMIST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        closeAlchemistRitual(s, bottle.id);
        c.note('在真实抽取窗口中成为炼金术士', `${bottle.id}于原研究园${plot.id}耗尽。意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}；精神−${mindCost}、四属性各+1。天文学家消化100与旧掌握保留，两项新掌握从0，灵性上限120但当前不补满，身体性别不变。你实际离场，死亡植物、沙土和干池保留；生命力不会返还，旧窗口不能重复使用。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        closeAlchemistRitual(s, bottle.id);
        c.note(severe ? '炼金术士魔药严重排异' : '炼金术士魔药排异', `${bottle.id}于${plot.id}耗尽；意志${result.roll}/${result.chance}，健康−${healthCost}、精神−${mindCost}、排异+${pollution}。本作G监督仅让此次药物排异保底1；仍为天文学家，旧消化与掌握完整保留。你实际沿原路离场，已经死亡的植物、沙土和干池永久留下。可正常休养，另一原瓶须配合另付成本取得的新活园，等下一真实周重新进入，不能复活原地。`);
      }
      return;
    }
  }
}
export function applyAlchemistCommand(s: SliceState, command: AlchemistCommand, c: SeerContext): void {
  rule(validateAlchemistCommand(command), '炼金术士命令无效。');
  if (validateAlchemistAcquisitionCommand(command)) return applyAlchemistAcquisition(s, command, c);
  if (validateAlchemistRitualCommand(command)) return applyAlchemistRitualCommand(s, command, c);
  if (validateAlchemistEncounterCommand(command)) return applyAlchemistEncounter(s, command, c);
  throw new Error('炼金术士生活实践须由共享入口结算实际掌握与消化。');
}

export function projectAlchemist(s: SliceState): AlchemistProjection {
  const state = s.alchemist, available = knownChannel(s), promoted = hasAlchemistHistory(s), known = available && state.guidanceKnown, actions: AlchemistAction[] = [];
  const add = (id: string, label: string, cost: string, command: AlchemistAcquisitionCommand) => {
    const reason = alchemistAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!known) add('learn-alchemist-guidance', '了解已知仪式特征、未知条件与导师方案G', '1行动 · 520便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-alchemist-supply', '确认后三瓶成品实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周 · 尚须逐瓶付费`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-alchemist-supply', '申请后三瓶独立成品', '1行动 · 下一真实周起到货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${ALCHEMIST_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵6300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶炼金术士魔药`, `0行动 · ${potionPrice(bottle)}便士 · 不附送活园`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `在当前实际抽取窗口服用第${bottleNumber(bottle)}瓶`, `0行动 · 独立确认 · 天文学家${s.progression.acting}/100 · ${astronomerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '炼金术士 · 序列4' : '炼金术士之路', discovered: available, guidanceKnown: known, promoted,
    formulaKnown: false, formula: [], actions: available && ![3,2,1].includes(s.progression.sequence??0) ? [...actions, ...alchemistRitualActions(s), ...alchemistLifeActions(s), ...alchemistEncounterActions(s)] : [],
    bottles: known ? state.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 独立炼金术士成品`, source: `${bottle.source}${bottle.ritualId ? `第${bottle.ritualWindowWeek}周在原研究园${bottle.ritualId}真实抽取窗口服用；损毁保留。` : ''}`,
      status: bottle.status === 'SUPPLIER' ? '原供应方持有，未交付' : bottle.status === 'PLAYER' ? '你实际持有，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为天文学家' : '排异，仍为天文学家'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? ALCHEMIST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?s.arcaneScholar.alchemistActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `天文学家消化${state.astronomerActingAtPromotion}/100与原掌握保留；炼金术士扮演${(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?s.arcaneScholar.alchemistActingAtPromotion:s.progression.acting}/100。` : available ? `天文学家消化需100（当前${s.progression.acting}/100），晋升后满12整周（${astronomerWeeks(s)}/12）；真实活园投入与当前抽取窗口须另行完成，可选择保持天文学家。` : '先完成天文学家之路。',
    pollution: s.seer.pollution, risk: known ? ALCHEMIST_CONSUMPTION_RISK : '先通过原导师了解炼金术士成品来源与实际仪式风险。',
    supplies: known ? `供应方持有${state.bottles.filter(bottle => bottle.status === 'SUPPLIER').length}瓶，你持有未用原瓶${state.bottles.filter(bottle => bottle.status === 'PLAYER').length}瓶。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}批。` : `第${state.resupply.requestedWeek}周申请，下一真实周起实际到货。`}成品配方仍未知，原瓶、实际活园与抽取生命分别结算。` : '',
    ...(available ? { story: `${ALCHEMIST_FORMULA_STATUS}${ALCHEMIST_RITUAL_SOURCE}${ALCHEMIST_SOURCE_STATUS}` } : {}),
    ritual: projectAlchemistRitual(s), life: projectAlchemistLife(s), encounter: projectAlchemistEncounter(s),
    insideCase: hasAlchemistRitualLock(s) || hasAlchemistLifeLock(s) || hasAlchemistEncounterLock(s),
    environment: available ? '原导师货栈、独立购入的封闭研究园与有限制造工房。实际原物、原植物和损毁状态持续保存，不复用他人旧灯或旧观测仪器。' : '',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateAlchemistAcquisitionCommand(v: unknown): v is AlchemistAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (typeof v.bottleId !== 'string' || !/^alchemist-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isAlchemistAcquisitionCommand = validateAlchemistAcquisitionCommand;
export function validateAlchemistCommand(v: unknown): v is AlchemistCommand {
  return validateAlchemistAcquisitionCommand(v) || validateAlchemistRitualCommand(v) || validateAlchemistActivityCommand(v) || validateAlchemistEncounterCommand(v);
}
export function validateAlchemistState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.alchemist;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'astronomerActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.astronomer) || !record(s.savant)) return false;
  const firstWeek = s.astronomer.promotionWeek ?? s.week, earliestConsumption = firstWeek + ALCHEMIST_MIN_ASTRONOMER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - earliestConsumption))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, earliestConsumption, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1)) return false;
  const state = raw as unknown as AlchemistState, promoted = hasAlchemistHistory(s), latestAcquisition = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.astronomer.promotionWeek, 1, s.week) || !integer(state.promotionWeek, earliestConsumption, s.week) || state.astronomerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?CIVILIZATION_ENLIGHTENER_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?KNOWLEDGE_MENTOR_ABILITY_IDS:[]),...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS, ...ARTISAN_ABILITY_IDS, ...ASTRONOMER_ABILITY_IDS, ...ALCHEMIST_ABILITY_IDS,...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?ARCANE_SCHOLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.astronomerActingAtPromotion !== null || ALCHEMIST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome', 'ritualId', 'ritualWindowWeek']) || bottle.id !== `alchemist-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  if (!validateAlchemistRitualState(s) || !validateAlchemistLife(s) || !validateAlchemistEncounter(s)) return false;
  let successes = 0;
  const usedPlots = new Set<string>();
  for (const [index, bottle] of state.bottles.entries()) {
    if (index < 3) {
      if (bottle.stockedWeek !== null || bottle.source !== ALCHEMIST_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.stockedWeek, earliestConsumption + 1, latestAcquisition) || bottle.source !== deliverySource(index + 1, bottle.stockedWeek)) return false;
      const start = Math.floor(index / 3) * 3;
      if (bottle.stockedWeek !== state.bottles[start]!.stockedWeek || state.bottles.slice(0, start).some(old => old.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(old.outcome ?? '') || !integer(old.consumedWeek, earliestConsumption, bottle.stockedWeek! - 1))) return false;
    }
    const stockWeek = bottle.stockedWeek ?? firstWeek;
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.acquiredWeek, stockWeek, latestAcquisition)) return false;
      if (bottle.status === 'PLAYER') { if (bottle.consumedWeek !== null || bottle.outcome !== null) return false; }
      else if (bottle.status === 'CONSUMED') {
        if (!integer(s.astronomer.promotionWeek, 1, s.week) || !integer(bottle.consumedWeek, Math.max(earliestConsumption, bottle.acquiredWeek), latestAcquisition) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '')) return false;
        if (!promoted && s.progression.acting !== 100) return false;
        if (typeof bottle.ritualId !== 'string' || usedPlots.has(bottle.ritualId) || bottle.ritualWindowWeek !== bottle.consumedWeek) return false;
        usedPlots.add(bottle.ritualId);
        const plot = state.ritual.plots.find(item => item.id === bottle.ritualId);
        if (!plot || plot.consumedBottleId !== bottle.id || plot.windowWeek !== bottle.consumedWeek || plot.closedWeek !== bottle.consumedWeek) return false;
      } else return false;
    }
    if (bottle.status !== 'CONSUMED' && (bottle.ritualId !== null || bottle.ritualWindowWeek !== null)) return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== state.promotionWeek) return false; }
  }
  if (state.ritual.plots.some(plot => plot.consumedBottleId !== null && !state.bottles.some(bottle => bottle.id === plot.consumedBottleId && bottle.ritualId === plot.id && bottle.status === 'CONSUMED'))) return false;
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0);
}

export { ALCHEMIST_ABILITIES } from './content.js';
export type * from './types.js';
