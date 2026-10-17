import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { GuardianAction, GuardianCommand, GuardianProjection } from "../domain/guardian/types";
import type { DawnPaladinProjection } from "../domain/dawn-paladin/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Preserve only the committed S6 equipment, practice and sources; no historical command is replayable. */
export function GuardianDawnPaladinHistory({ dawnPaladin }: { dawnPaladin: DawnPaladinProjection }) {
  const practice = dawnPaladin.practice;
  const equipment = dawnPaladin.battleEquipment;
  return <section className="seer-panel warrior-panel" aria-label="黎明骑士时期的经历">
    <h3>黎明骑士时期的经历</h3>
    <p className="slice-notice">你已晋升守护者（序列5）。这里保留黎明骑士时期的真实幻象来源、原工具借还、铠甲裂纹、风暴与原靶、失败、已耗资源和独立原瓶，只供回看。</p>
    <p>黎明骑士扮演进度 {dawnPaladin.acting} · 消化：{dawnPaladin.digestion}</p>
    {(dawnPaladin.story || dawnPaladin.environment || dawnPaladin.supplies) && <details className="seer-fold">
      <summary>黎明骑士原故事与供给</summary>
      {dawnPaladin.story && <p>{dawnPaladin.story}</p>}
      {dawnPaladin.environment && <p>{dawnPaladin.environment}</p>}
      {dawnPaladin.supplies && <p>{dawnPaladin.supplies}</p>}
    </details>}
    <details className="seer-fold" aria-label="黎明骑士原实践与原物">
      <summary>原幻象、铠甲与风暴记录</summary>
      <dl className="seer-facts">
        <div><dt>原实践晨曦武器</dt><dd>{practice.swordActive ? "原记录仍在持续" : "原记录未持续"}</dd></div>
        <div><dt>原实践晨曦铠甲</dt><dd>{practice.armorActive ? "原记录仍在持续" : "原记录未持续"}</dd></div>
        <div><dt>原教学幻象</dt><dd>{practice.illusionCreated ? "已实际建立" : "尚未实际建立"}</dd></div>
        <div><dt>原志愿者剩余灵性</dt><dd>{practice.volunteerSpirituality}</dd></div>
        <div><dt>原幻象破除</dt><dd>{practice.illusionDispelled ? "已实际破除" : "尚无实际破除记录"}</dd></div>
        <div><dt>原遮屏</dt><dd>{practice.screenRemoved ? "已实际移开" : "尚无移开记录"}</dd></div>
        <div><dt>原铠甲试探</dt><dd>{practice.armorProbePerformed ? "已实际试探" : "尚未实际试探"}</dd></div>
        <div><dt>原试探铠甲</dt><dd>{practice.armorCracked ? "已有实际裂纹" : "尚无裂纹记录"}</dd></div>
        <div><dt>原风暴清场</dt><dd>{practice.stormCleared ? "已实际清场" : "尚无实际清场记录"}</dd></div>
        <div><dt>原导师位置</dt><dd>{practice.instructorOutside ? "原记录在场外等候" : "原记录不在场外等候"}</dd></div>
        <div><dt>原风暴纸靶</dt><dd>{practice.stormTarget === "DESTROYED" ? "已被实际风暴毁坏" : practice.stormTarget === "DISMANTLED" ? "已由普通方法实际拆卸" : "原靶仍完整"}</dd></div>
        <div><dt>原靶框</dt><dd>{practice.stormFrameScorched ? "已有风暴灼损" : "尚无风暴灼损记录"}</dd></div>
        <div><dt>原风暴武器</dt><dd>{practice.stormSwordDispersed ? "已在原风暴后消散" : "尚无风暴失剑记录"}</dd></div>
        <div><dt>原风暴铠甲</dt><dd>{practice.stormArmorCracked ? "已有风暴裂纹" : "尚无风暴裂纹记录"}</dd></div>
      </dl>
    </details>
    <details className="seer-fold" aria-label="黎明骑士旧战斗装备">
      <summary>旧战斗临时剑甲记录</summary>
      <dl className="seer-facts">
        <div><dt>旧战斗晨曦剑</dt><dd>{equipment.swordReady ? "原记录已有凝剑" : "原记录没有待用晨曦剑"}</dd></div>
        <div><dt>旧战斗失剑</dt><dd>{equipment.swordLostRound === null ? "没有原失剑回合" : `第${equipment.swordLostRound}回合`}</dd></div>
        <div><dt>旧战斗晨曦甲</dt><dd>{equipment.armorReady ? "原记录已有光甲" : "原记录没有待用光甲"}</dd></div>
        <div><dt>旧战斗光甲期限</dt><dd>{equipment.armorExpiresRound === null ? "没有原期限" : `至第${equipment.armorExpiresRound}回合`}</dd></div>
      </dl>
      <p className="slice-muted">这些是旧战斗自身的已保存记录，不补甲、不重凝旧剑，不复制到当前守护者遭遇。</p>
    </details>
    {dawnPaladin.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <p className="slice-muted">旧实践不重新结算、不发奖，不恢复原靶或志愿者资源；原短棍的所有权与真实借还、四项序列6原能力ID与掌握及更低序列记录继续保留。守护者的新守护与分担实践不能改写旧失败或旧对手的实际后果。</p>
    {dawnPaladin.bottles.length > 0 && <details className="seer-fold">
      <summary>黎明骑士原瓶 · 来源与去向</summary>
      {dawnPaladin.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {dawnPaladin.abilities.length > 0 && <details className="seer-fold">
      <summary>黎明骑士时期能力记录</summary>
      {dawnPaladin.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface GuardianPanelProps {
  guardian: GuardianProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: GuardianCommand) => void;
}

function isCaseAction(action: GuardianAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: GuardianAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function GuardianPanel({ guardian, resources, busy, blocked = false, error = null, onCommand }: GuardianPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = guardian.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = guardian.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = guardian.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled);
  const fallbackExit = caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : fallbackExit && "caseId" in fallbackExit.command ? fallbackExit.command.caseId : null;
  const selectedCase = (guardian.insideCase ? guardian.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? guardian.cases.find((entry) => entry.id === selectedCaseId)
    ?? guardian.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? guardian.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = guardian.actions.filter(isEncounterAction);
  const growthActions = guardian.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = !guardian.promoted
    ? guardian.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type !== "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !guardian.promoted && !guardian.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (guardian.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, guardian.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || guardian.promoted || guardian.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, guardian.promoted, guardian.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: GuardianAction) {
    if (busy || interactionBlocked || guardian.insideCase || guardian.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || guardian.promoted || guardian.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: GuardianAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `guardian-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`guardian-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel guardian-panel seer-confirmation" aria-label="这瓶守护者魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示无需仪式，也不虚构仪式材料或步骤。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="守护者服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{guardian.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{guardian.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="guardian-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "guardian-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel guardian-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="守护者成长下一步">
      <span className="seer-seal">{guardian.promoted ? "守护者5" : "黎明骑士6 → 守护者5"}</span>
      <h3>{guardian.title}</h3>
      {guardian.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : guardian.insideCase ? "请查看当前公开的结束实践选项。"
          : guardian.promoted && guardian.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{guardian.digestion}</p>
      {guardian.discovered && !guardian.promoted && <p className="slice-muted">用药指导：{guardian.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("已知石巨人核心是主材料线索；完整魔药配方与晋升仪式细节尚未核实，其余材料、剂量、调配顺序及具体仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、导师准备与指导服药流程，不提供虚构材料表。")}</p>
    </section>

    {guardian.promoted && guardian.environment && <section aria-label="当前守护者现场">
      <h4>当前现场</h4><p>{guardian.environment}</p>
    </section>}
    {guardian.promoted && guardian.practice && <section className="slice-notice" aria-label="守护者本人与同伴实际状态" aria-live="polite" aria-atomic="true">
      <h3>本人与同伴的实际伤势</h3>
      <dl className="seer-facts">
        <div><dt>本人当前健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>本人守护与实际承伤</dt><dd>{guardian.practice.guard}</dd></div>
        <div><dt>原纸靶实际状态</dt><dd>{guardian.practice.target}</dd></div>
        <div><dt>同伴位置与实际伤势</dt><dd>{guardian.practice.companion}</dd></div>
      </dl>
      <p className="slice-muted">准备只记录本次同意与方法，不开启守护、不产生伤害，也不让维拉提前到场。第三项实际执行时，她才从相邻等候点沿两米原路走到标记；结束时实际走回。承伤与分担写入本人健康及同伴原伤势，停止实践不会自动治疗。</p>
      {guardian.practice.history.length > 0 && <details className="seer-fold">
        <summary>实际试探、承伤与分担记录</summary>
        <ul>{guardian.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>}
    </section>}
    {selectedCase && <section aria-label="守护者有限实践">
      <h3>守护承压、出手降防与近旁同伴</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || guardian.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {guardian.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前守护者实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；请先核对各自原软垫摆锤、机械止动、原纸靶与普通退路。同伴只有在实际到达标记后才处于分担范围。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备只记录本次知情同意与方法，不代替实际承压、出手或同伴到场；身体位置、原靶与伤势只显示已保存的结果。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="守护者实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前守护者实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {guardian.insideCase && <p className="slice-muted">返回生活前须实际停止本案原摆锤并收束动作；仍在守护时实际解除守护，维拉已到场时沿两米原路回到原等候点。0行动、0精神、0灵性仍可按公开选项结束或撤回。不另抽随机、发奖、退款、治疗、复原纸靶或抹去失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="守护者成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="守护者有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">成年外院值守埃德温持自己的普通短棍，在两米外的空院中；原普通出口清楚，对方不追击，也没有旁观者。可以交涉，或承担真实伤势与死亡风险。维拉不会加入这场战斗，现场没有可分担伤害的同伴；抽中分担槽只作普通格挡，不耗分担灵性，也不声称保护了不存在的人。</p>
      <p className="slice-muted">选择防守即本回合全程守护并放弃攻击；灵性足够时轮初支付3灵性，不足时仍不攻击，只能普通防御。即使取得回合优势也只守住位置，不能伤害埃德温；须另选进攻或撤退继续处理冲突。进攻时防御降低，守护不是回血或免死。</p>
      <div className="warrior-action-list" role="group" aria-label="守护者冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {guardian.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{guardian.story}</p></details>}
    {guardian.discovered && guardian.supplies && <section className="slice-notice" aria-label="守护者成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{guardian.supplies}</p>
    </section>}
    {guardian.discovered && guardian.bottles.length > 0 && <details className="seer-fold" open={!guardian.promoted}>
      <summary>守护者独立成品原瓶 · 来源与去向</summary>
      {guardian.bottles.map((bottle) => {
        const action = guardian.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !guardian.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !guardian.promoted && !guardian.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `guardian-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`guardian-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {guardian.discovered && !guardian.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{guardian.risk}</p></details>}
    {guardian.promoted && <section aria-label="守护者能力与消化">
      <h3>能力与消化 · {guardian.abilities.length} 项训练记录</h3>
      <p>扮演进度 {guardian.acting} · 消化：{guardian.digestion}</p>
      <progress className="cryptologist-progress" aria-label="守护者扮演进度" value={guardian.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {guardian.pollution}</p>
      {guardian.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="守护者能力边界">
        <summary>查看守护、实际承伤与继承能力边界</summary>
        <p>守护状态放弃攻击，换取极强的全类型防御；主动出手时防御降低。守护者不会被幻术迷惑，但这不等于读心、看穿所有秘密、自动标记邪恶或免疫所有非凡效果。</p>
        <p>{playerText("三项原创G实践使用各自真实原软垫摆锤，单次基准伤害6仅用于低强度试探。守护承压实付3灵性，成功本人实际损失1健康，失败仍实际损失2健康；出手实践实付3灵性，以自己的身体或已持原棍击中GD5-TARGET-1纸靶，本人实际损失3健康，不免费凝剑。")}</p>
        <p>{playerText("近旁成年同伴维拉须自愿参与并实际走到两米标记。实付3灵性后，成功把本次6点试探中的3点转由本人承受，她仍承受3点；失败不转移，她承受6点、本人不承接。三米范围与分担一半均为本作原创G数值；不是全场分担，不追溯转移旧伤，不递归转移，也不会治疗任何一方。")}</p>
        <p>普通路线可停止并移开本案原摆锤、拆卸原纸靶，或双方退出第三项试探，不耗灵性、不产生虚假承伤或能力掌握。已经移开的装置与已拆原靶不会凭空复原；每项有限报告与反思只结算一次。</p>
        <p>{playerText("真实战斗选择防守时整轮不攻击，3灵性只在轮初实际支付一次；已支付守护的敌方有效攻击贡献按0.35计，进攻姿态按较弱的0.75计，灵性不足的防守回退普通防御。倍率仅是本作原创G的一次战斗贡献减免，不额外乘健康伤害，也不与旧光甲重复相乘。守住位置仍可能受伤或死亡。")}</p>
        <p>晨曦、晨曦铠甲、凝聚武器与光之风暴继承原能力ID与掌握。晨曦剑须实际凝聚，光之风暴需已有剑并实际耗灵，会失剑且使自身光甲受损；不自动借棍、补剑或补甲。守护者本页不提供序列4猎魔人的邪恶与污染辨识、隐藏意图、怪物弱点、专用材料与针对性药膏、神话生物形态。</p>
        <p>{playerText("原著能力边界之外，三项有限实践、软垫试探、距离、伤害、消耗、判定、导师准备、独立成品渠道与消化数值均为本作原创G。完整配方和晋升仪式细节仍待核实，不能断言无需仪式。")}</p>
      </details>
      <details className="seer-fold" aria-label="守护者本场临时装备">
        <summary>本场实际晨曦剑甲</summary>
        <dl className="seer-facts">
          <div><dt>晨曦剑</dt><dd>{guardian.battleEquipment.swordReady ? "已实际凝聚，可按本场条件使用" : "当前没有待用晨曦剑"}</dd></div>
          <div><dt>本场失剑</dt><dd>{guardian.battleEquipment.swordLostRound === null ? "尚无本场失剑回合" : `第${guardian.battleEquipment.swordLostRound}回合`}</dd></div>
          <div><dt>晨曦甲</dt><dd>{guardian.battleEquipment.armorReady ? "已有本场临时光甲" : "当前没有待用光甲"}</dd></div>
          <div><dt>本场光甲期限</dt><dd>{guardian.battleEquipment.armorExpiresRound === null ? "当前没有期限记录" : `至第${guardian.battleEquipment.armorExpiresRound}回合`}</dd></div>
        </dl>
        <p className="slice-muted">只显示守护者本场实际装备；旧黎明骑士遭遇的临时剑甲另存于历史，不能借回看补充装备。</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
