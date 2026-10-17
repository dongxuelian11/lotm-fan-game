import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { AppraiserAction, AppraiserCommand, AppraiserProjection } from "../domain/appraiser/types";
import type { ArchaeologistProjection } from "../domain/archaeologist/types";
import type { SavantProjection } from "../domain/savant/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

interface AppraiserPanelProps {
  appraiser: AppraiserProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: AppraiserCommand) => void;
}

const ITEM_STATUS: Record<string, string> = {
  AVAILABLE: "等待许可与检查", EXAMINED: "已检查，等待鉴定", IDENTIFIED: "已鉴定用途与隐患，等待交付", RESOLVED: "鉴定记录已交付",
};
const PROJECT_STATUS: Record<string, string> = {
  UNREAD: "尚未学习", LEARNED: "已学图纸，等待制作", READY: "成品待交付", DELIVERED: "已交付",
};
const SITE_STATUS: Record<string, string> = {
  AVAILABLE: "等待许可与现场勘察", SURVEYED: "已有现场记录，等待核实", RESOLVED: "探索记录已核实交付",
};

/** Earlier originals and committed findings stay visible without re-enabling former actions. */
function ParagonRecords({ pathway, name }: { pathway: SavantProjection | ArchaeologistProjection; name: string }) {
  return <>
    {pathway.bottles.length > 0 && <details className="seer-fold">
      <summary>{name}原瓶 · 来源与去向</summary>
      {pathway.bottles.map((bottle) => <article className="appraiser-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {pathway.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{name}能力</summary>
      {pathway.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </>;
}

export function AppraiserSavantHistory({ savant }: { savant: SavantProjection }) {
  return <section className="seer-panel" aria-label="通识者时期的经历">
    <h3>通识者时期的经历</h3>
    <p className="slice-notice">这里保留通识者时期的工坊委托、已学工序与原瓶记录。当前实践请回到鉴定师卷宗。</p>
    <p>通识者扮演进度 {savant.acting} · {savant.digestion}</p>
    {savant.projects.length > 0 && <section aria-label="通识者工坊记录">
      {savant.projects.map((project) => <details className="seer-fold" key={project.id}>
        <summary>{project.title} · {PROJECT_STATUS[project.status] ?? project.status}</summary>
        <p>{project.story}</p>{project.plan && <p>{project.plan}</p>}
        <p>实际材料：{project.materials}</p><p>借用工具：{project.tool}</p>
      </details>)}
    </section>}
    <ParagonRecords pathway={savant} name="通识者" />
  </section>;
}

export function ArchaeologistHistory({ archaeologist }: { archaeologist: ArchaeologistProjection }) {
  return <section className="seer-panel" aria-label="考古学家时期的经历">
    <h3>考古学家时期的经历</h3>
    <p className="slice-notice">这里保留考古学家时期的现场记录、实际探索结果与原瓶记录。当前实践请回到鉴定师卷宗。</p>
    <p>考古学家扮演进度 {archaeologist.acting} · {archaeologist.digestion}</p>
    {archaeologist.sites.length > 0 && <section aria-label="考古学家探索记录">
      {archaeologist.sites.map((site) => <details className="seer-fold" key={site.id}>
        <summary>{site.title} · {SITE_STATUS[site.status] ?? site.status}</summary>
        <p>{site.story}</p>
        {site.observations.length > 0 && <ul>{site.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
        {site.result && <p>实际探索结果：{site.result}</p>}
      </details>)}
    </section>}
    <ParagonRecords pathway={archaeologist} name="考古学家" />
  </section>;
}

/** The renderer never imports item contents or infers a finding from an item's identity. */
export function AppraiserPanel({ appraiser, resources, busy, blocked, onCommand }: AppraiserPanelProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = appraiser.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = appraiser.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const itemActions = appraiser.actions.filter((action) => "itemId" in action.command);
  const actionsForItem = (id: string) => itemActions.filter((action) => "itemId" in action.command && action.command.itemId === id);
  const selectedItem = appraiser.items.find((item) => item.id === selectedItemId)
    ?? appraiser.items.find((item) => actionsForItem(item.id).some((action) => action.enabled))
    ?? appraiser.items[0];
  const selectedItemActions = selectedItem ? actionsForItem(selectedItem.id) : [];
  const remainingActions = appraiser.actions.filter((action) => action.command.type !== "CONSUME" && !("itemId" in action.command));
  const nextAction = appraiser.promoted
    ? selectedItemActions.find((action) => action.enabled) ?? remainingActions.find((action) => action.enabled)
      ?? selectedItemActions[0] ?? remainingActions[0]
    : appraiser.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? remainingActions.find((action) => action.enabled) ?? remainingActions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !appraiser.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || appraiser.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, appraiser.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: AppraiserAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || appraiser.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }
  function actionButton(action: AppraiserAction) {
    return <div className="seer-action appraiser-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || blocked || !action.enabled}
        onClick={() => onCommand(action.command)} aria-describedby={action.reason ? `appraiser-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`appraiser-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  if (confirming && selectedBottle && selectedAction) return <section className="seer-panel appraiser-panel seer-confirmation" aria-label="这瓶鉴定师魔药的服用确认" aria-busy={busy}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="鉴定师服用风险与四档结果">
      <strong>服用风险与四档结果</strong><p>{appraiser.risk}</p>
    </section>
    <section aria-label="服药前当前资源" className="seer-current-resources">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{appraiser.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedAction.reason && <p className="seer-action-reason" id="appraiser-confirm-reason">{selectedAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedAction.reason ? "appraiser-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
  </section>;

  const bottleRecords = appraiser.bottles.map((bottle) => {
    const action = !appraiser.promoted ? appraiser.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id) : undefined;
    return <article className="seer-bottle" key={bottle.id}>
      <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
      {action && <div>
        <button className="slice-button" disabled={busy || blocked || !action.enabled}
          ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
          onClick={() => openBottle(action)} aria-describedby={action.reason ? `appraiser-bottle-${bottle.id}` : undefined}>
          查看并准备服用「{bottle.title}」
        </button>
        <p className="seer-small-note">{action.cost}</p>
        {action.reason && <p className="seer-action-reason" id={`appraiser-bottle-${bottle.id}`}>{action.reason}</p>}
      </div>}
    </article>;
  });

  return <div className="seer-panel appraiser-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="鉴定师成长下一步">
      <span className="seer-seal">{appraiser.promoted ? "序列 7" : "鉴定师晋升准备"}</span>
      <h3>{appraiser.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{appraiser.promoted ? `扮演进度 ${appraiser.acting} · ${appraiser.digestion}` : appraiser.digestion}</p>
    </section>

    {appraiser.promoted && selectedItem && <section aria-label="鉴定师物品委托">
      <label className="seer-case-selector">选择鉴定原物
        <select value={selectedItem.id} disabled={busy || blocked} onChange={(event) => setSelectedItemId(event.target.value)}>
          {appraiser.items.map((item) => <option key={item.id} value={item.id}>{item.title} · {ITEM_STATUS[item.status] ?? item.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前鉴定原物">
        <h3>{selectedItem.title}</h3><p className="slice-muted">{ITEM_STATUS[selectedItem.status] ?? selectedItem.status}</p><p>{selectedItem.story}</p>
        <section className="seer-fold" aria-label="亲自检查的记录">
          <h4>亲自检查的记录</h4>
          {selectedItem.observations.length > 0
            ? <ul>{selectedItem.observations.map((observation, index) => <li key={`${selectedItem.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚未留下可用的检查记录。</p>}
        </section>
        <section className="seer-fold" aria-label="已公开的鉴定结论">
          <h4>用途与鉴定结论</h4>
          {selectedItem.finding ? <p>{selectedItem.finding}</p> : <p className="slice-muted">用途尚不明确，等待实际鉴定。</p>}
        </section>
        <section className="seer-fold appraiser-item-risk" aria-label="已公开的物品隐患">
          <h4>已知隐患</h4>
          {selectedItem.risk ? <p>{selectedItem.risk}</p> : <p className="slice-muted">隐患尚未查明，不代表安全。</p>}
        </section>
        <div className="appraiser-action-list" role="group" aria-label="当前原物的鉴定行动">{selectedItemActions.map(actionButton)}</div>
      </section>
    </section>}
    {appraiser.promoted && appraiser.environment && <section className="slice-notice" aria-label="当前鉴定环境">
      <h4>现场与保管</h4><p>{appraiser.environment}</p>
    </section>}
    {appraiser.promoted && <details className="seer-fold">
      <summary>查看鉴定与试用边界</summary>
      <p>先检查原物，再鉴定用途与隐患。鉴定不会自动激活物品；交付报告可以作为处理方式，不必为了完成委托冒险试用。</p>
      <p>这些是本作原创物品与有限情境。只保留实际公开的记录，鉴定不等于知晓完整来历或所有真相。</p>
    </details>}
    {remainingActions.length > 0 && <section aria-label={appraiser.promoted ? "鉴定师成长行动" : "鉴定师成品药渠道"}>
      {!appraiser.promoted && <h4>成品药与准备</h4>}
      <div className="seer-actions">{remainingActions.map(actionButton)}</div>
    </section>}
    {appraiser.story && <p className="slice-muted">{appraiser.story}</p>}
    {appraiser.discovered && !appraiser.promoted && <section aria-label="鉴定师供货说明">
      {appraiser.supplies && <p className="slice-notice">{appraiser.supplies}</p>}
      <p className="slice-muted">{playerText("完整配方尚未核实。本阶段使用明确标记为游戏设定（G）的有限成品药渠道；取得原瓶与确认服用是两个独立步骤。")}</p>
    </section>}
    {appraiser.discovered && appraiser.bottles.length > 0 && (appraiser.promoted
      ? <details className="seer-fold"><summary>鉴定师原瓶 · 来源与去向</summary>{bottleRecords}</details>
      : <section className="seer-bottles" aria-label="鉴定师独立原瓶"><h3>鉴定师独立原瓶</h3>{bottleRecords}</section>)}
    {appraiser.discovered && !appraiser.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{appraiser.risk}</p></details>}
    {appraiser.promoted && <details className="seer-fold" aria-label="鉴定师能力与消化">
      <summary>能力与消化 · {appraiser.abilities.length} 项能力</summary>
      <p>灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {appraiser.pollution}</p>
      {appraiser.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
  </div>;
}
