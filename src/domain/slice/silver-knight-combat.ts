import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from './combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState } from './types.js';
import { beginSilverKnightCombatRound, currentSilverKnightCombatSource, silverKnightActionCount, silverKnightEnemyActionCount,
  drawSilverKnightAbility, drawSilverKnightEnemyAbility, finishSilverKnightCombatRound, resolveSilverKnightCombatAbility, resolveSilverKnightEnemyAbility, attemptSilverKnightRetreat } from '../silver-knight/combat.js';

type Outcome = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
type Actor = 'PLAYER' | 'ENEMY';
/** Six actual pre-promotion hunt sources and one post-promotion original opponent; same injury and action-count core. */
export function resolveSilverKnightCombatRound(state: SliceState, stance: SliceStance): { round: SliceCombatRound; outcome: Outcome } {
  const source=currentSilverKnightCombatSource(state);
  if (!source) throw new Error('须当前原猎场个体或晋后原洛肯实际在场、仍有能力资源及开放退出条件。');
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const combat = state.combat!, random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
  const context = beginSilverKnightCombatRound(state, stance, random);
  const playerCountRoll = random.nextInt(1, 100), enemyCountRoll = random.nextInt(1, 100);
  const first: Actor = combat.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
  const stats = state.character.coreStats;
  // Both S4 hunts and S3 retain the actual Warrior45/20/25/10 weighted core; new effects are G.
  const core = stats.physique*.45+stats.perception*.2+stats.will*.25+stats.knowledge*.1;
  const playerBase = baseAdvantage(core, state.health, state.mind, state.spirituality, 1250, 120);
  const enemyBase = baseAdvantage(source.enemyCore, combat.enemyHealth, combat.enemyMind, source.resources.enemySpirituality, source.enemyTier, source.enemyMaxSpirituality);
  const round: SliceCombatRound = { round: combat.round, stance, first, playerCount: silverKnightActionCount(playerCountRoll),
    enemyCount: silverKnightEnemyActionCount(enemyCountRoll), playerCountRoll, enemyCountRoll, moves: [], playerAdvantage: playerBase,
    enemyAdvantage: enemyBase, winChance: 0, winner: null, consequence: '', consequenceWeights: null, retreat: 'NONE' };
  const threatened = { PLAYER: false, ENEMY: false };
  const update = () => {
    // Only the actual executed actions enter the common advantage and injury resolution.
    const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
    round.playerAdvantage = Math.max(125, playerBase + sum(context.playerActions, 'selfGain') - sum(context.enemyActions, 'enemyReduction'));
    round.enemyAdvantage = Math.max(source.enemyTier*.1, enemyBase + sum(context.enemyActions, 'selfGain') - sum(context.playerActions, 'enemyReduction'));
    round.moves = [...context.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...context.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    round.winChance = round.playerAdvantage / (round.playerAdvantage + round.enemyAdvantage) * 100;
  };
  const finish = (outcome: Outcome) => {
    update();
    round.consequence = context.label + round.consequence;
    round.silverKnightOutcome = finishSilverKnightCombatRound(state, context, outcome === 'CONTINUE');
    round.consequence += '本轮有限银甲/借光/影缚等暂效结束；原身体、原材料、原精神压力与独立敌灵性保留，未晋升不能使用银骑士新技。';
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
        if (attemptSilverKnightRetreat(state, context, random)) {
          round.retreat = 'SUCCESS'; round.winner = 'ENEMY';
          round.consequence = '本人在实际影缚解除/到期条件下沿原场开放地面出口离开，无追逐或瞬移；同一原目标与资源留原位置，实付灵性及原伤势不恢复。';
          return finish('RETREATED');
        }
        round.retreat = 'FAILURE'; continue;
      }
      remaining[actor]--;
      const effect = actor === 'PLAYER'
        ? resolveSilverKnightCombatAbility(state, drawSilverKnightAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random, context)
        : resolveSilverKnightEnemyAbility(state, drawSilverKnightEnemyAbility(random), 1 - statusPenalty(combat.enemyHealth, 100), random, context);
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
  const subject = loser === 'PLAYER' ? '你' : `同一原目标${source.targetId}`;
  if (!threatened[loser]) {
    round.consequence = `${subject}本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。${injuries.length ? `已有伤势下再败，累计风险${risk}保留。` : ''}`;
    return finish('CONTINUE');
  }
  // Common65/30/5 initial wheel and cumulative injury risk. Limited positioning does not bypass the shared injury wheel or heal actual wounds.
  round.consequenceWeights = consequenceWeights(risk);
  const roll = random.nextInt(1, 100); round.consequenceRoll = roll;
  const severity = roll <= round.consequenceWeights.light ? 'LIGHT' : roll <= round.consequenceWeights.light + round.consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
  if (severity === 'DEATH') {
    if (loser === 'PLAYER') state.health = 0; else { combat.enemyHealth = 0; combat.enemyStatus = 'DEAD'; }
    round.consequence = `${subject}在共同伤势盘${roll}/100进入真实死亡分支；原身体与各自原物留在现场，银甲或借光不能复活。`;
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  const injury: SliceInjury = { id: `${state.runId}:combat:${round.round}:${loser}:${state.revision + 1}:${injuries.length}`,
    severity, acquiredRevision: state.revision + 1, treatedRevision: null };
  injuries.push(injury);
  const damage = severity === 'LIGHT' ? 10 : 30;
  if (loser === 'PLAYER') state.health = Math.max(0, state.health - damage); else combat.enemyHealth = Math.max(0, combat.enemyHealth - damage);
  round.consequence = `${subject}在共同伤势盘${roll}/100受到${severity === 'LIGHT' ? '轻' : '重'}伤，原健康实际−${damage}；不是观察或材料准备自动杀伤，伤势保留。`;
  if ((loser === 'PLAYER' ? state.health : combat.enemyHealth) <= 0) {
    if (loser === 'ENEMY') combat.enemyStatus = 'DEAD';
    round.consequence += '原身体健康降0，真实死亡，没有能力复活。';
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  if (loser === 'ENEMY' && severity === 'HEAVY' && source.mode === 'HUNT' && source.huntBehaviorVersion === 2) {
    round.consequence += '本非人原体按已登记G行为v2，带真实重伤继续抵抗；伤势、健康、灵性和风险均保留。本人可尝试沿普通出口撤离，未死亡不产生遗骸。';
    return finish('CONTINUE');
  }
  if (loser === 'ENEMY' && severity === 'HEAVY') {
    combat.enemyStatus = 'SURRENDERED'; round.consequence += '同一原目标仍活着，因真实重伤停止抵抗；不计亲猎死亡、不发遗骸、不允许补刀，原伤势保留。';
    return finish('ENEMY_SURRENDERED');
  }
  return finish('CONTINUE');
}
