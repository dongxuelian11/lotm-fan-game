import type { MadmanBurstPolicy } from '../madman/combat.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from './combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState } from './types.js';
import { beginPuppetCombatRound, currentPuppetCombatSource, puppetActionCount, puppetEnemyActionCount,
  drawPuppetAbility, drawPuppetEnemyAbility, finishPuppetCombatRound, resolvePuppetCombatAbility, resolvePuppetEnemyAbility, reflectPuppetActualWound } from '../puppet/combat.js';

type Outcome = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
type Actor = 'PLAYER' | 'ENEMY';
/** Narrow original Edrin adapter. Shares the established RNG, status/base and injury-risk wheel. */
export function resolvePuppetCombatRound(state: SliceState, stance: SliceStance, cursePolicy = false, madmanPolicy: MadmanBurstPolicy = 'HOLD'): { round: SliceCombatRound; outcome: Outcome } {
  if (!currentPuppetCombatSource(state)) throw new Error('木偶缺少同一原埃德林的实际原工坊战斗来源；不把旧贝文或其他原人改成新敌。');
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const combat = state.combat!, random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
  const playerCountRoll = random.nextInt(1, 100), enemyCountRoll = random.nextInt(1, 100);
  const first: Actor = combat.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
  const context = beginPuppetCombatRound(state, stance, cursePolicy, madmanPolicy), stats = state.character.coreStats;
  // Preserve actual S5/S6 CHAINED50/20/15/15 core. All S4 budgets are explicit G.
  const core = stats.physique * .5 + stats.perception * .2 + stats.will * .15 + stats.knowledge * .15;
  const playerBase = baseAdvantage(core, state.health, state.mind, state.spirituality, 1250, 120);
  const enemyBase = baseAdvantage(20, combat.enemyHealth, combat.enemyMind, state.puppet.encounter.enemySpirituality, 850, 40);
  const round: SliceCombatRound = { round: combat.round, stance, first, playerCount: puppetActionCount(playerCountRoll),
    enemyCount: puppetEnemyActionCount(enemyCountRoll), playerCountRoll, enemyCountRoll, moves: [], playerAdvantage: playerBase,
    enemyAdvantage: enemyBase, winChance: 0, winner: null, consequence: '', consequenceWeights: null, retreat: 'NONE' };
  const threatened = { PLAYER: false, ENEMY: false };
  const update = () => {
    // Only the actual executed actions enter the common advantage and injury resolution.
    const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
    round.playerAdvantage = Math.max(125, playerBase + sum(context.playerActions, 'selfGain') - sum(context.enemyActions, 'enemyReduction'));
    round.enemyAdvantage = Math.max(85, enemyBase + sum(context.enemyActions, 'selfGain') - sum(context.playerActions, 'enemyReduction'));
    round.moves = [...context.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...context.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    round.winChance = round.playerAdvantage / (round.playerAdvantage + round.enemyAdvantage) * 100;
  };
  const finish = (outcome: Outcome) => {
    update();
    round.consequence = context.label + round.consequence;
    round.puppetOutcome = finishPuppetCombatRound(state, context, outcome === 'CONTINUE');
    round.madmanBurst = { ...context.madman };
    round.consequence += '本轮末同一原身体实际恢复人形（0额外行动、预付G），原伤不退；联系最多到种下轮及后两轮末，终局断开，原木块保留实际位置，实付成本不退。';
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
          round.consequence = '本人沿原独立净空工坊的开放普通出口实际离开，无追逐、瞬移或夺棍；原埃德林与自己的PU4-EDRIN-CLUB留在原工坊，原伤势与实付灵性保留。';
          return finish('RETREATED');
        }
        round.retreat = 'FAILURE'; continue;
      }
      remaining[actor]--;
      const effect = actor === 'PLAYER'
        ? resolvePuppetCombatAbility(state, drawPuppetAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random, context)
        : resolvePuppetEnemyAbility(state, drawPuppetEnemyAbility(random), 1 - statusPenalty(combat.enemyHealth, 100), random, context);
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
  const subject = loser === 'PLAYER' ? '你' : '同一原埃德林';
  if (!threatened[loser]) {
    round.consequence = `${subject}本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。${injuries.length ? `已有伤势下再败，累计风险${risk}保留。` : ''}`;
    return finish('CONTINUE');
  }
  // The unchanged common65/30/5 injury wheel decides actual wounds before any finite curse mapping.
  round.consequenceWeights = consequenceWeights(risk);
  const roll = random.nextInt(1, 100); round.consequenceRoll = roll;
  const severity = roll <= round.consequenceWeights.light ? 'LIGHT' : roll <= round.consequenceWeights.light + round.consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
  if (severity === 'DEATH') {
    if (loser === 'PLAYER') state.health = 0; else { combat.enemyHealth = 0; combat.enemyStatus = 'DEAD'; }
    round.consequence = `${subject}在共同伤势盘${roll}/100进入真实死亡分支；原身体与各自原物留在现场，诅咒形态不能复活。`;
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  const injury: SliceInjury = { id: `${state.runId}:combat:${round.round}:${loser}:${state.revision + 1}:${injuries.length}`,
    severity, acquiredRevision: state.revision + 1, treatedRevision: null };
  injuries.push(injury);
  const damage = severity === 'LIGHT' ? 10 : 30;
  if (loser === 'PLAYER') state.health = Math.max(0, state.health - damage); else combat.enemyHealth = Math.max(0, combat.enemyHealth - damage);
  round.consequence = `${subject}在共同伤势盘${roll}/100受到${severity === 'LIGHT' ? '轻' : '重'}伤，原健康实际−${damage}；不是联系或变形自动杀伤，原伤势保留。`;
  const reflection = loser === 'PLAYER' ? reflectPuppetActualWound(state, injury, context) : null;
  if (reflection) round.consequence += `同一原身体实际承受上述完整${reflection.playerDamage}伤害，仍有有效原联系的木偶诅咒源将有限${reflection.enemyDamage}伤害及对应伤势映射到同一原埃德林（G）；不治疗本人或删原伤。`;
  // Both original deaths are retained, with the player's death taking priority.
  if (state.health <= 0) {
    round.consequence += '玩家原身体健康降0，真实死亡；即使原敌也已死亡，玩家死亡仍优先。';
    return finish('PLAYER_DEAD');
  }
  if (combat.enemyHealth <= 0) {
    if (loser === 'ENEMY') combat.enemyStatus = 'DEAD';
    round.consequence += '原身体健康降0，真实死亡，没有诅咒能力复活。';
    return finish('ENEMY_DEAD');
  }
  if (reflection?.severity === 'HEAVY' && combat.enemyHealth <= 40) {
    combat.enemyStatus = 'SURRENDERED'; round.consequence += '原埃德林因自己实际重伤且健康不高于40，自主决定停止抵抗（G）；仍活着，不是联系强迫投降。';
    return finish('ENEMY_SURRENDERED');
  }
  if (loser === 'ENEMY' && severity === 'HEAVY') {
    combat.enemyStatus = 'SURRENDERED'; round.consequence += '原埃德林仍活着，因真实重伤自行停止抵抗且仍保有自己的原棍；没有强迫服从，原伤势保留。';
    return finish('ENEMY_SURRENDERED');
  }
  return finish('CONTINUE');
}
