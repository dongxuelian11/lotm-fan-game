import type { SliceRecoveryProjection } from '../domain/slice/medical';

/** Guidance only: navigation never submits treatment, rest, or an encounter exit. */
export function RecoveryNotice({ value, busy = false, compact = false, showClearRisk = false, onNavigate }: {
  value: SliceRecoveryProjection | undefined;
  busy?: boolean;
  compact?: boolean;
  showClearRisk?: boolean;
  onNavigate?: () => void;
}) {
  if (!value || !value.needsAttention && !showClearRisk) return null;
  const next = value.nextAction;
  const navigable = next.kind === 'ERA_LIFE' || next.kind === 'INVESTIGATE' || next.kind === 'REST';
  return <section className="slice-recovery-notice" aria-label="伤势与恢复路线">
    <strong>{value.needsAttention ? '先核实伤势与恢复路线' : '当前伤势后果风险'}</strong>
    <p>{value.summary}</p>
    <p>{value.nextLoss.label}：轻伤 {value.nextLoss.weights.light}% · 重伤 {value.nextLoss.weights.heavy}% · 死亡 {value.nextLoss.weights.death}%</p>
    {!compact && <><p className="slice-muted">{value.nextLoss.explanation}</p><p>{value.guidance}</p></>}
    {compact && <p className="slice-muted">此为败北进入伤势分支后的条件权重，并非每回合死亡概率。普通休养不会解除未治疗重伤。</p>}
    {value.locked && <p className="seer-action-reason">{value.blockedReason} 须按当前现场原有结束或撤离方式处理；这里不会自动退出。</p>}
    {onNavigate && navigable && <button className="slice-button quiet" disabled={busy || value.locked || !next.enabled} onClick={onNavigate}>
      {next.kind === 'REST' ? '回到休养行动' : next.label}
    </button>}
    {next.reason && !value.locked && <p className="seer-action-reason">{next.reason}</p>}
  </section>;
}
