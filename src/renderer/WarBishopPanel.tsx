import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WarBishopAction, WarBishopCommand, WarBishopProjection } from "../domain/war-bishop/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const NODE: Record<string, string> = { NEAR: "原近端", MID_A: "中段甲位", MID_B: "中段乙位", FAR: "原远端" };
const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "实际现场未收束", EXAMINED: "待报告", RESOLVED: "已报告",
};
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
type Confirmation = { action: WarBishopAction; bottle: WarBishopProjection["bottles"][number]; facts: string };

export interface WarBishopPanelProps {
  value: WarBishopProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: WarBishopCommand) => void;
  /** Closing this view never dismisses members, returns an original or cancels preparation. */
  onClose?: () => void;
}

function confirmationFacts(value: WarBishopProjection, action: WarBishopAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, currentGender: value.currentGender,
    originalGender: value.originalGender, action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Render committed public facts; local choices never grant presence, mastery or supplies. */
export function WarBishopPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: WarBishopPanelProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
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
  const practice = value.life.practice;
  const selectedCase = value.life.cases.find(entry => entry.id === practice.activeCase)
    ?? value.life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED")
    ?? value.life.cases.find(entry => entry.id === caseId)
    ?? value.life.cases.find(entry => entry.status !== "RESOLVED");
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!("bottleId" in action.command) || action.command.bottleId === selectedBottle?.id));
  const encounter = value.encounter;
  const encounterActions = value.actions.filter(action => encounter.actions.some(entry => entry.id === action.id));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !encounterActions.includes(action));
  const currentLifeActions = lifeActions.filter(action => !("caseId" in action.command) || action.command.caseId === selectedCase?.id);
  const currentActions = encounter.inside ? encounterActions : value.promoted ? currentLifeActions : acquisitionActions;
  const nextAction = currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? currentActions.find(action => action.enabled && action.command.type !== "LEAVE_PREPARATION" && action.command.type !== "WITHDRAW")
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const presentMembers = value.life.members.filter(member => member.present && member.location === "YARD");

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== publicFacts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null);
      summaryHeading.current?.focus();
    }
    if (confirmation && submitted.current === null && !busy && error === null && !liveConfirmation) setConfirmation(null);
  }, [publicFacts, busy, error, confirmation, liveConfirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: WarBishopAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: WarBishopAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: WarBishopAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `war-bishop-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`war-bishop-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="战争主教当前资源"><h4>当前实际资源</h4>
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
  function attemptFacts(attempt: WarBishopProjection["life"]["cases"][number]["attempts"][number], index: number) {
    return <div key={index}>
      <p>第{attempt.invitedWeek}周实际邀请 · {attempt.method === "ABILITY" ? "能力准备" : "普通准备"} · {attempt.failed ? "本次实际失败" : attempt.result === "ABILITY" ? "实际能力成功" : attempt.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"}。</p>
      <p>实际经过 {attempt.elapsedSeconds} 秒 · 原物移动 {attempt.toolTravelMetres} 米 · 本人健康损失 {attempt.ownerDamage}；{attempt.linkStarted ? "本次已开启联系并耗5灵性" : "本次未开启联系"}。</p>
      {attempt.memberCosts.length > 0 && <p>原成员实际代价：{attempt.memberCosts.map(cost => `${value.life.members.find(member => member.id === cost.id)?.name ?? cost.id}（${cost.id}）健康−${cost.healthLoss}、精力−${cost.energySpent}`).join("；")}。</p>}
      <p>{attempt.returned ? "已实际返回" : "尚未实际返回"} · {attempt.dismissed ? "已实际散场" : "尚未散场"} · {attempt.closed ? "本次已收束" : "本次尚未收束"}。</p>
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、邀请、建立联系或服药。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation war-bishop-panel"
    aria-label="战争主教原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。三项专业准备与场地检查均为本作G；完整配方与原著晋升仪式仍未知。")}</p>
    <section className="slice-notice seer-risk" aria-label="战争主教服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不会退回。专业经历保留；重试须休养、筹另一独立原瓶并重新检查场地。</p>
    <p>当前角色身体：{GENDER[value.currentGender] ?? value.currentGender}。
      {value.originalGender !== null && `原铁血骑士首次服药前：${GENDER[value.originalGender] ?? value.originalGender}。`}
      本阶身体性别不再变化，旧身体记录与旧能力掌握保留；灵性上限仍为120，当前灵性不补满。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="war-bishop-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "war-bishop-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel war-bishop-panel" aria-label="战争主教" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="战争主教当前目标">
      <span className="seer-seal">{value.promoted ? "战争主教3 · 原队有限协作" : "铁血骑士4 → 战争主教3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}{value.promoted && ` · 战争主教扮演 ${value.acting}`}</p>
      {value.promoted && <p>原G1本次实际在院 {presentMembers.length} / 5 人 · {encounter.inside
        ? encounter.linkedMemberIds.length ? `本场冲突当前联系 ${encounter.linkedMemberIds.length} 人` : "本场冲突没有建立联系"
        : practice.linkedMemberIds.length ? `当前联系 ${practice.linkedMemberIds.length} 人，余 ${practice.linkRemainingSeconds} 秒` : "当前没有建立联系"}</p>}
    </section>

    {!value.promoted && selectedBottle && <section aria-label="当前独立原瓶"><h4>本次原瓶</h4>
      <label>选择独立战争主教原瓶<select aria-label="选择独立战争主教原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.status}</p>
    </section>}
    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前战争主教生活情境">
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.preparation && <p>{selectedCase.preparation}</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      {selectedCase.attempts.at(-1)?.failed && <section className="slice-notice seer-risk" aria-label="本次实践失败与实际代价"><h4>已经发生的失败与代价</h4>{attemptFacts(selectedCase.attempts.at(-1)!, selectedCase.attempts.length - 1)}</section>}
      {value.insideCase && <p>本人在{NODE[practice.ownerNode]} · 实际经过 {practice.elapsedSeconds} 秒；结束前须沿原路归位、归还原物、解除联系并让同伴实际散场。</p>}
      <p className="slice-muted">普通方法同样可以完成生活情境；能力掌握只记录实际成功。停止不退还成本，也不自动治疗。</p>
    </section>}
    <section aria-label="战争主教当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {currentActions.length ? actionList(currentActions, "战争主教公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
    </section>

    {value.promoted && <details className="seer-fold"><summary>原G1五人的当前状态 · 实际在院 {presentMembers.length} / 5</summary>
      <section aria-label="原G1真实成员状态"><h4>沿用原三十人中的同一五位成员</h4>
        <p>{playerText("历史加入与共同成长不代表本次到场。只有当前愿意、实际在院且健康与精力足够的原成员参与；本场邀请1行动40便士G。")}</p>
        <p>本章生活情境实际邀请：{value.life.invitationWeeks.length ? value.life.invitationWeeks.map(week => `第${week}周`).join("、") : "尚无已保存邀请"}。旧周邀请不会自动延续为当前在场。</p>
        <ul>{value.life.members.map(member => <li key={member.id}><strong>{member.name}</strong> · {member.id}
          <p>健康 {member.health} / 100 · 精力 {member.energy} / 20 · {member.willing ? "当前愿意合作" : "当前未同意合作"} · {member.present && member.location === "YARD" ? "实际在院" : member.location === "HOME" ? "在家中，尚未到场" : "未确认在院"}</p>
          <p>{member.node ? `本场位置：${NODE[member.node] ?? member.node}` : "未登记本场站位"} · {member.present && member.location === "YARD" ? "本次已经实际到场" : member.eligible ? "身体、意愿与位置满足受邀条件" : "当前不满足受邀条件"}</p>
        </li>)}</ul>
        <p className="slice-muted">健康、精力与意愿来自原队唯一记录。散场后伤势和疲劳仍保留，读旧名单不会重新邀请或恢复成员。</p>
      </section>
    </details>}

    {value.promoted && <details className="seer-fold"><summary>同一原物与有限联系</summary>
      <section aria-label="战争主教原物与联系"><h4>本场原物的实际去向</h4>
        <p>{practice.frame.id} · 搬运框：{practice.frame.holder === "RACK" ? "原架" : practice.frame.holder === "TEAM_NEAR" ? "队伍承持于原近端" : "队伍承持于原远端"} · 玻璃：{practice.frame.cargo === "SEALED" ? "原封未交付" : practice.frame.cargo === "HALF" ? "普通第一趟已交付一半" : "已实际交付"}</p><p>{practice.frame.source}</p>
        <p>{practice.card.id} · 通行牌：{practice.card.holder === "RACK" ? "原架" : practice.card.holder === "OWNER" ? "本人持有" : value.life.members.find(member => member.id === practice.card.holder)?.name ?? practice.card.holder}</p><p>{practice.card.source}</p>
        <p>{practice.load.id} · 机械：{practice.load.holder === "RACK" ? "原架" : "本场固定架"} · {({ IDLE: "未加载", ARMED: "已准备", WARNED: "已预告侧向力", HELD: "正在实际支撑", RELEASED: "已卸载" } as Record<string, string>)[practice.load.phase]}</p><p>{practice.load.source}</p>
        <p>联系：{practice.linkedMemberIds.length ? practice.linkedMemberIds.map(id => value.life.members.find(member => member.id === id)?.name ?? id).join("、") : "没有实际联系"} · 剩余 {practice.linkRemainingSeconds} 秒。</p>
        <p>{playerText("开启联系5灵性、每位实际参与者2精力、最多60秒与6米。各人在真实站位协作，普通走路与交接仍须发生。")}</p>
      </section>
    </details>}

    {value.promoted && <details className="seer-fold"><summary>三个不同生活情境与实际失败记录</summary>
      <section aria-label="战争主教生活记录"><h4>选择情境或回看原结果</h4>
        <label>选择生活情境<select aria-label="选择战争主教生活情境" disabled={locked || value.insideCase} value={selectedCase?.id ?? ""} onChange={event => setCaseId(event.target.value)}>
          {!selectedCase && <option value="" disabled>选择一项原记录</option>}
          {value.life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
        </select></label>
        {value.life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4><p>{entry.story}</p>
          <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束接触"}</p>
          {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
          {entry.attempts.length > 0 && <section aria-label={`${entry.title}的实际尝试`}><h4>原尝试、损伤与疲劳</h4>{entry.attempts.map(attemptFacts)}</section>}
        </article>)}
        <p>{value.life.environment}</p>
      </section>
    </details>}

    <details className="seer-fold"><summary>独立成品、专业准备与配方边界</summary>
      <section aria-label="战争主教成品与配方边界"><h4>{playerText("专业支持与独立成品")}</h4>
        <p>{playerText("完整配方、材料用量与原著晋升仪式仍未知。本场三项专业准备与场地检查不冒称原著仪式，也不使用序列0的大陆战争仪式。")}</p>
        <p>{value.supplies}</p>{value.story && <p>{value.story}</p>}
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>当次场地检查：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}。</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、三十人历史与继承能力</summary>
      <section aria-label="战争主教继承记录"><h4>原成长与同一身体</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。{value.originalGender !== null && `原铁血骑士首次服药前：${GENDER[value.originalGender] ?? value.originalGender}。`}本阶不再次改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>原三十人的身份、共同成长、伤势、精力与旧原物去向不因晋升重置；本场只引用G1五人。其他原成员不会因为查看此页来到现场。</p>
      </section>
      <section aria-label="战争主教能力边界"><h4>不同成员的有限协作</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>战斗默认保留联系；主动选择且条件满足时才耗5灵性与每位2精力，条件不足不耗。五位原成员没有免费独立轮盘或共享施法；本场机械冲击不是天气权柄。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>当前资源与场地说明</summary>{resources()}<p>{value.environment}</p></details>
    {value.promoted && <details className="seer-fold" open={encounter.inside}><summary>新原人的可选冲突</summary>
      <section aria-label="战争主教原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
        <p>{encounter.enemy.name} · {encounter.enemy.age}岁 · {encounter.enemy.id}{playerText(" · 本场G序列")}{encounter.enemy.sequence}等效。
          健康 {encounter.enemy.health} · 精神 {encounter.enemy.mind} · 独立灵性 {encounter.enemy.spirituality} · {encounter.enemy.status === "DEAD" ? "已经真实死亡" : encounter.enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>他自己的原棍 {encounter.enemy.weaponId} · {encounter.enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原院"}。</p>
        <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>当前战斗联系策略：{encounter.policy === "HOLD" ? "保留，不自动施术" : "条件具备时建立联系"}。条件不足不耗资源，结束不补满原人的健康或灵性。</p>
        {!encounter.inside && actionList(encounterActions, "战争主教可选遭遇行动")}
      </section>
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭战争主教页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
