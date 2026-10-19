import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { IronBloodKnightAction, IronBloodKnightCommand, IronBloodKnightProjection } from "../domain/iron-blood-knight/types";
import type { ReaperProjection } from "../domain/reaper/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察原现场", PREPARED: "已准备，尚未执行",
  ACTIVE: "现场仍待实际收束", EXAMINED: "已实际收束，等待报告", RESOLVED: "已报告",
};
const ACTIVITY: Record<string, string> = { RESCUE: "合力救援", WATCH: "共同守夜", SIGNALS: "眼神与动作协作" };
const FORM: Record<string, string> = { HUMAN: "人形", STEEL: "自身钢铁形态", FLAME: "自身火焰形态" };
const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const TEAM_TYPES = ["JOIN_COHORT", "TEAM_ACTIVITY", "FULL_EXERCISE", "REST_TEAM", "RECOVER_TEAM", "PREPARE_RITE", "LEAVE_RITE"];
const PRACTICE_TYPES = ["RETURN_TOOL", "EXIT_FORM", "START_LINK", "LOAD_PULSE", "STOP_LINK", "FLAME_OUT", "FLAME_BACK", "RETURN_ORDINARY"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "CALL_COMPANIONS", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];

/** Earlier originals and outcomes are read-only; this view cannot repeat their rewards. */
export function IronBloodReaperHistory({ reaper }: { reaper: ReaperProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="收割者时期的经历">
    <h3>收割者时期的经历</h3>
    <p className="slice-notice">原弱点观察、实际窗口、失败、原器材与独立原瓶继续保留，只供回看。晋升不会重开旧窗口或重置原失败。</p>
    <p>收割者扮演进度 {reaper.acting} · 消化：{reaper.digestion}</p>
    <details className="seer-fold"><summary>收割者原故事与供给</summary>
      {reaper.story && <p>{reaper.story}</p>}{reaper.environment && <p>{reaper.environment}</p>}{reaper.supplies && <p>{reaper.supplies}</p>}
    </details>
    {reaper.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p className="slice-muted">原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={`${entry.id}-${index}`}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}
      <p>{entry.windowOpen}</p><p>{entry.practice}</p><p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {reaper.bottles.length > 0 && <details className="seer-fold"><summary>收割者原瓶 · 来源与去向</summary>
      {reaper.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {reaper.abilities.length > 0 && <details className="seer-fold"><summary>收割者时期能力记录</summary>
      {reaper.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface IronBloodKnightPanelProps {
  ironBloodKnight: IronBloodKnightProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: IronBloodKnightCommand) => void;
}
interface Confirmation {
  action: IronBloodKnightAction;
  bottle: IronBloodKnightProjection["bottles"][number];
}

/** All progress and availability come from saved public state, never from button clicks. */
export function IronBloodKnightPanel({ ironBloodKnight: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: IronBloodKnightPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [acceptBodyChange, setAcceptBodyChange] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const liveConfirmation = confirmation && value.actions.find((action) => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command));
  const members = value.team.cohorts.flatMap((cohort) => cohort.members);
  const presentMembers = members.filter((member) => member.present && member.location === "YARD");
  const readyMembers = members.filter((member) => member.joined && member.willing && member.health >= 80 && member.energy >= 8);
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const selectedCase = (value.life.insideCase ? value.life.cases.find((entry) => entry.id === value.life.practice.activeCase) : undefined)
    ?? value.life.cases.find((entry) => entry.id === caseId)
    ?? value.life.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.life.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const practiceActions = value.actions.filter((action) => !("caseId" in action.command) && PRACTICE_TYPES.includes(action.command.type));
  const teamActions = value.actions.filter((action) => TEAM_TYPES.includes(action.command.type));
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const growthActions = value.actions.filter((action) => action.command.type !== "CONSUME" && !("caseId" in action.command)
    && !TEAM_TYPES.includes(action.command.type) && !PRACTICE_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type));
  const nextAction = (value.life.insideCase ? [...practiceActions, ...selectedCaseActions] : value.actions).find((action) => action.enabled)
    ?? value.actions[0];
  const practice = value.life.practice;

  useEffect(() => {
    if (selectedCase && (value.life.insideCase || caseId === null)) setCaseId(selectedCase.id);
  }, [selectedCase, value.life.insideCase, caseId]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation || value.promoted)))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null; setAcceptBodyChange(false);
    }
  }, [confirmation, liveConfirmation, busy, error, readOnly, value.promoted]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function openBottle(action: IronBloodKnightAction) {
    if (locked || !action.enabled || action.command.type !== "CONSUME" || value.promoted) return;
    const bottleId = action.command.bottleId;
    const bottle = value.bottles.find((entry) => entry.id === bottleId);
    if (!bottle) return;
    returnActionId.current = action.id; submitted.current = null;
    setAcceptBodyChange(false); setSubmittedId(null); setConfirmation({ action, bottle });
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !acceptBodyChange || !confirmation || !liveConfirmation?.enabled) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id);
    onCommand(confirmation.action.command);
  }
  function actionButton(action: IronBloodKnightAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `iron-blood-reason-${action.id}` : undefined}
        onClick={() => { if (locked || !action.enabled) return; if (action.command.type === "CONSUME") openBottle(action); else onCommand(action.command); }}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`iron-blood-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作。"}
  </p>;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶铁血骑士魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">原瓶、实际仪式与角色身体变化</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>来源：{confirmation.bottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一原瓶</dt><dd>{confirmation.bottle.id}</dd></div>
      <div><dt>原瓶状态</dt><dd>{confirmation.bottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{confirmation.bottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{confirmation.action.cost}</dd></div>
    </dl>
    <section className="slice-notice" aria-label="本次实际三十人仪式">
      <h4>当前真实到场的原成员</h4>
      <p>{value.team.qualification}</p>
      <p>实际在院 {presentMembers.length} 人 · 本次仪式登记 {value.team.rite?.participantIds.length ?? 0} 人</p>
      <p>{value.team.rite ? `本次仪式 ${value.team.rite.id}，第${value.team.rite.arrivedWeek}周实际到场。` : "当前没有已保存的仪式集合。"}</p>
      <p className="slice-muted">原瓶无论成功或失败都会耗尽，本次集合实际结束；共同经历保留，下一原瓶仍须重新集合。</p>
    </section>
    <section className="slice-notice seer-risk" aria-label="铁血骑士服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
    <section className="slice-notice" aria-label="角色身体变化的独立确认">
      <h4>单独确认角色身体变化</h4>
      <p>{value.bodyChange}</p>
      <p>女性角色仅在实际晋升成功后身体变为男性；原本男性角色保持男性。服药失败不改变身体性别。</p>
      <p>当前角色身体：{GENDER[value.currentGender] ?? value.currentGender}。
        {value.originalGender !== null && `首次服药前的原记录：${GENDER[value.originalGender] ?? value.originalGender}。`}</p>
      <label><input type="checkbox" checked={acceptBodyChange} disabled={confirmationLocked}
        onChange={(event) => setAcceptBodyChange(event.target.checked)} />我已了解并接受本次成功晋升的角色身体变化</label>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源"><h4>当前角色资源</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>暂不服用，返回当前集合</button>
      <button className="slice-button" disabled={confirmationLocked || !acceptBodyChange || !liveConfirmation?.enabled} onClick={confirmBottle}>
        {busy ? "正在结算并保存…" : `确认服用「${confirmation.bottle.title}」`}
      </button>
    </div>
    <p className="slice-muted">两项确认只适用于这一原瓶。保存失败时保留同一已确认意图，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel iron-blood-knight-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="铁血骑士成长下一步">
      <span className="seer-seal">{value.promoted ? "铁血骑士4" : "收割者5 → 铁血骑士4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看原记录。" : "请查看共同成长与当前公开条件。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("仪式需要至少30名真正共同成长、互相信任并默契协作的成员。完整配方与完整仪式布置尚未核实；本作G成品供给不取消仪式，也不能付款购买战友情谊。")}</p>
    </section>

    {(value.discovered || value.promoted) && <section aria-label="三十名原成员与共同成长">
      <h3>{value.team.title}</h3><p>{value.team.environment}</p>
      <dl className="seer-facts">
        <div><dt>实际加入</dt><dd>{members.filter((member) => member.joined).length} / 30 人</dd></div>
        <div><dt>当前身体与意愿达标</dt><dd>{readyMembers.length} / 30 人</dd></div>
        <div><dt>实际在院</dt><dd>{presentMembers.length} 人</dd></div>
        <div><dt>已过真实周数</dt><dd>{value.team.elapsedWeeks} / 6 周</dd></div>
        <div><dt>共同整队演练</dt><dd>{value.team.exerciseWeeks.length} / 2 次</dd></div>
      </dl>
      <p className="slice-notice" aria-label="当前仪式资格">{value.team.qualified ? "共同成长条件已满足。" : "共同成长条件尚未满足。"}{value.team.qualification}</p>
      <p className="slice-muted">{playerText("六组各五位原成员。每组须跨真实周完成救援、守夜、动作协作三种经历，再完成不同周的两次整队演练；至少六个真实周为本作G规则。历史经历与当前健康、精力、意愿分别记录。")}</p>
      {value.team.exerciseWeeks.length > 0 && <p>整队演练成功记录：{value.team.exerciseWeeks.map((week) => `第${week}周`).join("、")}</p>}
      {value.team.restRequestedWeek !== null && <p>第{value.team.restRequestedWeek}周已安排休整，实际恢复须按下一真实周的公开选项结算。</p>}
      {value.team.cohorts.map((cohort) => <details className="seer-fold" key={cohort.id} aria-label={`${cohort.title}成员与经历`}>
        <summary>{cohort.title} · {cohort.joined ? "已加入" : "尚未加入"} · 不同经历 {cohort.successfulActivities.length}/3 · 当前在院 {cohort.members.filter((member) => member.present && member.location === "YARD").length}/5</summary>
        <p>已成功共同经历：{cohort.successfulActivities.length ? cohort.successfulActivities.map((activity) => ACTIVITY[activity] ?? activity).join("、") : "尚无"}。</p>
        <p>成功周记录：{cohort.activityWeeks.length ? cohort.activityWeeks.map((week) => `第${week}周`).join("、") : "尚无"}。
          {cohort.lastAttemptWeek !== null && `最近实际尝试：第${cohort.lastAttemptWeek}周。`}</p>
        <ul>{cohort.members.map((member) => <li key={member.id}>
          <strong>{member.name}</strong> · {member.age}岁 · {member.id}
          <p>健康 {member.health} / 100 · 精力 {member.energy} / 20 · {member.willing ? "当前愿意合作" : "当前未同意合作"} · {member.joined ? "已加入" : "尚未加入"} · {member.present && member.location === "YARD" ? "实际在院" : member.location === "HOME" ? "已在家中" : "未确认实际到场"}</p>
          <p>原经历 {member.experience} · 小组经历 {member.cohortActivities.length} · 整队演练 {member.exerciseWeeks.length}</p>
          {member.cohortActivities.length > 0 && <p>{member.cohortActivities.map((entry) => `${ACTIVITY[entry.activity]}（第${entry.week}周）`).join("、")}</p>}
          <small>原成员来源：{member.source}</small>
        </li>)}</ul>
        <div className="warrior-action-list" role="group" aria-label={`${cohort.title}共同活动`}>{teamActions.filter((action) => "cohortId" in action.command && action.command.cohortId === cohort.id).map(actionButton)}</div>
      </details>)}
      {value.team.rite && <section className="slice-notice" aria-label="当前实际仪式集合">
        <h4>本次真实集合</h4><p>{value.team.rite.id} · 第{value.team.rite.arrivedWeek}周 · 登记 {value.team.rite.participantIds.length} 位原成员</p>
        <p>实际到场名单：{members.filter((member) => value.team.rite?.participantIds.includes(member.id) && member.present && member.location === "YARD").map((member) => member.name).join("、") || "当前没有符合记录的在院成员"}</p>
        <p>成员正在原院等候。服用或使用0行动的结束集合后，才实际各自返回；查看页面不会代替到场或离场。</p>
      </section>}
      <div className="warrior-action-list" role="group" aria-label="整队演练与仪式行动">{teamActions.filter((action) => !("cohortId" in action.command)).map(actionButton)}</div>
      {value.team.riteHistory.length > 0 && <details className="seer-fold"><summary>原集合与实际结束记录</summary>
        {value.team.riteHistory.map((rite) => <p key={rite.id}>{rite.id}：第{rite.arrivedWeek}周到场{rite.participantIds.length}人，第{rite.closedWeek}周结束；{rite.consumedBottleId ? `耗用原瓶 ${rite.consumedBottleId}` : "未服药而实际解散"}。</p>)}
      </details>}
    </section>}

    {value.promoted && <section className="slice-notice" aria-label="铁血骑士当前身体与原物">
      <h3>当前身体、同伴与原物</h3><p>{value.life.environment}</p>
      <dl className="seer-facts">
        <div><dt>角色身体</dt><dd>{GENDER[value.currentGender] ?? value.currentGender} · {FORM[practice.form]}</dd></div>
        <div><dt>实际位置</dt><dd>{practice.ownerNode === "NEAR" ? "原近端" : "原远端"}</dd></div>
        <div><dt>已连结原成员</dt><dd>{practice.linkedMemberIds.length ? practice.linkedMemberIds.map((id) => members.find((member) => member.id === id)?.name ?? id).join("、") : "当前没有连结"}</dd></div>
        <div><dt>12千克原训练梁</dt><dd>{practice.beam.id} · {practice.beam.holder === "CRADLE" ? "原托架" : "本人承持"}</dd></div>
        <div><dt>14千克原箱</dt><dd>{practice.crate.id} · {practice.crate.holder === "CRADLE" ? "原托架" : "本人承持"}</dd></div>
        <div><dt>原衣物</dt><dd>{practice.clothes.id} · 仍归本人</dd></div>
        <div><dt>原地面通路</dt><dd>{practice.route.id} · {practice.route.distanceMetres}米 · {practice.route.clear ? "已知净空" : "当前未净空"}</dd></div>
      </dl>
      <p>原梁来源：{practice.beam.source} · 原箱来源：{practice.crate.source}</p>
      <p className="slice-muted">火焰化沿实际地面通路移动；钢铁化仍会受伤。连结只作用于真正到场且同意的原成员，解除连结不治疗已付出的伤势。</p>
      <ul>{members.filter((member) => member.id === "IB4-01" || member.id === "IB4-02").map((member) => <li key={member.id}>{member.name} · {member.id} · 健康 {member.health} · 精力 {member.energy} · {member.willing ? "当前愿意合作" : "当前未同意合作"} · {member.present && member.location === "YARD" ? "实际在院" : "当前不在院"}</li>)}</ul>
    </section>}

    {value.promoted && selectedCase && <section aria-label="铁血骑士有限实践">
      <h3>自身形态与真实协作</h3>
      <label className="seer-case-selector">选择当前实践<select value={selectedCase.id} disabled={locked || value.life.insideCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前铁血骑士实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "现场尚未结束" : "现场已收束或尚未开始"} · {selectedCase.returned ? "已实际归还与返回" : "尚无本次完成返回记录"} · 实际结束 {selectedCase.closes} 次</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length ? <ul>{selectedCase.observations.map((text, index) => <li key={`${selectedCase.id}-${index}`}>{text}</li>)}</ul> : <p className="slice-muted">尚无本次实际观察；请先核对原物、参加者、同意与已知退路。</p>}
        </section>
        <p>{selectedCase.preparation ?? "尚未准备本次方法。普通方法与能力方法分别保留，准备不会提前施法或完成报告。"}</p>
        {selectedCase.result && <section className="slice-notice" aria-label="铁血骑士实际结果" aria-live="polite"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前铁血骑士实践行动">{[...selectedCaseActions, ...practiceActions].map(actionButton)}</div>
        {value.life.insideCase && <p className="slice-muted">离开前须按当前公开选项归还原器材、解除连结、退出形态并实际返回。0行动的收束不额外治疗、不复原消耗，也不抹去原失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="铁血骑士成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="铁血骑士可选冲突"><h3>{value.encounter.title}</h3>
      <p>{value.encounter.story}</p>
      <p>原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原对手状态：{value.encounter.enemy.status === "DEAD" ? "已真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "已实际投降" : "仍在抵抗"}。原武器：{value.encounter.enemy.weaponId} · {value.encounter.enemy.weaponLocation === "HAND" ? "仍在原对手手中" : "留在原石院"}</p>
      <ul>{value.encounter.companions.map((member) => <li key={member.id}>{member.name} · {member.id} · 健康 {member.health} · 精力 {member.energy} · {member.present ? "实际在场" : "当前不在场"} · {member.eligible ? "当前可应邀" : "当前不满足邀请条件"}</li>)}</ul>
      <p className="slice-muted">可独自应对；同伴须另行邀请并真正到场。三十名仪式成员不会自动组成随身军队。战斗仍有真实伤势与死亡风险，指导服药保护不适用于战斗。</p>
      <div className="warrior-action-list" role="group" aria-label="铁血骑士冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.discovered && value.supplies && <section className="slice-notice" aria-label="铁血骑士独立成品来源"><h4>实际供给与独立原瓶</h4><p>{value.supplies}</p></section>}
    {value.discovered && value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>铁血骑士原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        {!value.promoted && value.actions.filter((action) => action.command.type === "CONSUME" && action.command.bottleId === bottle.id).map(actionButton)}
      </article>)}
    </details>}
    {value.promoted && <section aria-label="铁血骑士能力与消化"><h3>能力与消化</h3>
      <p>扮演进度 {value.acting} · {value.digestion}</p><progress className="cryptologist-progress" aria-label="铁血骑士扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">共同成长、有限协作与自身形态不提供无敌、免费同伴、瞬移或序列3战争主教的全军强化。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>
      {value.story && <p>{value.story}</p>}<p>{value.team.source}</p><p>{value.life.source}</p><p>{value.bodyChange}</p><p>{value.risk}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
