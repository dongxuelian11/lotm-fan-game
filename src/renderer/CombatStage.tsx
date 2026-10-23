import type { SlicePublicCombatRound as SliceCombatRound, SliceProjection } from '../domain/slice/types';
import './combat-stage.css';

/** A view of the saved round, never a second combat simulation. */
export function CombatStage({ state, round, fast }: {
  state: SliceProjection;
  round: SliceCombatRound | null;
  fast: boolean;
}) {
  const battle = state.combat;
  const firstCase = battle?.title === '首案 · 追击携铃者';
  const portrait = `${import.meta.env.BASE_URL}assets/portraits/portrait_${state.character.portraitId.replace('portrait-', '').padStart(2, '0')}.webp`;
  const outcome = !round ? '选择姿态，再结算这一回合' : round.retreat === 'SUCCESS' ? '成功脱离战斗' : round.retreat === 'FAILURE' ? '撤退失败' : round.winner === 'PLAYER' ? '你赢得本回合' : round.winner === 'ENEMY' ? '对手赢得本回合' : '本回合未分胜负';
  const animate = !!round && !fast;
  return <section className={`combat-stage ${firstCase ? 'combat-stage-boiler' : ''} ${animate ? 'combat-stage-reveal' : ''}`} aria-label="当前战场" data-animated={animate} key={`${state.runId}:${round?.round ?? 'ready'}`}>
    <div className="combat-duel">
      <section className={`combat-fighter combat-player ${round?.winner === 'PLAYER' ? 'combat-advantage' : ''}`} aria-label="你的战斗状态">
        <img className="combat-portrait" src={portrait} alt="" />
        <div className="combat-fighter-info">
          <span className="combat-side">你的角色</span>
          <h3>{state.character.name}</h3>
          <Health value={state.health} max={state.maxHealth} label="你的健康" />
          <p>精神 {state.mind} / {state.maxMind} · 灵性 {state.spirituality} / {state.maxSpirituality}</p>
          <p className="combat-wounds">普通伤势 {state.injuries.length}处 · 风险累积 {state.injuryRisk}层</p>
        </div>
      </section>
      <span className="combat-versus" aria-hidden="true">交<br/>锋</span>
      <section className={`combat-fighter combat-enemy ${round?.winner === 'ENEMY' ? 'combat-advantage' : ''}`} aria-label="对手战斗状态">
        <div className="combat-fighter-info">
          <span className="combat-side">{battle ? '眼前的对手' : '遭遇已结束'}</span>
          <h3>{battle?.enemyName ?? '对手'}</h3>
          {battle ? <><Health value={battle.enemyHealth} max={100} label="对手健康" />
            {battle.enemyMind !== undefined && <p>精神 {battle.enemyMind} / 100</p>}
            <p>{({ RESISTING: '仍在抵抗', SURRENDERED: '已投降', DEAD: '已死亡' } as Record<string, string>)[battle.enemyStatus] ?? battle.enemyStatus}</p>
          </> : <p>当前没有交战中的对手</p>}
        </div>
        {firstCase ? <img className="combat-portrait combat-enemy-portrait" src={`${import.meta.env.BASE_URL}assets/npcs/bell-bearer.png`} alt="持短棍的携铃者" /> : <svg className="combat-enemy-mark" viewBox="0 0 90 120" aria-hidden="true">
          <path d="M45 10 77 25 72 78 45 110 18 78 13 25Z"/><path className="combat-mark-line" d="m30 31 30 53M60 31 30 84M24 69l15 8M51 77l15-8"/>
        </svg>}
      </section>
    </div>
    <div className="combat-round-outcome" role={round ? 'status' : undefined}>
      <strong>{outcome}</strong>
      {round && <span>行动次数：你 {round.playerCount} · 对手 {round.enemyCount}　{round.first === 'PLAYER' ? '你先行动' : '对手先行动'}</span>}
    </div>
  </section>;
}

function Health({ value, max, label }: { value: number; max: number; label: string }) {
  return <div className="combat-health">
    <div className="combat-health-label"><span>健康</span><strong>{value} / {max}</strong></div>
    <div className="combat-health-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} />
    </div>
  </div>;
}
