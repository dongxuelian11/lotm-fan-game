import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from 'react';
import type { WisdomAngelAction, WisdomAngelCommand, WisdomAngelProjection } from '../domain/wisdom-angel/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['WITHDRAW_CONSENT', 'STOP_METHOD', 'RETURN_PAPERS', 'RETURN_DEVICE', 'EXIT_ROOM', 'INSPECT', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'SYNTHESIS', 'RESPONSE', 'FIRST_DEMONSTRATION', 'SECOND_DEMONSTRATION', 'SWITCH_FILTER', 'ENCOUNTER_FIGHT', 'MAKE_INHERITED_FLASH']);
const LOCATION: Record<string, string> = { EXIT: '原门外入口', TABLE: '4米内同一原桌', PLAYER: '本人手中' };
const CONSENT = { UNASKED: '尚未询问本次', GRANTED: '本次当前同意', DECLINED: '本次拒绝', REVOKED: '本次已撤回', CLOSED: '本次已结束' } as const;
const WINDOW = { NONE: '尚未尝试', ACTIVE: '有限窗口尚有效', FAILED: '检定失败', APPLIED: '已实际应用一次', STOPPED: '已明确停止', EXPIRED: '实际时间已到期', INVALIDATED: '原条件已失效' } as const;
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' } as const;
const STATUS: Record<string, string> = { AVAILABLE: '尚未观察', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已退出，待报告', RESOLVED: '已报告或和平结束', READY: '已接触', FIGHTING: '真实交战中', RETREATED: '已撤退', LOST: '本人实际死亡' };
const LIGHT = { WHITE: '白光', AMBER: '琥珀光' } as const;
type Attempt = NonNullable<WisdomAngelProjection['life']['currentAttempt']>;
type Confirmation = { id: string; facts: string };
export interface WisdomAngelPanelProps {
  value: WisdomAngelProjection; busy: boolean; blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: WisdomAngelCommand) => void;
  /** Navigation only; closing cannot stop a real effect or return an original object. */
  onClose?: () => void;
}
export function WisdomAngelPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: WisdomAngelPanelProps) {
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
  const craft = value.actions.filter(a => a.command.type === 'MAKE_INHERITED_FLASH');
  const daily = value.actions.filter(a => !ACQUISITION.has(a.command.type) && !ENCOUNTER.has(a.command.type) && a.command.type !== 'MAKE_INHERITED_FLASH' && (!('caseId' in a.command) || a.command.caseId === selected?.id));
  const relevant = encounter.inside ? battle : value.promoted ? daily : acquisition;
  const next = relevant.find(a => a.enabled && a.command.type === 'CONSUME') ?? relevant.find(a => a.enabled && !RETURN.has(a.command.type)) ?? relevant.find(a => a.enabled);
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // A cleared error or elapsed time is not a commit receipt. Never unlock the
    // original submitted intent until persisted public facts actually change.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); heading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) setConfirmation(null);
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation && error === null) { if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal(); cancel.current?.focus(); }
    else if (submitted.current === null && returnActionId.current) (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
  }, [confirmation, error]);
  function submit(action: WisdomAngelAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: WisdomAngelAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) { returnActionId.current = action.id; setConfirmation({ id: action.id, facts }); } else submit(action);
  }
  function actions(entries: WisdomAngelAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled} aria-describedby={a.reason ? `wisdom-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }} onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`wisdom-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const r = value.resources;
    return r && <section aria-label="智慧天使当前资源" className="seer-current-resources"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div><div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function uses(a: Attempt) {
    return <div><p>本次第{a.week}周 · 实付{a.spiritualitySpent}灵性 · 实际{a.elapsedSeconds}秒 · 本人{a.playerTravelMetres}米、玛拉{a.maraTravelMetres}米。</p>
      {([['条件综合', a.synthesis], ['已见方法应对', a.response]] as const).map(([name, use]) => <p key={name}>{name}：尝试{use.attempts} / 检定成功{use.successes} / 实际应用{use.effects}；{use.tier ? TIER[use.tier] : '尚无检定'}，{WINDOW[use.state]}，余{use.remainingSeconds}秒；来源条件版本{use.conditionVersion ?? '尚无'}。</p>)}
      <p>玛拉本次许可：{CONSENT[a.ownerConsent]}。双方{a.exited ? '已实际沿原路退出' : a.entered ? '仍须实际退出' : '尚未进入'}。原纸{a.papersReturned ? '已亲手归还' : a.papersTaken ? '本次仍需归还' : '本次未拿起'}；原器具{a.deviceReturned ? '已亲手归还' : a.deviceTaken ? '本次仍需归还' : '本次未拿起'}。</p>
      {a.models.map((m, i) => <p key={i}>模型条件版本{m.version} · {TIER[m.tier]} · {WINDOW[m.state]}：{m.hypothesis}</p>)}
      {a.predictions.map((p, i) => <p key={i}>原预测{i + 1}：条件版本{p.version}，{LIGHT[p.prediction]}，记录于{p.at}秒；这只是当时预测。</p>)}
      {a.demonstrations.map(d => <p key={d.id}>实际{d.id}：条件版本{d.version}，{LIGHT[d.result]}；原储能{d.chargeBefore}→{d.chargeAfter}，完成于{d.at}秒。</p>)}
      {a.handoverFinding && <p>{a.handoverFinding}</p>}{a.resultVerified && <p>已真实复核：{a.predictionMatched ? '最新预测与实际版本、结果一致' : '最新预测错误或版本已过时，原记录保留'}。</p>}
    </div>;
  }
  const pending = submittedId && <p role="status" aria-live="polite">已提交同一次意图，等待保存回执。{error !== null ? '保存错误未解除原意图锁，请在保存错误处重试。' : '不会因重复点击或清除错误再次执行。'}</p>;
  return <section className="seer-panel" aria-label="智慧天使有限切片" aria-busy={busy}>
    <h2 ref={heading} tabIndex={-1}>{value.title}</h2>
    <p>{value.story ?? life.story}</p><p className="slice-notice seer-risk">{value.risk}</p>
    <p>{playerText("晋升须取得独立成品并完成专业准备。下一序列1尚未开放；判断仍须依据当前实际资料。")}</p>
    {resources()}
    {error !== null && <p role="alert">{playerText(typeof error === 'string' ? error : error.message)} 请使用保存错误处的重试；此处不会再次提交原意图。</p>}{pending}
    {next && <section aria-label="当前可做的一步"><h3>{value.promoted ? '当前现场可做的一步' : '当前独立成品准备'}</h3><p>{next.label} · {next.cost}</p>{actions([next], '当前下一步')}</section>}
    {!value.promoted && <section><h3>本阶独立原瓶与专业准备</h3><p>{value.supplies}</p><p>{playerText("晋升使用独立成品，并须完成当次场地检查。")}</p>
      <label>查看原瓶 <select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>{value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}</select></label>
      {bottle && <article><h4>{bottle.title} · {bottle.id}</h4><p>{bottle.source}</p><p>当前状态{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      {value.preparations.map(p => <p key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未实际完成' : `第${p.completedWeek}周已完成`}</p>)}
      <p>当次检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}；每次成功或失败均耗尽原瓶与当次准备。</p>{actions(acquisition, '独立成品获取与服药')}
    </section>}
    {value.promoted && <><section aria-label="当前原人原物与来源"><h3>原资料、当前许可与真实归还</h3>
      <p>{life.environment}</p><p>本人{LOCATION[life.playerLocation]}；同一玛拉43岁，存活，健康{life.mara.health}、精神{life.mara.mind}，{LOCATION[life.mara.location]}。</p>
      <p>同一原器具{life.device.id}在{LOCATION[life.device.location]}，剩{life.device.charges}/2格原储能；已真实示范{life.device.demonstrations}次，更换滤片{life.device.filterChanges}次，当前条件版本{life.device.conditionVersion}，{life.device.filter === null ? '本版本尚未亲眼观察' : life.device.filter === 'CLEAR' ? '本版本已见透明滤片' : '本版本已见琥珀滤片'}。</p>
      {life.papers.map(p => <p key={p.id}>同一原纸{p.id}在{LOCATION[p.location]}，归玛拉；{p.text === null ? '尚未实际阅读，内容不公开。' : p.text}</p>)}
      <p>累计实际{life.clockSeconds}秒，本人{life.playerTravelMetres}米，玛拉{life.mara.travelMetres}米。窗口不会复制原纸、补充储能或把模型当真实交接。</p>
      {attempt && uses(attempt)}{actions(daily.filter(a => RETURN.has(a.command.type)), '停止、归还与普通出口')}
    </section>
    <section><h3>本次有限实践</h3><label>查看实践 <select value={selected?.id ?? ''} disabled={locked || confirmation !== null || life.inside} onChange={e => setCaseId(e.target.value)}>{life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? c.status}</option>)}</select></label>
      {selected && <><h4>{selected.title}</h4><p>{selected.story}</p>{selected.observations.map((x, i) => <p key={i}>{x}</p>)}{selected.result && <p>{selected.result}</p>}</>}{actions(daily.filter(a => !RETURN.has(a.command.type)), '有限实践步骤')}
    </section>
    <section aria-label="实际旧法生产"><h3>原微光片的付费再制作</h3><p>只调用既有真实学会的FLASH与原生产方法。每真实周最多一次，实际支付1行动、160便士、4灵性，知识16检定；失败照付且不出新片。旧原片的来源、固定效力及消耗记录保留。</p>{actions(craft, '继承原法实际制作')}</section>
    <section><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? encounter.status}</p><p>{encounter.story}</p>
      {encounter.enemy && <p>原维克托{encounter.enemy.age}岁：H{encounter.enemy.health}/100 · M{encounter.enemy.mind}/100 · S{encounter.enemy.spirituality}/120 · {encounter.enemy.status}。同一原棍{encounter.enemy.weaponId}在{encounter.enemy.weaponLocation}；实付闪光{encounter.enemy.powerUses.FLASH}次、护术{encounter.enemy.powerUses.WARD}次、变招{encounter.enemy.powerUses.FEINT}次。</p>}
      {encounter.room && <p>原场地{encounter.room.id} · 原门{encounter.room.doorId}开放；本人{encounter.playerLocation === 'OUTSIDE' ? '实际在门外' : '仍在门槛'}，实际行走{encounter.playerTravelMetres}米、战场{encounter.clockSeconds}秒。</p>}
      <p>当前实际条件版本{encounter.conditionVersion}。条件综合：尝试{encounter.abilityUses.SYNTHESIS.attempts} / 成功{encounter.abilityUses.SYNTHESIS.successes} / 应用{encounter.abilityUses.SYNTHESIS.effects}；已见方法应对：尝试{encounter.abilityUses.RESPONSE.attempts} / 成功{encounter.abilityUses.RESPONSE.successes} / 应用{encounter.abilityUses.RESPONSE.effects}。战斗不另奖掌握。</p>
      <p>{encounter.responseWindow ? `当前有限应对只针对实际已见${encounter.responseWindow.targetPower}、条件版本${encounter.responseWindow.conditionVersion}，截止${encounter.responseWindow.expiresAt}秒；下一真实敌动作即消费，不保证匹配。` : '当前没有未使用应对窗口。'}</p>
      <details><summary>实际已见原术记录（{encounter.observations.length}）</summary>{encounter.observations.map((o, i) => <p key={i}>第{o.round}轮第{o.order}序：{o.power}，条件版本{o.conditionVersion}，实际付{o.paidCost}灵性，{o.atSeconds}秒。{o.conditionVersion === encounter.conditionVersion ? '当前版本观察' : '旧版本保留，不能冒充当前条件'}</p>)}</details>
      <ul>{encounter.facts.map((x, i) => <li key={i}>{x}</li>)}</ul>{actions(battle, '原敌接触与普通退出')}
    </section></>}
    <details className="seer-fold"><summary>三案历史与新掌握</summary><p>{life.story}</p>{life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? c.status}</h4>{c.attempts.map((a, i) => <div key={i}>{uses(a)}</div>)}</article>)}
      {value.abilities.map(a => <p key={a.id}>{a.label} · 掌握{a.mastery}：{a.description}</p>)}<p>{value.digestion}</p>
    </details>
    <details className="seer-fold"><summary>原身体与七阶历史</summary><p>当前身体性别：{value.currentGender === 'FEMALE' ? '女性' : value.currentGender === 'MALE' ? '男性' : value.currentGender}；本阶不改变身体性别，不免费治疗或补灵。</p><ul>{value.inheritedHistory.map((x, i) => <li key={i}>{x}</li>)}</ul><p>{value.environment}</p></details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || value.insideCase || confirmation !== null} onClick={() => { if (!locked && !value.insideCase && !confirmation) onClose(); }}>关闭智慧天使页面</button>}
    {confirmation && error === null && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="wisdom-confirm-title" aria-describedby="wisdom-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={e => { e.preventDefault(); if (!locked) setConfirmation(null); }} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <h3 id="wisdom-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次真实消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '实际公开条件已改变，请返回最新状态。'}</p><p id="wisdom-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p><p>{playerText("本瓶和当次准备成功失败均耗尽；旧17掌握、原人原物、旧死亡与和平结局、伤势及风险保留。当前灵性不补满，完整配方和原著仪式仍未知。")}</p></>}
      {liveConfirmation?.command.type === 'SYNTHESIS' && <p>5灵性、知识20，实际2秒；成功只形成最多20秒的有限模型，必须以实际交接或实做结果检验。原条件改变或当前撤回可使未用模型失效；未应用不奖掌握。</p>}
      {liveConfirmation?.command.type === 'RESPONSE' && <p>6灵性、知识20，实际2秒；成功最多20秒，只基于本人已见原示范及亲眼观察的新条件。下一次原示范仍实际耗储能；错误预测不会获得实际应对效果，失败可普通复核。</p>}
      {liveConfirmation && ['FIRST_DEMONSTRATION', 'SECOND_DEMONSTRATION'].includes(liveConfirmation.command.type) && <p>同一原器具实际耗1格储能，原两格不会补充。真实结果发生后才记录；不能重骰、改回储能或免费再演示。</p>}
      {liveConfirmation?.command.type === 'SWITCH_FILTER' && <p>玛拉在原桌亲手改变同一原器具的滤片，真实用2秒。旧模型与尚未应用的窗口立即失效，旧预测留存；新条件必须再次亲眼观察。</p>}
      {liveConfirmation?.command.type === 'MAKE_INHERITED_FLASH' && <p>真实付1行动、160便士、4灵性，知识16检定，每周最多一次。失败成本照付且没有新片；成功才另制一件有原材料来源和固定效力的新原片。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <p className="slice-notice seer-risk">真实交战可能受伤、投降或不可逆死亡。旧伤和累计风险继续生效，当前健康满不表示旧重伤已治疗。有限知识方法不跳过共同伤势盘，不提供复活或无条件逃跑；取消后仍可普通离开。</p>}
      {resources()}{liveConfirmation?.reason && <p>{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button ref={cancel} type="button" className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button><button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作'}</button></div>
      <p>取消不提交。提交后等待同一次保存回执；清除错误本身不会解除原意图锁。</p>{pending}
    </dialog>}
  </section>;
}
