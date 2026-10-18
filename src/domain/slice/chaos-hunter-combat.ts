import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from './combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState } from './types.js';
import { beginChaosHunterCombatRound, currentChaosHunterCombatSource, chaosHunterActionCount, chaosHunterEnemyActionCount,
  drawChaosHunterAbility, drawChaosHunterEnemyAbility, finishChaosHunterCombatRound, resolveChaosHunterCombatAbility, resolveChaosHunterEnemyCombatAbility } from '../chaos-hunter/combat.js';

type Outcome = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
type Actor = 'PLAYER' | 'ENEMY';
/** Narrow original Edric adapter. Shares the established RNG, status/base and injury-risk wheel. */
export function resolveChaosHunterCombatRound(state: SliceState, stance: SliceStance): { round: SliceCombatRound; outcome: Outcome } {
  if (!currentChaosHunterCombatSource(state)) throw new Error('混乱猎手缺少原埃德里克的实际原外院战斗来源；不把旧罗温改成新敌。');
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const combat = state.combat!, random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
  const context = beginChaosHunterCombatRound(state, stance, random);
  const playerCountRoll = random.nextInt(1, 100), enemyCountRoll = random.nextInt(1, 100);
  const first: Actor = combat.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
  const stats = state.character.coreStats;
  // Original Justiciar core30/20/35/15; all S3 budgets remain finite G.
  const core = stats.physique * .3 + stats.perception * .2 + stats.will * .35 + stats.knowledge * .15;
  const playerBase = baseAdvantage(core, state.health, state.mind, state.spirituality, 1250, 120);
  const enemyBase = baseAdvantage(22, combat.enemyHealth, combat.enemyMind, state.chaosHunter.encounter.enemySpirituality, 1250, 120);
  const round: SliceCombatRound = { round: combat.round, stance, first, playerCount: chaosHunterActionCount(playerCountRoll),
    enemyCount: chaosHunterEnemyActionCount(enemyCountRoll), playerCountRoll, enemyCountRoll, moves: [], playerAdvantage: playerBase,
    enemyAdvantage: enemyBase, winChance: 0, winner: null, consequence: '', consequenceWeights: null, retreat: 'NONE' };
  const threatened = { PLAYER: false, ENEMY: false };
  const update = () => {
    // Only the actual executed actions enter the common advantage and injury resolution.
    const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
    round.playerAdvantage = Math.max(125, playerBase + sum(context.playerActions, 'selfGain') - sum(context.enemyActions, 'enemyReduction'));
    round.enemyAdvantage = Math.max(125, enemyBase + sum(context.enemyActions, 'selfGain') - sum(context.playerActions, 'enemyReduction'));
    round.moves = [...context.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...context.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    round.winChance = round.playerAdvantage / (round.playerAdvantage + round.enemyAdvantage) * 100;
  };
  const finish = (outcome: Outcome) => {
    update();
    round.consequence = context.label + round.consequence;
    round.chaosHunterOutcome = finishChaosHunterCombatRound(state, context, outcome === 'CONTINUE');
    round.consequence += '本轮双方各自未用身体禁令、原震慑、暂剥、凝神与真实违令来源均到期；已付灵性和实际伤势不退，不追改此前动作、不重抽。';
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
          round.consequence = '本人沿原协会独立净空外院的开放普通出口实际离开，无追逐、瞬移或夺棍；原埃德里克与自己的CH3-EDRIC-ROD留在原外院，原伤势与各自实付灵性保留。';
          return finish('RETREATED');
        }
        round.retreat = 'FAILURE'; continue;
      }
      remaining[actor]--;
      const effect = actor === 'PLAYER'
        ? resolveChaosHunterCombatAbility(state, drawChaosHunterAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random, context)
        : resolveChaosHunterEnemyCombatAbility(state, drawChaosHunterEnemyAbility(random), 1 - statusPenalty(combat.enemyHealth, 100), random, context);
      const other: Actor = actor === 'PLAYER' ? 'ENEMY' : 'PLAYER';
      if (effect.threatens) threatened[other] = true;
    }
  }
  update();
  round.winner = random.nextInt(1, 1_000_000) <= round.winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  const loser: Actor = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
  const injuries = loser === 'PLAYER' ? state.injuries : combat.enemyInjuries;
  let risk = loser === 'PLAYER' ? state.injuryRisk : combat.enemyRisk;
  if (injuries.length > 0) risk++;
  if (loser === 'PLAYER') state.injuryRisk = risk; else combat.enemyRisk = risk;
  const subject = loser === 'PLAYER' ? '你' : '同一原埃德里克';
  if (!threatened[loser]) {
    round.consequence = `${subject}本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。${injuries.length ? `已有伤势下再败，累计风险${risk}保留。` : ''}`;
    return finish('CONTINUE');
  }
  // Exactly the common65/30/5 initial wheel and cumulative injury risk. Prohibition and deprivation never directly damage health or guarantee a wound.
  round.consequenceWeights = consequenceWeights(risk);
  const roll = random.nextInt(1, 100); round.consequenceRoll = roll;
  const severity = roll <= round.consequenceWeights.light ? 'LIGHT' : roll <= round.consequenceWeights.light + round.consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
  if (severity === 'DEATH') {
    if (loser === 'PLAYER') state.health = 0; else { combat.enemyHealth = 0; combat.enemyStatus = 'DEAD'; }
    round.consequence = `${subject}在共同伤势盘${roll}/100进入真实死亡分支；原身体与各自原物留在现场，禁令不能复活。`;
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  const injury: SliceInjury = { id: `${state.runId}:combat:${round.round}:${loser}:${state.revision + 1}:${injuries.length}`,
    severity, acquiredRevision: state.revision + 1, treatedRevision: null };
  injuries.push(injury);
  const damage = severity === 'LIGHT' ? 10 : 30;
  if (loser === 'PLAYER') state.health = Math.max(0, state.health - damage); else combat.enemyHealth = Math.max(0, combat.enemyHealth - damage);
  round.consequence = `${subject}在共同伤势盘${roll}/100受到${severity === 'LIGHT' ? '轻' : '重'}伤，原健康实际−${damage}；不是禁令自动杀伤，伤勢保留。`;
  if ((loser === 'PLAYER' ? state.health : combat.enemyHealth) <= 0) {
    if (loser === 'ENEMY') combat.enemyStatus = 'DEAD';
    round.consequence += '原身体健康降0，真实死亡，没有能力复活。';
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  if (loser === 'ENEMY' && severity === 'HEAVY') {
    combat.enemyStatus = 'SURRENDERED'; round.consequence += '原埃德里克仍活着，因真实重伤自行停止抵抗并仍保有自己的原棍；没有强迫服从，原伤势保留。';
    return finish('ENEMY_SURRENDERED');
  }
  return finish('CONTINUE');
}
