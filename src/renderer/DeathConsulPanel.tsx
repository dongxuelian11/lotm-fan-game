import { useEffect, useRef, useState } from 'react';
import type { DeathConsulAction, DeathConsulCommand, DeathConsulProjection } from '../domain/death-consul/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['STOP', 'CLOSE_DOOR', 'UNBLOCK_DOOR', 'CLOSE_CONTAINER', 'SEAL_CONTAINER', 'RETURN_RESIDUAL', 'RETURN_GROUP', 'WAIT_10', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'OBSERVE', 'PREPARE', 'PERFORM', 'BUY_SEAL', 'OPEN_CONTAINER', 'SEAL_CONTAINER', 'APPLY_FLAME', 'CROSS_PASSAGE', 'WALK_OUT', 'REPORT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT']);
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const POSITION: Record<string, string> = { ENTRY: '近室入口（0米）', NEAR: '近室内侧（2米）', DOOR: '两室间的门旁（3米）', OTHER: '另一室门内（4米）', FAR: '另一室端点（6米）', OUTSIDE: '场外（距入口2米）' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '已同意本次用途', DECLINED: '已拒绝本次用途', WITHDRAWN: '已撤回本次许可', CLOSED: '本次许可已结束' };
const DOOR: Record<string, string> = { CLOSED: '已关闭', OPEN: '已打开', BLOCKED: '门闩阻挡' };
const SEAL: Record<string, string> = { ORIGINAL: '原封完整', BROKEN: '原封已拆，尚未重新封存', RESEALED: '已用实购封材重新封存' };
const RESIDUAL_LOCATION: Record<string, string> = { ENTRY_STAND: '近室原架上', FAR_STAND: '另一室的架上', PLAYER: '本人手中' };
const EFFECT: Record<string, string> = { OFF: '没有正在维持的作用', PALE_FLAME: '苍白焰窗口有效', PASSAGE: '灵界短渡窗口有效' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试开窗', ACTIVE: '窗口仍有效', FAILED: '检定失败，未形成窗口', STOPPED: '已明确停止', EXPIRED: '窗口已到期' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或结束', READY: '已到场交谈', FIGHTING: '交战中', RETREATED: '已撤退', LOST: '本人已死亡' };
const POWER: Record<string, string> = { PALE_STRIKE: '有限苍白法术（每次5灵性）', STEADY: '一次定神（每次4灵性）', CLOSE_DOOR: '普通关闭门扇' };
type Confirmation = { id: string; facts: string };
type Attempt = NonNullable<DeathConsulProjection['life']['currentAttempt']>;

export interface DeathConsulPanelProps {
  value: DeathConsulProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DeathConsulCommand) => void;
  /** Navigation only: this callback never stops an effect or moves a person. */
  onClose?: () => void;
}

/** Reads only the saved public projection and submits its existing action objects. */
export function DeathConsulPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: DeathConsulPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const returnActionId = useRef<string | null>(null), buttons = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const facts = JSON.stringify(value), locked = busy || blocked || error !== null || submittedId !== null;
  const { life, encounter } = value;
  const selected = life.cases.find(c => c.id === life.activeCase)
    ?? life.cases.find(c => c.contactOpen || c.status === 'PREPARED')
    ?? life.cases.find(c => c.id === caseId) ?? life.cases.find(c => c.status !== 'RESOLVED') ?? life.cases[0];
  const bottle = value.bottles.find(b => b.id === bottleId)
    ?? value.bottles.find(b => value.actions.some(a => a.enabled && 'bottleId' in a.command && a.command.bottleId === b.id)) ?? value.bottles[0];
  const acquisition = value.actions.filter(a => ACQUISITION.has(a.command.type) && (!('bottleId' in a.command) || a.command.bottleId === bottle?.id));
  const battle = value.actions.filter(a => ENCOUNTER.has(a.command.type));
  const daily = value.actions.filter(a => !ACQUISITION.has(a.command.type) && !ENCOUNTER.has(a.command.type) && (!('caseId' in a.command) || a.command.caseId === selected?.id));
  const currentActions = encounter.inside ? battle : value.promoted ? daily : acquisition;
  const next = currentActions.find(a => a.enabled && a.command.type === 'CONSUME')
    ?? currentActions.find(a => a.enabled && !RETURN.has(a.command.type))
    ?? currentActions.find(a => a.enabled && RETURN.has(a.command.type)) ?? currentActions.find(a => a.enabled) ?? currentActions[0];
  const immediate = currentActions.filter(a => a.enabled || a === next);
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command
    ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;
  const confirmedCase = liveConfirmation && 'caseId' in liveConfirmation.command
    ? life.cases.find(c => 'caseId' in liveConfirmation.command && c.id === liveConfirmation.command.caseId) : undefined;
  const sceneLocked = value.insideCase || life.inside || encounter.inside || value.preparedWeek !== null;

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // Clearing an error or waiting is not a receipt. Keep the original intent locked.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null); heading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) setConfirmation(null);
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) {
      if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal();
      cancel.current?.focus();
    } else if (submitted.current === null && returnActionId.current) {
      (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
    }
  }, [confirmation, error]);

  function submit(action: DeathConsulAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: DeathConsulAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) {
      if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
      returnActionId.current = action.id; setConfirmation({ id: action.id, facts });
    } else submit(action);
  }
  function actions(entries: DeathConsulAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled}
        aria-describedby={a.reason ? `death-consul-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }}
        onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`death-consul-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '死亡执政官当前资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前身体与资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>排异</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function sourceFacts() {
    const prices = value.prices;
    return <><p>{value.sourceLabel}</p>
      <p>{value.sourceEra === 'POST_CYCLE' ? '已登记后世当代供应渠道。' : value.sourceEra === 'ORIGINAL' ? '已登记原时代供应渠道。' : '尚未完成本次来源登记。'}{value.guidanceKnown && '本次来源与费用按这次真实登记保留。'}</p>
      {prices ? <p>专业指导{prices.guidance}便士；每瓶{prices.potion}便士，或完成本瓶五项劳务抵{prices.labourCredit}便士后支付{prices.labourBalance}便士。当周服药检查另付1行动、{prices.preparation}便士。</p> : <p>当前没有可供购买的实际报价。</p>}
    </>;
  }
  function siteFacts() {
    const p = life.site;
    return <section className="seer-current-case" aria-label="死亡执政官双室封存场当前实况"><h3>双室封存场</h3>
      <p>两室直距{p.lengthMetres}米，普通迂回路每程{p.ordinaryRouteMetres}米。现场累计操作时间{p.elapsedSeconds}秒。</p>
      {p.sourceEra === null ? <p>尚未当面接触保管员或登记封存罐。先观察本案，才能认识这里的人与物。</p> : <>
        <p>{p.sourceEra === 'POST_CYCLE' ? '后世当代的封存场' : '原时代的封存场'}；第{p.introducedWeek}周当面登记{p.introducedDate && `，${p.introducedDate.year}年${p.introducedDate.month}月${p.introducedDate.day}日`}。</p>
        <dl className="seer-facts">
          <div><dt>两室间的原门</dt><dd>{DOOR[p.door.state]} · 已实际操作{p.door.operations}次</dd></div>
          <div><dt>当前作用</dt><dd>{EFFECT[p.effect.mode]}{p.effect.expiresAt !== null && ` · 剩余${Math.max(0, p.effect.expiresAt - p.elapsedSeconds)}秒`}</dd></div>
          <div><dt>唯一封存罐</dt><dd>{p.residual.id} · 在{RESIDUAL_LOCATION[p.residual.location]} · {p.residual.container === 'CLOSED' ? '罐盖已合' : '罐盖已打开'}</dd></div>
          <div><dt>封条与残余回响</dt><dd>{SEAL[p.residual.seal]} · 残余强度{p.residual.strength}</dd></div>
          <div><dt>灼痕与余热</dt><dd>{p.residual.scorch}处灼痕 · 余热还需{p.residual.heatSeconds}秒消散</dd></div>
          <div><dt>原罐实际路程</dt><dd>普通搬运{p.residual.ordinaryMetres}米 · 短渡{p.residual.passageMetres}米</dd></div>
          <div><dt>有限封材</dt><dd>{p.material.acquired ? `已实付${p.material.paidPennies}便士，剩余${p.material.remaining}份` : '尚未购买，本人持有0份'}</dd></div>
          <div><dt>普通出口</dt><dd>{p.ordinaryExit === 'OPEN' ? '开放，须沿普通路亲自返回' : '当前不能通行'}</dd></div>
        </dl>
        <p className="slice-notice">罐里只有这份有限残余回响。苍白焰会留下真实灼痕与余热；停止作用和离开都不会修复封条、补充封材或搬回原罐。</p>
      </>}
    </section>;
  }
  function positions() {
    const p = life.site;
    return <section aria-label="死亡执政官本人同伴位置与当前许可"><h3>当前位置与本次许可</h3>
      {p.sourceEra === null ? <p>封存场内尚无本人的行程或同伴接触记录。</p> : <>
        <p>本人当前在{POSITION[p.playerLocation]}；累计普通行走{p.playerMetres}米，短渡{p.playerPassageMetres}米。</p>
        <p>{p.operatorName}，{p.operatorAge}岁，当前在{POSITION[p.operatorLocation]}；独立精力{p.operatorEnergy}/100，累计普通行走{p.operatorMetres}米，短渡{p.operatorPassageMetres}米。</p>
        <p className={p.operatorConsent === 'WITHDRAWN' || p.operatorConsent === 'DECLINED' ? 'slice-notice seer-risk' : 'slice-notice'}>
          {p.operatorName}的当前许可：{CONSENT[p.operatorConsent]}。{p.operatorConsentWeek !== null && `本次询问在第${p.operatorConsentWeek}周。`}
          {p.operatorConsent === 'WITHDRAWN' ? '她已撤回许可，本次不得再运输她；须停止通路并普通收尾。已经花掉的行动、灵性和时间保留。' : '每案须当面重新询问，旧案许可不能代答。'}
        </p>
        <p>两人一起短渡6米需6秒，普通迂回12米需12秒；她每程消耗2精力。去程与返程分别完成，本人的身体和灵性消耗见上方资源。</p>
        <p>能力结束后，原人和原罐留在实际到达的位置。换页、报告或等待都不能代替普通返程。</p>
      </>}
      {life.currentAttempt && <section aria-label="死亡执政官本次尝试"><h4>本次已发生的步骤</h4>{attemptFacts(life.currentAttempt, false)}</section>}
    </section>;
  }
  function attemptFacts(a: Attempt, historical: boolean) {
    const end = historical ? (a.siteAtClose?.elapsedSeconds ?? life.site.elapsedSeconds) : life.site.elapsedSeconds;
    const remaining = a.window === 'ACTIVE' && a.windowExpiresAt !== null ? Math.max(0, a.windowExpiresAt - end) : 0;
    const operator = a.siteAtStart.operatorName ?? '本次保管员';
    const success = a.abilityTier === 'SUCCESS' || a.abilityTier === 'GREAT_SUCCESS';
    return <div>
      <p>{historical ? '已保存经历' : '当前尝试'} · 第{a.week}周 · {a.method === 'ABILITY' ? '能力方法' : '普通方法'} · {a.closed ? '已实际收束' : '尚未收束'}。</p>
      <p>实际经过{a.elapsedSeconds}秒，实耗{a.spiritualitySpent}灵性、{a.penniesSpent}便士和{a.materialSpent}份封材。</p>
      <p>本人普通行走{a.playerTravelMetres}米、短渡{a.playerPassageMetres}米；{operator}普通行走{a.operatorTravelMetres}米、短渡{a.operatorPassageMetres}米，实耗{a.operatorEnergySpent}精力。</p>
      <p>{a.performed ? '已执行本次实施步骤' : '尚未实施'}；检定{a.abilityTier ? TIER[a.abilityTier] : '尚无'}；{WINDOW[a.window]}{a.window === 'ACTIVE' && `，剩余${remaining}秒`}。{a.effectStopped ? '已明确停止作用。' : a.performed && a.spiritualitySpent > 0 ? '仍须明确停止作用。' : ''}</p>
      <p>{success && a.appliedAbilityIds.length === 0 ? '检定成功，但没有实际应用。' : a.abilityTier === 'FAILURE' || a.abilityTier === 'GREAT_FAILURE' ? '检定失败，已付消耗保留。' : ''}
        实际应用：{a.appliedAbilityIds.length ? a.appliedAbilityIds.map(id => value.abilities.find(ability => ability.id === id)?.label ?? (id === 'death.s2.pale-flame' ? '苍白焰' : '灵界短渡')).join('、') : '无'}。只有实际应用并报告才增加掌握。</p>
      <p>原罐{a.residualInspected ? '已实查' : '本次尚未检查'}，{a.flameApplied ? '苍白焰确已消减残余，并留下灼痕' : '本次没有苍白焰实际作用'}；封材已用{a.materialSpent}份。</p>
      <p>两端{a.endpointsChecked ? '已亲自往返核实' : '本次尚未核实'}；{a.crossed ? '两人携同一原罐完成过短渡' : a.ordinaryOut ? '两人携同一原罐沿普通路到过另一室' : '本次没有运输到另一室'}；{a.returned ? '已沿普通路返回' : '本次没有普通返程记录'}。</p>
      <p>{a.permissionWithdrawn ? '本次许可已明确撤回，未应用的成功不增加掌握。' : `本次许可：${CONSENT[a.operatorConsent]}。`}最后核实{a.inspected ? '已完成' : '尚未完成'}；{a.interrupted ? '中途停止的经过与成本已经保留' : '按实际完成的步骤记录'}。</p>
      {historical && <><p>这是当次记录；当前的位置、资源和许可以上方实况为准。</p>
        {a.siteAtClose && <p>收束时本人在{POSITION[a.siteAtClose.playerLocation]}，{operator}在{POSITION[a.siteAtClose.operatorLocation]}、精力{a.siteAtClose.operatorEnergy}；原罐残余强度{a.siteAtClose.residual.strength}、灼痕{a.siteAtClose.residual.scorch}处、余热{a.siteAtClose.residual.heatSeconds}秒，封材剩{a.siteAtClose.material.remaining}份。</p>}
      </>}
    </div>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="死亡执政官可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? encounter.status}</p><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}，{enemy.age}岁，{enemy.sourceEra === 'POST_CYCLE' ? '后世当代独立接触的成人' : '原时代独立接触的成人'}，当前在{POSITION[enemy.location]}；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120；{enemy.status === 'DEAD' ? '已死亡，身体留在原处' : enemy.status === 'SURRENDERED' ? '已投降，停止抵抗' : '仍有独立意志'}。</p>
        <p>他的原棍：{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : `留在${POSITION[enemy.weaponLocation] ?? '原交战位置'}`}。</p>
        <p>{Object.entries(enemy.powerUses).map(([id, count]) => `${POWER[id] ?? '已记录动作'}：${count}次`).join('；')}。</p></>}
      <ul>{encounter.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      <p>本人、保管员、原门与封存罐的当前状态见上方。交谈和开战都不会补满资源；双方可能受伤、撤退或死亡。</p>
    </section>;
  }

  return <section className="seer-panel warrior-panel death-consul-panel" aria-label="死亡执政官" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="死亡执政官当前目标"><span className="seer-seal">{value.promoted ? '死亡执政官 · 死神序列2' : '摆渡人3 → 死亡执政官2'}</span>
      <h2 ref={heading} tabIndex={-1}>{value.title}</h2><p>{value.story ?? life.story}</p>
      <p className="seer-next"><strong>下一步：</strong>{next ? `${next.label} · ${next.cost}${!next.enabled && next.reason ? `。${next.reason}` : ''}` : '当前没有可提交的现场步骤，可查看已保存经历。'}</p>
      <p>{value.digestion}</p>
    </section>
    {resources()}
    <p className="slice-notice seer-risk">{value.risk}</p>
    {error !== null && <p role="alert">{typeof error === 'string' ? error : error.message} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在等待同一次操作的保存回执；重复点击、清除错误或时间经过都不会再次扣除资源。</p>}

    {!value.promoted && <section aria-label="死亡执政官独立药瓶与准备"><h3>独立药瓶与本周准备</h3>{sourceFacts()}<p>{value.supplies}</p>
      <label className="seer-case-selector">查看药瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>
        {value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}
      </select></label>
      {bottle && <article><h4>{bottle.title} · {bottle.id}</h4><p>{bottle.source}</p><p>当前状态：{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次检查：{value.preparedWeek === null ? '尚未进行' : `第${value.preparedWeek}周已完成`}。购买、准备与服药分别确认，不会自动饮用。</p>
      <p>须从实际摆渡人晋升周起满12整周、摆渡人消化100，并完成三项各1行动的准备。检查只用于当周这次服药；实际退出会结束检查，未服药瓶保留，已付费用不退。</p>
      <p>现有原瓶全部失败耗尽后，须花1行动申请下一批，再等下一真实周确认到货；新原瓶仍逐瓶付费。</p>
    </section>}

    {value.promoted && <>{siteFacts()}{positions()}
      {!encounter.inside && <section className="seer-current-case" aria-label="死亡执政官当前实践"><h3>本次实践</h3>
        <label className="seer-case-selector">查看实践<select value={selected?.id ?? ''} disabled={locked || confirmation !== null || life.inside || life.cases.some(c => c.status === 'PREPARED')} onChange={e => setCaseId(e.target.value)}>
          {life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? c.status}</option>)}
        </select></label>
        {selected && <><h4>{selected.title} · {STATUS[selected.status] ?? selected.status}</h4><p>{selected.story}</p><ul>{selected.observations.map((fact, i) => <li key={i}>{fact}</li>)}</ul>{selected.result && <p className="slice-notice">{selected.result}</p>}
          {!life.currentAttempt && selected.attempts.at(-1) && <section aria-label="死亡执政官本案最近记录"><h4>本案最近的已保存经历</h4>{attemptFacts(selected.attempts.at(-1)!, true)}</section>}
        </>}
      </section>}
      {encounter.inside && encounterFacts()}
    </>}

    <section aria-label="死亡执政官当前行动"><h3>{sceneLocked ? '当前现场的下一步' : '当前可选行动'}</h3>
      {actions(immediate.filter(a => !RETURN.has(a.command.type)), '死亡执政官当前步骤')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="死亡执政官停止与普通收尾"><h4>{value.promoted ? '停止作用、收好原物与普通退出' : '实际结束本次准备'}</h4>
        {actions(immediate.filter(a => RETURN.has(a.command.type)), '死亡执政官实际停止与返回')}
        <p>{value.promoted ? '停止、合盖、重新封存、归物和普通返程分别完成。0行动步骤仍按各自标明的时间、距离和材料消耗结算。' : '结束准备会使当次检查失效，原瓶仍保留；下次服药须重新检查并付费。'}</p>
      </section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '死亡执政官未满足条件的步骤')}</details>}
    </section>

    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>封存场的可选冲突</summary>{encounterFacts()}{actions(battle, '死亡执政官可选遭遇行动')}</details>}
    {value.promoted && <details className="seer-fold"><summary>独立药瓶与专业准备记录</summary>{sourceFacts()}<p>{value.supplies}</p>
      {value.bottles.map(b => <article key={b.id}><h4>{b.title} · {b.id}</h4><p>{b.source}</p><p>已保存状态：{b.status}</p></article>)}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>已饮用的原瓶已经耗尽。当前专业渠道没有可供自行调配的完整配方。</p>
    </details>}
    <details className="seer-fold"><summary>三案经历与技巧掌握</summary><p>{life.story}</p>
      {life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? c.status}</h4><p>{c.result ?? '尚无已报告结果。'} · 已实际收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</article>)}
      {value.abilities.map(a => <p key={a.id}>{a.label} · 掌握{a.mastery}：{a.description}</p>)}
      <p>成功开窗不等于实际应用。每案只有实际应用并报告的技巧增加8掌握；普通方法、普通返程和撤回许可后的未应用成功都不增加这项掌握。</p><p>{value.digestion}</p>
    </details>
    <details className="seer-fold"><summary>身体与已有经历</summary>
      <p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。十五项已有掌握保留，两项新技巧从0开始；晋升不补满当前灵性，不清除旧伤，也不改变身体性别。</p>
      <ul>{value.inheritedHistory.map((fact, i) => <li key={i}>{fact}</li>)}</ul><p>{value.environment}</p>
      <p>旧芦羽与此前人物、原物均保留各自的已保存经历；本页只读展示，不重新发放或补充。普通死亡不会即时复活。</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || sceneLocked || confirmation !== null} onClick={() => { if (!locked && !sceneLocked && !confirmation) onClose(); }}>关闭死亡执政官页面</button>}

    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="death-consul-confirm-title" aria-describedby="death-consul-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={e => { e.preventDefault(); if (!locked) setConfirmation(null); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!locked) setConfirmation(null); }
        if (e.key === 'Tab') {
          const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const first = controls[0], last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      {error !== null && <p role="status">保存尚未成功，原确认保持锁定。请使用保存错误处的重试。</p>}
      <h3 id="death-consul-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '当前条件已改变，请返回最新状态。'}</p><p id="death-consul-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p>
        <p>本瓶和当次检查无论成功失败都会耗尽，已经付出的费用不退。失败须恢复身体、取得另一独立原瓶并重新检查，不能撤回已经提交的饮用。</p>
        <p>十五项已有掌握、性别、当前伤势与过去人物原物保持。晋升只新增两项初始掌握，不免费治疗、不补满当前灵性。</p>
      </>}
      {liveConfirmation?.command.type === 'PERFORM' && <>
        <p>{confirmedCase?.method === 'ORDINARY' ? '采用普通方法，不形成能力窗口，也不会增加能力掌握。实施后仍须按同一现场的实际状态封存、归物和返回。' : confirmedCase?.id === 'pale-residue' ? '本次尝试苍白焰。成功后仍须在有效窗口内另行作用于面前的原罐，才会消减有限残余并留下灼痕与余热；检定失败仍支付成本。' : '本次尝试灵界短渡。成功只打开20秒窗口，不会自动移动任何人或原罐；真正通过还须当前许可、已核实的两端、足够时间与同伴精力。检定失败仍支付成本。'}</p>
        <p>{confirmedCase?.id === 'withdrawn-passage' ? '本案实施后还须读取保管员当前撤回的决定，随后停止并普通收尾，不运输她。未应用的成功不会增加掌握。' : '作用停止后仍须处理原物并普通返程；退出不返还灵性，也不恢复封材或精力。'}</p>
      </>}
      {liveConfirmation?.command.type === 'APPLY_FLAME' && <p>苍白焰只消减这只原罐内的有限残余，留下真实灼痕与余热。之后须停止、合盖、实际等它冷却，并消耗已购买的封材重新封存。</p>}
      {liveConfirmation?.command.type === 'CROSS_PASSAGE' && <p>本人、当前同意的保管员与手中原罐实际短渡到另一室，不生成副本。之后仍须停止通路，两人携原罐沿12米普通路返回。</p>}
      {liveConfirmation?.command.type === 'OPEN_CONTAINER' && <p>这一步会拆开原封。之后必须实际合盖、冷却并消耗唯一实购封材重新封存，退出不会恢复原封。</p>}
      {liveConfirmation?.command.type === 'SEAL_CONTAINER' && <p>这一步会耗掉剩余的一份原封材。重新封存不消除原罐上的灼痕，也不补充材料。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <><p className="slice-notice seer-risk">你选择与{encounter.enemy?.name ?? '现场对手'}真正交战。双方使用各自的身体、武器和灵性；可能出现伤势、撤退或死亡。</p><p>保管员须已实际离开交战位置。原门、封存罐、灼痕与既有损耗沿用当前状态，开战不会恢复任何资源。</p></>}
      {resources('死亡执政官操作确认当前资源')}
      {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交、不扣资源。提交后等待同一次保存回执；关闭确认或页面不能代替实际停止与退出。</p>
    </dialog>}
  </section>;
}
