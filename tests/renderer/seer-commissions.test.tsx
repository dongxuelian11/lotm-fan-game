/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { SeerProjection } from "../../src/domain/seer/types";
import type { SliceEnding, SliceProjection } from "../../src/domain/slice/types";
import { SeerPanel, type SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 90, maxHealth: 100, mind: 90, maxMind: 100,
  spirituality: 20, maxSpirituality: 48, cash: "1镑 2苏勒 3便士", actionsRemaining: 2,
};
const ending: SliceEnding = {
  kind: "COMPLETED", title: "首案测试收尾", summary: "已经提交的首案结论。",
  workers: "工人结论原文", accountability: "证据结论原文",
  hazard: "危险物结论原文", relationship: "关系结论原文",
};
function fixture(patch: Partial<SliceProjection> = {}): SliceProjection {
  const base = projectSliceState(createSliceRun("commission-ui", sliceDefaultCreationSelection, "commission-ui"));
  return {
    ...base, character: { ...base.character, name: "艾琳" }, activeEvent: null,
    canAct: true, actionBlockedReason: null, ...patch,
  };
}
function practice(): SeerProjection["practice"] {
  return {
    title: "公开委托测试", body: "来自领域的委托范围说明。", completed: 1, total: 3,
    cases: [
      { id: "delivered", title: "已交付测试案", body: "已经公开的旧案说明。", status: "已交付", choices: [] },
      {
        id: "bookmark", title: "书签测试案", body: "仅有眼前书签的公开线索。", status: "待接取",
        choices: [
          { id: "sight", label: "按投影开启灵视", cost: "领域成本：1行动 · 2灵性", enabled: true, reason: null, command: { type: "PRACTICE", caseId: "bookmark", approachId: "sight" } },
          { id: "inspect", label: "按投影普通检查", cost: "领域成本：1行动 · 无灵性支出", enabled: true, reason: null, command: { type: "PRACTICE", caseId: "bookmark", approachId: "inspect" } },
        ],
      },
      {
        id: "list", title: "清单测试案", body: "另一个已公开的委托故事。", status: "现在可重试",
        choices: [
          { id: "divine", label: "按投影核实清单", cost: "领域成本：1行动 · 3灵性", enabled: true, reason: null, command: { type: "PRACTICE", caseId: "list", approachId: "divine" } },
          { id: "count", label: "按投影重新点数", cost: "领域成本：1行动", enabled: true, reason: null, command: { type: "PRACTICE", caseId: "list", approachId: "count" } },
        ],
      },
    ],
    reflection: { id: "reflection", label: "整理已完成委托的认识", cost: "反思成本原文：1行动", enabled: true, reason: null, command: { type: "REFLECT" } },
  };
}
function seer(patch: Partial<SeerProjection> = {}): SeerProjection {
  return { ...fixture().seer, promoted: true, discovered: true, formulaKnown: true, actions: [], practice: practice(), ...patch };
}
function panel(value: SeerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SeerPanel seer={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state,
      runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-11T00:00:00Z" }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision, newRevision: state.revision, committedAt: "2026-10-11T00:01:00Z", replayed: false, state } };
}
async function enter(value: SliceBridge, archived = false) {
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: archived ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Seer commissions and continuing life", () => {
  it("recommends an enabled prepared original bottle ahead of further material work", () => {
    panel(seer({ promoted: false, actions: [
      { id: "work", label: "继续第二批劳务", cost: "1行动", enabled: true, reason: null, command: { type: "MATERIAL_WORK", batchId: "second" } },
      { id: "consume", label: "服用已经备好的第一瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "first-bottle", confirmed: true } },
    ] }));
    const next = screen.getByRole("region", { name: "成长下一步" });
    expect(next.textContent).toContain("下一步：服用已经备好的第一瓶");
    expect(next.textContent).not.toContain("继续第二批劳务");
  });

  it("opens one unfinished story with two choices and switches among only the public cases", async () => {
    const value = seer();
    const { onCommand } = panel(value);
    expect((screen.getByText("公开委托测试 · 已完成 1 / 3").closest("details") as HTMLDetailsElement).open).toBe(true);
    expect((screen.getByRole("combobox", { name: "查看委托" }) as HTMLSelectElement).value).toBe("bookmark");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    const story = screen.getByRole("region", { name: "当前委托" });
    expect(within(story).getByRole("heading", { name: "书签测试案" })).toBeTruthy();
    expect(within(story).getAllByRole("button")).toHaveLength(2);
    expect(within(story).getByText("领域成本：1行动 · 2灵性")).toBeTruthy();
    expect(screen.queryByText("另一个已公开的委托故事。")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "查看委托" }), "list");
    expect(screen.queryByText("仅有眼前书签的公开线索。")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /按投影核实清单/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PRACTICE", caseId: "list", approachId: "divine" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "查看委托" }), "delivered");
    expect(within(story).queryByRole("group", { name: "委托处理方式" })).toBeNull();
    expect(within(story).getAllByRole("button")).toHaveLength(1);
    expect(within(story).getByText("已经公开的旧案说明。")).toBeTruthy();
    await userEvent.click(within(story).getByRole("button", { name: "查看可处理委托：书签测试案" }));
    expect(within(story).getByRole("heading", { name: "书签测试案" })).toBeTruthy();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("preserves projected disabled reasons, respects save locks, and sends the reflection command", async () => {
    const value = seer();
    value.practice.cases[1]!.choices[0] = { ...value.practice.cases[1]!.choices[0]!, enabled: false, reason: "领域原因：当前灵性不足" };
    value.practice.reflection = { ...value.practice.reflection, enabled: false, reason: "领域原因：尚无可整理的新经历" };
    const { onCommand, rerender } = panel(value);
    const choice = screen.getByRole("button", { name: /按投影开启灵视/ }) as HTMLButtonElement;
    const reflect = screen.getByRole("button", { name: /整理已完成委托的认识/ }) as HTMLButtonElement;
    expect(choice.disabled).toBe(true);
    expect(reflect.disabled).toBe(true);
    expect(screen.getByText("领域原因：当前灵性不足")).toBeTruthy();
    expect(screen.getByText("领域原因：尚无可整理的新经历")).toBeTruthy();
    expect(within(reflect).getByText("反思成本原文：1行动")).toBeTruthy();
    fireEvent.click(choice);
    fireEvent.click(reflect);
    expect(onCommand).not.toHaveBeenCalled();
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      rerender(<SeerPanel seer={seer()} resources={resources} {...lock} onCommand={onCommand} />);
      expect((screen.getByRole("combobox", { name: "查看委托" }) as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(button);
      }
    }
    expect(onCommand).not.toHaveBeenCalled();
    rerender(<SeerPanel seer={seer()} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /整理已完成委托的认识/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
  });

  it("does not expose commissions before promotion or invent them for older projections", () => {
    const { rerender } = panel(seer({ promoted: false }));
    expect(screen.queryByText(/公开委托测试/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: "查看委托" })).toBeNull();
    const oldProjection = seer();
    Reflect.deleteProperty(oldProjection, "practice");
    rerender(<SeerPanel seer={oldProjection} resources={resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.queryByText(/公开委托测试/)).toBeNull();
    expect(screen.getByRole("region", { name: "占卜家能力与消化" })).toBeTruthy();
  });

  it("keeps a commission save failure locked and retries the original intent envelope", async () => {
    const state = fixture({ seer: seer(), caseArchive: [ending] });
    const b = bridge(state);
    let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    b.submitIntent = submit;
    await enter(b);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choice = screen.getByRole("button", { name: /按投影开启灵视/ });
    fireEvent.click(choice);
    fireEvent.click(choice);
    expect(submit).toHaveBeenCalledTimes(1);
    expect((choice as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "委托保存失败测试", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("委托保存失败测试");
    expect((choice as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SEER", command: { type: "PRACTICE", caseId: "bookmark", approachId: "sight" } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("continues a surviving case only after saving, retries the same envelope, and retains its four-axis archive", async () => {
    const state = fixture({ status: "SLICE_COMPLETE", ending, canAct: false });
    const b = bridge(state);
    let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const continued: SliceProjection = { ...state, revision: state.revision + 1, status: "ACTIVE", ending: null, caseArchive: [ending], canAct: true };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(async (envelope) => receipt(continued, envelope));
    b.submitIntent = submit;
    await enter(b);
    await userEvent.click(screen.getByRole("button", { name: "查看卷宗" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看收尾" }));
    const continueButton = screen.getByRole("button", { name: "继续生活" });
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /工作，1行动/ })).toBeNull();
    expect((screen.getByRole("button", { name: "查看卷宗" }) as HTMLButtonElement).disabled).toBe(true);
    for (const button of screen.getAllByRole("button", { name: "返回标题" })) expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "继续生活保存失败测试", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("继续生活保存失败测试");
    expect((screen.getByRole("button", { name: "继续生活" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /工作，1行动/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "CONTINUE_LIFE" });
    expect((screen.getByRole("button", { name: /工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /完整纪事/ }));
    const fold = screen.getByText("已收尾案件 · 1 份卷宗");
    expect((fold.closest("details") as HTMLDetailsElement).open).toBe(false);
    await userEvent.click(fold);
    const archive = screen.getByRole("region", { name: `案件卷宗：${ending.title}` });
    for (const text of [ending.workers, ending.accountability, ending.hazard, ending.relationship]) expect(within(archive).getByText(text)).toBeTruthy();
  });

  it("keeps dead characters read-only and never offers continue life", async () => {
    const b = bridge(fixture({ status: "DEAD", ending: { ...ending, kind: "DEATH" }, canAct: false }));
    await enter(b, true);
    expect(screen.getByText("只读封存卷宗")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看卷宗" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    expect(screen.queryByRole("button", { name: /工作，1行动/ })).toBeNull();
    expect(b.submitIntent).not.toHaveBeenCalled();
  });
});
