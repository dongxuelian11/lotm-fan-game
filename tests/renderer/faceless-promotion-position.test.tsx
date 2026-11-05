/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { FACELESS_FORMULA, FACELESS_CONSUMPTION_RISK } from "../../src/domain/faceless/content";
import type { FacelessAction, FacelessCommand, FacelessProjection } from "../../src/domain/faceless/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";
function action(command: FacelessCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): FacelessAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_FORMULA" }, "向原指导者学习无面人配方", true, "360便士 · 1行动");
function faceless(patch: Partial<FacelessProjection> = {}): FacelessProjection {
  return {
    title: "无面人晋升", discovered: true, promoted: false, formulaKnown: false,
    formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "魔术师扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk: FACELESS_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "",
    appearance: { templateId: "SELF", label: "本人原貌", voice: "本人原声", summary: "外貌与声音均为本人，尚未采用模板。", source: "本人原有外貌", heightOffsetCm: 0, persistent: false },
    outfit: { id: "FC6-PROP-COAT-1", label: "原排练道具服", location: "原衣柜", summary: "同一原物尚未借出，借出0次，归还0次。" },
    ...patch,
  };
}
function bottled(): FacelessProjection {
  return faceless({ formulaKnown: true, formula: [...FACELESS_FORMULA],
    actions: ["faceless-batch-1:bottle", "faceless-batch-2:bottle"].map((bottleId) => action(
      { type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: [
      { id: "faceless-batch-1:bottle", title: "第一瓶无面人魔药", source: "第一批六项实际原料，完成五步劳务后独立调配", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "faceless-batch-1:bottle", confirmed: true } },
      { id: "faceless-batch-2:bottle", title: "第二瓶无面人魔药", source: "第二批六项实际采购原料的调配记录", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "faceless-batch-2:bottle", confirmed: true } },
    ],
  });
}
function fixture(sequence: 7 | 6 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("faceless-scroll-run", sliceDefaultCreationSelection, "faceless-scroll-seed");
  raw.week = 50; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
  raw.seer.discovered = true; raw.seer.formulaKnown = true;
  raw.progression = { pathwayId: "diviner", sequence, acting: 100, promotionWeek: 5, mastery: {} };
  raw.magician.formulaKnown = true; raw.magician.promotionWeek = 22;
  return { ...projectSliceState(raw), investigateTargets: [], canAct: true, actionBlockedReason: null,
    faceless: faceless({ promoted: sequence === 6 }), ...patch };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state,
      runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week,
        date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-11T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-11T00:01:00Z", replayed: false, state } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
const scrollIntoView = vi.fn();
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  scrollIntoView.mockClear();
});
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Faceless successful-promotion scroll entry", () => {
  const practice = action({ type: "RESTORE_SELF" }, "复原本人");
  function promotedProjection(state: SliceProjection, sameRun = true): SliceProjection {
    const next = fixture(6, { faceless: faceless({ promoted: true, actions: [practice] }) });
    const record = { id: "promotion-scroll-result", week: state.week, title: "无面人晋升成功", text: "原瓶已消耗，进入真实无面人成长。" };
    return { ...next, runId: sameRun ? state.runId : "different-promoted-run", revision: state.revision + 1,
      lastResult: record, chronicle: [...state.chronicle, record] };
  }
  async function openConsumption(value: SliceBridge) {
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "无面人晋升" }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    return screen.getByRole("dialog", { name: "非凡成长" });
  }

  it("resets the same dialog on confirmed same-run promotion once, not on later S6 practice", async () => {
    const state = fixture(7, { faceless: bottled() }), value = bridge(state), promoted = promotedProjection(state);
    const practicedRecord = { id: "s6-practice-scroll-result", week: promoted.week, title: "完成本次实践", text: "后续实践不重置成长页位置。" };
    const practiced = { ...promoted, revision: promoted.revision + 1, lastResult: practicedRecord, chronicle: [...promoted.chronicle, practicedRecord] };
    value.submitIntent = vi.fn().mockImplementationOnce(async (envelope: SliceEnvelope) => receipt(promoted, envelope))
      .mockImplementationOnce(async (envelope: SliceEnvelope) => receipt(practiced, envelope));
    const dialog = await openConsumption(value);
    dialog.scrollTop = 640;
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶无面人魔药」" }));
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBe(dialog);
    expect(dialog.scrollTop).toBe(0);
    expect(document.activeElement).toBe(dialog.querySelector("[data-modal-heading]"));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.getByRole("region", { name: "无面人成长下一步" })).toBeTruthy();
    dialog.scrollTop = 312;
    await userEvent.click(screen.getByRole("button", { name: new RegExp(practice.label) }));
    expect(dialog.scrollTop).toBe(312);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /非凡成长/ }));
    expect(value.submitIntent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(value.submitIntent).mock.calls[1]![0].payload).toEqual({ type: "FACELESS", command: practice.command });
  });

  it("does not treat a different run's promoted projection as this run's promotion", async () => {
    // Deliberately synthetic cross-run projection exercises the UI identity guard, not save semantics.
    const state = fixture(7, { faceless: bottled() }), value = bridge(state), promoted = promotedProjection(state, false);
    value.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt(promoted, envelope));
    const dialog = await openConsumption(value); dialog.scrollTop = 517;
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶无面人魔药」" }));
    expect(screen.getByRole("region", { name: "无面人成长下一步" })).toBeTruthy();
    expect(dialog.scrollTop).toBe(517);
  });

  it("keeps failure feedback scrolling without forcing the dialog to its top", async () => {
    const state = fixture(7, { faceless: bottled() }), value = bridge(state);
    const record = { id: "consumption-failed-scroll", week: state.week, title: "本次排异未晋升", text: "已消耗原瓶，仍在筹备阶段。" };
    const next = { ...state, revision: state.revision + 1, lastResult: record, chronicle: [...state.chronicle, record],
      faceless: { ...state.faceless, actions: state.faceless.actions.slice(1) } };
    value.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt(next, envelope));
    const dialog = await openConsumption(value); dialog.scrollTop = 429; scrollIntoView.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶无面人魔药」" }));
    expect(dialog.scrollTop).toBe(429);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "本次行动结果" }).textContent).toContain(record.text);
  });

  it("does not write scrollTop when loading an already-promoted run or simply reopening its dossier", async () => {
    const value = bridge(fixture(6)); await enter(value);
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop"), writes = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTop", { configurable: true, get: () => 225, set: writes });
    try {
      await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
      expect(screen.getByRole("dialog", { name: "非凡成长" }).scrollTop).toBe(225);
      await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
      await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
      expect(writes).not.toHaveBeenCalled(); expect(value.submitIntent).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, "scrollTop", original);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollTop");
    }
  });
});
