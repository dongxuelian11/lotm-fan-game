import { sliceCreationCatalogue } from "../content/slice-creation";
import type { SliceProjection } from "../domain/slice/types";

type MoneyFormat = (pence: number) => string;
export interface SettlementChange {
  runId: string;
  revision: number;
  fromWeek: number;
  toWeek: number;
  changes: { label: string; before: number; after: number; money?: boolean }[];
}

/** Only compare confirmed, newer public snapshots from the same run. */
export function settlementChange(before: SliceProjection | null, after: SliceProjection): SettlementChange | null {
  if (!before || before.runId !== after.runId || after.revision <= before.revision) return null;
  const changes = [
    { label: "现金", before: before.cash, after: after.cash, money: true },
    { label: "行动点", before: before.actionsRemaining, after: after.actionsRemaining },
    { label: "健康", before: before.health, after: after.health },
    { label: "精神", before: before.mind, after: after.mind },
    { label: "灵性", before: before.spirituality, after: after.spirituality },
    { label: "知识", before: before.character.coreStats.knowledge, after: after.character.coreStats.knowledge },
    { label: "债务余额", before: before.debtTotal, after: after.debtTotal, money: true },
  ].filter(change => change.before !== change.after);
  if (!changes.length && before.week === after.week) return null;
  return { runId: after.runId, revision: after.revision, fromWeek: before.week, toWeek: after.week, changes };
}

export function DailyStateSummary({ state, money }: { state: SliceProjection; money: MoneyFormat }) {
  const current = sliceCreationCatalogue.livingStandards.find(tier => tier.id === state.lifeTier);
  const planned = sliceCreationCatalogue.livingStandards.find(tier => tier.id === state.nextLifeTier);
  return <section className="slice-daily-summary" aria-label="本周状态与生活预算">
    <div className="slice-daily-summary-heading"><strong>第 {state.week} 周 · 行动 {state.actionsRemaining}/{state.weeklyBudget}</strong><span>现金 {money(state.cash)}</span></div>
    <dl className="slice-daily-vitals">
      <div><dt>健康</dt><dd>{state.health}/{state.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{state.mind}/{state.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{state.spirituality}/{state.maxSpirituality}</dd></div>
    </dl>
    <p>本周末生活费：{current ? `${current.label} · ${money(current.weeklyCostPence)}` : "未提供"}；债务余额：{money(state.debtTotal)}。</p>
    {state.nextLifeTier !== state.lifeTier && <p>下周计划：{planned ? `${planned.label} · 每周 ${money(planned.weeklyCostPence)}` : "未提供"}（不改变本周生活费）。</p>}
    <small>生活费不含还债及其他收支；债务余额不是本周应还额。</small>
  </section>;
}

export function SettlementSummary({ change, money }: { change: SettlementChange | null; money: MoneyFormat }) {
  if (!change) return null;
  const crossedWeek = change.fromWeek !== change.toWeek;
  return <section className="slice-settlement-summary" aria-label="本次结算净变化" role="status">
    <strong>本次结算净变化{crossedWeek ? "（含跨周结算）" : ""}</strong>
    {crossedWeek && <p>第 {change.fromWeek} 周 → 第 {change.toWeek} 周；以下合并行动与周结算，不代表单次行动奖励。</p>}
    <ul>{change.changes.map(item => <li key={item.label}>{item.label}：{item.money ? money(item.before) : item.before} → {item.money ? money(item.after) : item.after}</li>)}</ul>
  </section>;
}
