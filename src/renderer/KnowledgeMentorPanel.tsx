import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from 'react';
import type { KnowledgeMentorAction, KnowledgeMentorCommand, KnowledgeMentorProjection } from '../domain/knowledge-mentor/types';
import './seer-styles.css';

const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const LOCATION: Record<string, string> = { PLAYER: '本人随身', BENCH_START: '原台起点', BENCH_END: '原台终点', GUARD_MARK: '原一米护架标记', YARD: '独立工院', OWNER: '维拉处', CONTROL: '原控制槽', RECYCLE: '实际回收盘', RACK: '工坊原架', ROUTE: '原低载路线' };
const PERMISSION = { UNASKED: '尚未询问', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已撤回' } as const;
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' } as const;
const CASE_STATUS: Record<string, string> = { AVAILABLE: '尚未观察', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '待报告', RESOLVED: '已报告' };
const PLATE_STATUS: Record<string, string> = { BLANK: '原空白片', BOUND: '已绑定', INSTALLED: '已实际安装', FAILED: '绑定失败', READY: '已准备，可用一次', SPENT: '已耗尽，实物仍在' };
const PROGRAM_END = { NONE: '尚无结束记录', FAILED: '启动失败', COMPLETE: '三步已完成', STOPPED: '明确停止', EXPIRED: '真实窗口已到期', WITHDRAWN: '同意撤回，程序停止', CALIBRATED: '有限校准已停止当前受阻程序' } as const;
const ACQUISITION_TYPES = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'CONSUME']);
const ENCOUNTER_TYPES = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN_TYPES = new Set(['STOP_PROGRAM', 'WAIT_PROGRAM', 'MANUAL_STOP', 'COLLECT_PARCEL', 'RETURN_PARCEL', 'CLEAR_STOP_BAR', 'RECYCLE_PLATE', 'RETURN_ORIGINALS', 'MOVE', 'CLOSE', 'WITHDRAW', 'REVOKE_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM_TYPES = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'BUY_PLATE', 'BIND_PLATE', 'START_PROGRAM', 'PLACE_STOP_BAR', 'CALIBRATE', 'RECHARGE', 'PREPARE_COMBAT_PLATE', 'ENCOUNTER_FIGHT']);
const isReturn = (action: KnowledgeMentorAction) => RETURN_TYPES.has(action.command.type);
type Attempt = NonNullable<KnowledgeMentorProjection['life']['currentAttempt']>;
type Confirmation = { actionId: string; facts: string };

export interface KnowledgeMentorPanelProps {
  value: KnowledgeMentorProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: KnowledgeMentorCommand) => void;
  /** View navigation only. It does not stop a program, return originals, or leave the actual scene. */
  onClose?: () => void;
}

/** Renderer only displays committed public facts and submits the exact projected typed command. */
export function KnowledgeMentorPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: KnowledgeMentorPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const { life, encounter } = value;
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === 'PREPARED')
    ?? life.cases.find(entry => entry.id === caseId)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const attempt = life.currentAttempt ?? selectedCase?.attempts.at(-1) ?? null;
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id)) ?? value.bottles[0];
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type)
    && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id));
  const currentActions = encounter.inside ? encounterActions : value.promoted ? lifeActions : acquisitionActions;
  const nextAction = currentActions.find(action => action.enabled && action.command.type === 'CONSUME')
    ?? currentActions.find(action => action.enabled && !isReturn(action)) ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.actionId) : undefined;
  const confirmationCommand = liveConfirmation?.command;
  const confirmedBottle = confirmationCommand && 'bottleId' in confirmationCommand
    ? value.bottles.find(bottle => bottle.id === confirmationCommand.bottleId) : undefined;

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    // Never unlock from elapsed time or an error: the same submitted intent awaits its save receipt.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null);
      summaryHeading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) setConfirmation(null);
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation && error === null) {
      if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal();
      cancelButton.current?.focus();
    } else if (submitted.current === null && returnActionId.current) {
      (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
    }
  }, [confirmation, error]);

  function submit(action: KnowledgeMentorAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: KnowledgeMentorAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM_TYPES.has(action.command.type)) {
      returnActionId.current = action.id; setConfirmation({ actionId: action.id, facts });
    } else submit(action);
  }
  function actionList(actions: KnowledgeMentorAction[], title: string) {
    if (!actions.length) return null;
    return <div className="warrior-action-list" role="group" aria-label={title}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `knowledge-mentor-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`knowledge-mentor-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const r = value.resources;
    return r && <section className="seer-current-resources" aria-label="知识导师当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health} / {r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind} / {r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality} / {r.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>剩余行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function attemptFacts(entry: Attempt, key: number) {
    return <article key={key}>
      <h5>第{entry.week}周 · {entry.method === 'ABILITY' ? '能力准备' : '普通准备'} · {entry.withdrawn ? '已撤回收束' : entry.closed ? '已收束' : '尚未收束'}</h5>
      <p>{entry.result === 'ABILITY' ? '实际能力完成' : entry.result === 'ORDINARY' ? '普通方法完成' : '尚无完成结果'} · {entry.verified ? '已实际复核' : '尚未实际复核'}。</p>
      <p>原记录{entry.recordsRead ? '已实际读取' : '尚未读取'}；普通基准 {entry.baselines.map(sample => `第${sample.sample}次：${sample.transferSeconds}秒 / ${sample.openingMm}毫米 / 往返${sample.boxTravelMetres}米`).join('；') || '尚无'}。</p>
      <p>绑定{entry.bindCheck ? `：${TIER[entry.bindCheck.tier]}（${entry.bindCheck.roll}/${entry.bindCheck.chance}）` : '尚未尝试'}；启动{entry.runCheck ? `：${TIER[entry.runCheck.tier]}（${entry.runCheck.roll}/${entry.runCheck.chance}）` : '尚未尝试'}；校准{entry.calibrationCheck ? `：${TIER[entry.calibrationCheck.tier]}（${entry.calibrationCheck.roll}/${entry.calibrationCheck.chance}）` : '尚未尝试'}。</p>
      <p>三步完成 {entry.completedSteps}/3，其中程序实际执行 {entry.automaticSteps} 步；{PROGRAM_END[entry.programEnd]}。{entry.programActive && `当前窗口余${entry.programRemainingSeconds}秒。`}</p>
      <p>实耗 {entry.elapsedSeconds} 秒 · 本人步行 {entry.ownerTravelMetres} 米 · 原盒移动 {entry.boxTravelMetres} 米。</p>
      <p>已付 {entry.paidPennies} 便士、{entry.spiritualitySpent} 灵性 · 原盒储能−{entry.boxChargeSpent}、原架储能−{entry.frameChargeSpent}、原架耐久−{entry.frameDurabilityLost}。</p>
      <p>同一原包裹{entry.parcel.returned ? '已亲手归还' : entry.parcel.holder === 'KM2-VERA' ? '仍由维拉持有' : '仍须实际归还'} · 两原件{entry.originalsReturned ? '已亲手取回' : '尚无本次取回记录'}。</p>
      {entry.stepHistory.length > 0 && <ol>{entry.stepHistory.map((step, index) => <li key={index}>{step}</li>)}</ol>}
    </article>;
  }
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;
  const saveNotice = error !== null && <p className="slice-notice" role="alert">{playerText(typeof error === 'string' ? error : error.message)} 当前仍显示上次已保存记录。
    {typeof error !== 'string' && error.retryable === false ? '请按错误提示重新加载。' : '请在保存错误处重试同一原操作，勿重复付费、补能、施术或服药。'}</p>;

  return <section className="seer-panel warrior-panel knowledge-mentor-panel" aria-label={playerText("知识导师候选G")} aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="知识导师当前目标"><span className="seer-seal">{value.promoted ? playerText("知识导师候选G · 序列2") : playerText("奥秘学者3 → 知识导师候选G2")}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="slice-notice seer-risk"><strong>{playerText("本阶段开放有限工序。")}</strong>{playerText("晋升须取得独立成品并完成专业准备；工序的持续时间、成本与奖励见下方。")}</p>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ''}` : '查看已保存结果，或继续普通生活。'}</p><p>{value.digestion}</p>
    </section>
    {resources()}{pendingNotice}{saveNotice}

    {!value.promoted && selectedBottle && <section aria-label="知识导师独立原瓶"><h4>本次独立原瓶</h4>
      <label>选择本次原瓶<select aria-label="选择知识导师原瓶" disabled={locked || confirmation !== null} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p><p>{selectedBottle.source}</p>
      <p>{playerText("三项专业准备与当周场地检查是G支持，检查后仍须独立确认服用所选原瓶。")}</p>
    </section>}

    {value.promoted && <section aria-label="知识导师唯一原造物"><h4>两件真实原物</h4>
      {life.creations.length ? <dl className="seer-facts">{life.creations.map(original => <div key={original.id}>
        <dt>{original.kind === 'MESSENGER_BOX' ? '原小轮盒' : '原护架'} · {original.id}</dt>
        <dd>储能 {original.charge}/3 · 耐久 {original.durability}/100 · {LOCATION[original.location] ?? original.location} · {original.active ? '正在赋灵' : '已停用'}</dd>
      </div>)}</dl> : <p>当前无已保存原物；界面不生成替代件。</p>}
      <p>生活与战斗共用原制造记录。指定原物实付1行动、40便士、3灵性补至3储能，不修耐久；晋升、换页和退场均不补能。</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前知识导师生活情境">
      <label>查看生活情境<select aria-label="选择知识导师生活情境" disabled={locked || life.insideCase || confirmation !== null} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.preparation && <p>{selectedCase.preparation}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p>{life.workbenchId} · 本人当前在{LOCATION[life.ownerNode] ?? life.ownerNode}。两端相距2米；以下仅为已保存的真实步骤，不随屏幕等待自行计时。</p>
      <ol><li>原架打开既有17毫米开口，2秒</li><li>原盒沿原路线移动2米，8秒</li><li>原架关闭，2秒</li></ol>
      <p>须先读原制造记录并亲手做两次普通基准；每案只绑定一次、启动一次。失败仍付原成本，可普通接管。停止、到期与关闭页面均不自动归还原物。</p>
      {selectedCase.id === 'consented-transfer' && <section aria-label="维拉两份独立当前许可"><h4>维拉 · 39岁 · KM2-VERA</h4>
        <dl className="seer-facts"><div><dt>PROGRAM · 本次程序许可</dt><dd>{life.currentAttempt && !life.currentAttempt.closed ? PERMISSION[life.currentAttempt.programPermission] : '当前无生效许可，旧记录不延续'}</dd></div>
          <div><dt>PARCEL · 本次原包裹交接许可</dt><dd>{life.currentAttempt && !life.currentAttempt.closed ? PERMISSION[life.currentAttempt.parcelPermission] : '当前无生效许可，旧记录不延续'}</dd></div></dl>
        <p>两份许可分别询问，拒绝或撤回后本次不重新同意；旧海伦娜与内尔的许可不沿用。撤回会停止程序，已借原包裹仍需亲手归还。</p>
        {attempt && <p>{attempt.parcel.id} · 所有人{attempt.parcel.owner} · 当前由{attempt.parcel.holder === 'KM2-VERA' ? '维拉' : attempt.parcel.holder === 'PLAYER' ? '本人' : '唯一原盒'}持有 · {LOCATION[attempt.parcel.location]}。{attempt.parcel.delivered ? '已实际送达终点。' : '尚无实际送达记录。'}{attempt.parcel.returned ? '已亲手归还。' : '送达不等于归还。'}</p>}
      </section>}
      {attempt && <section aria-label="本次原片与实际工序"><h4>原指令片与有限窗口</h4>
        {attempt.plate ? <><p>{attempt.plate.id} · {PLATE_STATUS[attempt.plate.status]} · {LOCATION[attempt.plate.location]} · 已付{attempt.plate.paidPennies}便士。</p><p>{attempt.plate.source}</p><p>绑定原件：{attempt.plate.boundObjectIds.join('、') || '尚未绑定'}。</p></> : <p>本次尚无实际取得的原指令片。</p>}
        <p>{attempt.programActive ? `当前程序仍在持续，剩余${attempt.programRemainingSeconds}/45秒。` : `当前无持续程序。${PROGRAM_END[attempt.programEnd]}。`}三步完成{attempt.completedSteps}/3，其中程序执行{attempt.automaticSteps}步。</p>
        {selectedCase.id === 'blocked-cycle' && <><p>{attempt.stopBar.id} · {LOCATION[attempt.stopBar.location]} · {attempt.stopBar.triggered ? '已真实触发阻挡' : '尚未触发'} · {attempt.stopBar.loadRunning ? '低载荷仍运行，必须停机' : '低载荷未运行'}。</p>
          <p>原架已损耐久{attempt.frameDurabilityLost}。有限校准只停当前受阻程序；失败用原手柄。拆回挡条、完成剩余步骤与取回原物仍需实际动作。</p></>}
        {attemptFacts(attempt, 0)}
      </section>}
    </section>}

    <section aria-label="知识导师当前可用行动"><h4>{encounter.inside ? '原工院当前行动' : value.promoted ? '当前原场行动' : '取得、准备与服用'}</h4>
      {actionList(currentActions.filter(action => !isReturn(action)), '知识导师推进操作')}
      {currentActions.some(isReturn) && <section aria-label="停止、撤回与普通返回"><h4>停止、撤回与实际返回</h4>{actionList(currentActions.filter(isReturn), '知识导师停止归还操作')}</section>}
      <p className="slice-muted">关闭页面只隐藏视图；请用以上实际停止、归还与退场行动收束现场。每个按钮遵循当前公开条件。</p>
    </section>

    {value.promoted && <details className="seer-fold"><summary>有限战斗指令片与付费补能记录</summary>
      <h4>战斗原片：已实际尝试 {life.combatPlates.length}/3</h4>
      <p>生活完成后可另行准备，最多三次。每次1行动、60便士、4灵性，知识18；成功才有一张READY原片，失败进实际回收盘。战斗封装尝试即耗原片、5灵性与两原件各1储能，失败也消耗。</p>
      {life.combatPlates.length ? life.combatPlates.map(plate => <article key={plate.id}><h5>{plate.id} · {PLATE_STATUS[plate.status]}</h5>
        <p>第{plate.createdWeek}周 · {TIER[plate.check.tier]}（{plate.check.roll}/{plate.check.chance}） · {LOCATION[plate.location]} · 已付{plate.actionsSpent}行动、{plate.paidPennies}便士、{plate.spiritualitySpent}灵性。</p>
        <p>{plate.source}</p><p>仅绑定 {plate.boundObjectIds.join('、')}。{plate.spentRevision !== null ? '已有真实战斗消耗记录。' : '尚无真实战斗消耗记录。'}</p>
      </article>) : <p>尚无本阶战斗原片准备记录，晋升不赠送原片。</p>}
      <h4>本阶实际补能</h4>{life.recharges.length ? life.recharges.map(entry => {
        const before = entry.before.find(original => original.id === entry.objectId), after = entry.after.find(original => original.id === entry.objectId);
        return <p key={entry.id}>第{entry.week}周 · {entry.objectId} · 耗材{entry.materialId} · 已付{entry.actionsSpent}行动、{entry.paidPennies}便士、{entry.spiritualitySpent}灵性。储能{before?.charge ?? '未公开'}→{after?.charge ?? '未公开'}，耐久{before?.durability ?? '未公开'}→{after?.durability ?? '未公开'}。{entry.source}</p>;
      }) : <p>尚无本阶实际补能记录。</p>}
      {life.creations.map(original => <p key={original.id}>{original.id}：{original.source}；第{original.manufacturedWeek}周亲手制造，原部件{original.componentIds.join('、')}。</p>)}
    </details>}

    {value.promoted && encounter.enemy && <details className="seer-fold" open={encounter.inside}><summary>罗温原人的可选冲突与普通出口</summary>
      <section aria-label="知识导师原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
        <p>{encounter.enemy.name} · {encounter.enemy.age}岁 · {encounter.enemy.id}{playerText(" · 本场G序列")}{encounter.enemy.sequence}等效。</p>
        <p>健康{encounter.enemy.health} · 精神{encounter.enemy.mind} · 独立灵性{encounter.enemy.spirituality} · {encounter.enemy.status === 'DEAD' ? '已真实死亡' : encounter.enemy.status === 'SURRENDERED' ? '已投降，仍是原人' : '仍有独立意志'}。</p>
        <p>唯一原棍 {encounter.enemy.weaponId} · {encounter.enemy.weaponLocation === 'HAND' ? '仍在本人手中' : '留在原院'}。</p>
        <p>对方实际施术：弧光{encounter.enemy.powerUses.ARC_BOLT}次、护术{encounter.enemy.powerUses.WARD}次、干扰{encounter.enemy.powerUses.JAM}次。各用其独立灵性，不因退场恢复。</p>
        <p>本场封装实际尝试{encounter.protocolUses}次，成功{encounter.protocolSuccesses}次；校准实际尝试{encounter.calibrationUses}次，成功{encounter.calibrationSuccesses}次，其中后续原造物实际受益{encounter.calibrationEffects}次；本人精神实耗{encounter.totalOwnerMindSpent}。</p>
        <p>实际携入原物：{encounter.carriedIds.join('、') || '尚无'}；实际携入原片：{encounter.carriedPlateIds.join('、') || '尚无'}。</p>
        <p>已实际取回原物：{encounter.retrievedIds.join('、') || '尚无'}；已实际取回原片：{encounter.retrievedPlateIds.join('、') || '尚无'}。普通退场已走{encounter.exitTravelMetres}米、实耗{encounter.exitSeconds}秒。</p>
        <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>先交谈，再明确选择开战或和平离开。活着离场须本人步行原出口4米、4秒并带回实际携入原物和原片；死亡原物留场。旧奥斯里克与科尔温分别保留原结局。</p>
        {!encounter.inside && actionList(encounterActions, '知识导师可选遭遇行动')}
      </section>
    </details>}

    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{value.story}</p><p>{value.supplies}</p><p>{value.risk}</p>
      <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{preparation.title}：{preparation.completedWeek === null ? '尚未实际完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
      <p>当周场地检查：{value.preparedWeek === null ? '尚无本次准备' : `第${value.preparedWeek}周`}。须实际晋3后12整周与奥秘学者消化100，三项专业准备完成；本次场地准备另付1行动120便士。</p>
      {value.bottles.map(bottle => <article key={bottle.id}><h5>{bottle.title}</h5><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
    </details>
    {value.promoted && <details className="seer-fold"><summary>三项实践、实际尝试与掌握</summary>
      <p>{life.source}</p><p>{life.environment}</p>
      {life.cases.map(entry => <article key={entry.id}><h4>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</h4>
        <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        {entry.result && <p>{entry.result}</p>}{entry.attempts.map(attemptFacts)}
      </article>)}
      <h4>真实掌握记录</h4>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握{ability.mastery}：{ability.description}</p>)}
      <p>掌握0不表示从未尝试，也不否认已付成本；具体检定、失败、抵抗与普通接管见实际记录。普通完成可消化，不奖励能力成功掌握。</p>
    </details>}
    <details className="seer-fold"><summary>原身体、旧园地与旧人记录</summary>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
      <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul><p>{value.environment}</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || value.insideCase || confirmation !== null} onClick={() => { if (!locked && !value.insideCase && !confirmation) onClose(); }}>关闭知识导师页面</button>}

    {confirmation && error === null && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="knowledge-mentor-confirm-title" aria-describedby="knowledge-mentor-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={event => { event.preventDefault(); if (!locked) setConfirmation(null); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <h3 id="knowledge-mentor-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次实际消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '公开条件已经改变，请返回查看最新记录。'}</p><p id="knowledge-mentor-confirm-cost">本次：{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p>
        {liveConfirmation?.command.type === 'CONSUME' && <><p>当前成功率{confirmedBottle.chance}%。本次准备：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p><p className="slice-notice seer-risk">{value.risk}</p>
          <p>{playerText("成功或失败都会耗尽这一原瓶与当次准备；当前灵性不补满、原物不充能不修复，旧伤、旧园与旧人结局保留。本阶身份映射及专业支持均G，原著配方与仪式未知。")}</p></>}
      </>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <p className="slice-notice seer-risk">这是与同一罗温原身体的真实战斗，会产生伤势、投降或不可逆死亡。沿用现有伤势与累计风险，生命回满不等于旧伤已治疗；不借用其他途径复活。可取消后选择普通离开。</p>}
      {liveConfirmation && ['BUY_PLATE', 'BIND_PLATE', 'START_PROGRAM', 'CALIBRATE', 'PREPARE_COMBAT_PLATE'].includes(liveConfirmation.command.type) && <p>只使用本次真实原片、原盒和原架。检定可能失败，实付消耗不会返还或重骰；普通接管、停止与实际归还仍按公开步骤进行。战斗片最多三次准备，每张只用一次。</p>}
      {liveConfirmation?.command.type === 'PLACE_STOP_BAR' && <p className="slice-notice seer-risk">本人放置工坊原挡条；后续原第二步将真实受阻并损失原架5耐久，必须停机后亲手拆回。有限校准不修耐久。</p>}
      {liveConfirmation?.command.type === 'RECHARGE' && <p>仅给所选随身原件付费补至3储能；耗材真实耗尽，不修复耐久。</p>}
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancelButton} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交；提交后等待同一保存回执，失败时保留原意图，不重复消费。</p>{pendingNotice}{saveNotice}
    </dialog>}
  </section>;
}
