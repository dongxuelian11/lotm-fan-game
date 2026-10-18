import type { TownAction, TownCommand, TownItem, TownProjection } from "../domain/town/types";

interface TownPanelProps {
  town: TownProjection;
  cash: string;
  actionsRemaining: number;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: TownCommand) => void;
  onOpenGrowth?: () => void;
}

/** All items, prices, gates and commands come from the committed public projection. */
export function TownPanel({ town, cash, actionsRemaining, busy, blocked, onCommand, onOpenGrowth }: TownPanelProps) {
  const carried = town.items.filter((item) => item.owner === "PLAYER" || item.owner === "BORROWED");
  const stock = town.items.filter((item) => item.owner === "SHOP");
  const carriedActions = town.actions.filter((action) =>
    action.command.type === "EQUIP_CLUB" || action.command.type === "UNEQUIP_CLUB" || action.command.type === "USE_BANDAGE",
  );
  const shopActions = town.actions.filter((action) => !carriedActions.includes(action));

  function itemRow(item: TownItem) {
    return <li key={item.id} className="town-item">
      <div><strong>{item.label} × {item.quantity}</strong><p>{item.description}</p></div>
      <span className="town-item-location">{item.owner === "BORROWED" ? "借用保管，所有人未变" : item.equipped ? "已装备" : item.owner === "PLAYER" ? "随身携带" : "店内货品"}</span>
    </li>;
  }
  function actionButton(action: TownAction) {
    return <div key={action.id} className="town-action">
      <button
        className="slice-choice"
        disabled={busy || blocked || !action.enabled}
        aria-describedby={action.reason ? `town-reason-${action.id}` : undefined}
        onClick={() => {
          if (!busy && !blocked && action.enabled) onCommand(action.command);
        }}
      >
        <strong>{action.label}</strong>
        <span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p id={`town-reason-${action.id}`} className="town-action-reason">{action.reason}</p>}
    </div>;
  }

  return <section className="town-panel" aria-label={town.title} aria-busy={busy}>
    <div className="town-resources" aria-label="当前交易资源"><span>现金 {cash}</span><span>剩余 {actionsRemaining} 行动</span></div>
    <section aria-label="随身物品">
      <h3>随身物品</h3>
      {carried.length > 0 ? <ul className="town-items">{carried.map(itemRow)}</ul> : <p className="slice-muted">当前没有随身物品。</p>}
      <div className="town-actions">{carriedActions.map(actionButton)}</div>
      {onOpenGrowth && <button className="slice-button quiet town-growth-link" disabled={busy || blocked} onClick={onOpenGrowth}>前往非凡成长</button>}
    </section>
    <section aria-label="商店">
      <h3>{town.shopKnown ? "已知商店" : "寻找生活补给"}</h3>
      {town.stockSummary && <p className="slice-muted">{town.stockSummary}</p>}
      {stock.length > 0 && <ul className="town-items">{stock.map(itemRow)}</ul>}
      <div className="town-actions">{shopActions.map(actionButton)}</div>
    </section>
    {busy && <p role="status">正在结算并保存，请稍候。</p>}
  </section>;
}
