import { learningKnowledge, type LearningView } from '../domain/slice/learning.js';
import type { SliceTarget } from '../domain/slice/types.js';

const topicCopy: Record<string, string> = {
  'learn.bookkeeping': '阅读手边的普通记账材料。',
  'learn.safety': '阅读住所的公开安全说明；不授予战斗能力。',
  'learn.profession': '整理已有的本职工作说明；不改变职业资格。',
  'learn.seer-notes': '神秘学记忆辅助。',
};
/** Format existing public fields without changing the persisted/public snapshot. */
export function learningTargetDescription(state: LearningView, target: SliceTarget): string {
  const description = topicCopy[target.id];
  if (!description) return target.description;
  const gain = learningKnowledge(state, target.id);
  const knowledge = gain.after > gain.before
    ? `成功知识${gain.before}→${gain.after}（+${gain.after - gain.before}，本类学习上限${gain.cap}）。`
    : `当前知识${gain.before}已达本类学习上限${gain.cap}；成功也不增加知识，原值保留。`;
  const mastery = target.id === 'learn.seer-notes' || state.progression.pathwayId === 'paragon'
    ? '成功后能力掌握另按既有规则随机分配给一项已知能力，不等于知识增长。' : '';
  return `${description}知识难度${gain.difficulty}；${knowledge}${mastery}`;
}
