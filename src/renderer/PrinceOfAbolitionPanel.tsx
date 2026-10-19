import { useEffect, useRef, useState } from 'react';
import type { PrinceOfAbolitionAction, PrinceOfAbolitionCommand, PrinceOfAbolitionProjection } from '../domain/prince-of-abolition/types';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const CLEANUP_ORDER = ['LEAVE', 'LEAVE_ENCOUNTER', 'LEAVE_PREPARATION', 'WAIT_FLIGHT', 'RETURN_OBJECTS', 'RETRIEVE_BALL', 'RETURN_TO_ANNEX', 'RETURN_TO_OUTSIDE', 'RESTORE_VIEW', 'ABORT', 'STOP_METHOD', 'WITHDRAW_CONSENT'];
const CLEANUP = new Set(['ABORT', 'STOP_METHOD', 'WAIT_FLIGHT', 'RETURN_OBJECTS', 'RETRIEVE_BALL', 'RETURN_TO_ANNEX', 'RETURN_TO_OUTSIDE', 'RESTORE_VIEW', 'LEAVE', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '尚未收束', EXAMINED: '待报告', RESOLVED: '已收束', CANCELLED: '已取消' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '仅同意本次有限练习', DECLINED: '已拒绝本次练习', REVOKED: '已撤回同意', WITHDRAWN: '已撤回同意', CLOSED: '本次接触已结束', ORDINARY: '仅同意普通处理' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const LOCATION: Record<string, string> = { START: '原门口', A: '原室操作处', B: '室内原接收垫', C: '室内另一原接收垫', OUTSIDE: '室外', ANNEX: '新承接区出手处', RECEIVER: '新接球软垫', YARD: '独立旁院' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface PrinceOfAbolitionPanelProps {
  value: PrinceOfAbolitionProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: PrinceOfAbolitionCommand) => void;
  onClose?: () => void;
}

/** Only saved public facts are displayed; every operation remains a domain intent. */
export function PrinceOfAbolitionPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: PrinceOfAbolitionPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: PrinceOfAbolitionAction; facts: string } | null>(null);
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
    ?? entries.find(action => action.enabled && !CLEANUP.has(action.command.type) && action.command.type !== 'WITHDRAW_CONSENT')
    ?? entries.find(action => action.enabled) ?? entries[0];
  const cleanup = entries.filter(action => action !== next && action.enabled && (action.cleanup || CLEANUP.has(action.command.type) || action.command.type === 'WITHDRAW_CONSENT'))
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

  function choose(action: PrinceOfAbolitionAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: PrinceOfAbolitionAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="弑序亲王当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining}</p>
      <p>当前原赠物仍持有{value.gifts.held}份，已经实际送出{value.gifts.given}份。只使用当前手中的同一原物；已赠出记录不能再次支用。</p>
      <p>原伤势{value.injuries.length}处 · 伤势风险{value.injuryRisk}。已付灵性、精神和费用照实保留；停止作用、归物与晋升不恢复健康、旧伤或已经经过的时间。</p>
    </section>;
  }
  function actionControl(action: PrinceOfAbolitionAction) {
    return <div key={action.id} className="seer-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `prince-of-abolition-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{prose(action.label)}</strong><span className="slice-modifiers">{prose(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`prince-of-abolition-reason-${action.id}`}>{prose(action.reason)}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="弑序亲王成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{prose(value.title)}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : complete && !inEncounter ? '三案已结束，可返回普通生活；旁院交战由你另行选择。' : inEncounter && encounterComplete ? '旁院经历已经结束，原物、费用与实际结果保留；可返回普通生活。' : prose(next?.label ?? value.nextStep)}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {resources()}
    {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
    <nav aria-label="弑序亲王目标">
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
      <p>当周服药场地准备：{value.preparedWeek === null ? '未完成' : `第${value.preparedWeek}周已支付，取消不退款`}。可选择继续停留熵之公爵。</p>
    </> : inEncounter ? encounterFacts() : lifeFacts()}
    {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
    {cleanup.length > 0 && <section aria-label="停止与普通退出"><h3>停止与普通退出</h3>{cleanup.map(actionControl)}</section>}
    {alternatives.length > 0 && <details><summary>其他操作、普通替代与退出</summary>{alternatives.map(actionControl)}</details>}
    <details><summary>能力、消化与继承经历</summary>
      <p>当前保留{value.abilities.length}项能力，逐项沿用已经取得的掌握；本阶段新增能力从实际零掌握开始。</p><p>{prose(value.appearanceRecord)}</p><p>{prose(value.digestion)}</p><p>{prose(value.inheritedTools)}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{prose(entry)}</li>)}</ul>
      {value.abilities.map(ability => <section key={ability.id}><h3>{prose(ability.label)} · 掌握{ability.mastery}</h3><p>{prose(ability.description)}</p></section>)}
    </details>
    <details><summary>原投递房与普通退路</summary><p>{prose(value.environment)}</p><p>关闭页面不会代为停止、等待原球实际落下、收回辅助片、归还原物或步行离场；已付代价、原物变化与旧伤保留。</p></details>
    {confirmation && <section role="dialog" aria-modal="true" aria-label="弑序亲王操作确认" onKeyDown={event => {
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
      {live?.command.type === 'CONSUME' && <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备；失败保留已付代价。也可取消并继续停留熵之公爵。</p>}
      {resources()}{live?.reason && <p className="seer-action-reason">{prose(live.reason)}</p>}
      <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
      <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button>
      <p>取消不提交。关闭页面不能替代实际停止、交还原物和步行离场。</p>
    </section>}
  </section>;

  function lifeFacts() {
    const piece = life.pieces.find(entry => entry.caseId === selectedCase?.id);
    const currentScene = life.activeCase === selectedCase?.id;
    return <section aria-label="弑序亲王原场事务">
      <h3>{prose(selectedCase?.title ?? life.title)}</h3><p>{prose(selectedCase?.story ?? life.story)}</p>
      <p>{prose(life.environment)}</p>
      {selectedCase?.result && <p className="slice-notice">{prose(selectedCase.result)}</p>}
      <section aria-label="原成年协作者与原物的实际位置">
        <h4>原人与同一原物</h4>
        <p>本人实际在{LOCATION[life.playerLocation]}，累计普通步行{life.playerTravelMetres}米，原现场时钟{life.clockSeconds}秒。</p>
        <p>{prose(life.site.guide)}</p><p>{prose(life.site.volunteer)}</p>
        <p>{prose(life.site.parcel)}</p><p>{prose(life.site.ball)}</p><p>{prose(life.site.paper)}</p>
        <p>本阶段协作实际耗力{life.cooperationEffortSpent}，达里安实际消耗{life.volunteerMindSpent}精神；旧身体不凭晋升获得新的精力储备。</p>
        <ul aria-label="室内原垫保持原位">{life.site.pads.map((pad, index) => <li key={index}>{prose(pad)}</li>)}</ul>
      </section>
      <section aria-label="另行付费的新承接区">
        <h4>新承接区</h4>
        {life.annex ? <>
          <p>第{life.annex.boughtWeek}周实际支付{life.annex.paidPennies}便士，另购并放置新接球软垫；实地检查{life.annex.surface.inspections}次，垫上{life.annex.surface.people}人。</p>
          <p>室内两块原垫仍在原处；新软垫在室外近旁，须实际走到出手处与接球处。</p>
        </> : <p>尚未购入、放置新接球软垫，室内两块原垫不能充当此处设施。出门须从原门口普通走四米。</p>}
      </section>
      {selectedCase && <p>本案原物许可：{CONSENT[selectedCase.permission.OWNER]}；具体能力许可：{CONSENT[selectedCase.permission.ABILITY]}；本人协作许可：{CONSENT[selectedCase.permission.COOPERATION]}。每案分别询问，旧许可不复用。</p>}
      {piece ? <section aria-label="本案实际购入的有限支撑片">
        <h4>本案唯一支撑片</h4>
        <p>第{piece.boughtWeek}周实付{piece.paidPennies}便士购入{piece.quantity}件；当前{piece.location === 'HAND' ? '由本人持有' : piece.location === 'ANNEX' ? '在新承接区' : '已实际收回保管'}，累计随本人移动{piece.travelMetres}米。</p>
        <p>实际用量剩余{piece.charges}/1 · 实际磨损{piece.wear}；同一片用完不刷新，失败与停止不退已付代价。</p>
      </section> : <p>本案尚未购入支撑片。可以先查看、拒绝或撤回本次许可；普通操作按现场实际条件进行。</p>}
      {currentScene && life.pending && <section aria-label="本人待执行动作的有限强化">
        <h4>仍待本人执行的一次动作</h4>
        <p className="slice-notice">定向强化还剩{life.pending.remainingSeconds}秒，只对本人当前这一次尚未执行的投球增加35。仍须亲手投出原球；已经完成的投球不能重开。</p>
        <p>本次施术实际支付8灵性、2精神，失败总计损4精神。撤回、停止、遮挡、移动或到期会使未用加成失效，已付成本保留。</p>
      </section>}
      {currentScene && life.flight && <section aria-label="同一原球正在发生的有限轨迹">
        <h4>原球仍在实际飞行</h4>
        <p>同一原球从{LOCATION[life.flight.from] ?? prose(life.flight.from)}飞向{LOCATION[life.flight.to] ?? prose(life.flight.to)}，已经前进{life.flight.positionMetres}米，实际还需等待{life.flight.remainingSeconds}秒。</p>
        <p>{life.flight.maintenanceSeconds > 0 ? `这次未结束轨迹已实际延长${life.flight.maintenanceSeconds}秒，最多二十秒，不叠加、不刷新。` : '这次轨迹尚未延长，只能在仍未结束时付费尝试有限维持。'}</p>
        <p>停止或撤回只阻止新施术；已经投出的原球照常落地。仍须实际等待、步行到球旁取回，再亲交原物；页面停留不会自行计时。</p>
      </section>}
      {life.viewBlocked && <p className="slice-notice">当前视线已遮挡，须按现场实际条件恢复视线。</p>}
      {attempt && <section aria-label="弑序亲王本次实际尝试">
        <h4>本次结果与实际消耗</h4>
        <p>{attempt.method === 'ABILITY' ? '有限能力练习' : '普通投球与核对'}；{attempt.closed ? '本次现场已经收束' : '本次现场尚未收束'}。</p>
        {attempt.withdrawn && <p>本案许可已真实撤回，不能新施术；既有轨迹仍须实际等待、取回与归还，已付费用不退。</p>}
        <p>本次实耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.penniesSpent}便士；实际应用{attempt.appliedAbilityIds.length}项能力。</p>
        <p>本人实际走{attempt.playerTravelMetres}米，实际经过{attempt.elapsedSeconds}秒；本案协作耗力{attempt.cooperationEffortSpent}，达里安实际损耗{attempt.volunteerMindSpent}精神。</p>
        <p>本次能力尝试：{attempt.castTier ? TIER[attempt.castTier] : '尚未施术'}；原球实际投出：{attempt.throwTier ? TIER[attempt.throwTier] : '尚未投出'}。普通操作与失败收尾不冒充能力成功。</p>
        <p>实际强化增加{attempt.amplification}，同一未结束轨迹实际延长{attempt.maintenanceSeconds}秒；费用、投球记录和经过时间不能回滚。</p>
        <p>{attempt.thrown ? attempt.landed ? '同一原球已经实际落地，不能再投或改写首次结果。' : '同一原球已亲手投出，仍须等候落地。' : '本案尚未亲手投出原球。'}{attempt.verified ? '本人已经在球旁核对实际结果。' : '尚未在原球旁完成实际核对。'}</p>
        <p>{attempt.returned ? '原球与原纸已经当面归还。' : '原球与原纸尚未完成当面归还。'}{attempt.stopped ? '本次新输入已停止。' : ''}</p>
      </section>}
      <details><summary>实际现场记录与普通收尾</summary>
        <p>只处理本人当前明确、尚未执行的动作和仍未结束的有限效果。普通退出按真实位置、轨迹和原物归还情况开放，不返还费用、治疗旧伤或倒转时间。</p>
        <ul>{life.ledger.map((entry, index) => <li key={index}>第{entry.week}周：{prose(entry.label)}；{entry.actions}行动、{entry.pennies}便士、{entry.spirituality}灵性、{entry.mind}精神，实际经过{entry.seconds}秒{entry.outcome ? `；${TIER[entry.outcome]}` : ''}。</li>)}</ul>
      </details>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="弑序亲王独立旁院冲突">
      <h3>{prose(encounter.title)}</h3><p>{prose(encounter.story)}</p>
      {encounter.preparation && <p>第{encounter.preparation.week}周已实付{encounter.preparation.pricePaid}便士、{encounter.preparation.mindPaid}精神，购入本次独立护片；取消或离场不退款。</p>}
      {enemy && <section aria-label="独立对手当前身体与心智">
        <h4>{enemy.name} · {enemy.age}岁 · 序列{enemy.sequence}</h4>
        <p>健康{enemy.health} · 精神{enemy.mind} · 灵性{enemy.spirituality} · {ENEMY_STATUS[enemy.status]}。对手有独立身体、心智与抵抗。</p>
        <p>本人距离对手{enemy.distanceMetres}米；唯一手杖{enemy.weaponLocation === 'HAND' ? '仍由对手持有' : '实际留在旁院'}，伤亡和离场不复制原物。</p>
        <p>本次实际使用弧光{enemy.powerUses.ARC_BOLT}次、屏护{enemy.powerUses.WARD}次、凝神{enemy.powerUses.COMPOSE}次、精神施压{enemy.powerUses.MENTAL_PRESSURE}次。</p>
      </section>}
      {scene && <p>本人在{LOCATION[scene.playerLocation]}，达里安在{LOCATION[scene.darianLocation]}，米蕾在{LOCATION[scene.guideLocation]}。累计普通步行{scene.playerTravelMetres}米，原现场时钟{scene.clockSeconds}秒。普通出口开放，实际退出还须走{scene.exitMetres}米。</p>}
      <section aria-label="本次新护片与原赠物的实际余量">
        <h4>当前物资</h4>
        <p>本次独立护片剩余{encounter.supportPieces.filter(piece => piece.status === 'HELD').length}/{encounter.supportPieces.length}枚，实际磨损{encounter.supportPieces.reduce((total, piece) => total + piece.wear, 0)}；失败也消耗同一件，耗尽不补充。</p>
        <p>对手独立刻片剩余{encounter.enemyCharges.filter(piece => piece.status === 'HELD').length}/{encounter.enemyCharges.length}枚。</p>
        <p>本人仍持有{value.gifts.held}份原赠物，已经实际送出{value.gifts.given}份；同一件只能交出一次。</p>
      </section>
      <p>双方每轮最多{encounter.maxActionCount}次真实行动。定向强化只给本人下一次尚未结算的身体行动增加35；有限维持只为仍未结束的作用保留二十秒窗口，下一次适用冲击最多减少30。本次能力各实付8灵性、2精神与一件护片，失败总计损4精神。</p>
      {encounter.windows.length > 0 && <section aria-label="本次尚未用完的有限窗口"><h4>当前待用作用</h4>{encounter.windows.map(window => <p key={window.kind}>{window.kind === 'DIRECTED' ? '本人下一次身体行动的35加成' : '下一次适用冲击的至多30减轻'}，还剩{window.remainingSeconds}秒，只能实际应用{window.remaining}次；到期不退款。</p>)}</section>}
      <p>已结束的动作、原伤、费用和经过时间不能改写。原奥斯温仍留在旧房间投降，原人原物的经历保持不变。</p>
      <ul>{encounter.facts.map((fact, index) => <li key={index}>{prose(fact)}</li>)}</ul>
      <details><summary>对手实际行动盘</summary><ul>{encounter.enemyAbilityWheel.map(action => <li key={action.id}>{prose(action.label)} · 权重{action.weight}</li>)}</ul></details>
    </section>;
  }
}
