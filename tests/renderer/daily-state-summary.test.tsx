/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createSliceRun, projectSliceState } from "../../src/domain/slice/index";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { DailyStateSummary, SettlementSummary, settlementChange } from "../../src/renderer/DailyStateSummary";
const state = () => projectSliceState(createSliceRun("summary-test", sliceDefaultCreationSelection, "summary-test"));
const money = (pence: number) => `${pence}便士`;
afterEach(cleanup);
describe("public daily ledger", () => {
  it("separates this week's tier from next week's plan and debt balance", () => {
    const current = { ...state(), lifeTier: "ORDINARY" as const, nextLifeTier: "POOR" as const, cash: 300, debtTotal: 900 };
    render(<DailyStateSummary state={current} money={money} />);
    expect(screen.getByText(/本周末生活费：普通 · 300便士；债务余额：900便士/)).toBeTruthy();
    expect(screen.getByText(/下周计划：贫困 · 每周 120便士（不改变本周生活费）/)).toBeTruthy();
    expect(screen.getByText(/债务余额不是本周应还额/)).toBeTruthy();
    expect(screen.queryByText(/足够|负担得起/)).toBeNull();
    expect(screen.getByText("健康")).toBeTruthy();
    expect(screen.getByText("精神")).toBeTruthy();
    expect(screen.getByText("灵性")).toBeTruthy();
  });
  it("compares only public resources without modifying either snapshot", () => {
    const before = state();
    const after = { ...before, revision: before.revision + 1, cash: before.cash + 120, actionsRemaining: before.actionsRemaining - 1 };
    const source = JSON.stringify([before, after]);
    const change = settlementChange(before, after);
    expect(change?.changes.map(item => item.label)).toEqual(["现金", "行动点"]);
    expect(JSON.stringify([before, after])).toBe(source);
  });
  it("rejects absent, foreign, equal and stale snapshots, and no-resource-change results", () => {
    const before = state();
    expect(settlementChange(null, before)).toBeNull();
    expect(settlementChange(before, { ...before, runId: "other", revision: before.revision + 1 })).toBeNull();
    expect(settlementChange(before, before)).toBeNull();
    expect(settlementChange(before, { ...before, revision: before.revision - 1 })).toBeNull();
    expect(settlementChange(before, { ...before, revision: before.revision + 1 })).toBeNull();
  });
  it("labels AP reset and resource recovery as net changes including weekly settlement", () => {
    const before = { ...state(), actionsRemaining: 1, spirituality: 3 };
    const after = { ...before, revision: before.revision + 1, week: before.week + 1, actionsRemaining: 3, spirituality: 8, debtTotal: 12 };
    render(<SettlementSummary change={settlementChange(before, after)} money={money} />);
    expect(screen.getByText("本次结算净变化（含跨周结算）")).toBeTruthy();
    expect(screen.getByText(/不代表单次行动奖励/)).toBeTruthy();
    expect(screen.getByText("行动点：1 → 3")).toBeTruthy();
    expect(screen.getByText("灵性：3 → 8")).toBeTruthy();
    expect(screen.getByText(/债务余额：.* → 12便士/)).toBeTruthy();
  });
});
