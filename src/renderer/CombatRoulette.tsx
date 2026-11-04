import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SlicePublicCombatRound, SliceWheelEntry } from '../domain/slice/types';
import './combat-roulette.css';

/** Geometry represents saved public facts, never a new draw. */
export function countNeedleAngle(roll: number | undefined): number | null {
  return roll !== undefined && Number.isInteger(roll) && roll >= 1 && roll <= 100 ? (roll - 1) * 3.6 : null;
}
export function outcomeNeedleAngle(round: SlicePublicCombatRound | null): number | null {
  if (!round || round.retreat === 'SUCCESS' || round.winner === null || !Number.isFinite(round.winChance) || round.winChance < 0 || round.winChance > 100) return null;
  if (round.winner === 'PLAYER') return round.winChance > 0 ? round.winChance * 1.8 : null;
  return round.winChance < 100 ? round.winChance * 3.6 + (100 - round.winChance) * 1.8 : null;
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return reduced;
}
function Dial({ angle, chance, count, animate, delay, serial, onFinish }: {
  angle: number | null; chance?: number | undefined; count: boolean; animate: boolean; delay: number; serial: number; onFinish: () => void;
}) {
  const validChance = chance !== undefined && Number.isFinite(chance) && chance >= 0 && chance <= 100;
  const style = { '--needle-angle': `${angle ?? 0}deg`, '--needle-start': `${(angle ?? 0) - 720}deg`, '--needle-delay': `${delay}ms` } as CSSProperties;
  return <svg className="roulette-dial" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
    <circle className="roulette-rim" cx="120" cy="120" r="112" />
    <circle className="roulette-face" cx="120" cy="120" r="102" />
    {validChance && <g transform="rotate(-90 120 120)">
      <circle className="roulette-share-enemy" cx="120" cy="120" r="78" pathLength="100" />
      <circle className="roulette-share-player" cx="120" cy="120" r="78" pathLength="100" strokeDasharray={`${chance} ${100 - chance}`} />
    </g>}
    {Array.from({ length: 100 }, (_, i) => <line key={i} className={i % 5 === 0 ? 'roulette-tick major' : 'roulette-tick'} x1="120" y1="20" x2="120" y2={i % 5 === 0 ? 31 : 26} transform={`rotate(${i * 3.6} 120 120)`} />)}
    {count && [1, 25, 50, 75].map(n => {
      const theta = (n - 1) * Math.PI / 50;
      return <text key={n} className="roulette-scale" x={120 + Math.sin(theta) * 78} y={120 - Math.cos(theta) * 78 + 5}>{n}</text>;
    })}
    <circle className="roulette-inner-ring" cx="120" cy="120" r="53" />
    {angle !== null && <g key={serial} className={`roulette-needle ${animate ? 'is-moving' : ''}`} style={style} onAnimationEnd={onFinish}>
      <path d="M 120 36 L 126 123 L 120 148 L 114 123 Z" />
    </g>}
    <circle className="roulette-hub" cx="120" cy="120" r="11" />
    {angle === null && <path className="roulette-rest-mark" d="M108 116H132 M108 124H132" />}
  </svg>;
}

export function CombatRoulette({ round, fast = false, history = false, playerWeights, enemyWeights }: {
  round: SlicePublicCombatRound | null; fast?: boolean; history?: boolean;
  playerWeights?: readonly SliceWheelEntry[] | undefined; enemyWeights?: readonly SliceWheelEntry[] | undefined;
}) {
  const reduced = useReducedMotion();
  const signature = round ? JSON.stringify(round) : null;
  const previous = useRef(signature);
  const [play, setPlay] = useState({ serial: 0, active: false });
  useEffect(() => {
    const changed = previous.current !== signature;
    previous.current = signature;
    if (changed) setPlay(old => ({ serial: old.serial + 1, active: signature !== null && !history && !fast && !reduced }));
  }, [signature, history, fast, reduced]);
  useEffect(() => { if (fast || reduced) setPlay(old => old.active ? { ...old, active: false } : old); }, [fast, reduced]);
  const stop = () => setPlay(old => old.active ? { ...old, active: false } : old);
  const angles = [countNeedleAngle(round?.playerCountRoll), countNeedleAngle(round?.enemyCountRoll), outcomeNeedleAngle(round)];
  const moving = play.active && !fast && !reduced;
  const lastMoving = angles.reduce<number>((last, angle, i) => angle !== null ? i : last, -1);
  const result = !round ? '待结算' : round.retreat === 'SUCCESS' ? '未进入胜负盘' : round.winner === null ? '未决出胜负' : round.winner === 'PLAYER' ? '你胜' : '对手胜';
  const labels = ['你的次数', '对手次数', '回合胜负'];
  const values = [round ? String(round.playerCount) : '待结算', round ? String(round.enemyCount) : '待结算', result];
  return <div className="roulette-workbench" data-history={history}>
    <div className="roulette-heading"><span>回合仪表</span><span>{round ? `第 ${round.round} 回合 · 已保存` : '选择姿态后结算'}</span></div>
    <div className="slice-wheel-row roulette-grid">
      {labels.map((label, i) => <div key={label} className={`slice-wheel roulette-card ${i === 2 ? 'roulette-outcome' : ''} ${moving && angles[i] !== null ? 'spinning' : ''}`}>
        <div className="slice-wheel-center">
          <small>{label}</small>
          <Dial count={i < 2} angle={angles[i] ?? null} chance={i === 2 && round && round.retreat !== 'SUCCESS' && round.winner !== null ? round.winChance : undefined} animate={moving && angles[i] !== null} delay={i === 2 ? 1100 : i * 150} serial={play.serial} onFinish={i === lastMoving ? stop : () => {}} />
          <strong>{values[i]}</strong>
        </div>
        <p className="roulette-fact">{i < 2 ? round ? angles[i] !== null ? `原骰 ${i === 0 ? round.playerCountRoll : round.enemyCountRoll} / 100` : '原骰未记录有效范围' : 'd100 · 1—100' : !round ? '双方行动结束后判定' : round.retreat === 'SUCCESS' ? '已成功撤离，不进行胜负抽取' : round.winner === null ? '原记录未决出胜负' : `你的胜率约 ${Number(round.winChance.toFixed(1))}%`}</p>
        {i === 2 && round && round.retreat !== 'SUCCESS' && round.winner !== null && <div className="roulette-legend"><span>◆ 你</span><span>◆ 对手</span></div>}
      </div>)}
    </div>
    {!round && <div className="roulette-weights">{[[playerWeights, '当前你的次数分布'], [enemyWeights, '当前对手次数分布']].map(([entries, title]) => <p key={String(title)}><b>{String(title)}：</b>{Array.isArray(entries) && entries.length ? entries.map(entry => `${entry.label} ${entry.weight}%`).join(' · ') : '暂无公开权重'}</p>)}</div>}
    <p className="roulette-explainer">{round ? '次数指针对应已保存的原骰。胜负盘只演示已存结果，不还原原胜负骰；回看不重掷。' : '次数盘决定本回合行动次数，不代表命中率或胜率。胜负盘等待双方行动结算。'}</p>
    {round && <div className="roulette-controls">
      <button type="button" className="slice-button" disabled={fast || reduced || lastMoving < 0} onClick={() => setPlay(old => ({ serial: old.serial + 1, active: true }))}>重播演示</button>
      <button type="button" className="slice-button" disabled={!moving} onClick={stop}>跳过动画</button>
      <span>结果已保存，动画仅作演示</span>
    </div>}
  </div>;
}
