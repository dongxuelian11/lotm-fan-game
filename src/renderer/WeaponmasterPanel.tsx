import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WeaponmasterAction, WeaponmasterCommand, WeaponmasterProjection } from "../domain/weaponmaster/types";
import type { SeerResources } from "./SeerPanel";
import type { GladiatorProjection } from "../domain/gladiator/types";
import "./seer-styles.css";
import "./cryptologist-styles.css";
import type { WarriorProjection } from "../domain/warrior/types";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原工具、目标与协作边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际练习，等待核对并报告",
  RESOLVED: "已完成本次练习报告",
};

/** The earlier S8 dossier intentionally has no command callback. */
export function GladiatorHistory({ gladiator }: { gladiator: GladiatorProjection }) {
  const status: Record<string, string> = {
    AVAILABLE: "尚未观察", OBSERVED: "已观察距离、许可与停止信号", PREPARED: "已选定方法并完成准备",
    EXAMINED: "已实际练习，等待核对接触与报告", RESOLVED: "已实际停止并完成本次报告",
  };
  return <section className="seer-panel warrior-panel" aria-label="格斗家时期的经历">
    <h3>格斗家时期的经历</h3>
    <p className="slice-notice">你已晋升武器大师。这里保留格斗家时期的原观察、实际方法、接触与停止记录、原瓶来源和能力掌握；当前实践请回到武器大师卷宗。</p>
    <p>格斗家扮演进度 {gladiator.acting} · {gladiator.digestion}</p>
    {gladiator.story && <p>{gladiator.story}</p>}
    {gladiator.environment && <p className="slice-muted">{gladiator.environment}</p>}
    {gladiator.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {status[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}><h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul></section>}
      {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原方式与准备</h4><p>{entry.preparation}</p></section>}
      <p>接触状态：{entry.contact}</p>
      {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际结果与停止记录</h4><p>{entry.result}</p></section>}
    </details>)}
    {gladiator.supplies && <p className="slice-muted">{gladiator.supplies}</p>}
    {gladiator.bottles.length > 0 && <details className="seer-fold"><summary>格斗家原瓶 · 来源与去向</summary>
      {gladiator.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {gladiator.abilities.length > 0 && <details className="seer-fold"><summary>已继承的格斗家能力</summary>
      {gladiator.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: WeaponmasterAction): boolean {
  return "caseId" in action.command;
}

interface WeaponmasterPanelProps {
  weaponmaster: WeaponmasterProjection;
  resources: SeerResources;
  tool?: WarriorProjection["tool"];
  busy: boolean;
  blocked: boolean;
  onCommand: (command: WeaponmasterCommand) => void;
}

/** The shared original tool and all results are read-only committed facts; actions remain public intents. */
export function WeaponmasterPanel({ weaponmaster, resources, tool = null, busy, blocked, onCommand }: WeaponmasterPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = weaponmaster.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = weaponmaster.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = weaponmaster.actions.filter(isCaseAction);
  const selectedCase = weaponmaster.cases.find((scene) => scene.id === selectedCaseId)
    ?? weaponmaster.cases.find((scene) => scene.status === "EXAMINED")
    ?? weaponmaster.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? weaponmaster.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? weaponmaster.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = weaponmaster.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = weaponmaster.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? caseActions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : weaponmaster.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !weaponmaster.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || weaponmaster.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, weaponmaster.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WeaponmasterAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || weaponmaster.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: WeaponmasterAction) {
    return (
      <div className="seer-action cryptologist-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => {
            if (busy || blocked || !action.enabled) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `weaponmaster-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`weaponmaster-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel cryptologist-panel weaponmaster-panel seer-confirmation" aria-label="这瓶武器大师魔药的服用确认" aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!confirmationLocked) setSelectedBottleId(null);
          }
        }}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="武器大师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{weaponmaster.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{weaponmaster.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="weaponmaster-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "weaponmaster-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel cryptologist-panel weaponmaster-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="武器大师成长下一步">
        <span className="seer-seal">{weaponmaster.promoted ? "序列 7" : "武器大师晋升卷宗"}</span>
        <h3>{weaponmaster.title}</h3>
        {weaponmaster.promoted && weaponmaster.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的原工具、练习结果与报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{weaponmaster.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{weaponmaster.digestion}</p>
        {!weaponmaster.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成格斗家消化与成熟时间，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("这是游戏设定（G）的新渠道独立成品药，沿用原创成年导师奥斯温·布莱克特；完整配方待核，指导不解锁材料采购或制造，也不会建立组织身份。")}</p>
      </section>

      {weaponmaster.promoted && <section className="slice-notice weaponmaster-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{weaponmaster.environment || "现场尚未确认，请先观察原工具、实际目标与协作边界。"}</p>
      </section>}

      {tool && <section className="seer-fold weaponmaster-tool" aria-label="训练原棍的归属与持有">
        <h4>训练原棍 · 当前公开记录</h4>
        <dl className="seer-facts">
          <div><dt>原物编号</dt><dd>{tool.id}</dd></div>
          <div><dt>原主人</dt><dd>{tool.owner}</dd></div>
          <div><dt>当前持有／保管</dt><dd>{tool.custodian}</dd></div>
          <div><dt>已知位置</dt><dd>{tool.location}</dd></div>
          <div><dt>原物记录版本</dt><dd>{tool.version}</dd></div>
        </dl>
        <p className="slice-muted">这里沿用战士时期的同一根原短棍。借用不转移所有权，取消准备不代表实际归还；以保存后的公开记录为准。</p>
      </section>}

      {selectedCase && (
        <section aria-label="武器大师实践记录">
          <h3>原工具、有限练习与报告</h3>
          <p className="slice-muted">先观察原工具、已知标记与交接条件，再选择武器技巧或普通团队方法。实际执行后按结果报告；取消准备不退回已付成本，也不等于实际交还原棍。各步消耗与可否执行以公开按钮为准。</p>
          <label className="seer-case-selector">
            选择武器实践情境
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {weaponmaster.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? scene.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前武器实践情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="seer-fold weaponmaster-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。原工具是否适合、目标的已知边界与本次结果仍未确认。</p>}
            </section>
            <section className="weaponmaster-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "尚未选定本次方法；不会自动取得武器、完成练习或替你作出结论。"}</p>
            </section>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">练习已有实际结果。请核对原工具与已知标记，再提交报告；尚未完成报告与奖励结算。</p>}
            {selectedCase.result && <section className="slice-notice weaponmaster-result" aria-label="实际武器实践结果"><h4>实际武器实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="cryptologist-action-list" role="group" aria-label="当前情境行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="cryptologist-action-list" role="group" aria-label="武器大师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {weaponmaster.story && <p className="slice-muted weaponmaster-source">{weaponmaster.story}</p>}

      {weaponmaster.discovered && weaponmaster.supplies && <p className="slice-notice">{weaponmaster.supplies}</p>}
      {weaponmaster.discovered && weaponmaster.bottles.length > 0 && (
        <details className="seer-fold weaponmaster-bottles" open={!weaponmaster.promoted}>
          <summary>武器大师独立成品原瓶 · 来源与去向</summary>
          {weaponmaster.bottles.map((bottle) => {
            const action = weaponmaster.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !weaponmaster.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !weaponmaster.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `weaponmaster-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`weaponmaster-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {weaponmaster.discovered && !weaponmaster.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{weaponmaster.risk}</p></details>}
      {weaponmaster.promoted && (
        <section className="weaponmaster-abilities" aria-label="武器大师能力与消化">
          <h3>能力与消化 · {weaponmaster.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("武器技巧与有限薄弱处判断属于本阶段的游戏设定（G）实践分类；继承战士与格斗家的原能力和掌握记录。必须使用实际在手的原武器，不凭空获得装备或看穿所有弱点。仍会受到精神影响与恐惧干扰；序列6晨曦铠甲、晨曦武器与光之风暴尚未开放。")}</p>
          <p>扮演进度 {weaponmaster.acting} / 100 · 消化：{weaponmaster.digestion}</p>
          <progress className="cryptologist-progress" aria-label="武器大师扮演进度" value={weaponmaster.acting} max={100} />
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {weaponmaster.pollution}</p>
          {weaponmaster.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
        </section>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
