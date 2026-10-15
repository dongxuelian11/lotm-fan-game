import { ALL_KNOWING_EYE_ABILITY_IDS } from '../all-knowing-eye/types.js';
import { WISDOM_ANGEL_ABILITY_IDS } from '../wisdom-angel/types.js';
import {INSIGHT_SCHOLAR_ABILITY_IDS} from '../insight-scholar/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { READER_ABILITY_IDS } from '../reader/types.js';
import { REASONER_ABILITY_IDS } from '../reasoner/types.js';
import { DETECTIVE_ABILITY_IDS } from '../detective/types.js';
import { POLYMATH_ABILITY_IDS } from '../polymath/types.js';
import { MYSTICISM_MAGISTER_ABILITY_IDS } from '../mysticism-magister/types.js';
import {
  createProphetRitualState, currentProphetVisit, hasProphetRitualLock, canConsumeProphetRitual,
  closeProphetRitual, validateProphetRitualState, validateProphetRitualCommand,
  applyProphetRitualCommand, prophetRitualActions, projectProphetRitual,
} from './ritual.js';
import {
  createProphetLifeState, validateProphetLife, projectProphetLife, prophetLifeActions,
  hasProphetLifeLock, validateProphetActivityCommand,
} from './life.js';
import {
  createProphetEncounterState, validateProphetEncounter, projectProphetEncounter,
  prophetEncounterActions, hasProphetEncounterLock, validateProphetEncounterCommand,
  applyProphetEncounter,
} from './encounter.js';
import {
  PROPHET_ABILITIES, PROPHET_BOTTLE_IDS, PROPHET_CONSUMPTION_RISK, PROPHET_FORMULA_STATUS,
  PROPHET_GUIDE, PROPHET_LABOUR_STEPS, PROPHET_LABOUR_TASKS, PROPHET_MIN_MYSTICISM_MAGISTER_WEEKS,
  PROPHET_POTION_SOURCES, PROPHET_PRICES, PROPHET_RITUAL_SOURCE, PROPHET_SOURCE_STATUS,
} from './content.js';
import {
  PROPHET_ABILITY_IDS, type ProphetAcquisitionCommand, type ProphetAction, type ProphetBottle,
  type ProphetCommand, type ProphetProjection, type ProphetState,
} from './types.js';

const freshBottle = (id: string, source: string, stockedWeek: number | null): ProphetBottle => ({
  id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
  ritualId: null, ritualWindowWeek: null,
});
export function createProphetState(): ProphetState {
  return {
    guidanceKnown: false, bottles: PROPHET_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, mysticismMagisterActingAtPromotion: null,
    ritual: createProphetRitualState(), life: createProphetLifeState(), encounter: createProphetEncounterState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isProphet = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 4;
const hasProphetHistory = (s:SliceState) => isProphet(s)||(s.progression.pathwayId==='white-tower'&&[3, 2, 1].includes(s.progression.sequence ?? 0));
const isMysticismMagister = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.reader.discovered && s.reader.guidanceKnown && s.reasoner.guidanceKnown && s.detective.guidanceKnown && s.polymath.guidanceKnown && s.mysticismMagister.guidanceKnown && s.mysticismMagister.promotionWeek !== null && (isMysticismMagister(s) || hasProphetHistory(s));
const bottleNumber = (bottle: Pick<ProphetBottle, 'id'>) => Number(bottle.id.slice('prophet-potion-'.length));
const potionPrice = (bottle: ProphetBottle) => PROPHET_PRICES.potion - (bottle.labourSteps === PROPHET_LABOUR_STEPS ? PROPHET_PRICES.labourCredit : 0);
const mysticismMagisterWeeks = (s: SliceState) => Math.max(0, (s.prophet.promotionWeek ?? s.week) - (s.mysticismMagister.promotionWeek ?? s.week));
const exhaustedSupply = (state: ProphetState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PROPHET_GUIDE}的独立预言家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4预言家原瓶prophet-potion-${number}，非阅读者至秘术导师旧瓶改装。完整配方仍未知，当前专业指导仪式与原封装包须另行准备。`;

export function prophetAcquisitionBlock(s: SliceState, command: ProphetAcquisitionCommand): string | null {
  const state = s.prophet, ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (Object.values(s.mysticismMagister.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED')
    || s.mysticismMagister.practice.token !== 'OWNER' || s.mysticismMagister.practice.dreamOpen
    || Object.values(s.polymath.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED')
    || hasProphetLifeLock(s) || hasProphetEncounterLock(s)) return '先实际结束旧秘术导师与博学者现场、停止梦境并归还同一原衣角，再继续当前准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须实际返回贝克兰德的原借阅馆与许可安静准备室。';
  if (!knownChannel(s)) return '先成为秘术导师并保有塞缪尔的原指导渠道。';
  if (hasProphetHistory(s)) return '已经完成预言家晋升，不能重复准备或服药；未用原瓶保留。';
  if (hasProphetRitualLock(s) && command.type !== 'CONSUME') return '你仍实际在原安静准备室内；完成当前专业准备后独立确认饮药，或0行动沿原出口离场。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (state.guidanceKnown) return '已经听过预言家成品来源、未知完整仪式与专业指导方案G风险。';
    return s.cash < PROPHET_PRICES.guidance ? '本次指导需要520便士。' : null;
  }
  if (!state.guidanceKnown) return '先听塞缪尔说明成品来源、实际专业准备与四档风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已申请后续三瓶，须等下一真实周实际到货。';
    return exhaustedSupply(state) ? null : '现有全部原瓶须真实耗尽且失败，才能申请后续供给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '尚未申请后续预言家原瓶。';
    if (s.week <= state.resupply.requestedWeek) return '下一真实周起才能实际接收后续原瓶。';
    return exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = state.bottles.find(item => item.id === command.bottleId);
  if (!bottle) return '所选预言家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '须独立确认本次饮用这瓶原魔药；准备核对的确认不能替代。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未实际交付，或已经耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药前须健康>20且精神>40；可0行动退出后正常休养，原预约和付费不回退。';
    if (s.progression.acting !== 100) return `秘术导师尚未完全消化，当前扮演${s.progression.acting}/100。`;
    if (s.mysticismMagister.promotionWeek === null || mysticismMagisterWeeks(s) < PROPHET_MIN_MYSTICISM_MAGISTER_WEEKS) return `成为秘术导师后已度过${mysticismMagisterWeeks(s)}/12整周。`;
    return canConsumeProphetRitual(s) ? null : '须本周亲自到原厅，由当前活着且自愿的玛莎使用本次原包完成准备，并明确核对；缺席、离场、失效监督或旧窗口不能替代。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯抵扣劳动。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= PROPHET_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the working copy supplied by the shared, atomic intent boundary. */
export function applyProphetAcquisition(s: SliceState, command: ProphetAcquisitionCommand, c: SeerContext): void {
  rule(validateProphetAcquisitionCommand(command), '预言家准备命令无效。');
  const blocked = prophetAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法继续。');
  const state = s.prophet;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= PROPHET_PRICES.guidance; state.guidanceKnown = true;
      c.note('听取预言家专业指导方案G', `花1行动、520便士，向原导师${PROPHET_GUIDE}了解原瓶来源、专业监督准备与四档风险。${PROPHET_FORMULA_STATUS}${PROPHET_RITUAL_SOURCE}`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!;
      s.actionsRemaining -= 1; bottle.labourSteps += 1;
      c.note(PROPHET_LABOUR_TASKS[bottle.labourSteps - 1]!, `为第${bottleNumber(bottle)}原瓶实际完成一次对应劳务，花1行动，现为${bottle.labourSteps}/5。完成五次仅抵本瓶6300便士，仍须支付900便士；部分劳动不折现或转移。原瓶仍在供应方，不产生完整配方、仪式包或完成的仪式。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      c.note('预言家独立原瓶实际交付', `支付${paid}便士、0行动，实际取得${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五次劳动抵6300便士，另付900便士。' : '原价7200便士，未完成五次劳动不部分抵扣。'}没有附送仪式包、完整配方或完成的仪式；尚未服用。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请后三瓶预言家成品', `现有全部原瓶已耗尽失败。花1行动核对原记录，最早第${s.week + 1}周实际到货三瓶；此刻没有新瓶。每瓶仍需7200便士或本瓶五次劳动后900便士，旧原瓶与已用仪式包不会重置。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < PROPHET_BOTTLE_IDS.length; offset += 1) {
        const number = first + offset; state.bottles.push(freshBottle(`prophet-potion-${number}`, deliverySource(number, s.week), s.week));
      }
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('后续三瓶预言家成品实际到货', `第${s.week}周，第${first}至${first + 2}独立原瓶实际入供应方库存，0行动，尚未付费交付。所有旧失败原瓶、仪式包及既往实际样本、联系物与制造经历完整保留。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, visit = currentProphetVisit(s);
      rule(visit !== undefined && visit.windowWeek === s.week, '缺少本周原厅当前专业准备窗口。');
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier;
      bottle.ritualId = visit.id; bottle.ritualWindowWeek = visit.windowWeek;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mindCost); state.mysticismMagisterActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of PROPHET_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        closeProphetRitual(s, bottle.id);
        c.note('在当前专业准备窗口中成为预言家', `${bottle.id}于原厅本次预约${visit.id}耗尽。意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}；精神−${mindCost}、四属性各+1。秘术导师消化100与旧掌握保留，两项新掌握从0，灵性上限120但当前不补满，身体性别不变。本次唯一仪式包实际耗尽，你沿普通出口离场，玛莎仍留在原厅。原样本、联系物、弱闪原件、身体事实与过去真实梦境经历保留；旧窗口不能重复使用。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        closeProphetRitual(s, bottle.id);
        c.note(severe ? '预言家魔药严重排异' : '预言家魔药排异', `${bottle.id}于${visit.id}耗尽；意志${result.roll}/${result.chance}，健康−${healthCost}、精神−${mindCost}、排异+${pollution}。本作G监督仅让此次药物排异保底1；仍为秘术导师，旧消化、身体、实际样本与原物事实和掌握完整保留。本次唯一仪式包实际耗尽，你沿普通出口离场，玛莎仍留原厅。可正常休养，另一原瓶须另付费预约、下一真实周取得新原包并重新到场；旧窗口不能重复使用。`);
      }
      return;
    }
  }
}
export function applyProphetCommand(s: SliceState, command: ProphetCommand, c: SeerContext): void {
  rule(validateProphetCommand(command), '预言家命令无效。');
  if (validateProphetAcquisitionCommand(command)) return applyProphetAcquisition(s, command, c);
  if (validateProphetRitualCommand(command)) return applyProphetRitualCommand(s, command, c);
  if (validateProphetEncounterCommand(command)) return applyProphetEncounter(s, command, c);
  throw new Error('预言家生活实践须由共享入口结算实际掌握与消化。');
}

export function projectProphet(s: SliceState): ProphetProjection {
  const state = s.prophet, available = knownChannel(s), promoted = hasProphetHistory(s), known = available && state.guidanceKnown, actions: ProphetAction[] = [];
  const add = (id: string, label: string, cost: string, command: ProphetAcquisitionCommand) => {
    const reason = prophetAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!known) add('learn-prophet-guidance', '了解预言家成品、未知完整仪式与专业指导方案G', '1行动 · 520便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-prophet-supply', '确认后三瓶成品实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周 · 尚须逐瓶付费`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-prophet-supply', '申请后三瓶独立成品', '1行动 · 下一真实周起到货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${PROPHET_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵6300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶预言家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 不附送仪式包`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `在当前专业准备窗口服用第${bottleNumber(bottle)}瓶`, `0行动 · 独立确认 · 秘术导师${s.progression.acting}/100 · ${mysticismMagisterWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '预言家 · 序列4' : '预言家之路', discovered: available, guidanceKnown: known, promoted,
    formulaKnown: false, formula: [], actions: available && ![3, 2, 1].includes(s.progression.sequence ?? 0) ? [...actions, ...prophetRitualActions(s), ...prophetLifeActions(s), ...prophetEncounterActions(s)] : [],
    bottles: known ? state.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 独立预言家成品`, source: `${bottle.source}${bottle.ritualId ? `第${bottle.ritualWindowWeek}周在原厅预约${bottle.ritualId}专业准备窗口服用；本次原包与原瓶均耗尽。` : ''}`,
      status: bottle.status === 'SUPPLIER' ? '原供应方持有，未交付' : bottle.status === 'PLAYER' ? '你实际持有，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为秘术导师' : '排异，仍为秘术导师'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? PROPHET_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ([3, 2, 1].includes(s.progression.sequence ?? 0)?s.insightScholar.prophetActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `秘术导师消化${state.mysticismMagisterActingAtPromotion}/100与原掌握保留；预言家扮演${[3, 2, 1].includes(s.progression.sequence ?? 0)?s.insightScholar.prophetActingAtPromotion:s.progression.acting}/100。` : available ? `秘术导师消化需100（当前${s.progression.acting}/100），晋升后满12整周（${mysticismMagisterWeeks(s)}/12）；当前专业准备与原封装包须另行完成，可选择保持秘术导师。` : '先完成秘术导师之路。',
    pollution: s.seer.pollution, risk: known ? PROPHET_CONSUMPTION_RISK : '先通过原导师了解预言家成品来源与实际仪式风险。',
    supplies: known ? `供应方持有${state.bottles.filter(bottle => bottle.status === 'SUPPLIER').length}瓶，你持有未用原瓶${state.bottles.filter(bottle => bottle.status === 'PLAYER').length}瓶。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}批。` : `第${state.resupply.requestedWeek}周申请，下一真实周起实际到货。`}成品配方仍未知，原瓶、付费预约与专业准备分别结算，旧仪式不能代替。` : '',
    ...(available ? { story: `${PROPHET_FORMULA_STATUS}${PROPHET_RITUAL_SOURCE}${PROPHET_SOURCE_STATUS}` } : {}),
    ritual: projectProphetRitual(s), life: projectProphetLife(s), encounter: projectProphetEncounter(s),
    insideCase: hasProphetRitualLock(s) || hasProphetLifeLock(s) || hasProphetEncounterLock(s),
    environment: available ? '原借阅馆、玛莎所在的许可安静准备室、诺拉的原窗板工作区与安静书房。原MM5-CLOTH-1、原FLASH样本、原MM5-FLASH-N与过去真实梦境经历持续保存，不以文字重置或复制。' : '',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateProphetAcquisitionCommand(v: unknown): v is ProphetAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (typeof v.bottleId !== 'string' || !/^prophet-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isProphetAcquisitionCommand = validateProphetAcquisitionCommand;
export function validateProphetCommand(v: unknown): v is ProphetCommand {
  return validateProphetAcquisitionCommand(v) || validateProphetRitualCommand(v) || validateProphetActivityCommand(v) || validateProphetEncounterCommand(v);
}
export function validateProphetState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.prophet;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'mysticismMagisterActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.mysticismMagister) || !record(s.reader)) return false;
  const firstWeek = s.mysticismMagister.promotionWeek ?? s.week, earliestConsumption = firstWeek + PROPHET_MIN_MYSTICISM_MAGISTER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - earliestConsumption))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, earliestConsumption, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1)) return false;
  const state = raw as unknown as ProphetState, promoted = hasProphetHistory(s), latestAcquisition = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.mysticismMagister.promotionWeek, 1, s.week) || !integer(state.promotionWeek, earliestConsumption, s.week) || state.mysticismMagisterActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?ALL_KNOWING_EYE_ABILITY_IDS:[]),...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS, ...MYSTICISM_MAGISTER_ABILITY_IDS, ...PROPHET_ABILITY_IDS,...([3, 2, 1].includes(s.progression.sequence ?? 0)?INSIGHT_SCHOLAR_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?WISDOM_ANGEL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.mysticismMagisterActingAtPromotion !== null || PROPHET_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome', 'ritualId', 'ritualWindowWeek']) || bottle.id !== `prophet-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  if (!validateProphetRitualState(s) || !validateProphetLife(s) || !validateProphetEncounter(s)) return false;
  let successes = 0;
  const usedVisits = new Set<string>();
  for (const [index, bottle] of state.bottles.entries()) {
    if (index < 3) {
      if (bottle.stockedWeek !== null || bottle.source !== PROPHET_POTION_SOURCES[index]!.source) return false;
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
        if (!integer(s.mysticismMagister.promotionWeek, 1, s.week) || !integer(bottle.consumedWeek, Math.max(earliestConsumption, bottle.acquiredWeek), latestAcquisition) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '')) return false;
        if (!promoted && s.progression.acting !== 100) return false;
        if (typeof bottle.ritualId !== 'string' || usedVisits.has(bottle.ritualId) || bottle.ritualWindowWeek !== bottle.consumedWeek) return false;
        usedVisits.add(bottle.ritualId);
        const visit = state.ritual.visits.find(item => item.id === bottle.ritualId);
        if (!visit || visit.consumedBottleId !== bottle.id || visit.windowWeek !== bottle.consumedWeek || visit.closedWeek !== bottle.consumedWeek) return false;
      } else return false;
    }
    if (bottle.status !== 'CONSUMED' && (bottle.ritualId !== null || bottle.ritualWindowWeek !== null)) return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== state.promotionWeek) return false; }
  }
  if (state.ritual.visits.some(visit => visit.consumedBottleId !== null && !state.bottles.some(bottle => bottle.id === visit.consumedBottleId && bottle.ritualId === visit.id && bottle.status === 'CONSUMED'))) return false;
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0);
}

export { PROPHET_ABILITIES } from './content.js';
export { createProphetRitualState, currentProphetVisit, hasProphetRitualLock, canConsumeProphetRitual, closeProphetRitual, validateProphetRitualState, validateProphetRitualCommand, applyProphetRitualCommand, prophetRitualActions, projectProphetRitual } from './ritual.js';
export type * from './types.js';
