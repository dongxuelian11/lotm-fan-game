import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from './combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState } from './types.js';
import { beginMysticCombatRound, currentMysticCombatSource, mysticActionCount, mysticEnemyActionCount,
  drawMysticAbility, drawMysticEnemyAbility, finishMysticCombatRound, resolveMysticCombatAbility, resolveMysticEnemyAbility } from '../mystic/combat.js';

type Outcome = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
type Actor = 'PLAYER' | 'ENEMY';
/** Narrow original Lucan adapter. Shares the established RNG, status/base and injury-risk wheel. */
export function resolveMysticCombatRound(state: SliceState, stance: SliceStance): { round: SliceCombatRound; outcome: Outcome } {
  if (!currentMysticCombatSource(state)) throw new Error('神秘学家缺少原卢坎的实际原附院战斗来源；不把首案携铃者或旧布莱斯改成新敌。');
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const combat = state.combat!, random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
  const playerCountRoll = random.nextInt(1, 100), enemyCountRoll = random.nextInt(1, 100);
  const first: Actor = combat.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
  const context = beginMysticCombatRound(state, stance), stats = state.character.coreStats;
  // Preserve HERMIT actual10/30/25/35 core; only the explicit S4 tier and finite original enemy change.
  const core = stats.physique * .1 + stats.perception * .3 + stats.will * .25 + stats.knowledge * .35;
  const playerBase = baseAdvantage(core, state.health, state.mind, state.spirituality, 1250, 120);
  const enemyBase = baseAdvantage(20, combat.enemyHealth, combat.enemyMind, state.mystic.encounter.enemySpirituality, 850, 40);
  const round: SliceCombatRound = { round: combat.round, stance, first, playerCount: mysticActionCount(playerCountRoll),
    enemyCount: mysticEnemyActionCount(enemyCountRoll), playerCountRoll, enemyCountRoll, moves: [], playerAdvantage: playerBase,
    enemyAdvantage: enemyBase, winChance: 0, winner: null, consequence: '', consequenceWeights: null, retreat: 'NONE' };
  const gains = { PLAYER: 0, ENEMY: 0 }, reductions = { PLAYER: 0, ENEMY: 0 }, threatened = { PLAYER: false, ENEMY: false };
  const update = () => {
    round.playerAdvantage = Math.max(125, playerBase + gains.PLAYER - reductions.PLAYER);
    round.enemyAdvantage = Math.max(85, enemyBase + gains.ENEMY - reductions.ENEMY);
    round.winChance = round.playerAdvantage / (round.playerAdvantage + round.enemyAdvantage) * 100;
  };
  const finish = (outcome: Outcome) => {
    update();
    round.consequence = context.label + round.consequence;
    round.mysticOutcome = finishMysticCombatRound(state, context);
    round.consequence += '本轮有限星光、回声与聚焦全部结束；原眼镜戴回，实付灵性与精神不退。';
    combat.lastRound = round; state.lastCombatRound = round; combat.round++;
    state.random.cursor = random.cursor;
    if (outcome === 'CONTINUE') state.spirituality = Math.min(120, state.spirituality + 12);
    return { round, outcome };
  };
  const remaining = { PLAYER: round.playerCount, ENEMY: round.enemyCount };
  const order: Actor[] = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] : ['ENEMY', 'PLAYER'];
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && stance === 'RETREAT') {
        remaining.PLAYER = 0;
        if (random.nextInt(1, 100) <= 50) {
          round.retreat = 'SUCCESS'; round.winner = 'ENEMY';
          round.consequence = '本人沿原独立净空附院的开放普通出口实际离开，无追逐、瞬移或夺棍；原卢坎与自己的MY4-LUCAN-CLUB留在原附院，原伤势与实付灵性保留。';
          return finish('RETREATED');
        }
        round.retreat = 'FAILURE'; continue;
      }
      remaining[actor]--;
      const effect = actor === 'PLAYER'
        ? resolveMysticCombatAbility(state, drawMysticAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random, context)
        : resolveMysticEnemyAbility(state, drawMysticEnemyAbility(random), 1 - statusPenalty(combat.enemyHealth, 100), random, context);
      gains[actor] += effect.selfGain;
      const other: Actor = actor === 'PLAYER' ? 'ENEMY' : 'PLAYER';
      reductions[other] += effect.enemyReduction;
      if (effect.threatens) threatened[other] = true;
      round.moves.push({ actor, label: effect.label, selfGain: effect.selfGain, enemyReduction: effect.enemyReduction });
    }
  }
  update();
  round.winner = random.nextInt(1, 1_000_000) <= round.winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const loser: Actor = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
  const injuries = loser === 'PLAYER' ? state.injuries : combat.enemyInjuries;
  let risk = loser === 'PLAYER' ? state.injuryRisk : combat.enemyRisk;
  if (injuries.length > 0) risk++;
  if (loser === 'PLAYER') state.injuryRisk = risk; else combat.enemyRisk = risk;
  const subject = loser === 'PLAYER' ? '你' : '同一原卢坎';
  if (!threatened[loser]) {
    round.consequence = `${subject}本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。${injuries.length ? `已有伤势下再败，累计风险${risk}保留。` : ''}`;
    return finish('CONTINUE');
  }
  // Exactly the common65/30/5 initial wheel and cumulative injury risk. Cage and echo are not direct damage.
  round.consequenceWeights = consequenceWeights(risk);
  const roll = random.nextInt(1, 100); round.consequenceRoll = roll;
  const severity = roll <= round.consequenceWeights.light ? 'LIGHT' : roll <= round.consequenceWeights.light + round.consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
  if (severity === 'DEATH') {
    if (loser === 'PLAYER') state.health = 0; else { combat.enemyHealth = 0; combat.enemyStatus = 'DEAD'; }
    round.consequence = `${subject}在共同伤势盘${roll}/100进入真实死亡分支；原身体与各自原物留在现场，故事、原眼镜与星光不复活。`;
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  const injury: SliceInjury = { id: `${state.runId}:combat:${round.round}:${loser}:${state.revision + 1}:${injuries.length}`,
    severity, acquiredRevision: state.revision + 1, treatedRevision: null };
  injuries.push(injury);
  const damage = severity === 'LIGHT' ? 10 : 30;
  if (loser === 'PLAYER') state.health = Math.max(0, state.health - damage); else combat.enemyHealth = Math.max(0, combat.enemyHealth - damage);
  round.consequence = `${subject}在共同伤势盘${roll}/100受到${severity === 'LIGHT' ? '轻' : '重'}伤，原健康实际−${damage}；不是回声或星光自动杀伤，伤勢保留。`;
  if ((loser === 'PLAYER' ? state.health : combat.enemyHealth) <= 0) {
    if (loser === 'ENEMY') combat.enemyStatus = 'DEAD';
    round.consequence += '原身体健康降0，真实死亡，没有故事复活。';
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  if (loser === 'ENEMY' && severity === 'HEAVY') {
    combat.enemyStatus = 'SURRENDERED'; round.consequence += '原卢坎仍活着，因真实重伤自行停止抵抗并放下自己的原棍；没有强迫服从，原伤势保留。';
    return finish('ENEMY_SURRENDERED');
  }
  return finish('CONTINUE');
}
