import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SummoningMasterAction, SummoningMasterCommand, SummoningMasterProjection } from "../domain/summoning-master/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const LOCATION: Record<string, string> = { HOME: "原玻璃暖房", YARD: "原小石院", PATH: "原普通小径", PLAYER: "本人手中", TABLE: "三米外原桌", ADA: "艾达本人处", OWNER: "艾达本人处", "SM3-ADA39": "艾达本人处", "SM3-LUMEN": "同一流灯保管" };
const GATE: Record<string, string> = { CLOSED: "已关闭", OPEN: "仍连通", BROKEN: "已被打断", EXPIRED: "已到期" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已当面同意本次有限任务", DECLINED: "已拒绝本次任务", REVOKED: "本次同意已撤回", CLOSED: "本次许可已结束" };
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER", "SET_GUEST_POLICY"]);
const PAPER_TYPES = new Set(["BUY_PAPERS", "PREPARE_PAPER"]);
const PAPER_STATUS: Record<string, string> = { HELD: "未准备", PREPARED: "已经准备", CONSUMED: "已真实耗用" };
const EXIT_TYPES = new Set(["RETURN_TOKEN", "RETURN_GUEST", "CLOSE_GATE", "RETURN_PLAYER", "REVOKE_CONSENT", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: SummoningMasterAction) => EXIT_TYPES.has(command.type);
type Confirmation = { action: SummoningMasterAction; bottle: SummoningMasterProjection["bottles"][number]; facts: string };

export interface SummoningMasterPanelProps {
  value: SummoningMasterProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SummoningMasterCommand) => void;
  /** View dismissal does not close a real gate, move the guest or return a borrowed original. */
  onClose?: () => void;
}

function confirmationFacts(value: SummoningMasterProjection, action: SummoningMasterAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, digestion: value.digestion, currentGender: value.currentGender,
    action: { id: action.id, cost: action.cost, command: action.command } });
}

/** The same saved guest, original objects and typed intent remain authoritative through save retries. */
export function SummoningMasterPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: SummoningMasterPanelProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const publicFacts = JSON.stringify(value);
  const liveConfirmation = confirmation ? value.actions.find(action => action.id === confirmation.action.id
    && confirmationFacts(value, action) === confirmation.facts) : undefined;
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && "bottleId" in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const { life, encounter } = value;
  const partner = life.partner;
  const attempt = life.currentAttempt;
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED")
    ?? life.cases.find(entry => entry.id === caseId)
    ?? life.cases.find(entry => entry.status !== "RESOLVED") ?? life.cases[0];
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!("bottleId" in action.command) || action.command.bottleId === selectedBottle?.id));
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const paperActions = value.actions.filter(action => PAPER_TYPES.has(action.command.type));
  const selectedPaper = life.inheritedPapers.find(paper => paper.id === paperId && paper.status === "HELD")
    ?? life.inheritedPapers.find(paper => paper.status === "HELD");
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type) && !PAPER_TYPES.has(action.command.type));
  const currentLifeActions = lifeActions.filter(action => !("caseId" in action.command) || action.command.caseId === selectedCase?.id);
  const currentActions = encounter.inside ? encounterActions : value.promoted ? currentLifeActions : acquisitionActions;
  const exitActions = currentActions.filter(isExit);
  const nextAction = currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? currentActions.find(action => action.enabled && !isExit(action))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== publicFacts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null);
      summaryHeading.current?.focus();
    }
    if (confirmation && submitted.current === null && !busy && error === null && !liveConfirmation) setConfirmation(null);
  }, [publicFacts, busy, error, confirmation, liveConfirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: SummoningMasterAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: SummoningMasterAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: SummoningMasterAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `summoning-master-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`summoning-master-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="召唤大师当前资源"><h4>当前实际资源</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{current.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
      </dl>
    </section>;
  }
  function attemptFacts(entry: NonNullable<SummoningMasterProjection["life"]["currentAttempt"]>, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "实际能力完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      <p>本次来客许可：{CONSENT[entry.consent]}{entry.consentWeek === null ? "" : `，第${entry.consentWeek}周记录`}。</p>
      {entry.gateTier && <p>本次开门：{TIER[entry.gateTier]}。{failedTier(entry.gateTier) && "没有成功开启原门；可按原普通小径接送，失败不会被改写为召唤成功。"}</p>}
      {entry.cooperationTier && <p>本次合作：{TIER[entry.cooperationTier]}。{failedTier(entry.cooperationTier) && "仍须本人普通搬运同一原牌，失败成本保留。"}</p>}
      <p>{entry.guestArrived ? `同一流灯已${entry.arrivalMethod === "GATE" ? "经原门" : "沿普通小径"}实际到过原院。` : "本次尚无来客实际到院记录。"}{entry.identityChecked ? "原声片与两项约定特征已核对。" : "本次尚未完成身份核对。"}</p>
      {entry.interruptionObserved && <p>{entry.gateInterrupted ? "原遮板已实际打断门，打断当时来客原身体仍留在场。" : "已实际观察原门未开启，未伪称打断了成功的门。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.ownerTravelMetres} 米 · 来客普通移动 {entry.guestTravelMetres} 米。</p>
      <p>已付灵性 {entry.spiritualitySpent} · 来客已付精力 {entry.guestStaminaSpent}。</p>
      <p>原牌{entry.tokenReturned ? "已实际归还" : entry.tokenTaken ? "仍须实际归还" : "本次未借出"} · 来客{entry.guestReturned ? "已实际回到原居处" : "尚无本次送返完成记录"} · {entry.inspected ? "已检查原声片与收束状态" : "尚未完成最终检查"}。</p>
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="召唤大师原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>自己的原棍 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原院"}。埃德温与旧多里安分别保存。</p>
      </>}
      <section className="slice-notice" aria-label="来客本场战斗政策"><h4>这场是否请流灯帮助</h4>
        <p>当前已保存选择：{encounter.guestPolicy === "HOME" ? "HOME · 默认留在原居处，不参战" : "ASK_HELP · 请求本场自愿帮助"}。</p>
        <p>{encounter.guestPermit ? `本场已取得${encounter.guestPermit.partnerId}的自愿许可，第${encounter.guestPermit.paidWeek}周实付${encounter.guestPermit.paidPence}便士。` : "尚未取得本场来客自愿帮助许可，生活同意不沿用。"}</p>
        <p>选择请求帮助须同一流灯仍活着、已当面见过、愿意、在HOME、精力至少20且精神至少30，再实付20便士。许可本身不召唤，不消耗开门灵性或来客精力。</p>
        <p>本场原门：{encounter.gateOpen ? "仍开启" : "未开启或已关闭"}。轮中实际成功召唤才让同体到院；门被打断后，已到院者仍在原位置。</p>
        <p className="slice-muted">双方只用共同战斗轮盘，流灯没有额外回合。活着时按本场约定普通30米原路回HOME；死亡身体及原声片留场，不补发来客。原院无追逐，不能推为任意远地自动安全返回。</p>
      </section>
      <details className="seer-fold"><summary>本场范围与战斗代价</summary><p>{encounter.story}</p>
        {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      </details>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、开门、邀请、送返或服药。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation summoning-master-panel"
    aria-label="召唤大师原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。专业准备为本作G；完整配方与原著晋升仪式仍未知。")}</p>
    <section className="slice-notice seer-risk" aria-label="召唤大师服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，并重新检查场地。</p>
    <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势与能力掌握保留；灵性上限120，当前灵性不补满。不重置原月亮纸人，也不发放新的来客。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="summoning-master-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "summoning-master-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认，不代替实际退出准备。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel summoning-master-panel" aria-label="召唤大师" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="召唤大师当前目标">
      <span className="seer-seal">{value.promoted ? "召唤大师3 · 一位真实来客" : "巫王4 → 召唤大师3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("召唤大师3名称已核实；本次来客、有限门与协作为本作G。完整配方与晋升仪式仍未知。")}</p>
    </section>
    {resources()}

    {!value.promoted && selectedBottle && <section aria-label="当前独立召唤大师原瓶"><h4>本次原瓶</h4>
      <label>选择独立召唤大师原瓶<select aria-label="选择独立召唤大师原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && <section aria-label="唯一流灯的当前身体"><h4>{partner.name} · 同一位来客</h4>
      <p>{partner.id} · 原身体 {partner.bodyId} · {partner.status === "DEAD" ? "已经真实死亡，原身体留在实际地点" : "仍活着，有独立意志"}。</p>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{partner.health} / 100</dd></div><div><dt>精神</dt><dd>{partner.mind} / 100</dd></div>
        <div><dt>精力</dt><dd>{partner.stamina} / 100</dd></div><div><dt>原身体位置</dt><dd>{LOCATION[partner.location] ?? partner.location}</dd></div>
      </dl>
      <p>原声片 {partner.chime.id} · 归 {partner.chime.owner} 所有，{partner.status === "DEAD" ? "作为其遗物留在原身体所在处" : "随同一身体保管"}。</p>
      {life.insideCase && <p>本次来客许可：{attempt ? CONSENT[attempt.consent] : "尚无本次已保存同意"}。每次只覆盖当前有限任务。</p>}
      <p>{partner.metWeek === null ? "本人尚未实际见过流灯。" : `第${partner.metWeek}周已实际见过同一流灯。`}{!partner.willing && partner.status !== "DEAD" && "来客当前不愿合作。"}</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前召唤大师生活情境">
      <label>选择召唤大师生活情境<select aria-label="选择召唤大师生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
    </section>}

    {value.promoted && life.insideCase && !encounter.inside && <section aria-label="召唤大师原门与普通退路"><h4>门与原身体分别记录</h4>
      <p>本人在{LOCATION[life.playerLocation] ?? life.playerLocation} · 实际累计行走 {life.playerTravelMetres} 米。</p>
      <p>原门：{GATE[life.gate.status] ?? life.gate.status}{life.gate.status === "OPEN" ? ` · 剩余 ${life.gate.remainingSeconds} 秒` : ""}。{LOCATION[life.gate.from]} ↔ {LOCATION[life.gate.to]}。</p>
      <p>流灯的原身体仍在{LOCATION[partner.location] ?? partner.location}。关门、到期或打断都不会令已过门的身体消失。</p>
      <p className="slice-muted">一次开门6灵性；来客实际过门耗6精力。原牌合作另耗3灵性及来客8精力，成本以已保存尝试为准。</p>
      <p className="slice-muted">{playerText("两地原普通小径相距30米。活着的来客须实际回暖房，再由本人回小院；死亡原身体留在实际地点。门关闭不代替返程。40秒是本作G窗口。")}</p>
      {selectedCase?.id === "original-token" && <section aria-label="唯一受托原测试牌"><h4>这一块原牌</h4>
        <p>{life.ada.name} · {life.ada.age}岁 · {life.ada.id} · {attempt?.ownerConsent ? "已当面同意本次借原牌" : "尚无本次已保存同意"}。</p>
        <p>{life.token.id} · 原主人 {life.token.owner} · {life.token.massGrams}克。</p>
        <p>当前保管：{LOCATION[life.token.custodian] ?? life.token.custodian} · 当前位置：{LOCATION[life.token.location] ?? life.token.location}。</p>
        <p>{attempt?.tokenDelivered ? "原牌已实际送达原桌。" : "本次尚无实际送达记录。"}{attempt?.tokenReturned ? "原牌已实际交回艾达。" : "结束前仍须核对原牌归还状态。"}</p>
        <p className="slice-muted">原牌只移动到三米外原桌，须交回艾达本人；同意、送达与归还是独立事实。</p>
      </section>}
      {selectedCase?.id === "interrupted-door" && <section aria-label="原遮板与断门撤离"><h4>事先告知的低强遮挡演示</h4>
        <p>原遮板 {life.shutter.id} · {life.shutter.location === "RAISED" ? "仍抬起" : "已经放下"}。{attempt?.ownerConsent ? "艾达已同意本次演示。" : "尚无艾达本次已保存同意。"}</p>
        <p>门已中断时，须沿已知30米普通小径陪流灯回原居处；本案练习撤离，不反复开门。开门失败也可记录原门未开启，再完成普通线路。</p>
      </section>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.gateTier) || failedTier(attempt.cooperationTier) || attempt.consent === "REVOKED" || attempt.consent === "DECLINED"}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="召唤大师本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>}
    {value.promoted && encounter.inside && encounterFacts()}

    <section aria-label="召唤大师当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {currentActions.length ? actionList(currentActions.filter(action => !isExit(action)), "召唤大师公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="召唤大师停止与普通收束"><h4>停止、还物与实际返回</h4>{actionList(exitActions, "召唤大师零行动收束")}
        <p className="slice-muted">可按公开选项0行动收束；还牌、送返、关门与本人返回分别落实，已付成本不退。关闭页面不会代替这些动作。</p>
      </section>}
    </section>

    {value.promoted && <details className="seer-fold"><summary>原月亮纸人与战前准备</summary>
      <section aria-label="继承的唯一月亮原纸"><h4>沿用旧巫王逐张原纸</h4>
        <p>未准备 {life.inheritedPapers.filter(paper => paper.status === "HELD").length} 张 · 已准备 {life.inheritedPapers.filter(paper => paper.status === "PREPARED").length} 张 · 已耗用 {life.inheritedPapers.filter(paper => paper.status === "CONSUMED").length} 张。</p>
        <ul>{life.inheritedPapers.map(paper => <li key={paper.id}>{paper.id} · {PAPER_STATUS[paper.status]} · {paper.source}</li>)}</ul>
        <p>战斗只消耗实际PREPARED的那一张原纸；持有不等于准备，晋升不补纸或改写旧消耗。</p>
        {selectedPaper && <label>选择一张未准备原纸<select aria-label="选择一张未准备原纸" value={selectedPaper.id} disabled={locked} onChange={event => setPaperId(event.target.value)}>
          {life.inheritedPapers.filter(paper => paper.status === "HELD").map(paper => <option key={paper.id} value={paper.id}>{paper.id}</option>)}
        </select></label>}
        {actionList(paperActions.filter(action => action.command.type === "BUY_PAPERS" || action.command.type === "PREPARE_PAPER" && action.command.paperId === selectedPaper?.id), "原月亮纸人准备行动")}
      </section>
    </details>}

    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="召唤大师生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    {value.promoted && <details className="seer-fold"><summary>流灯的来源与原居处</summary><section aria-label="流灯的来源与有限身体">
      <p>{partner.source}</p><p>原居处 {partner.homeId} · {partner.adult ? "成年" : "年龄以原记录为准"} · {partner.independentMind ? "独立意识" : "意识状态以原记录为准"}。</p>
      <p>已有居处的原创低强灵界来客，只能托起不超过200克的原纸或小牌。流灯不是主人创造或所有的生命，不承人、不复制物、不治病；旧驯兽动物保留原身份。</p>
      {partner.restHistory.length > 0 && <section aria-label="流灯实际休息记录"><h4>实际休息与原伤势</h4>
        {partner.restHistory.map((rest, index) => <p key={index}>第{rest.week}周 · 已付{rest.paidPennies}便士 · 精力 {rest.staminaBefore}→{rest.staminaAfter} · 精神 {rest.mindBefore}→{rest.mindAfter} · 健康仍为 {rest.healthUnchanged}。</p>)}
      </section>}
      <p>本人退出现场、流灯在家且距上次恢复已跨一真实周，才可按公开行动付1行动及30便士安排休息：精力+30、精神+10，健康不会自动治疗。</p>
    </section></details>}

    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="召唤大师成品与配方边界"><h4>{playerText("当前能力与使用范围")}</h4>
        <p>{playerText("月亮序列3召唤大师与下一阶2创生者的名称已核实。完整配方、材料数量、原著晋升仪式与具体能力参数仍未知，不据名称推演创生者造物。")}</p>
        <p>{value.supplies}</p>{value.story && <p>{value.story}</p>}
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>从巫王实际晋升周起须满12整周、原消化100；指导500便士，三项不同准备各1行动，当周准备另需1行动及120便士。三瓶独立成品各6200便士，或各完成五次真实劳务后800便士。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。上述供给与准备为本作G。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>受外来加持的巫王卡拉曼开门联系组织已有天使，属于越阶个例，不是本阶免费天使库。毁门只支持媒介可受干扰；指环的临时协议、五分钟与渴血属于原物品。</p>
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧多里安与月亮原纸</summary>
      <section aria-label="召唤大师继承记录"><h4>旧人原物仍是原记录</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧多里安、原棍、逐张原纸、原泥靶、伊尔玛与格蕾丝都按已保存状态保留，不因晋升复位、补纸或再结算。原供血、原动物、旧瓶与原材料也不重置。</p>
      </section>
      <section aria-label="召唤大师能力与实际掌握"><h4>实际能力掌握</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("有限门与有限合作参数为本作G；合作不冒称另一项已核实原著法术。每次只涉及同一位真实来客。")}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>
      {encounterFacts()}{actionList(encounterActions, "召唤大师可选遭遇行动")}
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭召唤大师页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
