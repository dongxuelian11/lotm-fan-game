import { useEffect, useId, useRef, useState } from 'react';
import type { WhiteTowerAction, WhiteTowerCommand, WhiteTowerProjection } from '../domain/white-tower/types';
import type { SliceInjury, SliceRecord } from '../domain/slice/types';
import type { PublicCheckResult } from '../shared/contracts';
import './seer-styles.css';

export interface WhiteTowerPanelProps {
  value: WhiteTowerProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  lastResult?: SliceRecord | null;
  lastCheck?: PublicCheckResult | null;
  injuries?: readonly SliceInjury[];
  injuryRisk?: number;
  onCommand: (command: { type: 'WHITE_TOWER'; command: WhiteTowerCommand }) => void;
  onClose?: () => void;
}

const CHECK_ABILITY: Record<PublicCheckResult['ability'], string> = {
  physique: '体魄', perception: '感知', will: '意志', knowledge: '知识',
};
const CHECK_OUTCOME: Record<PublicCheckResult['tier'], string> = {
  GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败',
};

function isSafetyExit(action: WhiteTowerAction): boolean {
  const command = action.command;
  return command.type === 'RETURN_ON_FOOT'
    || command.type === 'PASSAGE' && ['UNLOAD', 'RETURN_ON_FOOT'].includes(command.command.type)
    || command.type === 'EPILOGUE' && ['STOP_EFFECTS', 'SECURE_GATE', 'UNLOAD_STRUT', 'ORDINARY_SIDE_EXIT', 'WITHDRAW'].includes(command.command.type);
}

/** Snapshot only the public facts used to review a command. No hidden state belongs in this view. */
function visibleFacts(value: WhiteTowerProjection): string {
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

export function WhiteTowerPanel({ value, busy, blocked = false, error = null, lastResult = null,
  lastCheck = null, injuries, injuryRisk, onCommand, onClose }: WhiteTowerPanelProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const confirmationTrigger = useRef<HTMLButtonElement | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: WhiteTowerAction; facts: string } | null>(null);
  const resultFacts = JSON.stringify({
    record: lastResult && [lastResult.id, lastResult.week, lastResult.title, lastResult.text],
    check: lastCheck && [lastCheck.ability, lastCheck.baseAbility, lastCheck.effectiveAbility,
      lastCheck.difficulty, lastCheck.chance, lastCheck.roll, lastCheck.tier,
      lastCheck.modifiers.map(({ source, value }) => [source, value])],
  });
  const injuryFacts = JSON.stringify({ injuries: injuries?.map(({ id, severity, treatedRevision }) =>
    ({ id, severity, treatedRevision })), injuryRisk });
  const facts = `${visibleFacts(value)}:${resultFacts}:${injuryFacts}`;
  const currentFacts = useRef(facts);
  currentFacts.current = facts;
  const locked = busy || blocked || pending || error !== null || value.resources.health <= 0;
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // A failed save retains the submitted intent in SliceApp. Only its saved result releases this latch.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submittedFacts.current = null;
      setPending(false);
      confirmationTrigger.current = null;
      setConfirmation(null);
      heading.current?.focus();
    }
  }, [facts, busy, error]);
  useEffect(() => {
    if (confirmation && (confirmation.facts !== facts || blocked || error !== null)) {
      confirmationTrigger.current = null;
      setConfirmation(null);
      heading.current?.focus();
    }
  }, [facts, blocked, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else confirmationTrigger.current?.focus();
  }, [confirmation]);

  const consume = value.actions.filter(action => action.command.type === 'CONSUME');
  const ordinary = value.actions.filter(action => action.command.type !== 'CONSUME');
  const exits = ordinary.filter(isSafetyExit);
  const work = ordinary.filter(action => !isSafetyExit(action));
  const preferred = work.filter(action => action.preferredAction && action.enabled);
  const main = [...new Set([...preferred, ...work.filter(action => action.enabled), ...work])].slice(0, 3);
  const secondary = work.filter(action => !main.includes(action));
  const passages = value.sections.filter(section => section.id === 'white-tower-passages' || section.id === 'passages' || section.id.startsWith('passage-'));
  const materials = value.sections.filter(section => section.id === 'materials');
  const clock = value.sections.filter(section => section.id === 'clock');
  const body = value.sections.filter(section => section.id === 'body');
  const injurySections = value.sections.filter(section => section.id === 'injuries');
  const recent = value.sections.filter(section => section.id === 'recent-action');
  const promotion = value.sections.filter(section => section.id === 'promotion-stability');
  const epilogue = value.sections.filter(section => section.id === 'epilogue' || section.id === 'epilogue-readiness');
  const details = value.sections.filter(section => !passages.includes(section) && !materials.includes(section) && !clock.includes(section)
    && !body.includes(section) && !injurySections.includes(section) && !recent.includes(section)
    && !promotion.includes(section) && !epilogue.includes(section));

  function submit(action: WhiteTowerAction) {
    if (locked || submittedFacts.current !== null || !action.enabled || currentFacts.current !== facts
      || action.command.type === 'CONSUME' && action !== live) return;
    submittedFacts.current = facts;
    setPending(true);
    onCommand({ type: 'WHITE_TOWER', command: action.command });
  }
  function choose(action: WhiteTowerAction, trigger: HTMLButtonElement) {
    if (locked || confirmation || submittedFacts.current !== null || !action.enabled) return;
    if (action.command.type === 'CONSUME') {
      confirmationTrigger.current = trigger;
      setConfirmation({ action, facts });
    } else submit(action);
  }
  function cancelConfirmation() {
    if (!locked && submittedFacts.current === null) setConfirmation(null);
  }
  function actionButton(action: WhiteTowerAction) {
    const index = value.actions.indexOf(action);
    return <div key={action.id}>
      <button className={`slice-button${action.preferredAction && !isSafetyExit(action) ? '' : ' quiet'}`}
        disabled={locked || confirmation !== null || !action.enabled}
        aria-describedby={`${id}-cost-${index}${action.reason ? ` ${id}-reason-${index}` : ''}`}
        onClick={event => choose(action, event.currentTarget)}>{action.label}</button>
      <p id={`${id}-cost-${index}`} className="slice-muted">{action.cost}</p>
      {action.reason && <p id={`${id}-reason-${index}`} className="seer-action-reason">{action.reason}</p>}
    </div>;
  }
  function publicSection(section: WhiteTowerProjection['sections'][number]) {
    const index = value.sections.indexOf(section);
    return <section key={section.id} aria-labelledby={`${id}-section-${index}`}>
      <h3 id={`${id}-section-${index}`}>{section.title}</h3>
      {section.lines.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
    </section>;
  }
  function resources() {
    return <p className="slice-muted">健康 {value.resources.health} · 精神 {value.resources.mind} · 灵性 {value.resources.spirituality} · {value.resources.cash} · 本周行动 {value.resources.actionsRemaining}</p>;
  }

  return <section className="seer-panel" aria-labelledby={`${id}-title`} aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <header>
        <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{value.title}</h2>
        <p>{value.story}</p>
        {resources()}
      </header>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {body.map(publicSection)}
      {clock.map(publicSection)}
      <section aria-labelledby={`${id}-next`}>
        <h3 id={`${id}-next`}>当前主目标</h3>
        <p className="seer-next">{value.nextStep}</p>
        {value.risk && <p className="slice-notice">{value.risk}</p>}
        <div className="seer-actions">{main.map(actionButton)}</div>
        {exits.length > 0 && <section aria-labelledby={`${id}-exits`}>
          <h4 id={`${id}-exits`}>暂停与安全返回</h4>
          <div className="seer-actions">{exits.map(actionButton)}</div>
        </section>}
        {secondary.length > 0 && <details className="seer-fold">
          <summary>其他可选行动</summary>
          <div className="seer-actions">{secondary.map(actionButton)}</div>
        </details>}
      </section>
      {epilogue.map(publicSection)}
      {passages.length > 0 && (value.promoted ? <details className="seer-fold">
        <summary>三处通路与原居民记录</summary>
        {passages.map(publicSection)}
      </details> : passages.map(publicSection))}
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
        <h3 id={`${id}-injuries`}>当前伤势</h3>
        {injuryRisk !== undefined && <p>伤势风险 {injuryRisk}</p>}
        {injuries?.length === 0 && <p>当前没有伤势。</p>}
        {injuries && injuries.length > 0 && <ul className="slice-simple-list">
          {injuries.map((injury, index) => <li key={injury.id}>
            {index + 1}. {injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treatedRevision === null ? '未处理' : '已处理'}
          </li>)}
        </ul>}
      </section> : injurySections.map(publicSection)}
      {(materials.length > 0 || promotion.length > 0 || consume.length > 0) && <section aria-labelledby={`${id}-promotion`}>
        <h3 id={`${id}-promotion`}>晋升与服药</h3>
        {materials.map(publicSection)}
        {promotion.map(publicSection)}
        <div className="seer-actions">{consume.map(actionButton)}</div>
      </section>}
      {value.abilities.length > 0 && <details className="seer-fold">
        <summary>已掌握的能力</summary>
        {value.abilities.map(ability => <div key={ability.id}>
          <h3>{ability.label} · 熟练 {ability.mastery}</h3>
          <p>{ability.description}</p>
        </div>)}
      </details>}
      {details.length > 0 && <details className="seer-fold">
        <summary>过往经历与个人账目</summary>
        {details.map(publicSection)}
      </details>}
      {onClose && !value.insideCase && <button className="slice-button quiet" disabled={locked || confirmation !== null}
        onClick={() => { if (!locked && !confirmation && submittedFacts.current === null) onClose(); }}>返回普通生活</button>}
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true"
      aria-labelledby={`${id}-confirmation`} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); cancelConfirmation(); }
        if (event.key !== 'Tab') return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <h3 id={`${id}-confirmation`} ref={confirmationHeading} tabIndex={-1}>白塔服药确认</h3>
      <h4>{live?.label ?? '当前准备已变化'}</h4>
      {resources()}
      <p>{live?.cost}</p>
      {value.risk && <p className="slice-notice">{value.risk}</p>}
      {body.flatMap(section => section.lines).map((line, index) => <p key={`body-${index}`}>{line}</p>)}
      {materials.flatMap(section => section.lines).map((line, index) => <p key={`materials-${index}`}>{line}</p>)}
      {promotion.flatMap(section => section.lines).map((line, index) => <p key={`preparation-${index}`}>{line}</p>)}
      <p>服用会消耗这一份魔药的载体与本次准备，已付费用不退还。失败会留下真实伤势与污染，严重失败可能死亡；存活也需要另行治疗、回收与重新准备。</p>
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={locked} onClick={cancelConfirmation}>取消，继续准备</button>
        <button className="slice-button" disabled={locked || !live?.enabled}
          onClick={() => { if (live) submit(live); }}>确认服用这一份魔药</button>
      </div>
    </section>}
  </section>;
}
