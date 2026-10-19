import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { PerfecterCommand, PerfecterProjection, PerfecterState } from './types.js';
import {
  createPerfecterState, startPerfecter, samePerfecter, perfecterDigest,
  validatePerfecterCommand, openPerfecterOwnedEngine, snapshotPerfecterOwnedEngine,
  advancePerfecterOwnedEngine, blockPerfecterOwnedEngine,
  getPerfecterPromotionStabilityPreview, getPerfecterEpilogueCheckPreview,
  perfecterHost, type PerfecterOwnedEngine,
} from './engine.js';
import {
  perfecterBudget, perfecterHistoryDigest, perfecterAcquisitionSnapshot,
  perfecterSourceBlock, validatePerfecterSource,
} from './source.js';
import {
  PERFECTER_ABILITIES, PERFECTER_STORY, PERFECTER_GOAL, PERFECTER_RISK,
  PERFECTER_CITY_PLACES, PERFECTER_HOME, PERFECTER_GUIDANCE,
  PERFECTER_SPIRITUALITY_CAP,
} from './content.js';
import { projectPerfecterWorks, getPerfecterWorksActions } from './works.js';
import { projectPerfecterEpilogue, getPerfecterEpilogueActions } from './epilogue.js';
import { getPerfecterMaterialActions, projectPerfecterMaterials } from './materials.js';
import {
  CIVILIZATION_ENLIGHTENER_ABILITIES,
  CIVILIZATION_ENLIGHTENER_INHERITED_ABILITIES,
} from '../civilization-enlightener/content.js';

export { createPerfecterState, validatePerfecterCommand } from './engine.js';
export { perfecterSourceView } from './source.js';
export type { PerfecterOwnedEngine } from './engine.js';
export type { PerfecterCommand, PerfecterState, PerfecterProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: PerfecterState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'paragon' ||
      !samePerfecter(perfecterBudget(s), frame.budget) || !samePerfecter(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!samePerfecter(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !samePerfecter(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== perfecterHistoryDigest(s) ||
      source.originalWorldDigest !== perfecterDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== perfecterDigest(s.combatHistory) ||
      !samePerfecter(source.acquisition, perfecterAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!samePerfecter(s.perfecter, createPerfecterState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = perfecterSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < PERFECTER_GUIDANCE.actions || s.cash < PERFECTER_GUIDANCE.cash
    ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validatePerfecterState(s: SliceState): boolean {
  try {
    if (samePerfecter(s.perfecter, createPerfecterState()))
      return s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 0;
    const head = openPerfecterOwnedEngine(s);
    assertCurrent(s, snapshotPerfecterOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasPerfecterHistory(s: SliceState): boolean {
  try {
    return s.perfecter.guidanceKnown && s.perfecter.source !== null &&
      s.progression.pathwayId === 'paragon' && validatePerfecterSource(s, s.perfecter.source);
  } catch { return false; }
}
export function hasPerfecterLock(s: SliceState): boolean { return hasPerfecterHistory(s); }
export function openPerfecterOwnedHead(s: SliceState): PerfecterOwnedEngine {
  const head = openPerfecterOwnedEngine(s);
  assertCurrent(s, snapshotPerfecterOwnedEngine(head));
  return head;
}
export function assertOwnedPerfecterCurrent(s: SliceState, head: PerfecterOwnedEngine): void {
  const root = snapshotPerfecterOwnedEngine(head);
  if (!samePerfecter(root, s.perfecter)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function perfecterCommandBlock(s: SliceState, command: PerfecterCommand): string | null {
  if (!validatePerfecterCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockPerfecterOwnedEngine(openPerfecterOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedPerfecterCommandBlock(s: SliceState, command: PerfecterCommand, head: PerfecterOwnedEngine): string | null {
  if (!validatePerfecterCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedPerfecterCurrent(s, head);
    return publicReason(blockPerfecterOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: PerfecterCommand, root: PerfecterState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.perfecter = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('三站修理与晋升指导', '已支付100便士与1行动核对本人身份、三份文明启蒙者特性和实际履历。旧人物、原物、当前伤势和旧账保留；接下来须亲自修理三站装置并核验实际运行结果。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '完美者当前行动' : '三站修理当前行动', event.notes.join(''));
  }
}
export function applyPerfecterCommand(s: SliceState, command: PerfecterCommand, ctx: SeerContext): void {
  if (!validatePerfecterCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: PerfecterState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startPerfecter(s);
  } else root = snapshotPerfecterOwnedEngine(advancePerfecterOwnedEngine(openPerfecterOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedPerfecterCommand(s: SliceState, command: PerfecterCommand, ctx: SeerContext, head: PerfecterOwnedEngine): PerfecterOwnedEngine {
  assertOwnedPerfecterCurrent(s, head);
  if (!validatePerfecterCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advancePerfecterOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotPerfecterOwnedEngine(next), ctx);
  return next;
}
export function projectPerfecter(s: SliceState): PerfecterProjection {
  return projection(s, samePerfecter(s.perfecter, createPerfecterState()) ? null : openPerfecterOwnedHead(s));
}
export function projectOwnedPerfecter(s: SliceState, head: PerfecterOwnedEngine): PerfecterProjection {
  assertOwnedPerfecterCurrent(s, head);
  return projection(s, head);
}

/** This boundary constructs only selected public fields. Neither private source
 * snapshots nor mutable domain objects are returned to the renderer. */
function projection(s: SliceState, head: PerfecterOwnedEngine | null): PerfecterProjection {
  const root = head ? snapshotPerfecterOwnedEngine(head) : s.perfecter;
  const f = root.frame, b = f?.budget ?? perfecterBudget(s);
  const promoted = s.progression.pathwayId === 'paragon' && b.sequence === 0 && root.promotionWeek !== null;
  const definitions = s.progression.pathwayId === 'paragon'
    ? [...CIVILIZATION_ENLIGHTENER_INHERITED_ABILITIES, ...CIVILIZATION_ENLIGHTENER_ABILITIES,
      ...(promoted ? PERFECTER_ABILITIES : [])] : [];
  const result: PerfecterProjection = {
    title: '序列0 完美者', guidanceKnown: root.guidanceKnown, promoted,
    story: PERFECTER_STORY, nextStep: PERFECTER_GOAL, risk: PERFECTER_RISK,
    resources: { health: b.health, mind: b.mind, spirituality: b.spirituality,
      cash: `${b.cash}便士`, actionsRemaining: b.actions },
    abilities: definitions.filter(a => Object.hasOwn(b.mastery, a.id)).map(a => ({
      id: a.id, label: a.label, description: a.description, mastery: b.mastery[a.id] ?? 0,
    })), actions: [], sections: [], insideCase: root.epilogue?.status === 'ACTIVE',
  };
  const add = (command: PerfecterCommand, label: string, cost: string, preferred = false) => {
    const reason = publicReason(head ? blockPerfecterOwnedEngine(head, command, s.revision + 1) : perfecterCommandBlock(s, command));
    result.actions.push({ id: `perfecter:${result.actions.length}:${command.type}`, label, cost,
      command: clone(command), enabled: reason === null, reason, ...(preferred ? { preferredAction: true } : {}) });
  };
  if (!root.guidanceKnown) {
    add({ type: 'LEARN_GUIDANCE' }, '听取三站修理与特性指导', '1行动、100便士', true);
    return result;
  }
  const host = perfecterHost(root, `R211:${root.source!.runId}:${s.revision + 1}`, s.revision + 1);
  const works = projectPerfecterWorks(root.works!);
  result.story = works.story; result.nextStep = works.nextStep;
  const place = PERFECTER_CITY_PLACES.find(p => p.id === f!.location)?.title ?? '当前现场';
  result.sections.push({ id: 'works', title: '三站真实修理与持续运行', lines: [
    `当前位置：${place}；第${b.week}周。`, ...works.lines,
  ] });
  const material = projectPerfecterMaterials(root.materials!);
  const holder: Record<string, string> = {
    EMBODIED: '已融入本人', SUPPLIER: '仍在原供应处', CUSTODIAN: '原保管人封存', PLAYER: '本人持有',
    COMPOUND: '在同批成药中', EXPOSED: '实际残留，尚未封存', SEALED: '已实际封存', LOST: '脱离本人控制',
    FUSED: '已在本人体内融合', UNLOCATED: '旧失败原物去向待调查',
    LEGACY_RESIDUE: '已辨识同一旧残余，尚未封存', LEGACY_SEALED: '同一旧残余已经实际封存',
  };
  result.sections.push({ id: 'materials', title: '三份特性与独立唯一性', lines: [
    '本人已融入一份文明启蒙者特性；须取得另外两份同批原特性和独立唯一性。普通调配包只提供一次承载与封存耗材。',
    ...material.characteristics.map((c, i) => `第${i + 1}份特性：${holder[c.holder] ?? '原账待核'}；已作${c.inheritedLabourSteps + c.labour.length}/5项原物劳动。`),
    `同一独立唯一性：${holder[material.uniqueness.holder] ?? '原账待核'}。须核验保管与交付记录，不能凭空补发。`,
    ...material.batches.map(batch => `${batch.label}：${batch.status === 'SUPPLIER' ? '仍在供应处' : batch.status === 'PLAYER' ? '本人持有' : batch.status === 'IN_COMPOUND' ? '在同批成药中' : batch.status === 'REPAIR_ORDERED' ? '已付费订购补充物，等待隔周领取' : '普通药液已用尽'}。`),
    material.recoveryNotice,
  ] });
  result.sections.push({ id: 'finance', title: '原职业、生活费与旧账', lines: [
    `现款${b.cash}便士；原职业每周工资${root.source!.character.weeklyWage}便士，每周须实际工作才能领取一次。`,
    `未付本金${f!.finance.debts.reduce((sum, debt) => sum + debt.remaining, 0)}便士；下次约定还款${f!.finance.debts.reduce((sum, debt) => sum + Math.min(debt.remaining, debt.weeklyPayment), 0)}便士。`,
    '每个实际周照常结算原生活费与约定还款；不足的生活费如实计欠，次周转赤贫。修理与材料劳动可以穿插在工作之后。',
  ] });
  result.sections.push({ id: 'injuries', title: '当前身体与原造物', lines: [
    `健康${b.health}，精神${b.mind}，灵性${b.spirituality}/${promoted ? PERFECTER_SPIRITUALITY_CAP : 120}，污染${b.pollution}；伤势风险${b.injuryRisk}。`,
    ...(b.injuries.length ? b.injuries.map(injury => `${injury.severity === 'HEAVY' ? '重伤' : '轻伤'}：${injury.treatedRevision === null ? '尚未处置' : '已作普通处置，之后仍须休养'}。`) : ['当前没有实际伤势。']),
    ...root.source!.originalDevices.map(device => `${device.kind === 'MESSENGER_BOX' ? '原传讯盒' : '原守卫架'}：耐久${device.durability}，储能${device.charge}；本次三站修理不会为它补充储能或改变制造履历。`),
    '重伤须在城市支付60便士与1行动普通处置，再经之后实际休养达到80健康。',
  ] });
  const latest = root.journal.at(-1);
  result.sections.push({ id: 'recent-action', title: '最近实际行动、费用与检定', lines: latest ? [
    ...latest.notes, ...latest.financeReceipts.map(receipt => receipt.text),
    ...latest.randomReceipts.map(receipt => `已发生检定：成功率${receipt.check.chance}%，实际掷出${receipt.check.roll}，${receipt.check.tier === 'SUCCESS' ? '成功' : receipt.check.tier === 'GREAT_SUCCESS' ? '大成功' : receipt.check.tier === 'FAILURE' ? '失败' : '严重失败'}。`),
    `本次现款变化${latest.after.budget.cash - latest.before.budget.cash}便士；行动后健康${b.health}、精神${b.mind}、灵性${b.spirituality}、现款${b.cash}便士、剩余${b.actions}行动。`,
  ] : ['已实际支付100便士与1行动听取指导，旧身体、原造物与三份特性履历原样继承。'] });

  if (root.epilogue) {
    const epilogue = projectPerfecterEpilogue(root.epilogue);
    result.story = epilogue.story; result.nextStep = epilogue.nextStep;
    result.sections.unshift({ id: 'epilogue', title: '档案馆副送纸口的有限处置', lines: epilogue.lines });
    for (const action of getPerfecterEpilogueActions(root.epilogue, b))
      add({ type: 'EPILOGUE', command: action.command }, action.label, action.cost, action.enabled);
    if (root.epilogue.status === 'ACTIVE') {
      const preview = getPerfecterEpilogueCheckPreview(root, 'CONTAIN_FLOW')!;
      result.sections.push({ id: 'epilogue-readiness', title: '有限技巧与普通退路', lines: [
        `两项技巧当前各${preview.chance}%成功率，每项本场只可实际施用一次，失败同样付费。`,
        '文明之页：1行动、12灵性、8精神、6便士；有限重构：1行动、10灵性、8精神、8便士。',
        '可直接用普通手柄隔离，再进行实际搬运；零行动时仍能沿普通出口撤离，全部原伤与结果保留。',
      ] });
      return result;
    }
  }
  for (const action of getPerfecterWorksActions(root.works!, host)) {
    if (promoted && action.command.type !== 'WORKS_TRAVEL') continue;
    const cost = action.cost;
    add({ type: 'WORKS', command: action.command }, action.label,
      `${cost.actions}行动、${cost.cashCost}便士${cost.weeks ? `、实际${cost.weeks}周，另结生活与还款` : ''}`,
      action.enabled && action.command.type !== 'WORKS_TRAVEL');
  }
  for (const destination of PERFECTER_CITY_PLACES) if (destination.id !== f!.location)
    add({ type: 'TRAVEL', to: destination.id }, `沿城市道路前往${destination.title}`, '1行动、10便士');
  if (f!.location !== PERFECTER_HOME)
    add({ type: 'RETURN_ON_FOOT' }, '沿普通道路步行返回修理工坊', '1行动；实际步行两小时，无车费', b.cash < 10);
  if (!promoted) {
    for (const action of getPerfecterMaterialActions(root.materials!, host))
      add({ type: 'MATERIAL', command: action.command }, action.label, action.cost, action.enabled);
    const lines: string[] = [];
    for (const compound of root.materials!.compounds.filter(c => c.status === 'PREPARED')) {
      const preview = getPerfecterPromotionStabilityPreview(root, compound.id);
      lines.push(`这份成药当前成功率${preview.chance}%；完成实际稳定准备后${preview.preparedChance}%。${preview.prepared ? '当前准备仍有效。' : '尚无本瓶有效准备。'}`,
        '准备实付100便士、1行动、12灵性与8精神，绑定这一瓶、已核验的三站结果、当前调配室与准备后的七天。离室、过期或实际服用即失效。',
        '实际检定采用50＋2×（意志＋本次准备修正−55），按普通检定上下限结算；准备不替换骰子或保证成功。');
      add({ type: 'STABILIZE_PROMOTION', compoundId: compound.id }, '为本瓶完成付费稳定准备', '1行动、100便士、12灵性、8精神', preview.eligible);
      add({ type: 'CONSUME', compoundId: compound.id, confirmed: true }, '确认风险并饮用本瓶成药', '1行动、30灵性；失败可能重伤、污染或死亡', preview.prepared);
    }
    if (lines.length) result.sections.push({ id: 'promotion-stability', title: '本瓶成药的真实风险与准备', lines });
  } else if (!root.epilogue) {
    result.nextStep = '亲自返回旧市档案馆，处置同一装置后来发生的副送纸口回送故障。';
    add({ type: 'START_EPILOGUE' }, '进入档案馆副送纸口回送故障现场', '0行动；实际步行入场十分钟，不补资源', true);
  }
  add({ type: 'WORK' }, '做本周原职业工作', `1行动；${root.source!.character.weeklyWage}便士，每周一次`, b.cash < 150);
  add({ type: 'CLINIC' }, '支付普通重伤处置', '1行动、60便士；之后仍须休养', b.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null));
  add({ type: 'REST' }, '按实际生活档休养', '1行动；未处置的重伤仍保留', b.health < 80 || b.mind < 78 || b.spirituality < 60);
  add({ type: 'NEXT_WEEK' }, '度过真实七天', '放弃本周余下行动，实际支付生活费与约定还款', b.actions === 0);
  return result;
}
