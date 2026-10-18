import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from 'react';
import type { ConcealmentServantAction, ConcealmentServantCommand, ConcealmentServantProjection } from '../domain/concealment-servant/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER', 'BLOCK_EXIT', 'CLEAR_EXIT', 'RELEASE_BATTLE_CONCEALMENT', 'EXIT_ENCOUNTER']);
const RETURN = new Set(['WITHDRAW_CONSENT', 'RELEASE_CONCEALMENT', 'RETURN_BOX', 'SWITCH_OFF_ANCHOR', 'UNBOLT_DOOR', 'EXIT_ROOM', 'INSPECT', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'CLEAR_EXIT', 'RELEASE_BATTLE_CONCEALMENT', 'EXIT_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'CONCEAL', 'TRACE_VEIL', 'BLOCK_DOOR', 'LIGHT_ANCHOR', 'ENCOUNTER_FIGHT']);
const LOCATION: Record<string, string> = { EXIT: '原门外入口', ROOM: '同一原房间内', START: '原保管起点', PLAYER: '本人手中', TABLE: '2米外原桌' };
const CONSENT = { UNASKED: '尚未询问本次', GRANTED: '本次当前同意', DECLINED: '本次拒绝', REVOKED: '本次已撤回', CLOSED: '本次已结束' } as const;
const WINDOW = { NONE: '尚未尝试', ACTIVE: '有限窗口生效', FAILED: '检定失败', APPLIED: '已实际应用一次', STOPPED: '已明确停止', EXPIRED: '真实时间已到期', COUNTERED: '被本场原锚灯反制' } as const;
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' } as const;
const STATUS: Record<string, string> = { AVAILABLE: '尚未观察', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已退出，待报告', RESOLVED: '已报告', READY: '已接触', FIGHTING: '真实交战中', RETREATED: '已撤退', LOST: '本人实际死亡' };
type Attempt = NonNullable<ConcealmentServantProjection['life']['currentAttempt']>;
type Confirmation = { id: string; facts: string };
export interface ConcealmentServantPanelProps {
  value: ConcealmentServantProjection; busy: boolean; blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ConcealmentServantCommand) => void;
  /** Navigation only. Closing the page does not release a window or move a body. */
  onClose?: () => void;
}
export function ConcealmentServantPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: ConcealmentServantPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null), [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null), [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null), returnActionId = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const facts = JSON.stringify(value), locked = busy || blocked || error !== null || submittedId !== null;
  const { life, encounter } = value;
  const selected = life.cases.find(c => c.id === life.activeCase) ?? life.cases.find(c => c.status === 'PREPARED') ?? life.cases.find(c => c.id === caseId) ?? life.cases.find(c => c.status !== 'RESOLVED') ?? life.cases[0];
  const attempt = life.currentAttempt ?? selected?.attempts.at(-1) ?? null;
  const bottle = value.bottles.find(b => b.id === bottleId) ?? value.bottles.find(b => value.actions.some(a => a.enabled && 'bottleId' in a.command && a.command.bottleId === b.id)) ?? value.bottles[0];
  const acquisition = value.actions.filter(a => ACQUISITION.has(a.command.type) && (!('bottleId' in a.command) || a.command.bottleId === bottle?.id));
  const battle = value.actions.filter(a => ENCOUNTER.has(a.command.type));
  const daily = value.actions.filter(a => !ACQUISITION.has(a.command.type) && !ENCOUNTER.has(a.command.type) && (!('caseId' in a.command) || a.command.caseId === selected?.id));
  const relevant = encounter.inside ? battle : value.promoted ? daily : acquisition;
  const next = relevant.find(a => a.enabled && a.command.type === 'CONSUME') ?? relevant.find(a => a.enabled && !RETURN.has(a.command.type)) ?? relevant.find(a => a.enabled);
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // An error, an error being cleared, and elapsed time are not a commit receipt.
    // Keep the original submitted intent locked until committed facts actually change.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); heading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) setConfirmation(null);
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation && error === null) { if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal(); cancel.current?.focus(); }
    else if (submitted.current === null && returnActionId.current) (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
  }, [confirmation, error]);
  function submit(action: ConcealmentServantAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: ConcealmentServantAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) { returnActionId.current = action.id; setConfirmation({ id: action.id, facts }); } else submit(action);
  }
  function actions(entries: ConcealmentServantAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled} aria-describedby={a.reason ? `concealment-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }} onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`concealment-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const r = value.resources;
    return r && <section aria-label="隐秘之仆当前资源" className="seer-current-resources"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div><div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function uses(a: Attempt) {
    return <div><p>本次第{a.week}周 · 已付{a.spiritualitySpent}灵性 · 真实{a.elapsedSeconds}秒 · 本人{a.playerTravelMetres}米、艾琳{a.erinTravelMetres}米、原盒{a.boxTravelMetres}米。</p>
      {([['有限房间隐秘', a.concealment], ['有限遮踪', a.traceVeil]] as const).map(([name, use]) => <p key={name}>{name}：尝试{use.attempts} / 检定成功{use.successes} / 实际应用{use.effects}；{use.tier ? TIER[use.tier] : '尚无检定'}，{WINDOW[use.state]}，余{use.remainingSeconds}秒。</p>)}
      <p>物主许可：{CONSENT[a.ownerConsent]}；参与者意愿：{CONSENT[a.participantConsent]}。{a.stoppedBy && `本次由${a.stoppedBy === 'ERIN' ? '艾琳' : '本人'}撤回。`}</p>
      <p>{a.doorBlocked ? `本次原门确曾受阻；${a.releasedAfterBlock ? '已明确解除' : '尚未解除'}，${a.doorUnbolted ? '已普通解闩' : '尚未普通解闩'}。` : '本次尚未放下原门闩。'}双方{a.exited ? '已实际沿原路退出' : a.entered ? '仍须实际退出' : '尚未进入'}。</p>
      {a.search && <p>同一弱标记检索实际从{a.search.requestedAt}秒到{a.search.completedAt}秒；实际延迟{a.search.delayedSeconds}秒，结果{a.search.result === 'ROOM_CONCEALED' ? '原房间仍处有限隐秘' : '原盒位置被检得'}。原标记与原记录仍存在。</p>}
    </div>;
  }
  const pending = submittedId && <p role="status" aria-live="polite">已提交同一次意图，等待保存回执。{error !== null ? '保存错误未解除原意图锁，请在保存错误处重试。' : '不会因点击或清除错误重复执行。'}</p>;
  return <section className="seer-panel" aria-label="隐秘之仆有限切片" aria-busy={busy}>
    <h2 ref={heading} tabIndex={-1}>{value.title}</h2>
    <p>{value.story ?? life.story}</p><p className="slice-notice seer-risk">{value.risk}</p>
    <p>{playerText("晋升须取得独立成品并完成专业准备。本阶段的隐秘与遮踪均有范围、时限和消耗，具体条件见下方。")}</p>
    {resources()}
    {error !== null && <p role="alert">{playerText(typeof error === 'string' ? error : error.message)} 请使用保存错误处的重试操作；此处不会自动再次执行。</p>}{pending}
    {next && <section aria-label="当前可做的一步"><h3>{value.promoted ? '当前现场可做的一步' : '当前独立成品准备'}</h3><p>{next.label} · {next.cost}</p>{actions([next], '当前下一步')}</section>}
    {!value.promoted && <section><h3>本阶独立原瓶与专业准备</h3><p>{value.supplies}</p><p>{playerText("完整配方未公开，不以专业成品费用冒充原著配方或仪式。")}</p>
      <label>查看原瓶 <select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>{value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}</select></label>
      {bottle && <article><h4>{bottle.title} · {bottle.id}</h4><p>{bottle.source}</p><p>当前原瓶状态{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      {value.preparations.map(p => <p key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未实际完成' : `第${p.completedWeek}周已完成`}</p>)}
      <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。每次成功或失败均耗尽本瓶与当次准备。</p>{actions(acquisition, '独立成品获取与服药')}
    </section>}
    {value.promoted && <><section aria-label="原房间当前状态"><h3>原房间、当前许可与普通出口</h3>
      <p>{life.environment}</p><p>本人{LOCATION[life.playerLocation]}；原艾琳38岁、存活，健康{life.erin.health}、精神{life.erin.mind}，{LOCATION[life.erin.location]}。</p>
      <p>原房间{life.room.id}：{life.room.concealed ? `有限隐秘，剩${life.room.remainingSeconds}秒` : '正常位置、正常可见'}；原门{life.room.doorId}：{life.room.doorBlocked ? '门闩真实受阻，先解除，再普通解闩' : '原门开放'}。</p>
      <p>原盒{life.box.id}在{LOCATION[life.box.location]}，始终归艾琳；原纸{life.page.id}仍在原房间，文字未抹除。累计原盒搬动{life.box.travelMetres}米，真实场内{life.clockSeconds}秒。</p>
      <p>原固定锚灯：{life.anchorLight.on ? '当前开启，有限窗口已受反制' : '关闭'}。原弱标记始终存在，实际检索{life.trace.searches}次、实际延迟{life.trace.delayedSearches}次，共{life.trace.totalDelaySeconds}秒。</p>
      {attempt && uses(attempt)}
      <p className="slice-notice">解除只停止隐秘，不传送。门闩受阻须先明确解除，再普通解闩；同一原盒归还后，双方沿原6米路径离场。</p>
      {actions(daily.filter(a => RETURN.has(a.command.type)), '停止、归还与普通出口')}
    </section>
    <section><h3>本次有限实践</h3><label>查看实践 <select value={selected?.id ?? ''} disabled={locked || confirmation !== null || life.inside} onChange={e => setCaseId(e.target.value)}>{life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? c.status}</option>)}</select></label>
      {selected && <><h4>{selected.title}</h4><p>{selected.story}</p>{selected.observations.map((x, i) => <p key={i}>{x}</p>)}{selected.result && <p>{selected.result}</p>}</>}{actions(daily.filter(a => !RETURN.has(a.command.type)), '有限实践步骤')}
    </section>
    <section><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? encounter.status}</p><p>{encounter.story}</p>
      {encounter.enemy && <p>同一原奥斯温{encounter.enemy.age}岁：H{encounter.enemy.health}/100 · M{encounter.enemy.mind}/100 · S{encounter.enemy.spirituality}/120 · {encounter.enemy.status}。原棍{encounter.enemy.weaponId}在{encounter.enemy.weaponLocation}；每轮资源按实际保存状态显示。</p>}
      {encounter.room && <p>原战场{encounter.room.id} · {encounter.room.widthMetres}米 · 唯一原门{encounter.room.doorId}：{encounter.room.doorStatus}；本人{encounter.playerLocation === 'OUTSIDE' ? '实际在原门外' : '仍在原门槛'}，已走{encounter.playerTravelMetres}米，战场实际{encounter.clockSeconds}秒。原弱痕迹仍在。</p>}
      <p>战斗隐秘：尝试{encounter.abilityUses.BOUNDED_CONCEALMENT.attempts} / 成功{encounter.abilityUses.BOUNDED_CONCEALMENT.successes} / 实际效果{encounter.abilityUses.BOUNDED_CONCEALMENT.effects}；遮踪：尝试{encounter.abilityUses.TRACE_VEIL.attempts} / 成功{encounter.abilityUses.TRACE_VEIL.successes} / 实际效果{encounter.abilityUses.TRACE_VEIL.effects}。战斗不额外奖励新掌握。</p>
      <ul>{encounter.facts.map((x, i) => <li key={i}>{x}</li>)}</ul>{actions(battle, '原敌接触与普通退出')}
    </section></>}
    <details className="seer-fold"><summary>三案历史、掌握与原记录</summary><p>{life.story}</p>{life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? c.status}</h4>{c.attempts.map((a, i) => <div key={i}>{uses(a)}</div>)}</article>)}
      {value.abilities.map(a => <p key={a.id}>{a.label} · 掌握{a.mastery}：{a.description}</p>)}<p>仅成功开窗且未实际应用不会获得+8；普通真实收束仍可报告与反思。</p><p>原纸永久记录：{life.page.text}</p>
    </details>
    <details className="seer-fold"><summary>原身体与七阶历史</summary><p>当前身体性别：{value.currentGender === 'FEMALE' ? '女性' : value.currentGender === 'MALE' ? '男性' : value.currentGender}；本阶不改变身体性别，不免费治疗或补灵。</p><ul>{value.inheritedHistory.map((x, i) => <li key={i}>{x}</li>)}</ul><p>{value.environment}</p></details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || value.insideCase || confirmation !== null} onClick={() => { if (!locked && !value.insideCase && !confirmation) onClose(); }}>关闭隐秘之仆页面</button>}
    {confirmation && error === null && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="concealment-confirm-title" aria-describedby="concealment-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={e => { e.preventDefault(); if (!locked) setConfirmation(null); }} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <h3 id="concealment-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次真实消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '公开条件已改变，请返回最新状态。'}</p><p id="concealment-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p><p>{playerText("这一独立原瓶和当次准备无论成功或失败都耗尽；旧16掌握、旧死亡、原人原物、伤势与风险保留，不免费治疗或补灵。完整配方及原著仪式仍未知。")}</p></>}
      {liveConfirmation?.command.type === 'CONCEAL' && <p>{playerText("6灵性、知识18，成功最多60秒G。仅原6米房间暂时隐秘，身体仍在原地点；实际搬运才计本次应用。原门受阻时必须先解除，再普通解闩退出。")}</p>}
      {liveConfirmation?.command.type === 'TRACE_VEIL' && <p>{playerText("5灵性、意志18，成功最多20秒G窗口。只有下一次已登记原弱标记的真实检索才延迟20秒；当前撤回、强锚或到期可令窗口失效。不会删除过去记录或物权。")}</p>}
      {liveConfirmation?.command.type === 'BLOCK_DOOR' && <p>将实际放下原门闩；隐秘不能绕门而过。须先明确解除，再普通解闩。归还原盒并让双方沿原路退出后才可结束。</p>}
      {liveConfirmation?.command.type === 'LIGHT_ANCHOR' && <p>原固定灯立即反制尚未完成的有限窗口，不撤销过去已完成动作，也不退还灵性。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <p className="slice-notice seer-risk">真实交战会产生伤势、投降或不可逆死亡。当前原伤和累计风险继续生效，有限隐秘与遮踪不跳过共同伤势盘，不提供复活或无条件逃跑。可取消后普通离开。</p>}
      {resources()}{liveConfirmation?.reason && <p>{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button ref={cancel} type="button" className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button><button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作'}</button></div>
      <p>取消不提交意图。已提交后等待同一次保存回执；错误清除本身不表示已经提交成功。</p>{pending}
    </dialog>}
  </section>;
}
