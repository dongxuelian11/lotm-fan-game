import { hasLongChapterHandoff, isLongChapterEraClosed } from '../long-chapter/index.js';
import { blockFerrymanEraCommand } from '../ferryman/era.js';
import { nextLosingInjuryWeights } from './combat.js';
import { currentEvent, investigationTargets } from './events.js';
import type { SliceState } from './types.js';

export interface RecoveryActionContext {
  canAct: boolean;
  actionBlockedReason: string | null;
}
export interface RecoveryActionAvailability {
  enabled: boolean;
  reason: string | null;
}
export type RecoveryStage =
  | 'CLEAR' | 'DISCOVER_CARE' | 'CARE_UNAVAILABLE' | 'CARE_READY' | 'INVITED_THIS_WEEK'
  | 'CARE_CHOICE' | 'AID_OFFER' | 'AID_CHECK' | 'AID_CORRECT' | 'AID_UNAVAILABLE'
  | 'REST_TO_HEAL' | 'REST_TO_RECOVER' | 'ERA_CARE' | 'ERA_REST';
export interface SliceRecoveryProjection {
  needsAttention: boolean;
  stage: RecoveryStage;
  injuryCount: number;
  untreatedHeavyCount: number;
  treatedHeavyCount: number;
  lightCount: number;
  injuryRisk: number;
  healthFullWithInjuries: boolean;
  summary: string;
  guidance: string;
  careKnown: boolean;
  careAvailable: boolean | null;
  invitedThisWeek: boolean;
  treatmentCost: 60;
  healingHealthThreshold: 80;
  cashShortfall: number;
  workIncomeThisWeek: number;
  aidStatus: SliceState['aid'];
  locked: boolean;
  blockedReason: string | null;
  nextLoss: {
    label: string;
    explanation: string;
    weights: ReturnType<typeof nextLosingInjuryWeights>;
  };
  actions: {
    rest: RecoveryActionAvailability;
    discover: RecoveryActionAvailability;
    work: RecoveryActionAvailability;
    aid: RecoveryActionAvailability & { targetId: 'CARE-WORK-CHECK' | 'CARE-WORK-CORRECT' | null };
    pay: RecoveryActionAvailability;
    credit: RecoveryActionAvailability;
  };
  nextAction: {
    kind: 'ERA_LIFE' | 'INVESTIGATE' | 'REST' | 'CURRENT_EVENT' | 'WAIT_WEEK' | 'NONE';
    label: string;
    targetId: string | null;
    enabled: boolean;
    reason: string | null;
  };
}

const available = (reason: string | null): RecoveryActionAvailability => ({ enabled: reason === null, reason });

/**
 * Read-only guidance for existing public actions. The caller supplies the shared ordinary-action
 * gate so this projector never reimplements the many pathway/scene locks or imports slice/index.
 * No state, random cursor, wound, invitation, or scene is changed here.
 */
export function projectRecovery(s: SliceState, context: RecoveryActionContext): SliceRecoveryProjection {
  const untreatedHeavyCount = s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length;
  const treatedHeavyCount = s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision !== null).length;
  const lightCount = s.injuries.filter(i => i.severity === 'LIGHT').length;
  const injuryCount = s.injuries.length;
  const invitedThisWeek = s.lastMedicalInviteWeek === s.week;
  const active = s.status === 'ACTIVE';
  // Later-era care has its own real people, fees and clock. Never direct this character
  // to an old-town investigation or mutate the historical medical invitation state.
  if (hasLongChapterHandoff(s) && isLongChapterEraClosed(s) && s.progression.pathwayId === 'death' && [4, 3, 2].includes(s.progression.sequence!)) {
    const navigationReason = blockFerrymanEraCommand(s, {type: s.ferryman.era.location === 'OUTSIDE' ? 'ERA_ENTER' : 'ERA_LEAVE'});
    const careReason = blockFerrymanEraCommand(s, {type:'ERA_CARE'});
    const restReason = blockFerrymanEraCommand(s, {type:'ERA_REST'});
    const workReason = blockFerrymanEraCommand(s, {type:'ERA_WORK'});
    const unavailable = available('旧时代诊疗与援助记录只读；请使用当代接待处的实际行动。');
    const stage: RecoveryStage = untreatedHeavyCount > 0 ? 'ERA_CARE' : injuryCount > 0 || s.health < 100 || s.mind < 100 ? 'ERA_REST' : 'CLEAR';
    return {
      needsAttention: injuryCount > 0 || s.health <= 0 || s.mind <= 0,
      stage, injuryCount, untreatedHeavyCount, treatedHeavyCount, lightCount, injuryRisk:s.injuryRisk,
      healthFullWithInjuries:s.health >= 100 && injuryCount > 0,
      summary:injuryCount > 0 ? `未治疗重伤${untreatedHeavyCount}处 · 已处置待康复重伤${treatedHeavyCount}处 · 轻伤${lightCount}处 · 累计风险${s.injuryRisk}。${s.health >= 100 ? '健康100仍不等于伤势痊愈。' : ''}` : '当前无普通伤势。',
      guidance:untreatedHeavyCount > 0
        ? '前往当代接待处，花1行动与60便士处置现有重伤；处置不恢复健康、不清零风险。之后实际休整，每次花1行动与8便士恢复5健康、8精神、10灵性；健康达到80且已有休整间隔，才解除符合条件的伤势。'
        : '当代接待处每次实际休整花1行动与8便士，恢复5健康、8精神、10灵性。轻伤及已处置重伤须在后来一次休整、健康达到80后解除；全部伤势解除才清零累计风险。',
      careKnown:true,careAvailable:true,invitedThisWeek:false,treatmentCost:60,healingHealthThreshold:80,
      cashShortfall:Math.max(0,(untreatedHeavyCount > 0 ? 60 : 8)-s.cash),workIncomeThisWeek:24,
      aidStatus:s.aid,locked:navigationReason !== null,blockedReason:navigationReason,
      nextLoss:{label:'下次败北进入伤势分支时的条件权重',explanation:'仅在下一次败北并进入伤势后果分支时适用，不是每回合死亡概率；胜负、撤退及特殊场景另按实际规则结算。',weights:nextLosingInjuryWeights(s)},
      actions:{rest:available(restReason),discover:unavailable,work:available(workReason),aid:{...unavailable,targetId:null},pay:available(careReason),credit:unavailable},
      nextAction:{kind:'ERA_LIFE',label:'查看当代接待处的处置与休整',targetId:null,...available(navigationReason)},
    };
  }
  const blockedReason = s.status === 'DEAD' ? '本周目已最终死亡，只读封存，不能休养或治疗。'
    : !active ? '当前首案已收尾，先使用原有继续生活入口。'
    : !context.canAct ? context.actionBlockedReason ?? (s.actionsRemaining <= 0 ? '本周行动已用完，先结清周末待办。' : '当前不能进行普通行动。')
    : null;
  const unfitReason = blockedReason ?? (s.health <= 0 || s.mind <= 0 ? '目前无法调查或工作，请先休养。' : null);
  const targets = investigationTargets(s);
  const hasTarget = (id: string) => targets.some(t => t.id === id);
  const aidPending = s.aid === 'ACCEPTED' || s.aid === 'CORRECT';
  const aidTargetId = s.aid === 'ACCEPTED' ? 'CARE-WORK-CHECK' : s.aid === 'CORRECT' ? 'CARE-WORK-CORRECT' : null;
  const aidValid = aidPending && s.world.city === 'BACKLUND' && s.world.careAvailable && s.world.aidBatchAvailable
    && s.aidInjuryIds.some(id => s.injuries.some(i => i.id === id && i.treatedRevision === null));
  const event = currentEvent(s);
  const medicalEvent = event?.id === 'LIFE-CARE-01' || event?.id === 'CARE-WORK-OFFER';
  const eventChoice = (id: string): RecoveryActionAvailability => {
    const choice = event?.id === 'LIFE-CARE-01' ? event.choices.find(c => c.id === id) : undefined;
    return available(!active ? blockedReason : !choice ? '请先在处置事件中选择。' : !choice.enabled ? choice.disabledReason ?? '当前不可选择。' : null);
  };
  const actions: SliceRecoveryProjection['actions'] = {
    rest: available(blockedReason),
    discover: available(unfitReason ?? (s.careKnown ? '诊疗渠道已经核实。' : !hasTarget('CARE-ACCESS-01') ? '当前调查列表中没有此目标。' : null)),
    work: available(unfitReason),
    aid: { ...available(unfitReason ?? (!aidTargetId ? '当前没有待交付的援助委托。' : !aidValid ? '原援助批次、渠道或待治伤势已改变，不能兑现处置。' : !hasTarget(aidTargetId) ? '当前调查列表中没有此目标。' : null)), targetId: aidTargetId },
    pay: eventChoice('PAY'),
    credit: eventChoice('CREDIT'),
  };
  let stage: RecoveryStage = 'CLEAR';
  let guidance = '当前没有待解除的普通伤势。';
  let nextAction: SliceRecoveryProjection['nextAction'] = { kind: 'NONE', label: '', targetId: null, enabled: false, reason: null };
  const restNext = (label: string) => { nextAction = { kind: 'REST', label, targetId: null, ...actions.rest }; };
  const investigateNext = (label: string, targetId: string, action: RecoveryActionAvailability) => {
    nextAction = { kind: 'INVESTIGATE', label, targetId, ...action };
  };
  if (event && medicalEvent) {
    stage = event.id === 'LIFE-CARE-01' ? 'CARE_CHOICE' : 'AID_OFFER';
    guidance = stage === 'CARE_CHOICE'
      ? '在当前事件选择支付60便士、可用医疗欠款或暂不处置。处置只标记已治疗，之后仍须实际休养，健康达到80后才解除符合条件的伤势。'
      : '当前援助邀请需要你明确接下，再花实际调查行动核对签条；完成后才兑现处置，之后仍须休养。';
    nextAction = { kind: 'CURRENT_EVENT', label: '查看当前医疗事件', targetId: null, enabled: active, reason: active ? null : blockedReason };
  } else if (aidPending) {
    stage = !aidValid ? 'AID_UNAVAILABLE' : s.aid === 'CORRECT' ? 'AID_CORRECT' : 'AID_CHECK';
    guidance = !aidValid ? '原援助委托已无法兑现，可使用原有取消入口；不会自动交付或赠送处置。'
      : s.aid === 'CORRECT' ? '签条仍需复核。调查“按标记复核签条”消耗1行动，完成后兑现处置；之后还须实际休养。'
      : '调查“核对退货签条”消耗1行动。成功才兑现处置；失败可再花1行动确定复核，之后还须实际休养。';
    investigateNext(s.aid === 'CORRECT' ? '查看签条复核' : '查看签条核对', aidTargetId!, actions.aid);
  } else if (untreatedHeavyCount > 0) {
    if (!s.careKnown) {
      stage = 'DISCOVER_CARE';
      guidance = '先在调查中核实普通诊疗点（1行动，仅发现，不治疗、不收费），再休养触发处置事件。支付60便士处置后，还须后来一次休养且健康达到80。';
      investigateNext('查看普通诊疗点', 'CARE-ACCESS-01', actions.discover);
    } else if (!s.world.careAvailable) {
      stage = 'CARE_UNAVAILABLE';
      guidance = '已核实的普通诊疗点目前不可用。普通休养仍可恢复健康、精神与灵性，但不会解除未治疗重伤。';
      restNext('查看休养');
    } else if (invitedThisWeek) {
      stage = 'INVITED_THIS_WEEK';
      guidance = '本周已经出现过医疗邀请，本周再次休养不会重复邀请。下一周渠道仍可用且仍有未治重伤时，再休养可重新触发。伤势与风险仍保留。';
      nextAction = { kind: 'WAIT_WEEK', label: '下周再安排处置', targetId: null, enabled: false, reason: '先按现有行动与账单流程推进至下一周。' };
    } else {
      stage = 'CARE_READY';
      const aidOffer = s.cash < 60 && s.credit === 'SUSPENDED' && s.world.aidBatchAvailable && s.aid !== 'DELIVERED';
      guidance = aidOffer
        ? '诊疗渠道已核实。再休养会触发当前可用的签条援助邀请；接下并完成调查后才兑现普通处置，之后还须休养。'
        : '诊疗渠道已核实。再休养会触发处置事件；支付60便士或使用事件内可用医疗欠款后，仍须后来一次休养且健康达到80。';
      restNext('查看休养与处置');
    }
  } else if (injuryCount > 0) {
    stage = 'REST_TO_HEAL';
    guidance = '轻伤及已经处置的重伤，须在受伤或处置之后实际休养，健康达到80才能解除。只有全部伤势真正解除后，累计风险才清零。';
    restNext('查看后续休养');
  } else if (s.health < 100 || s.mind < 100) {
    stage = 'REST_TO_RECOVER';
    guidance = '可通过实际休养恢复健康与精神；本周生活档位决定每次恢复量。';
    restNext('查看休养');
  }
  // H/M at zero forbids investigation and work, while the existing REST action remains legal.
  if (active && context.canAct && (s.health <= 0 || s.mind <= 0) && nextAction.kind === 'INVESTIGATE') {
    guidance = `当前健康或精神不足，先实际休养后才能调查。${guidance}`;
    restNext('查看恢复身心的休养');
  }
  if (blockedReason !== null && nextAction.kind !== 'CURRENT_EVENT') {
    nextAction = { ...nextAction, enabled: false, reason: blockedReason };
  }
  const summary = injuryCount > 0
    ? `未治疗重伤${untreatedHeavyCount}处 · 已处置待康复重伤${treatedHeavyCount}处 · 轻伤${lightCount}处 · 累计风险${s.injuryRisk}。${s.health >= 100 ? '健康100仍不等于伤势痊愈。' : ''}`
    : '当前无普通伤势。';
  return {
    needsAttention: injuryCount > 0 || s.health <= 0 || s.mind <= 0,
    stage, injuryCount, untreatedHeavyCount, treatedHeavyCount, lightCount, injuryRisk: s.injuryRisk,
    healthFullWithInjuries: s.health >= 100 && injuryCount > 0,
    summary, guidance, careKnown: s.careKnown, careAvailable: s.careKnown ? s.world.careAvailable : null,
    invitedThisWeek, treatmentCost: 60, healingHealthThreshold: 80, cashShortfall: Math.max(0, 60 - s.cash),
    workIncomeThisWeek: s.wagePaidWeek === s.week ? 0 : s.character.weeklyWage,
    aidStatus: s.aid, locked: blockedReason !== null, blockedReason,
    nextLoss: {
      label: '下次败北进入伤势分支时的条件权重',
      explanation: '仅在下一次败北并进入伤势后果分支时适用，不是每回合死亡概率；胜负、撤退及特殊场景另按实际规则结算。',
      weights: nextLosingInjuryWeights(s),
    },
    actions, nextAction,
  };
}
