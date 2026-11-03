import type { ProvokerAction } from '../domain/provoker/types';
import { PROVOKER_CHOICE_RULES, PROVOKER_CHOICE_SUCCESS } from '../shared/provoker-choice-rules';

const attributeLabels = { will: '意志', knowledge: '知识', perception: '感知' } as const;
const genericRisk = ' · 可能被拒绝；人的冲突可能导致推搡受伤';

/** Annotate only an existing public choice, never create or enable an action. */
export function provokerChoicePreview(action: ProvokerAction) {
  const command = action.command;
  if (command.type !== 'CHOOSE') return null;
  const knownPair = command.caseId === 'yard-hound'
    ? command.choice === 'ATTRACT' || command.choice === 'WAIT'
    : (command.caseId === 'invoice-claim' || command.caseId === 'queue-boast')
      && (command.choice === 'CHALLENGE' || command.choice === 'DEESCALATE');
  if (!knownPair) return null;
  const rule = PROVOKER_CHOICE_RULES[command.choice];
  const penalty = [rule.failureHealth ? `健康−${rule.failureHealth}` : '', rule.failureMind ? `精神−${rule.failureMind}` : ''].filter(Boolean).join('、');
  return {
    // Replace only the exact legacy generic suffix; retain all supplied resource costs.
    cost: action.cost.endsWith(genericRisk) ? action.cost.slice(0, -genericRisk.length) : action.cost,
    detail: `${attributeLabels[rule.attribute]}难度${rule.difficulty} · ${penalty ? `失败${penalty}` : '失败不额外扣健康或精神'}`,
  };
}

export const provokerChoiceCommonNote = `成功均获得扮演+${PROVOKER_CHOICE_SUCCESS.acting}、单项已知能力掌握+${PROVOKER_CHOICE_SUCCESS.mastery}；失败本周不能重试。`;
