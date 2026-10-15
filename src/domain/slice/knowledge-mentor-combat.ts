import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { stableStringify } from '../canonical.js';
import { validateKnowledgeMentorRoundOutcome } from '../knowledge-mentor/combat.js';
import { baseAdvantage, consequenceWeights, statusPenalty } from './combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState } from './types.js';
import { beginKnowledgeMentorCombatRound, currentKnowledgeMentorCombatSource, knowledgeMentorActionCount, knowledgeMentorEnemyActionCount,
  drawKnowledgeMentorAbility, drawKnowledgeMentorEnemyAbility, finishKnowledgeMentorCombatRound, resolveKnowledgeMentorCombatAbility, resolveKnowledgeMentorEnemyAbility } from '../knowledge-mentor/combat.js';

type Outcome = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
type Actor = 'PLAYER' | 'ENEMY';
/** Candidate G2 original Rowan Hale adapter. Shares the established RNG, status/base and injury-risk wheel. */
export function resolveKnowledgeMentorCombatRound(state: SliceState, stance: SliceStance): { round: SliceCombatRound; outcome: Outcome } {
  if (!currentKnowledgeMentorCombatSource(state)) throw new Error('候选知识导师缺少原罗温·黑尔的实际原外院战斗来源；不把已死亡的旧奥斯里克改成新敌。');
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('战术姿态无效。');
  const combat = state.combat!, random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
  const context = beginKnowledgeMentorCombatRound(state, stance, random);
  const playerCountRoll = random.nextInt(1, 100), enemyCountRoll = random.nextInt(1, 100);
  const first: Actor = combat.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
  const stats = state.character.coreStats;
  // Candidate S2 retains the actual Paragon S4 weighted core; new effects are G.
  const core = stats.physique*.3+stats.perception*.3+stats.will*.25+stats.knowledge*.15;
  const playerBase = baseAdvantage(core, state.health, state.mind, state.spirituality, 1250, 120);
  const enemyBase = baseAdvantage(24, combat.enemyHealth, combat.enemyMind, state.knowledgeMentor.encounter.enemySpirituality, 1250, 120);
  const round: SliceCombatRound = { round: combat.round, stance, first, playerCount: knowledgeMentorActionCount(playerCountRoll),
    enemyCount: knowledgeMentorEnemyActionCount(enemyCountRoll), playerCountRoll, enemyCountRoll, moves: [], playerAdvantage: playerBase,
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
    round.knowledgeMentorOutcome = finishKnowledgeMentorCombatRound(state, context, outcome === 'CONTINUE', random.cursor);
    round.consequence += '本轮候选封装、校准与继承解析协同窗口实际结束；原片实物、原储能、精神、灵性和耐久成本保留，实际使用计数不取决于掌握是否增长。';
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
          round.consequence = '本人实际停止原件、亲手拾回本次携入的原盒原架及全部原指令片（含用尽实物），沿开放普通出口步行4米、4秒离开，无追逐、瞬移或夺棍；原罗温·黑尔与自己的KM2-ROWAN-CLUB留在原外院，原伤势、实付灵性保留。';
          return finish('RETREATED');
        }
        round.retreat = 'FAILURE'; continue;
      }
      remaining[actor]--;
      const effect = actor === 'PLAYER'
        ? resolveKnowledgeMentorCombatAbility(state, drawKnowledgeMentorAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random, context)
        : resolveKnowledgeMentorEnemyAbility(state, drawKnowledgeMentorEnemyAbility(random), 1 - statusPenalty(combat.enemyHealth, 100), random, context);
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
  const subject = loser === 'PLAYER' ? '你' : '同一原罗温·黑尔';
  if (!threatened[loser]) {
    round.consequence = `${subject}本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。${injuries.length ? `已有伤势下再败，累计风险${risk}保留。` : ''}`;
    return finish('CONTINUE');
  }
  // Common65/30/5 initial wheel and cumulative injury risk. Construct coordination does not bypass the shared injury wheel or heal actual wounds.
  round.consequenceWeights = consequenceWeights(risk);
  const roll = random.nextInt(1, 100); round.consequenceRoll = roll;
  const severity = roll <= round.consequenceWeights.light ? 'LIGHT' : roll <= round.consequenceWeights.light + round.consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
  if (severity === 'DEATH') {
    if (loser === 'PLAYER') state.health = 0; else { combat.enemyHealth = 0; combat.enemyStatus = 'DEAD'; }
    round.consequence = `${subject}在共同伤势盘${roll}/100进入真实死亡分支；原身体与各自原物留在现场，造物协调不能复活。`;
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  const injury: SliceInjury = { id: `${state.runId}:combat:${round.round}:${loser}:${state.revision + 1}:${injuries.length}`,
    severity, acquiredRevision: state.revision + 1, treatedRevision: null };
  injuries.push(injury);
  const damage = severity === 'LIGHT' ? 10 : 30;
  if (loser === 'PLAYER') state.health = Math.max(0, state.health - damage); else combat.enemyHealth = Math.max(0, combat.enemyHealth - damage);
  round.consequence = `${subject}在共同伤势盘${roll}/100受到${severity === 'LIGHT' ? '轻' : '重'}伤，原健康实际−${damage}；不是分析结果自动杀伤，伤势保留。`;
  if ((loser === 'PLAYER' ? state.health : combat.enemyHealth) <= 0) {
    if (loser === 'ENEMY') combat.enemyStatus = 'DEAD';
    round.consequence += '原身体健康降0，真实死亡，没有能力复活。';
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  if (loser === 'ENEMY' && severity === 'HEAVY') {
    combat.enemyStatus = 'SURRENDERED'; round.consequence += '原罗温·黑尔仍活着，因真实重伤自行停止抵抗并将自己的唯一原棍KM2-ROWAN-CLUB实际放在YARD原地；没有强迫服从，原伤势保留。';
    return finish('ENEMY_SURRENDERED');
  }
  return finish('CONTINUE');
}

/** Independently replay this exact source cursor, both count/ability wheels,
 * every paid check, the common winner/injury dice and resource action records.
 * This is validation only: no game state, random cursor or resource is changed. */
export function validateKnowledgeMentorRecordedRound(round: SliceCombatRound): boolean {
  try {
    const o = round.knowledgeMentorOutcome;
    if (!validateKnowledgeMentorRoundOutcome(o) || round.round !== o.round || round.stance !== o.stance || round.winner === null) return false;
    const src = o.source, random = new DeterministicActionRandomStream(src.randomSeed, src.randomCursor);
    const roundKeys = ['round', 'stance', 'first', 'playerCount', 'enemyCount', 'playerCountRoll', 'enemyCountRoll', 'moves', 'playerAdvantage', 'enemyAdvantage', 'winChance', 'winner', 'consequence', 'consequenceWeights', 'retreat', 'knowledgeMentorOutcome', ...('consequenceRoll' in round ? ['consequenceRoll'] : [])];
    if (stableStringify(Object.keys(round).sort()) !== stableStringify(roundKeys.sort())) return false;
    const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
    const playerCountRoll = random.nextInt(1, 100), enemyCountRoll = random.nextInt(1, 100);
    const first: Actor = src.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
    if (round.first !== first || round.playerCountRoll !== playerCountRoll || round.enemyCountRoll !== enemyCountRoll ||
        round.playerCount !== knowledgeMentorActionCount(playerCountRoll) || round.enemyCount !== knowledgeMentorEnemyActionCount(enemyCountRoll)) return false;
    const left = { PLAYER: round.playerCount, ENEMY: round.enemyCount }, at = { PLAYER: 0, ENEMY: 0 };
    const order: Actor[] = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] : ['ENEMY', 'PLAYER'];
    let globalOrder = 0, retreat: SliceCombatRound['retreat'] = 'NONE', stopped = false;
    const dummyState = {} as SliceState; // drawKnowledgeMentorAbility does not inspect state.
    while (!stopped && (left.PLAYER > 0 || left.ENEMY > 0)) {
      for (const actor of order) {
        if (!left[actor]) continue;
        if (actor === 'PLAYER' && o.stance === 'RETREAT') {
          left.PLAYER = 0;
          retreat = random.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE';
          if (retreat === 'SUCCESS') { stopped = true; break; }
          continue;
        }
        left[actor]--;
        if (actor === 'PLAYER') {
          const action = o.playerActions[at.PLAYER++];
          if (!action || action.order !== globalOrder++ || action.id !== drawKnowledgeMentorAbility(random, dummyState, o.stance) || action.physicalFactor !== 1 - statusPenalty(src.playerHealth, 100)) return false;
          if (action.rolls.some(n => n !== random.nextInt(1, 100))) return false;
        } else {
          const action = o.enemyActions[at.ENEMY++];
          if (!action || action.order !== globalOrder++ || action.planned !== drawKnowledgeMentorEnemyAbility(random) || action.physicalFactor !== 1 - statusPenalty(src.enemyHealth, 100) || action.rolls.length !== 0) return false;
        }
      }
    }
    if (at.PLAYER !== o.playerActions.length || at.ENEMY !== o.enemyActions.length || retreat !== round.retreat) return false;
    const stats = src.playerCoreStats, core = stats.physique*.3 + stats.perception*.3 + stats.will*.25 + stats.knowledge*.15;
    const playerBase = baseAdvantage(core, src.playerHealth, src.playerMind, src.playerSpirituality, 1250, 120);
    const enemyBase = baseAdvantage(24, src.enemyHealth, src.enemyMind, src.enemySpirituality, 1250, 120);
    const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, a) => n + a[key], 0);
    const pa = Math.max(125, playerBase + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction'));
    const ea = Math.max(125, enemyBase + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction'));
    const chance = pa / (pa + ea) * 100;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (round.playerAdvantage !== pa || round.enemyAdvantage !== ea || round.winChance !== chance || !same(round.moves, moves)) return false;
    let ph = src.playerHealth, eh = src.enemyHealth, pr = src.playerRisk, er = src.enemyRisk;
    let enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD' = 'RESISTING';
    let outcome: Outcome = retreat === 'SUCCESS' ? 'RETREATED' : 'CONTINUE';
    const pi = structuredClone(src.playerInjuries), ei = structuredClone(src.enemyInjuries);
    if (retreat === 'SUCCESS') {
      if (round.winner !== 'ENEMY' || round.consequenceWeights !== null || round.consequenceRoll !== undefined) return false;
    } else {
      const winner: Actor = random.nextInt(1, 1_000_000) <= chance * 10_000 ? 'PLAYER' : 'ENEMY';
      if (round.winner !== winner) return false;
      const loser: Actor = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
      const injuries = loser === 'PLAYER' ? pi : ei;
      let risk = loser === 'PLAYER' ? pr : er;
      if (injuries.length) risk++;
      if (loser === 'PLAYER') pr = risk; else er = risk;
      const threatened = (loser === 'PLAYER' ? o.enemyActions : o.playerActions).some(a => a.threatens);
      if (!threatened) {
        if (round.consequenceWeights !== null || round.consequenceRoll !== undefined) return false;
      } else {
        const weights = consequenceWeights(risk), roll = random.nextInt(1, 100);
        if (!same(round.consequenceWeights, weights) || round.consequenceRoll !== roll) return false;
        const severity = roll <= weights.light ? 'LIGHT' : roll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
        if (severity === 'DEATH') {
          if (loser === 'PLAYER') { ph = 0; outcome = 'PLAYER_DEAD'; }
          else { eh = 0; enemyStatus = 'DEAD'; outcome = 'ENEMY_DEAD'; }
        } else {
          const damage = severity === 'LIGHT' ? 10 : 30;
          injuries.push({ id: `${src.runId}:combat:${src.round}:${loser}:${src.revision + 1}:${injuries.length}`, severity, acquiredRevision: src.revision + 1, treatedRevision: null });
          if (loser === 'PLAYER') ph = Math.max(0, ph - damage); else eh = Math.max(0, eh - damage);
          if (loser === 'PLAYER' && ph === 0) outcome = 'PLAYER_DEAD';
          else if (loser === 'ENEMY' && eh === 0) { enemyStatus = 'DEAD'; outcome = 'ENEMY_DEAD'; }
          else if (loser === 'ENEMY' && severity === 'HEAVY') { enemyStatus = 'SURRENDERED'; outcome = 'ENEMY_SURRENDERED'; }
        }
      }
    }
    return o.continuing === (outcome === 'CONTINUE') && o.playerHealthAfter === ph && o.enemyHealth === eh && o.enemyStatus === enemyStatus &&
      o.playerRiskAfter === pr && o.enemyRiskAfter === er && same(o.playerInjuriesAfter, pi) && same(o.enemyInjuriesAfter, ei) && o.randomCursorAfter === random.cursor;
  } catch { return false; }
}
