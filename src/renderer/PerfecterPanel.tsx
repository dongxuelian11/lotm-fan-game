import { useEffect, useId, useRef, useState } from 'react';
import type { PerfecterAction, PerfecterCommand, PerfecterProjection } from '../domain/perfecter/types';
import type { SliceInjury, SliceRecord } from '../domain/slice/types';
import type { PublicCheckResult } from '../shared/contracts';
import './seer-styles.css';

export interface PerfecterPanelProps {
  value: PerfecterProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  lastResult?: SliceRecord | null;
  lastCheck?: PublicCheckResult | null;
  injuries?: readonly SliceInjury[];
  injuryRisk?: number;
  onCommand: (command: { type: 'PERFECTER'; command: PerfecterCommand }) => void;
  onClose?: () => void;
}

const CHECK_ABILITY: Record<PublicCheckResult['ability'], string> = {
  physique: '体魄', perception: '感知', will: '意志', knowledge: '知识',
};
const CHECK_OUTCOME: Record<PublicCheckResult['tier'], string> = {
  GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败',
};

function isWithdrawal(action: PerfecterAction): boolean {
  return action.command.type === 'RETURN_ON_FOOT'
    || action.command.type === 'EPILOGUE' && action.command.command.type === 'WITHDRAW';
}

/** Public facts only: neither future rolls nor the private source participate in the view. */
function visibleFacts(value: PerfecterProjection): string {
  return JSON.stringify({
    title: value.title, guidanceKnown: value.guidanceKnown, promoted: value.promoted,
    story: value.story, nextStep: value.nextStep, risk: value.risk, insideCase: value.insideCase,
    resources: {
      health: value.resources.health, mind: value.resources.mind, spirituality: value.resources.spirituality,
      cash: value.resources.cash, actionsRemaining: value.resources.actionsRemaining,
    },
    abilities: value.abilities.map(({ id, label, mastery, description }) => ({ id, label, mastery, description })),
    actions: value.actions.map(({ id, label, cost, enabled, reason, command, preferredAction }) =>
      ({ id, label, cost, enabled, reason, command, preferredAction })),
    sections: value.sections.map(({ id, title, lines }) => ({ id, title, lines })),
  });
}

export function PerfecterPanel({ value, busy, blocked = false, error = null, lastResult = null,
  lastCheck = null, injuries, injuryRisk, onCommand, onClose }: PerfecterPanelProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const confirmationTrigger = useRef<HTMLButtonElement | null>(null);
  const submitted = useRef(false);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: PerfecterAction; facts: string } | null>(null);
  const resultFacts = JSON.stringify({
    record: lastResult && [lastResult.id, lastResult.week, lastResult.title, lastResult.text],
    check: lastCheck && [lastCheck.ability, lastCheck.baseAbility, lastCheck.effectiveAbility,
      lastCheck.difficulty, lastCheck.chance, lastCheck.roll, lastCheck.tier,
      lastCheck.modifiers.map(({ source, value }) => [source, value])],
  });
  const injuryFacts = JSON.stringify({ injuries: injuries?.map(({ id, severity, treatedRevision }) =>
    ({ id, severity, treatedRevision })), injuryRisk });
  const facts = `${visibleFacts(value)}:${resultFacts}:${injuryFacts}`;
  const locked = busy || blocked || pending || error !== null || value.resources.health <= 0;
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy) { submitted.current = false; setPending(false); }
  }, [facts, busy, error]);
  useEffect(() => {
    if (confirmation && (confirmation.facts !== facts || blocked || error !== null)) setConfirmation(null);
  }, [facts, blocked, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else confirmationTrigger.current?.focus();
  }, [confirmation]);

  const consume = value.actions.filter(action => action.command.type === 'CONSUME');
  const ordinary = value.actions.filter(action => action.command.type !== 'CONSUME');
  const exits = ordinary.filter(isWithdrawal);
  const preferred = ordinary.filter(action => action.preferredAction && action.enabled && !isWithdrawal(action));
  const main = [...new Set([...preferred.slice(0, 1), ...exits, ...preferred,
    ...ordinary.filter(action => action.enabled), ...ordinary])].slice(0, 3);
  const secondary = ordinary.filter(action => !main.includes(action));
  const works = value.sections.filter(section => section.id === 'works');
  const injurySections = value.sections.filter(section => section.id === 'injuries');
  const recent = value.sections.filter(section => section.id === 'recent-action');
  const promotion = value.sections.filter(section => section.id === 'promotion-stability');
  const rescue = value.sections.filter(section => section.id === 'epilogue' || section.id === 'epilogue-readiness');
  const details = value.sections.filter(section => !works.includes(section) && !injurySections.includes(section)
    && !recent.includes(section) && !promotion.includes(section) && !rescue.includes(section));

  function submit(action: PerfecterAction) {
    if (locked || submitted.current || !action.enabled || action.command.type === 'CONSUME' && action !== live) return;
    submitted.current = true;
    setPending(true);
    onCommand({ type: 'PERFECTER', command: action.command });
  }
  function choose(action: PerfecterAction, trigger: HTMLButtonElement) {
    if (locked || confirmation || submitted.current || !action.enabled) return;
    if (action.command.type === 'CONSUME') {
      confirmationTrigger.current = trigger;
      setConfirmation({ action, facts });
    } else submit(action);
  }
  function cancelConfirmation() {
    if (!locked) setConfirmation(null);
  }
  function actionButton(action: PerfecterAction) {
    const index = value.actions.indexOf(action);
    return <div key={action.id}>
      <button className={`slice-button${action.preferredAction ? '' : ' quiet'}`}
        disabled={locked || confirmation !== null || !action.enabled}
        aria-describedby={`${id}-cost-${index}${action.reason ? ` ${id}-reason-${index}` : ''}`}
        onClick={event => choose(action, event.currentTarget)}>{action.label}</button>
      <p id={`${id}-cost-${index}`} className="slice-muted">{action.cost}</p>
      {action.reason && <p id={`${id}-reason-${index}`} className="seer-action-reason">{action.reason}</p>}
    </div>;
  }
  function publicSection(section: PerfecterProjection['sections'][number]) {
    const index = value.sections.indexOf(section);
    return <section key={section.id} aria-labelledby={`${id}-section-${index}`}>
      <h3 id={`${id}-section-${index}`}>{section.title}</h3>
      {section.lines.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
    </section>;
  }

  return <section className="seer-panel" aria-labelledby={`${id}-title`} aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <header>
        <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{value.title}</h2>
        <p>{value.story}</p>
        <p className="slice-muted">健康 {value.resources.health} · 精神 {value.resources.mind} · 灵性 {value.resources.spirituality} · {value.resources.cash} · 本周行动 {value.resources.actionsRemaining}</p>
      </header>
      {works.map(publicSection)}
      <section aria-labelledby={`${id}-next`}>
        <h3 id={`${id}-next`}>当前主目标</h3>
        <p>{value.nextStep}</p>
        {value.risk && <p className="slice-notice">{value.risk}</p>}
        <div className="seer-actions">{main.map(actionButton)}</div>
        {secondary.length > 0 && <details className="seer-fold">
          <summary>其他可选行动</summary>
          <div className="seer-actions">{secondary.map(actionButton)}</div>
        </details>}
      </section>
      {(recent.length > 0 || lastResult || lastCheck) && <section className="slice-round-record" aria-labelledby={`${id}-result`}>
        <h3 id={`${id}-result`}>最近行动结果</h3>
        {recent.length > 0 ? recent.flatMap(section => section.lines).map((line, index) => <p key={index}>{line}</p>)
          : lastResult && <><h4>{lastResult.title}</h4><p>{lastResult.text}</p></>}
        {lastCheck && <>
          <h4>{CHECK_OUTCOME[lastCheck.tier]} · {CHECK_ABILITY[lastCheck.ability]}检定</h4>
          <p>基础 {lastCheck.baseAbility}，有效能力 {lastCheck.effectiveAbility}，难度 {lastCheck.difficulty}。本次成功率 {lastCheck.chance}%，实际掷骰 {lastCheck.roll}。</p>
          {lastCheck.modifiers.length > 0 && <ul className="slice-simple-list">
            {lastCheck.modifiers.map((modifier, index) => <li key={index}>
              {modifier.source} {modifier.value >= 0 ? '+' : ''}{modifier.value}
            </li>)}
          </ul>}
        </>}
      </section>}
      {injuries !== undefined || injuryRisk !== undefined ? <section aria-labelledby={`${id}-injuries`}>
        <h3 id={`${id}-injuries`}>原有伤势</h3>
        {injuryRisk !== undefined && <p>伤势风险 {injuryRisk}</p>}
        {injuries?.length === 0 && <p>当前没有伤势。</p>}
        {injuries && injuries.length > 0 && <ul className="slice-simple-list">
          {injuries.map((injury, index) => <li key={injury.id}>
            {index + 1}. {injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treatedRevision === null ? '未处理' : '已处理'}
          </li>)}
        </ul>}
      </section> : injurySections.map(publicSection)}
      {rescue.map(publicSection)}
      {(promotion.length > 0 || consume.length > 0) && <section aria-labelledby={`${id}-promotion`}>
        <h3 id={`${id}-promotion`}>晋升与服药</h3>
        {promotion.map(publicSection)}
        <div className="seer-actions">{consume.map(actionButton)}</div>
      </section>}
      {details.length > 0 && <details className="seer-fold">
        <summary>原物与个人账目</summary>
        {details.map(publicSection)}
      </details>}
      {value.abilities.length > 0 && <details className="seer-fold">
        <summary>已掌握的能力</summary>
        {value.abilities.map(ability => <div key={ability.id}>
          <h3>{ability.label} · 熟练 {ability.mastery}</h3>
          <p>{ability.description}</p>
        </div>)}
      </details>}
      {onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={onClose}>返回当前生活</button>}
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true"
      aria-label="完美者服药确认" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); cancelConfirmation(); }
        if (event.key !== 'Tab') return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live?.label ?? '当前准备已变化'}</h3>
      <p>{live?.cost}</p>
      <p className="slice-notice">{value.risk}</p>
      {promotion.flatMap(section => section.lines).map((line, index) => <p key={index}>{line}</p>)}
      <p>服用会消耗这一份原魔药与本次准备，已付费用不退还。失败会留下实际伤势与污染，可能死亡；不保证保有可追回的残余。</p>
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={locked} onClick={cancelConfirmation}>取消，继续准备</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>确认服用这一份原魔药</button>
      </div>
    </section>}
  </section>;
}
