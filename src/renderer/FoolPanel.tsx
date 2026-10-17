import { useEffect, useId, useRef, useState } from 'react';
import type { FoolCommand, FoolProjection } from '../domain/fool/types';
import './seer-styles.css';

export interface FoolPanelProps {
  value: FoolProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: FoolCommand) => void;
  onClose?: () => void;
}

/** Every action and visible fact comes from the public projection. */
export function FoolPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: FoolPanelProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const submitted = useRef(false);
  const [pending, setPending] = useState(false);
  const facts = JSON.stringify(value);
  const locked = busy || blocked || pending || error !== null || value.resources.health <= 0;
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy) { submitted.current = false; setPending(false); }
  }, [facts, busy, error]);

  function choose(action: FoolProjection['actions'][number]) {
    if (locked || submitted.current || !action.enabled) return;
    submitted.current = true;
    setPending(true);
    onCommand(action.command);
  }

  return <section className="seer-panel" aria-labelledby={`${id}-title`} aria-busy={busy || pending}>
    <header>
      <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{value.title}</h2>
      <p>{value.story}</p>
      <p className="slice-muted">健康 {value.resources.health} · 精神 {value.resources.mind} · 灵性 {value.resources.spirituality} · {value.resources.cash} · 本周行动 {value.resources.actionsRemaining}</p>
    </header>
    <section aria-labelledby={`${id}-next`}>
      <h3 id={`${id}-next`}>眼下该做什么</h3>
      <p>{value.nextStep}</p>
      {value.risk && <p className="slice-notice">{value.risk}</p>}
      <div className="seer-actions">
        {value.actions.map((action, index) => <div key={action.id}>
          <button className={`slice-button${action.preferredAction ? '' : ' quiet'}`}
            disabled={locked || !action.enabled}
            aria-describedby={`${id}-cost-${index}${action.reason ? ` ${id}-reason-${index}` : ''}`}
            onClick={() => choose(action)}>{action.label}</button>
          <p id={`${id}-cost-${index}`} className="slice-muted">{action.cost}</p>
          {action.reason && <p id={`${id}-reason-${index}`} className="seer-action-reason">{action.reason}</p>}
        </div>)}
      </div>
    </section>
    {value.sections.map((section, index) => <section key={section.id} aria-labelledby={`${id}-section-${index}`}>
      <h3 id={`${id}-section-${index}`}>{section.title}</h3>
      {section.lines.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
    </section>)}
    {value.abilities.length > 0 && <details className="seer-fold">
      <summary>已掌握的能力</summary>
      {value.abilities.map(ability => <div key={ability.id}>
        <h3>{ability.label} · 熟练 {ability.mastery}</h3>
        <p>{ability.description}</p>
      </div>)}
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={onClose}>返回当前生活</button>}
  </section>;
}
