import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MarauderAction, MarauderCommand, MarauderProjection } from "../domain/marauder/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原物与许可范围",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际执行，请核对原物去向",
  RESOLVED: "已交还原物并提交本次报告",
};

const DISPUTE_STATUS: Record<string, string> = {
  UNSEEN: "尚未观察现场",
  OBSERVED: "已观察，尚未介入",
  READY: "已确认普通退路，尚未开战",
  ACTIVE: "冲突进行中",
  RESOLVED: "本场已结束",
};

/** The encounter record receives only already-public facts and has no controls. */
function DisputeRecord({ dispute }: { dispute: MarauderProjection["dispute"] }) {
  return <>
    <span className="slice-eyebrow">和平实践之外 · 可选遭遇</span>
    <h3>{dispute.title}</h3>
    <p>{dispute.description}</p>
    <p className="slice-muted">现场状态：{DISPUTE_STATUS[dispute.stage] ?? "状态待核实"}</p>
    {dispute.weapon ? <section className="seer-fold" aria-label="争端原短棍的归属与持有">
      <h4>同一原短棍 · 当前公开记录</h4>
      <dl className="seer-facts">
        <div><dt>原物编号</dt><dd>{dispute.weapon.id}</dd></div>
        <div><dt>原主人</dt><dd>{dispute.weapon.owner}</dd></div>
        <div><dt>当前持有／保管</dt><dd>{dispute.weapon.custodian}</dd></div>
        <div><dt>已知位置</dt><dd>{dispute.weapon.location}</dd></div>
        <div><dt>原物记录版本</dt><dd>{dispute.weapon.version}</dd></div>
        <div><dt>现场注意</dt><dd>{dispute.attention}</dd></div>
      </dl>
      <p className="slice-muted">实际持有与所有权分别记录。死亡或投降不会自动转让原物；登记柜保管也不等于原主人已经领回。</p>
    </section> : <p className="slice-muted">尚未亲见现场，原工具的编号、归属、持有与位置仍未公开。</p>}
    {dispute.outcome && <p className="slice-notice">本场结果：{dispute.outcome}</p>}
  </>;
}

function OriginalRecords({ originals }: { originals: MarauderProjection["originals"] }) {
  return <section className="marauder-originals" aria-label="已观察原物的归属与持有">
    <h3>已观察原物 · 归属与当前持有</h3>
    <p className="slice-muted">这里只显示已公开的原物记录。主人与当前持有者分别保留，取走、交还和报告各自结算。</p>
    {originals.map((original) => <article className="seer-fold" key={original.id} aria-label={original.label}>
      <h4>{original.label}</h4>
      <dl className="seer-facts">
        <div><dt>原主人</dt><dd>{original.owner}</dd></div>
        <div><dt>当前持有／保管</dt><dd>{original.custodian}</dd></div>
        <div><dt>已知位置</dt><dd>{original.location}</dd></div>
        <div><dt>封口状态</dt><dd>{original.sealed ? "原封完整" : "无封口"}</dd></div>
        <div><dt>原物记录版本</dt><dd>{original.version}</dd></div>
      </dl>
    </article>)}
  </section>;
}

/** Other-pathway history has no mutation callback or actionable controls. */
export function MarauderHistory({ marauder, advanced = false, currentTitle = "诈骗师" }: { marauder: MarauderProjection; advanced?: boolean; currentTitle?: "诈骗师" | "解密学者" | "盗火人" }) {
  const title = advanced ? "偷盗者时期的经历" : "偷盗者渠道经历";
  return <section className="seer-panel marauder-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">{advanced ? `你已晋升${currentTitle}。偷盗者时期的原物归属、争端、原瓶与能力记录保留在这里；当前实践请回到${currentTitle}卷宗。` : "已选择其它途径，这份偷盗者渠道只供回看。"}</p>
    {advanced && <p>偷盗者扮演进度 {marauder.acting} · {marauder.digestion}</p>}
    {marauder.story && <p>{marauder.story}</p>}
    {marauder.supplies && <p>{marauder.supplies}</p>}
    {marauder.environment && <p>{marauder.environment}</p>}
    {marauder.originals.length > 0 && <OriginalRecords originals={marauder.originals} />}
    {marauder.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {(marauder.promoted || advanced) && <section className="seer-current-case" aria-label="维修院原工具争端">
      <DisputeRecord dispute={marauder.dispute} />
    </section>}
    {marauder.bottles.length > 0 && <details className="seer-fold" open>
      <summary>偷盗者原瓶 · 来源与去向</summary>
      {marauder.bottles.map((bottle) => <article className="marauder-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {marauder.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {marauder.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: MarauderAction): boolean {
  return "caseId" in action.command;
}

function isDisputeAction(action: MarauderAction): boolean {
  return ["OBSERVE_DISPUTE", "PREPARE_DISPUTE", "START_DISPUTE", "LEAVE_DISPUTE", "RETURN_TOOL"].includes(action.command.type);
}

interface MarauderPanelProps {
  marauder: MarauderProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: MarauderCommand) => void;
}

/** Only committed public facts can change ownership, custody, preparation or reports. */
export function MarauderPanel({ marauder, resources, busy, blocked, readOnly = false, onCommand }: MarauderPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = marauder.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = marauder.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = marauder.actions.filter(isCaseAction);
  const selectedCase = marauder.cases.find((entry) => entry.id === selectedCaseId)
    ?? marauder.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? marauder.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = marauder.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isDisputeAction(action));
  const disputeActions = marauder.promoted ? marauder.actions.filter(isDisputeAction) : [];
  const nextAction = marauder.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? disputeActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0] ?? disputeActions[0]
    : marauder.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !marauder.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || marauder.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, marauder.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MarauderAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || marauder.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: MarauderAction) {
    return (
      <div className="seer-action marauder-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `marauder-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`marauder-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <MarauderHistory marauder={marauder} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel marauder-panel seer-confirmation" aria-label="这瓶偷盗者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="偷盗者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{marauder.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{marauder.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="marauder-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "marauder-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel marauder-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="偷盗者成长下一步">
        <span className="seer-seal">{marauder.promoted ? "序列 9" : "偷盗者成长卷宗"}</span>
        <h3>{marauder.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份偷盗者渠道只供回看。</p>
        ) : marauder.promoted && marauder.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的原物实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{marauder.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{marauder.digestion}</p>
        {!marauder.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入任何家族或组织。原物归属与当前持有分别记录，实际取得不等于获得所有权。</p>
      </section>

      {marauder.promoted && <section className="slice-notice marauder-environment" aria-label="现场、许可与原物去向">
        <h4>现场、许可与原物去向</h4>
        <p>{marauder.environment || "尚未取得现场公开记录；原物的位置、持有者与本次结果须经实际观察和行动确认。"}</p>
      </section>}

      {marauder.originals.length > 0 && <OriginalRecords originals={marauder.originals} />}

      {selectedCase && (
        <section aria-label="偷盗者原物实践">
          <h3>原物、实际取得与归还</h3>
          <label className="seer-case-selector">
            选择原物实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {marauder.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case marauder-case" aria-label="当前原物实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="marauder-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察原物与现场；许可范围、当前持有与本次行动结果仍未知。</p>}
            </section>
            <section className="marauder-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的取得、归还与报告见原记录。"}</p>
            </section>
            <section className="slice-notice marauder-boundaries" aria-label="接触、归还与所有权">
              <h4>接触、归还与所有权</h4>
              <p>先观察现场与许可，再选择灵巧或普通方法。准备、实际执行、交还原物与报告分别提交，成本与限制见按钮。</p>
              <p className="slice-muted">眼前可接触的原物才可操作，不能远程读取库存或隔空取物。准备不会移动原物；拿到原物也不会改变主人。执行前可取消准备，实际取得后须真正归还，再报告已核实的经过。</p>
            </section>
            {selectedCase.result && <section className="marauder-result" aria-label="实际执行与报告记录">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="marauder-action-list" role="group" aria-label="当前原物实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="marauder-action-list" role="group" aria-label="偷盗者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {marauder.promoted && <section className="seer-current-case" aria-label="维修院原工具争端">
        <DisputeRecord dispute={marauder.dispute} />
        {disputeActions.length > 0 && <div className="marauder-action-list" role="group" aria-label="维修院争端行动">
          {disputeActions.map(actionButton)}
        </div>}
      </section>}

      {marauder.story && <p className="slice-muted">{marauder.story}</p>}

      {marauder.discovered && <section className="slice-notice marauder-source" aria-label="偷盗者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段由独立失物登记员艾德温·洛克提供有独立来源记录的成品原瓶，不提供调配；导师、渠道、场景与数值属于本作游戏设定。")}</p>
        {marauder.supplies && <p>{marauder.supplies}</p>}
      </section>}
      {marauder.discovered && marauder.bottles.length > 0 && (
        <details className="seer-fold marauder-bottles" open={!marauder.promoted}>
          <summary>导师的独立成品原瓶 · 来源与去向</summary>
          {marauder.bottles.map((bottle) => {
            const action = marauder.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !marauder.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !marauder.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `marauder-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`marauder-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {marauder.discovered && !marauder.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{marauder.risk}</p></details>}
      {marauder.promoted && (
        <section className="marauder-abilities" aria-label="偷盗者能力与消化">
          <h3>能力与消化 · {marauder.abilities.length} 项能力</h3>
          <p className="slice-muted">敏捷、灵巧与偷取是序列9的三个训练分类。只对眼前实际可接触的普通原物生效，不提供宝物感应、远程库存或能力窃取。</p>
          <p>扮演进度 {marauder.acting} · 消化：{marauder.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {marauder.pollution}</p>
          {marauder.abilities.map((ability) => (
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
