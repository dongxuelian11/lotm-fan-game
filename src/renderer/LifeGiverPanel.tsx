import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from 'react';
import type { LifeGiverAction, LifeGiverCommand, LifeGiverProjection } from '../domain/life-giver/types';
import './seer-styles.css';

const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const LOCATION: Record<string, string> = {
  HOME: '原玻璃暖房', YARD: '原小石院', PATH: '原30米普通小径', PLAYER: '本人随身',
  OWNER: '米拉本人处', 'LG2-MIRA41': '米拉本人处', START: '原搬运起点', TABLE: '2米外原桌', RETURN_TRAY: '实际归还托盘',
};
const CONSENT = { UNASKED: '本次尚未当面询问', GRANTED: '当前同意本次有限任务', DECLINED: '已拒绝', REVOKED: '本次同意已撤回', CLOSED: '本次许可已结束' } as const;
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' } as const;
const ENCOUNTER_STATUS = { AVAILABLE: '尚未接触', READY: '已交谈，尚未开战', FIGHTING: '真实交战中', RESOLVED: '本场已结束', RETREATED: '本人已实际撤离', LOST: '本人已死亡，原物留场' } as const;
const CASE_STATUS: Record<string, string> = { AVAILABLE: '尚未观察', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '待报告', RESOLVED: '已报告' };
const SHELTER = { NONE: '尚未尝试', ACTIVE: '窗口仍生效', FAILED: '尝试失败', APPLIED: '已实际分担一次', STOPPED: '已停止', EXPIRED: '实际窗口已到期' } as const;
const PAPER_STATUS = { HELD: '实际持有，尚未准备', PREPARED: '已明确准备', CONSUMED: '已真实耗尽' } as const;
const ACQUISITION_TYPES = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'CONSUME']);
const ENCOUNTER_TYPES = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER', 'SET_GUEST_POLICY']);
const PAPER_TYPES = new Set(['BUY_PAPERS', 'PREPARE_PAPER']);
const RETURN_TYPES = new Set(['STOP_SHELTER', 'WAIT', 'REVOKE_CONSENT', 'REVOKE_OWNER', 'CARRY_TOKEN', 'CLEAR_PATH', 'RETURN_TOKEN', 'RETURN_GUEST', 'RETURN_PLAYER', 'RETURN_BEADS', 'INSPECT', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM_TYPES = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'VITALITY', 'SHELTER', 'PREPARE_BATTLE_BEAD', 'BUY_PAPERS', 'PREPARE_PAPER', 'REST_GUEST', 'ENCOUNTER_FIGHT']);
const isReturn = (action: LifeGiverAction) => RETURN_TYPES.has(action.command.type);
const needsConfirmation = ({ command }: LifeGiverAction) => CONFIRM_TYPES.has(command.type)
  || command.type === 'PREPARE' && command.method === 'ABILITY'
  || command.type === 'SET_GUEST_POLICY' && command.policy === 'ASK_HELP';
type Attempt = NonNullable<LifeGiverProjection['life']['currentAttempt']>;
type Bead = LifeGiverProjection['life']['beads'][number];
type Confirmation = { actionId: string; facts: string };

export interface LifeGiverPanelProps {
  value: LifeGiverProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: LifeGiverCommand) => void;
  /** View navigation only; never returns an original, ends consent, or leaves an actual scene. */
  onClose?: () => void;
}

/** Public committed facts only. Every submitted command is the exact currently projected intent. */
export function LifeGiverPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: LifeGiverPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
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
  const partner = life.partner;
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === 'PREPARED')
    ?? life.cases.find(entry => entry.id === caseId)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const attempt = life.currentAttempt ?? selectedCase?.attempts.at(-1) ?? null;
  const currentAttempt = life.currentAttempt && !life.currentAttempt.closed ? life.currentAttempt : null;
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles.find(bottle => value.actions.some(action => 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const selectedPaper = life.inheritedPapers.find(paper => paper.id === paperId && paper.status === 'HELD')
    ?? life.inheritedPapers.find(paper => paper.status === 'HELD');
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const paperActions = value.actions.filter(action => PAPER_TYPES.has(action.command.type)
    && (action.command.type !== 'PREPARE_PAPER' || action.command.paperId === selectedPaper?.id));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type) && !PAPER_TYPES.has(action.command.type)
    && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id));
  const currentActions = encounter.inside ? encounterActions : value.promoted ? lifeActions : acquisitionActions;
  const nextAction = currentActions.find(action => action.enabled && action.command.type === 'CONSUME')
    ?? currentActions.find(action => action.enabled && !isReturn(action)) ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.actionId) : undefined;
  const confirmationCommand = liveConfirmation?.command;
  const confirmedBottle = confirmationCommand && 'bottleId' in confirmationCommand
    ? value.bottles.find(bottle => bottle.id === confirmationCommand.bottleId) : undefined;
  const selectedBeads = life.beads.filter(bead => bead.purpose === 'LIFE' && bead.caseId === selectedCase?.id);
  const combatBeads = life.beads.filter(bead => bead.purpose === 'COMBAT');

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    // Only a changed committed projection clears the submitted intent. Error and time never do.
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

  function submit(action: LifeGiverAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: LifeGiverAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (needsConfirmation(action)) {
      returnActionId.current = action.id; setConfirmation({ actionId: action.id, facts });
    } else submit(action);
  }
  function actionList(actions: LifeGiverAction[], title: string) {
    if (!actions.length) return null;
    return <div className="warrior-action-list" role="group" aria-label={title}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `life-giver-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`life-giver-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const r = value.resources;
    return r && <section className="seer-current-resources" aria-label="创生者当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health} / {r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind} / {r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality} / {r.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>剩余行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function beadFacts(bead: Bead) {
    return <article key={bead.id}><h5>{bead.id} · {bead.status === 'READY' ? '尚未消耗' : '已耗尽，仍是同一实物'}</h5>
      <p>第{bead.preparedWeek}周实付{bead.paidPennies}便士 · {LOCATION[bead.location] ?? bead.location} · {bead.purpose === 'COMBAT' ? '独立战斗原珠' : '本情境生活原珠'}。</p>
      <p>{bead.spentWeek === null ? '尚无实际消耗记录。' : `第${bead.spentWeek}周已实际消耗${bead.combatRound === null ? '' : `，战斗第${bead.combatRound}回合`}。`}
        {bead.abilityId && `用于${bead.abilityId === 'moon.s2.bounded-vitality' ? '有限活性支持' : '有限共同庇护'}；消耗本身不等于成功。`}</p>
      <p>{bead.source}</p>
    </article>;
  }
  function attemptFacts(entry: Attempt, index: number) {
    return <article key={index}><h5>第{entry.week}周 · {entry.method === 'ABILITY' ? '能力准备' : '普通准备'} · {entry.closed ? '现场已实际收束' : '现场尚未收束'}</h5>
      <p>当次来客许可：{CONSENT[entry.consent]}；物主许可：{entry.ownerConsent ? '已取得本次同意' : '当前无同意'}。{entry.revoked && '本次留有明确撤回记录。'}</p>
      <p>{entry.visited ? '本人已实际到原居处。' : '尚未实际拜访原居处。'}{entry.arrived ? '同一原身体已沿普通小径到院。' : '尚无本次原身体到院记录。'}
        {entry.originChecked ? '已实际核对原身体、原声片及生死。' : '尚无本次原人来源核对记录。'}</p>
      <p>活性支持：{entry.vitalityTier === null ? '尚未尝试' : TIER[entry.vitalityTier]}；实际恢复精力{entry.vitalityRestored}。
        共担：{entry.shelterTier === null ? '尚未尝试' : TIER[entry.shelterTier]}；{entry.shelterApplied ? '已在真实搬运中应用一次' : '尚无实际分担效果'}。</p>
      <p>当前共担记录：{SHELTER[entry.shelterStatus]}{entry.shelterStatus === 'ACTIVE' ? `，剩余${entry.shelterRemainingSeconds}/15秒` : ''}。成功建立窗口与实际应用分别记录。</p>
      <p>流灯实际搬运{entry.guestTrips}程 · {entry.ordinaryCompleted ? '本人已完成普通搬运' : '尚无本人普通搬运完成记录'}。
        原牌{entry.tokenDelivered ? '已到原桌' : '尚无送达记录'}、{entry.tokenBack ? '已回起点' : '尚无回起点记录'}、{entry.tokenReturned ? '已交回物主' : entry.tokenTaken ? '仍须实际归还' : '本次尚未借出'}。</p>
      <p>实耗{entry.elapsedSeconds}秒 · 本人普通步行{entry.playerTravelMetres}米 · 来客普通移动{entry.guestTravelMetres}米。
        实耗灵性{entry.spiritualitySpent}、来客精力{entry.guestStaminaSpent}、本人健康{entry.playerHealthSpent}。</p>
      <p>同一身体入场前：健康{entry.guestBefore.health}、精神{entry.guestBefore.mind}、精力{entry.guestBefore.stamina}，在{LOCATION[entry.guestBefore.location]}。
        {entry.guestAfter ? `收束时：健康${entry.guestAfter.health}、精神${entry.guestAfter.mind}、精力${entry.guestAfter.stamina}，在${LOCATION[entry.guestAfter.location]}。` : '尚无本次收束后的身体快照。'}</p>
      <p>{entry.obstructionObserved ? '已经实际观察原遮板阻挡。' : '尚无本次阻挡观察记录。'}{entry.cleared ? '已亲手清开原路。' : ''}
        来客{entry.guestReturned ? '已实际回原居处' : entry.arrived ? '尚未完成本次普通返程' : '本次未到院，不伪造返程记录'}；{entry.inspected ? '已完成原人原物最终检查' : '尚未完成最终检查'}。</p>
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="创生者原人遭遇"><h4>{encounter.title}</h4>
      <p>本场进展：{ENCOUNTER_STATUS[encounter.status]} · 本人当前在{encounter.playerLocation === 'YARD' ? '本场独立石院内' : '本场原院外'}。</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场原创G序列")}{enemy.sequence}等效 · 原身体体质{enemy.physique}。</p>
        <dl className="seer-facts"><div><dt>对方健康</dt><dd>{enemy.health} / 100</dd></div><div><dt>对方精神</dt><dd>{enemy.mind} / 100</dd></div>
          <div><dt>对方独立灵性</dt><dd>{enemy.spirituality} / 120</dd></div><div><dt>原人状态</dt><dd>{enemy.status === 'DEAD' ? '已经真实死亡' : enemy.status === 'SURRENDERED' ? '已投降停止抵抗' : '仍有独立意志'}</dd></div></dl>
        <p>唯一原棍{enemy.weaponId} · {enemy.weaponLocation === 'HAND' ? '仍在对方本人手中' : '留在本场原院'}。
          实际施术：暗矢{enemy.powerUses.DARK_BOLT}次、护术{enemy.powerUses.WARD}次、干扰{enemy.powerUses.JAM}次。</p>
      </>}
      <section className="slice-notice" aria-label="流灯本场当前许可"><h4>本场是否邀请同一流灯</h4>
        <p>已保存选择：{encounter.guestPolicy === 'HOME' ? 'HOME · 留在原居处' : 'ASK_HELP · 请求本场自愿帮助'}。
          {encounter.guestPermit ? encounter.inside ? '本场许可仍有效，施术须另满足身体与资源条件。' : '本场许可只作历史记录，不延续到新场景。' : '当前没有本场援助许可。'}</p>
        {encounter.guestPermit && <p>原许可对象{encounter.guestPermit.partnerId} · 第{encounter.guestPermit.paidWeek}周实付{encounter.guestPermit.paidPence}便士 · 本次当面协商实走{encounter.guestPermit.negotiationTravelMetres}米、{encounter.guestPermit.negotiationSeconds}秒。</p>}
        <p>本场已实际拜访协商{encounter.invitationVisits}次。旧生活与埃德温许可不沿用；取得许可本身不召唤、不恢复来客。
          当前原身体{encounter.partner.bodyId}在{LOCATION[encounter.partner.location]}，精力{encounter.partner.stamina}/100、精神{encounter.partner.mind}/100。</p>
        <p>当前原门：{encounter.gateOpen ? '仍开启' : '未开启或已关闭'}；当前共担链：{encounter.shelterOpen ? '仍有待应用的窗口' : '没有仍生效的窗口'}。以上是已保存状态，轮中曾经成功或失败另按实际结果记录。</p>
        <p>门或链失效不删除身体。活着的同一来客在每轮末按约走30米普通原路回HOME；死亡则同体和原声片留YARD，不补发来客。</p>
      </section>
      <section aria-label="创生者战斗实际尝试与效果"><h4>尝试、成功与实际分担分别记账</h4>
        <p>活性支持实际尝试{encounter.vitalityUses}次，成功{encounter.vitalitySuccesses}次，实际恢复原来客精力共{encounter.staminaRestored}。</p>
        <p>共担实际尝试{encounter.shelterUses}次，成功开启{encounter.shelterSuccesses}次，其中实际应用{encounter.shelterEffects}次、被干扰打断{encounter.shelterBroken}次。
          本人因实际分担已耗健康{encounter.totalPlayerHealthSpent}。</p>
        <p>{playerText("共担成功建立后，只有后续真实成功合作才应用：流灯耗精力8→3，本人健康−5，并产生本场G额外减势20。仅开出窗口不算实际分担；本场记录不额外授予生活实践掌握。")}</p>
        <p>本场原珠{encounter.combatBeads.length}粒，其中仍在本人随身且尚未消耗{encounter.combatBeads.filter(bead => bead.status === 'READY' && bead.location === 'PLAYER').length}粒、已耗尽{encounter.combatBeads.filter(bead => bead.status === 'SPENT').length}粒。</p>
        <p>已实际取回原珠：{encounter.retrievedBeadIds.join('、') || '尚无取回记录'}。普通出口实走{encounter.exitTravelMetres}米、{encounter.exitSeconds}秒；累计已结算战斗时间{encounter.elapsedCombatSeconds}秒。</p>
      </section>
      <details className="seer-fold"><summary>本场范围、普通退路与实际代价</summary><p>{encounter.story}</p>
        <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>先交谈，再明确开战或和平离开。生还按本场开放出口实际步行4米、4秒并带回原珠；死亡按原位置留下身体与原物。旧埃德温、旧多里安与他们的原棍分别保留。</p>
      </details>
    </section>;
  }
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;
  const saveNotice = error !== null && <p className="slice-notice" role="alert">{playerText(typeof error === 'string' ? error : error.message)} 当前仍显示上次已保存记录。
    {typeof error !== 'string' && error.retryable === false ? '请按错误提示重新加载。' : '请在保存错误处重试同一原操作，勿重复付费、施术、邀请、还物或服药。'}</p>;

  return <section className="seer-panel warrior-panel life-giver-panel" aria-label="创生者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="创生者当前目标"><span className="seer-seal">{value.promoted ? '创生者 · 月亮序列2' : '召唤大师3 → 创生者2'}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="slice-muted">{playerText("创生者2、美神1名称已核实。完整配方、原著仪式与具体新能力未知；本页新规则均为原创G。本阶不改变性别。")}</p>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ''}` : '查看已保存结果，或继续普通生活。'}</p><p>{value.digestion}</p>
    </section>
    {resources()}{pendingNotice}{saveNotice}

    {!value.promoted && selectedBottle && <section aria-label="创生者独立原瓶"><h4>本次独立原瓶</h4>
      <label className="seer-case-selector">选择本次原瓶<select aria-label="选择创生者原瓶" disabled={locked || confirmation !== null} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p><p>{selectedBottle.source}</p>
      <p>本次场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。付费取得、场地准备与服药各自确认；买到原瓶不等于已服用。</p>
    </section>}

    {value.promoted && <section aria-label="创生者原来客当前身体"><h4>{partner.name} · 同一原身体</h4>
      <p>{partner.id} · {partner.bodyId} · {partner.status === 'DEAD' ? '已经真实死亡，原身体留在实际位置' : '仍活着，有独立意识'}。</p>
      <dl className="seer-facts"><div><dt>健康</dt><dd>{partner.health} / 100</dd></div><div><dt>精神</dt><dd>{partner.mind} / 100</dd></div>
        <div><dt>精力</dt><dd>{partner.stamina} / 100</dd></div><div><dt>当前原身体位置</dt><dd>{LOCATION[partner.location]}</dd></div>
        <div><dt>当前意愿</dt><dd>{partner.willing ? '愿意协商，仍须当次许可' : '当前不愿合作'}</dd></div>
        <div><dt>本次生活许可</dt><dd>{currentAttempt ? CONSENT[currentAttempt.consent] : '没有生效中的生活许可'}</dd></div></dl>
      <p>原声片{partner.chime.id}归{partner.chime.owner}所有，随原身体保管。{partner.metWeek === null ? '尚无实际见面记录。' : `第${partner.metWeek}周已见过本人。`}</p>
      <p>有限支持只作用于这位现存来客的实际疲劳；成功至多恢复12精力。生命、精神、旧伤、死亡与原声片不会被晋升或支持复原。</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前创生者生活情境">
      <label className="seer-case-selector">查看生活情境<select aria-label="选择创生者生活情境" disabled={locked || life.insideCase || confirmation !== null} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>已保存准备：{selectedCase.method === 'ABILITY' ? '能力方法，两粒不同的60便士原珠' : '普通方法'}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p>本人在{LOCATION[life.playerLocation]} · 本阶本人累计步行{life.playerTravelMetres}米、实际经过{life.clockSeconds}秒。
        原居处与小院相距30米；本次原桌距起点2米。屏幕等待不推进现场秒数。</p>
      {currentAttempt && <p>{currentAttempt.arrived && !currentAttempt.guestReturned ? `流灯在本次搬运路线的${currentAttempt.guestOffsetMetres === 2 ? '原桌端，距起点2米' : '起点端'}。` : `流灯原身体当前在${LOCATION[partner.location]}。`}
        {currentAttempt.shelterStatus === 'ACTIVE' ? `当前共担窗口余${currentAttempt.shelterRemainingSeconds}/15秒。` : `当前共担：${SHELTER[currentAttempt.shelterStatus]}。`}</p>}
      <section aria-label="米拉本次许可与原借物"><h4>{life.owner.name} · {life.owner.age}岁 · {life.owner.id}</h4>
        <p>物主本次许可：{currentAttempt?.ownerConsent ? '当前已明确同意' : '当前没有生效的物主许可'}。来客同意与物主同意分开取得，旧艾达许可不沿用。</p>
        <p>唯一原牌{life.token.id} · 所有人{life.token.owner} · {life.token.massGrams}克。</p>
        <p>实际保管：{LOCATION[life.token.custodian] ?? life.token.custodian} · 位置：{LOCATION[life.token.location]}。送达原桌、搬回起点和交回米拉分别记录。</p>
      </section>
      <section aria-label="有限支持与普通返程"><h4>真实成本、窗口与普通退路</h4>
        <p>活性支持：每案一次，6灵性与一粒原珠，知识18；有实际疲劳、原身体在旁且当前同意才可尝试，失败也付成本。</p>
        <p>共同庇护：每案一次，4灵性与另一粒原珠，知识18；成功开15秒窗口。
          下一次真实2米低载搬运才使流灯耗精力8→3，并让本人实扣5健康；未应用不会扣这5健康或增加成功掌握。</p>
        <p>当前原遮板{life.shutter.id}：{life.shutter.location === 'LOWERED' ? '已放下，原路受阻' : '已抬起，原路开放'}。
          撤回、阻路、停止、返程或到期都会终止窗口；不会删除已经到场的身体。</p>
        <p>普通归还同一原牌，已到院的活来客沿30米原路送回HOME、本人回院，并把原珠实物交回托盘后才能收束。死亡原身体与原声片留在实际位置，不移动或复活；耗尽的原珠仍须归还。</p>
      </section>
      {attempt && <details className="seer-fold" open={life.insideCase}><summary>本次实际尝试、效果与已付成本</summary>{attemptFacts(attempt, 0)}</details>}
      {selectedBeads.length > 0 && <details className="seer-fold"><summary>本情境逐粒原珠与实际去向</summary>{selectedBeads.map(beadFacts)}</details>}
    </section>}

    {value.promoted && encounter.inside && encounterFacts()}
    <section aria-label="创生者当前可用行动"><h4>{encounter.inside ? '当前原人遭遇行动' : value.promoted ? '当前原场行动' : '取得、准备与服用'}</h4>
      {currentActions.length ? actionList(currentActions.filter(action => !isReturn(action)), '创生者推进操作') : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {currentActions.some(isReturn) && <section aria-label="停止、撤回与普通返回"><h4>停止、普通接管与实际归还</h4>{actionList(currentActions.filter(isReturn), '创生者停止归还操作')}</section>}
      <p className="slice-muted">按钮只提交当前公开操作。关闭页面只隐藏视图，不能代替停止、归还和普通返回。</p>
    </section>

    {value.promoted && <details className="seer-fold"><summary>战前独立原珠与继承原纸</summary>
      <h4>独立战斗原珠 · 已实际准备{combatBeads.length}/3粒</h4>
      <p>生活完成后最多另付费准备三粒，每粒1行动、60便士。每粒只用一次；实际尝试即耗该原珠，成功与否另记。
        活着离场带回剩余和耗尽实物，死亡时按真实位置留场。</p>
      {combatBeads.length ? combatBeads.map(beadFacts) : <p>尚无战斗原珠准备记录，晋升不赠送。</p>}
      <h4>沿用旧巫王唯一原纸</h4>
      <p>未准备{life.inheritedPapers.filter(paper => paper.status === 'HELD').length}张 · 已准备{life.inheritedPapers.filter(paper => paper.status === 'PREPARED').length}张 · 已耗尽{life.inheritedPapers.filter(paper => paper.status === 'CONSUMED').length}张。</p>
      <ul>{life.inheritedPapers.map(paper => <li key={paper.id}>{paper.id} · {PAPER_STATUS[paper.status]} · {paper.source}</li>)}</ul>
      <p>持有原纸不等于已准备；新阶段不会复制纸张、恢复旧消耗或把旧纸自动变成战备。</p>
      {selectedPaper && <label className="seer-case-selector">选择未准备原纸<select aria-label="选择创生者继承原纸" value={selectedPaper.id} disabled={locked || confirmation !== null} onChange={event => setPaperId(event.target.value)}>
        {life.inheritedPapers.filter(paper => paper.status === 'HELD').map(paper => <option key={paper.id} value={paper.id}>{paper.id}</option>)}
      </select></label>}
      {actionList(paperActions, '创生者继承原纸准备')}
    </details>}

    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>艾德里安原人的可选冲突</summary>
      {encounterFacts()}{actionList(encounterActions, '创生者可选遭遇行动')}
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <h4>{playerText("独立成品与本阶能力")}</h4><p>{value.story}</p><p>{value.supplies}</p><p>{value.risk}</p>
      <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{preparation.title}：{preparation.completedWeek === null ? '尚未实际完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
      <p>须从召唤大师实际晋升周起12整周、旧消化100，完成三项不同专业准备；当周场地检查另付1行动120便士。
        本次检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}{playerText("。准备不是已核实的原著仪式。")}</p>
      {value.bottles.map(bottle => <article key={bottle.id}><h5>{bottle.title}</h5><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
    </details>
    {value.promoted && <details className="seer-fold"><summary>三项实践、实际成功与掌握</summary>
      <p>{life.story}</p><p>{life.environment}</p>
      {life.cases.map(entry => <article key={entry.id}><h4>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</h4>
        <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        {entry.result && <p>{entry.result}</p>}{entry.attempts.map(attemptFacts)}
      </article>)}
      <h4>真实掌握记录</h4>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握{ability.mastery}：{ability.description}</p>)}
      <p>普通完成与报告可计扮演；生活中新能力必须产生实际效果才计对应成功掌握。开出窗口、仅尝试过、消耗原珠和掌握0都是不同事实。</p>
    </details>}
    {value.promoted && <details className="seer-fold"><summary>同一来客的来源与实际休息</summary>
      <p>{partner.source}</p><p>原居处{partner.homeId} · 成年 · 独立意识 · 累计普通移动{partner.ordinaryDistanceM}米、原门经过{partner.gateCrossings}次。</p>
      <p>本人退出现场、同一活来客在家，且符合真实跨周恢复条件后，才可付1行动30便士安排休息：至多恢复精力30、精神10；健康与原伤不会恢复。</p>
      {partner.restHistory.length ? partner.restHistory.map((rest, index) => <p key={index}>第{rest.week}周 · 实付{rest.paidPennies}便士 · 精力{rest.staminaBefore}→{rest.staminaAfter} · 精神{rest.mindBefore}→{rest.mindAfter} · 健康保持{rest.healthUnchanged}。</p>) : <p>尚无已保存的休息记录。</p>}
    </details>}
    <details className="seer-fold"><summary>原身体、七阶掌握与旧人原物</summary>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。创生者2不改变性别。</p>
      <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul><p>{value.environment}</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || value.insideCase || confirmation !== null}
      onClick={() => { if (!locked && !value.insideCase && !confirmation) onClose(); }}>关闭创生者页面</button>}

    {confirmation && error === null && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="life-giver-confirm-title" aria-describedby="life-giver-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={event => { event.preventDefault(); if (!locked) setConfirmation(null); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <h3 id="life-giver-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次实际消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '公开条件已经改变，请返回查看最新记录。'}</p><p id="life-giver-confirm-cost">本次：{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p>
        {liveConfirmation?.command.type === 'CONSUME' && <><p>当前成功率{confirmedBottle.chance}%。本次准备：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p>
          <p className="slice-notice seer-risk">{value.risk}</p><p>{playerText("成功或失败都会耗尽这一原瓶与当次准备。旧消化、掌握、伤势、风险及原人原物保留；不补灵、不治疗、不变性、不产生新生命。完整配方与原著仪式仍未知。")}</p></>}
      </>}
      {confirmationCommand?.type === 'PREPARE' && confirmationCommand.method === 'ABILITY' && <p>本次实付1行动、120便士取得两粒不同的60便士原珠，之后每项能力最多尝试一次。取消此确认不花费；实际准备后退出不退款，未用与耗尽实物都须归还。</p>}
      {confirmationCommand?.type === 'VITALITY' && <p>本次6灵性与一粒现有原珠，知识18；成功至多恢复同一来客12精力，失败也实耗。当前来客精力{partner.stamina}/100，健康{partner.health}、精神{partner.mind}不会由此治疗或恢复。</p>}
      {confirmationCommand?.type === 'SHELTER' && <p className="slice-notice seer-risk">本次4灵性与一粒现有原珠，知识18；成功只开15秒窗口。下一次真实低载搬运应用时，本人健康实际−5、流灯耗精力8→3。撤回、阻路或到期后不会应用；失败成本不退。</p>}
      {confirmationCommand?.type === 'PREPARE_BATTLE_BEAD' && <p>本次另付1行动、60便士取得一粒独立战斗原珠，最多三粒。每粒仅用一次；生活原珠、已耗尽原珠和旧纸不会改成新增库存。</p>}
      {confirmationCommand?.type === 'SET_GUEST_POLICY' && confirmationCommand.policy === 'ASK_HELP' && <p>本次沿原30米小径普通往返，向同一流灯当面协商这场援助并支付公开费用。旧生活许可与埃德温援助许可不延续；取得许可本身不召来身体、不保证技能成功。</p>}
      {confirmationCommand?.type === 'ENCOUNTER_FIGHT' && <p className="slice-notice seer-risk">这是与艾德里安同一原身体的真实战斗，会产生伤势、投降或不可逆死亡。本人既有伤势及累计风险继续生效；来客也可能受伤或死亡。新支援不跳过共同伤势盘，也不提供复活。可取消后普通离开。</p>}
      {confirmationCommand?.type === 'REST_GUEST' && <p>付费让同一活来客在原居处休息，仅恢复公开的有限精力与精神，不治疗健康、旧伤或死亡。</p>}
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancelButton} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交意图。提交后等待同一次保存回执；失败时保留原意图，请用保存错误处重试。</p>{pendingNotice}
    </dialog>}
  </section>;
}
