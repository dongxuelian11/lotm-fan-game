import { currentNatureWalkerCombatSource, replayNatureWalkerCombatRound, validNatureWalkerCombatSource } from '../nature-walker/combat.js';
import { natureWalkerCombatBody } from '../nature-walker/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor; Mother20/15/20/45 core; the new root owns the current original root pad. */
export function resolveNatureWalkerCombatRound(s: SliceState, stance: SliceStance) {
  const source=currentNatureWalkerCombatSource(s);
  if (!source || !validNatureWalkerCombatSource(source)) throw new Error('缺少同一独立对手、实际净空院落或真实物资记录。');
  const result=replayNatureWalkerCombatRound(source,stance),o=result.round.natureWalkerOutcome!,c=s.combat!;
  s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;
  s.progression.mastery={...o.masteryAfter};s.natureWalker.life.rootPad=structuredClone(o.rootPadAfter);Object.assign(s.natureWalker.encounter,natureWalkerCombatBody(o));
  s.natureWalker.life.site=structuredClone(o.siteAfter);s.natureWalker.life.operation=structuredClone(o.operationAfter);
  c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;
  c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
  if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);
  return result;
}
export const resolveNatureWalkerSliceCombatRound=resolveNatureWalkerCombatRound;
