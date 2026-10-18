import { useEffect, useRef, useState } from 'react';
import type { HandOfOrderAction, HandOfOrderCommand, HandOfOrderProjection } from '../domain/hand-of-order/types';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const CLEANUP_ORDER = ['LEAVE', 'CLOSE', 'WITHDRAW', 'LEAVE_ENCOUNTER', 'LEAVE_PREPARATION', 'RETURN_OBJECTS', 'TAKE_OBJECT', 'STOP', 'CANCEL_IMPULSE', 'WAIT_EFFECT', 'WITHDRAW_PERMISSION'];
const CLEANUP = new Set(CLEANUP_ORDER);
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '尚未收束', EXAMINED: '待报告', RESOLVED: '已收束', CANCELLED: '已取消' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '仅同意本次有限练习', DECLINED: '已拒绝本次练习', REVOKED: '已撤回同意', WITHDRAWN: '已撤回同意', CLOSED: '本次接触已结束', ORDINARY: '仅同意普通处理' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const LOCATION: Record<string, string> = { START: '原门口', A: '原标线处', B: '室内原空桌旁', OUTSIDE: '室外', ANNEX_A: '新场地甲处', ANNEX_B: '新场地乙处', YARD: '独立旁院' };
const POLICY: Record<string, string> = { ALL: '允许两项新能力', DIVISION: '允许分割战场', AFTERMATH: '允许余波控制', ORDINARY: '只作普通行动' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface HandOfOrderPanelProps {
  value: HandOfOrderProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: HandOfOrderCommand) => void;
  onClose?: () => void;
}

/** Only saved public facts are displayed; every operation remains a domain intent. */
export function HandOfOrderPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: HandOfOrderPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: HandOfOrderAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || pending || value.resources?.health === 0;
  const { life, encounter } = value;
  // Display authored prose only; commands, identifiers and custom names stay exact.
  const prose = (text: string) => value.characterName ? text.split(value.characterName).map(playerText).join(value.characterName) : playerText(text);
  const encounterActionIds = new Set(encounter.actions.map(action => action.id));
  const activeCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === 'PREPARED');
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => !['RESOLVED', 'CANCELLED'].includes(entry.status)) ?? life.cases[0];
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && goal === 'encounter');
  const inside = value.insideCase || life.insideCase || encounter.inside;
  const complete = life.reflected && life.cases.every(entry => entry.status === 'RESOLVED');
  const encounterComplete = ['RESOLVED', 'RETREATED', 'LOST'].includes(encounter.status);
  const entries = value.actions.filter(action => inEncounter ? !encounterComplete && encounterActionIds.has(action.id)
    : value.promoted ? !complete && !ACQUISITION.has(action.command.type) && !encounterActionIds.has(action.id)
      && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id)
      : ACQUISITION.has(action.command.type) && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const next = entries.find(action => action.enabled && action.id === value.preferredActionId)
    ?? entries.find(action => action.enabled && action.preferredAction)
    ?? entries.find(action => action.enabled && !action.cleanup && !CLEANUP.has(action.command.type))
    ?? entries.find(action => action.enabled) ?? entries[0];
  const cleanup = entries.filter(action => action !== next && action.enabled && (action.cleanup || CLEANUP.has(action.command.type)))
    .sort((a, b) => (CLEANUP_ORDER.indexOf(a.command.type) < 0 ? CLEANUP_ORDER.length : CLEANUP_ORDER.indexOf(a.command.type)) - (CLEANUP_ORDER.indexOf(b.command.type) < 0 ? CLEANUP_ORDER.length : CLEANUP_ORDER.indexOf(b.command.type))).slice(0, 2);
  const alternatives = entries.filter(action => action !== next && !cleanup.includes(action));
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmedBottleId = live?.command.type === 'CONSUME' ? live.command.bottleId : null;
  const confirmedBottle = value.bottles.find(bottle => bottle.id === confirmedBottleId);
  const attempt = selectedCase ? (life.activeCase === selectedCase.id ? life.currentAttempt : null) ?? selectedCase.attempts.at(-1) ?? null : null;

  const phase = `${value.promoted ? 'life' : 'acquisition'}:${inEncounter ? 'encounter' : selectedCase?.id}:${next?.id}`;
  useEffect(() => { if (!confirmation && !pending) heading.current?.focus(); }, [phase]);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null;
      submittedFacts.current = null;
      setPending(false);
      returnActionId.current = null;
      setConfirmation(null);
      heading.current?.focus();
    } else if (error !== null || confirmation && confirmation.facts !== facts) {
      returnActionId.current = null;
      setConfirmation(null);
      heading.current?.focus();
    }
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? heading.current)?.focus();
  }, [confirmation]);

  function choose(action: HandOfOrderAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: HandOfOrderAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="秩序之手当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining}</p>
      <p>现有伤势{value.injuries.length}处 · 伤势风险{value.injuryRisk}。</p>
      {value.injuries.length > 0 && <ul aria-label="当前伤势与处置">{value.injuries.map((injury, index) => <li key={injury.id}>第{index + 1}处{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已处置，仍须休养' : '尚未处置'}</li>)}</ul>}
      <p>原伤继续生效。停止作用、归物与晋升不会治疗旧伤，也不会返还已经付出的灵性、精神或费用。</p>
    </section>;
  }
  function actionControl(action: HandOfOrderAction) {
    return <div key={action.id} className="seer-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `hand-of-order-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{prose(action.label)}</strong><span className="slice-modifiers">{prose(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`hand-of-order-reason-${action.id}`}>{prose(action.reason)}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="秩序之手成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{prose(value.title)}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : complete && !inEncounter ? '三案已结束，可返回普通生活；旁院交战由你另行选择。' : inEncounter && encounterComplete ? '旁院经历已经结束，原物、费用与实际结果保留；可返回普通生活。' : prose(next?.label ?? value.nextStep)}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {resources()}
    {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
    <nav aria-label="秩序之手目标">
      {value.promoted ? <>
        {life.cases.map(entry => <button key={entry.id} className="slice-button quiet" disabled={locked || inside || confirmation !== null || !['RESOLVED', 'CANCELLED'].includes(entry.status) && !life.actions.some(action => 'caseId' in action.command && action.command.caseId === entry.id)}
          aria-pressed={!inEncounter && selectedCase?.id === entry.id} onClick={() => setGoal(entry.id)}>{entry.title} · {STATUS[entry.status] ?? entry.status}</button>)}
        <button className="slice-button quiet" disabled={locked || inside || confirmation !== null} aria-pressed={inEncounter} onClick={() => setGoal('encounter')}>可选旁院交战</button>
      </> : value.bottles.map(bottle => <button key={bottle.id} className="slice-button quiet" disabled={locked || life.insideCase || encounter.inside || confirmation !== null}
        aria-pressed={selectedBottle?.id === bottle.id} onClick={() => setGoal(bottle.id)}>{bottle.title} · {bottle.status}</button>)}
    </nav>
    {!value.promoted ? <>
      <p>{prose(value.supplies)}</p><p>{prose(value.risk)}</p>
      {selectedBottle && <section aria-label="独立原药瓶"><h3>{prose(selectedBottle.title)}</h3><p>{prose(selectedBottle.source)}</p><p>{selectedBottle.status} · 当前成功率{selectedBottle.chance}%</p></section>}
      <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{prose(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
      <p>当周服药场地准备：{value.preparedWeek === null ? '未完成' : `第${value.preparedWeek}周已支付，取消不退款`}。可选择继续停留平衡者。</p>
    </> : inEncounter ? encounterFacts() : lifeFacts()}
    {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
    {cleanup.length > 0 && <section aria-label="停止与普通退出"><h3>停止与普通退出</h3>{cleanup.map(actionControl)}</section>}
    {alternatives.length > 0 && <details><summary>其他操作、普通替代与退出</summary>{alternatives.map(actionControl)}</details>}
    <details><summary>能力、消化与继承经历</summary>
      <p>当前保留{value.abilities.length}项能力，逐项保留已有掌握；未曾掌握的能力仍为零。晋升后才会新增两项能力，均从零开始。</p><p>{prose(value.appearanceRecord)}</p><p>{prose(value.digestion)}</p><p>{prose(value.inheritedTools)}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{prose(entry)}</li>)}</ul>
      {value.abilities.map(ability => <section key={ability.id}><h3>{prose(ability.label)} · 掌握{ability.mastery}</h3><p>{prose(ability.description)}</p></section>)}
    </details>
    <details><summary>原演练房与普通退路</summary><p>{prose(value.environment)}</p><p>关闭页面不会代为停止作用、收回支撑片、归还原封包、原标条与原纸，或携带同一护板步行离场；已付代价、原物变化与旧伤保留。</p></details>
    {confirmation && <section role="dialog" aria-modal="true" aria-label="秩序之手操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{prose(live?.label ?? '现场已变化')}</h3><p>{live ? prose(live.cost) : ''}</p><p>{prose(!value.promoted ? value.risk : inEncounter ? encounter.story : life.environment)}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{prose(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p></>}
      {live?.command.type === 'CONSUME' && <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备；失败保留已付代价。也可取消并继续停留平衡者。</p>}
      {resources()}{live?.reason && <p className="seer-action-reason">{prose(live.reason)}</p>}
      <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
      <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button>
      <p>取消不提交。关闭页面不能替代实际停止、交还原物和步行离场。</p>
    </section>}
  </section>;

  function lifeFacts() {
    const currentScene = life.activeCase === selectedCase?.id;
    return <section aria-label="秩序之手原场事务">
      <h3>{prose(selectedCase?.title ?? life.title)}</h3><p>{prose(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p className="slice-notice">{prose(selectedCase.result)}</p>}
      <p>本人在{LOCATION[life.playerLocation]}，累计普通步行{life.playerTravelMetres}米；现场时钟{life.clockSeconds}秒。</p>
      <section aria-label="同一原护板当前状态">
        <h4>{prose(life.guardPlate.title)}</h4>
        <p>当前完整度{life.guardPlate.integrity} · {prose(life.guardPlate.holder)} · {prose(life.guardPlate.location)}。</p>
        <p>每次实际缓冲磨损15完整度；不足15时不能施用余波控制。晋升、停止与普通离场不会修复护板。</p>
      </section>
      {currentScene && life.pendingAction && <section aria-label="当前待执行的有限动作">
        <h4>本次待执行动作</h4><p>{prose(life.pendingAction)}</p>
        {life.effectRemainingSeconds > 0 && <p>当前作用还剩{life.effectRemainingSeconds}秒，只适用于这一次动作；仍须亲手执行并核对结果。</p>}
      </section>}
      {attempt && <p>本案许可：{CONSENT[attempt.consent]}。{attempt.permissionWithdrawn ? '许可已撤回，不能继续施术；仍可普通完成、归物和退出。' : '只适用于本次已说明的操作，随时可以撤回。'}</p>}
      <details><summary>当前人物、原物与另付费场地</summary>
        <section aria-label="原成年协作者与原物的实际位置">
          <h4>{prose(life.site.title)}</h4>
          <p>{prose(life.site.guide)}</p><p>{prose(life.site.volunteer)}</p>
          <p>{prose(life.site.parcel)}</p><p>{prose(life.site.line)}</p><p>{prose(life.site.paper)}</p>
          <p>{prose(life.site.table)}</p>
        </section>
        <section aria-label="另行付费的新划界场地">
          <h4>{prose(life.annex.title)}</h4>
          <p>{life.annex.paid ? '已经实际支付40便士、1次行动，布置新场地。' : '尚未支付40便士与1次行动布置新场地。'}两处标记相隔四米，室内原空桌仍在原处。</p>
          <p>有限支撑片剩余{life.annex.supportPieces}枚；本阶段协作已耗力{life.annex.effortSpent}/{life.annex.effortLimit}，米拉当前精神{life.annex.volunteerMind}。</p>
          <p>米拉累计普通步行{life.annex.volunteerTravelMetres}米。每案实际协作耗力3、精神1；这份有限安排不会为她补充身体或精神。</p>
        </section>
        <p>{prose(life.environment)}</p>
        <ul>{(selectedCase?.observations ?? []).map((entry, index) => <li key={index}>{prose(entry)}</li>)}</ul>
      </details>
      {attempt && <details><summary>本次结果与实际消耗</summary>
        <section aria-label="秩序之手本次实际尝试">
          <h4>{attempt.method === 'ABILITY' ? '有限能力练习' : '普通交接与核对'}</h4>
          <p>{attempt.closed ? '本次现场已经收束。' : '本次现场尚未收束。'}{attempt.stopped ? '本次作用已经停止。' : ''}</p>
          <p>实耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.healthLost}健康；本人步行{attempt.playerTravelMetres}米，经过{attempt.elapsedSeconds}秒。</p>
          <p>协作耗力{attempt.effortSpent}，米拉消耗{attempt.volunteerMindSpent}精神。</p>
          <p>分割战场：{attempt.divisionTier ? TIER[attempt.divisionTier] : '尚未施术'}；余波控制：{attempt.aftermathTier ? TIER[attempt.aftermathTier] : '尚未施术'}。</p>
          {attempt.divisionOutcome && <p>{attempt.divisionOutcome === 'STOPPED' ? '本次待交接的原封包实际停在这一侧。' : attempt.divisionOutcome === 'RESISTED' ? '本次划界受到抵抗，实际交接照常进行。' : '这一次普通交接已经进行。'}</p>}
          {attempt.impact && <p>这次可见冲击实际损失{attempt.impact.healthLoss}健康、磨损{attempt.impact.plateWear}护板完整度；{attempt.impact.aftermathApplied ? '有限余波控制已经实际应用。' : '这次结果未应用余波控制。'}</p>}
          <p>{attempt.objectsReturned ? '原封包、原标条和原纸已经当面归还。' : '原物仍须亲手取回并当面归还。'}普通操作、失败或仅仅施术都不计作能力应用。</p>
          <ul>{attempt.evidence.map((entry, index) => <li key={index}>{prose(entry)}</li>)}</ul>
        </section>
      </details>}
      <details><summary>有限作用与普通收尾</summary>
        <p>只处理眼前这一次交接或本人护板上的轻缓冲击。分割战场和余波控制各支付8灵性、2精神及一枚有限支撑片，失败总计损4精神。施术后的二十秒内仍须执行实际动作，才有可能应用。</p>
        <p>轻缓冲击通常损5健康；成功应用余波控制后损2健康并磨损15护板完整度。普通支撑也能将5健康损失减至2，不计能力应用。</p>
        <p>撤回许可会取消未用作用；已经发生的交接、伤势、磨损、费用与时间保留。灵性不足时仍可普通移动、等候、归物与退出。</p>
        <ul>{life.facts.map((entry, index) => <li key={index}>{prose(entry)}</li>)}</ul>
      </details>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="秩序之手独立旁院冲突">
      <h3>{prose(encounter.title)}</h3><p>{prose(encounter.story)}</p>
      <p>当前策略：{POLICY[encounter.policy]}。</p>
      {enemy && <section aria-label="独立对手当前身体与心智">
        <h4>{enemy.name} · {enemy.age}岁 · 序列{enemy.sequence}</h4>
        <p>健康{enemy.health} · 精神{enemy.mind} · 灵性{enemy.spirituality} · {ENEMY_STATUS[enemy.status]}。本人距离对手{enemy.distanceMetres}米。</p>
        <p>对手有独立身体、心智与抵抗；唯一手杖{enemy.weaponLocation === 'HAND' ? '仍由对手持有' : '实际留在旁院'}。</p>
      </section>}
      {scene && <p>本人在{LOCATION[scene.playerLocation]}，米拉在{LOCATION[scene.miraLocation]}，薇娜在{LOCATION[scene.guideLocation]}。累计步行{scene.playerTravelMetres}米，现场时钟{scene.clockSeconds}秒；普通退出还须走{scene.exitMetres}米。</p>}
      <section aria-label="旁院物资与同一原护板">
        <h4>当前物资</h4>
        <p>本次独立支撑片剩余{encounter.supportPieces.filter(piece => piece.status === 'HELD').length}/{encounter.supportPieces.length}枚；对手刻片剩余{encounter.enemyCharges.filter(piece => piece.status === 'HELD').length}/{encounter.enemyCharges.length}枚。</p>
        {encounter.guardPlate && <p>同一原护板当前完整度{encounter.guardPlate.integrity}，位于{LOCATION[encounter.guardPlate.location] ?? prose(encounter.guardPlate.location)}；这仍是同一块护板，换场不会修复磨损。</p>}
      </section>
      {encounter.windows.length > 0 && <section aria-label="本次尚未用完的有限窗口"><h4>当前待用作用</h4>{encounter.windows.map(window => <p key={window.kind}>{window.kind === 'DIVISION' ? '本人下一次身体行动增加35' : '下一次身体或弧光冲击最多减轻30'}，还剩{window.remainingSeconds}秒，可应用{window.remaining}次。</p>)}</section>}
      <details><summary>旁院准备、能力条件与普通退路</summary>
        {encounter.preparation && <p>第{encounter.preparation.week}周已实付{encounter.preparation.pricePaid}便士、{encounter.preparation.mindPaid}精神，购入三枚独立支撑片；取消或离场不退款。</p>}
        <p>双方每轮最多{encounter.maxActionCount}次实际行动。分割战场只为本人下一次尚未结算的身体行动增加35，并接受对手抵抗；余波控制只减轻下一次身体或弧光冲击，不抵挡精神攻击。</p>
        <p>两项能力各付8灵性、2精神与一枚支撑片，失败总计损4精神，作用最多二十秒且仅用一次。余波控制实际应用时磨损原护板15完整度；不足15时不能施术。</p>
        <p>对手可凝神抵抗、遮挡或沿普通道路离开。原演练房的人物与交战结果保留，布拉姆是这次另行接触的成年对手。</p>
        <ul>{encounter.facts.map((fact, index) => <li key={index}>{prose(fact)}</li>)}</ul>
        <h4>对手当前行动盘</h4><ul>{encounter.enemyAbilityWheel.map(action => <li key={action.id}>{prose(action.label)} · 权重{action.weight}</li>)}</ul>
      </details>
    </section>;
  }
}
