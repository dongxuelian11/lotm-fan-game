import { useEffect, useId, useRef, useState } from 'react';
import type { RedPriestAction, RedPriestCommand, RedPriestProjection } from '../domain/red-priest/types';
import type { SliceRecord } from '../domain/slice/types';
import type { PublicCheckResult } from '../shared/contracts';
import './seer-styles.css';

export interface RedPriestPanelProps {
  value: RedPriestProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  lastResult?: SliceRecord | null;
  lastCheck?: PublicCheckResult | null;
  onCommand: (command: RedPriestCommand) => void;
  onClose?: () => void;
}

function isWithdrawal(action: RedPriestAction): boolean {
  return action.command.type === 'CAMPAIGN' && action.command.command.type === 'WITHDRAW_PROTECT' ||
    action.command.type === 'EPILOGUE' && action.command.command.type === 'WITHDRAW';
}

function isPlanSelection(action: RedPriestAction): boolean {
  return action.command.type === 'CAMPAIGN' && action.command.command.type === 'SELECT_BATTLE_PLAN';
}
function isEnablePlanning(action: RedPriestAction): boolean {
  return action.command.type === 'CAMPAIGN' && action.command.command.type === 'ENABLE_PLANNING';
}

const CHECK_ABILITY: Record<PublicCheckResult['ability'], string> = {
  physique: '体魄', perception: '感知', will: '意志', knowledge: '知识',
};
const CHECK_OUTCOME: Record<PublicCheckResult['tier'], string> = {
  GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败',
};

/** Render only public facts and dispatch the supplied intent without predicting its result. */
export function RedPriestPanel({ value, busy, blocked = false, error = null, lastResult = null, lastCheck = null, onCommand, onClose }: RedPriestPanelProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const submitted = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const confirmationTrigger = useRef<HTMLButtonElement | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: RedPriestAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [planDraft, setPlanDraft] = useState<{ facts: string; stance: string; extraSupplies: boolean } | null>(null);
  const facts = JSON.stringify(value);
  const locked = busy || blocked || pending || error !== null || value.resources.health <= 0;
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy) { submitted.current = false; setPending(false); }
  }, [facts, busy, error]);
  useEffect(() => {
    if (confirmation && (confirmation.facts !== facts || error !== null)) setConfirmation(null);
  }, [facts, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else confirmationTrigger.current?.focus();
  }, [confirmation]);

  // Keep the next useful step and ordinary withdrawal on the first screen.
  // Secondary choices remain available, with their exact costs and reasons.
  const planChoices = value.actions.filter(isPlanSelection);
  const enablePlanning = value.actions.find(isEnablePlanning);
  const planningSections = value.sections.filter(section => section.id === 'campaign-planning');
  const hasPlanning = planChoices.length > 0 || planningSections.length > 0;
  const draft = planDraft?.facts === facts ? planDraft : { facts, stance: '', extraSupplies: false };
  const selectedPlan = planChoices.find(action => action.command.type === 'CAMPAIGN'
    && action.command.command.type === 'SELECT_BATTLE_PLAN' && action.command.command.stance === draft.stance
    && action.command.command.extraSupplies === draft.extraSupplies);
  const promotionSections = value.sections.filter(section => section.id === 'promotion-stability');
  const preparedEntry = value.actions.find(action => action.command.type === 'START_PREPARED_EPILOGUE');
  const ordinaryActions = value.actions.filter(action => !isPlanSelection(action) && !isEnablePlanning(action)
    && !(preparedEntry && action.command.type === 'START_EPILOGUE'));
  const withdrawals = ordinaryActions.filter(isWithdrawal);
  const preferred = ordinaryActions.filter(action => action.preferredAction && !isWithdrawal(action));
  // Only the actual enabled public preparation gets priority. The old consume
  // intent remains available, and no displayed prospect grants a bonus.
  const preparationAction = ordinaryActions.find(action => action.command.type === 'STABILIZE_PROMOTION' && action.enabled && action.preferredAction);
  for (const action of [preparationAction, preparedEntry?.enabled ? preparedEntry : undefined]) if (action) {
    const index = preferred.indexOf(action);
    if (index >= 0) preferred.splice(index, 1);
    preferred.unshift(action);
  }
  const priority = [...preferred.filter(action => action.enabled), ...preferred.filter(action => !action.enabled)]
    .slice(0, Math.max(0, 3 - withdrawals.length)).concat(withdrawals);
  const recovery = promotionSections.length > 0 ? ordinaryActions.filter(action => action.enabled
    && (action.command.type === 'WORK' || action.command.type === 'REST' || action.command.type === 'NEXT_WEEK'
      || action.command.type === 'RETURN_ON_FOOT' || action.command.type === 'CAMPAIGN' && action.command.command.type === 'MILITARY_LABOUR')) : [];
  const first = promotionSections.length > 0 ? [...priority.slice(0, 1), ...withdrawals, ...recovery] : priority;
  const main = [...new Set([...first, ...ordinaryActions])].slice(0, 3);
  const secondary = ordinaryActions.filter(action => !main.includes(action));
  const situation = value.sections.filter(section => ['campaign-status', 'campaign-losses', 'epilogue', 'promotion-stability', 'epilogue-entry-readiness', 'epilogue-readiness'].includes(section.id)
    || hasPlanning && section.id === 'campaign-readiness');
  const preparation = value.sections.filter(section => !situation.includes(section) && !planningSections.includes(section));

  function submit(action: RedPriestAction) {
    if (locked || submitted.current || !action.enabled || action.command.type === 'CONSUME' && action !== live) return;
    submitted.current = true;
    setPending(true);
    onCommand(action.command);
  }
  function choose(action: RedPriestAction, trigger: HTMLButtonElement) {
    if (locked || confirmation || submitted.current || !action.enabled) return;
    if (action.command.type === 'CONSUME') {
      confirmationTrigger.current = trigger;
      setConfirmation({ action, facts });
    } else submit(action);
  }
  function cancelConfirmation() {
    if (!locked) setConfirmation(null);
  }

  function actionButton(action: RedPriestAction) {
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

  function publicSection(section: RedPriestProjection['sections'][number]) {
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
    <section aria-labelledby={`${id}-next`}>
      <h3 id={`${id}-next`}>眼下该做什么</h3>
      <p>{value.nextStep}</p>
      {value.risk && <p className="slice-notice">{value.risk}</p>}
      {enablePlanning && <section aria-labelledby={`${id}-enable-planning`}>
        <h3 id={`${id}-enable-planning`}>发动前选择筹备</h3>
        <p>可以在签发发动命令前启用本场筹备。启用后，每处会战由你选择侦察、战术和额外补给，再决定是否交战。</p>
        {actionButton(enablePlanning)}
      </section>}
      {hasPlanning && <section aria-labelledby={`${id}-planning`}>
        <h3 id={`${id}-planning`}>本次会战筹备</h3>
        {planningSections.flatMap(section => section.lines).map((line, index) => <p key={index}>{line}</p>)}
        {planChoices.length > 0 && <div>
          <label htmlFor={`${id}-stance`}>待提交战术</label>{' '}
          <select id={`${id}-stance`} value={draft.stance} disabled={locked || confirmation !== null}
            onChange={event => setPlanDraft({ ...draft, stance: event.currentTarget.value })}>
            <option value="">请选择本次战术</option>
            <option value="STANDARD">常规</option>
            <option value="COORDINATED">三军协同</option>
            <option value="PROTECTIVE">保护性准备</option>
          </select>
          <label><input type="checkbox" checked={draft.extraSupplies} disabled={locked || confirmation !== null}
            onChange={event => setPlanDraft({ ...draft, extraSupplies: event.currentTarget.checked })} />额外投入每军6补给</label>
          <p className="slice-muted">更改选择还未支付或生效。下方按钮会提交这一项真实准备；当前生效方案以上方记录为准。</p>
          {selectedPlan ? actionButton(selectedPlan) : <p className="slice-muted">选择战术后显示本项实际代价与可用条件。</p>}
        </div>}
      </section>}
      <div className="seer-actions">{main.map(actionButton)}</div>
      {secondary.length > 0 && <details className="seer-fold">
        <summary>其他可选行动</summary>
        <div className="seer-actions">{secondary.map(actionButton)}</div>
      </details>}
    </section>
    {(lastResult || lastCheck) && <section className="slice-round-record" aria-labelledby={`${id}-result`}>
      <h3 id={`${id}-result`}>最近行动结果</h3>
      {lastResult && <>
        <h4>{lastResult.title}</h4>
        <p>{lastResult.text}</p>
      </>}
      {lastCheck && <>
        <h4>{CHECK_OUTCOME[lastCheck.tier]} · {CHECK_ABILITY[lastCheck.ability]}检定</h4>
        <p>基础 {lastCheck.baseAbility}，有效能力 {lastCheck.effectiveAbility}，难度 {lastCheck.difficulty}。成功率 {lastCheck.chance}%，d100 掷骰 {lastCheck.roll}。</p>
        {lastCheck.modifiers.length > 0 && <ul className="slice-simple-list">
          {lastCheck.modifiers.map((modifier, index) => <li key={index}>
            {modifier.source} {modifier.value >= 0 ? '+' : ''}{modifier.value}
          </li>)}
        </ul>}
      </>}
    </section>}
    {situation.map(publicSection)}
    {preparation.length > 0 && <details className="seer-fold">
      <summary>原物与个人账目</summary>
      {preparation.map(publicSection)}
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
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="红祭司服药确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); cancelConfirmation(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live?.label ?? '当前准备已变化'}</h3>
      <p>{live?.cost}</p>
      <p className="slice-notice">{value.risk}</p>
      {promotionSections.flatMap(section => section.lines).map((line, index) => <p key={index}>{line}</p>)}
      <p>确认服用这一份原魔药。成功或失败都会消耗原物与已付代价；失败会留下实际伤势、增加污染，可能死亡。</p>
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={locked} onClick={cancelConfirmation}>取消，继续准备</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>确认服用这一份原魔药</button>
      </div>
    </section>}
  </section>;
}
