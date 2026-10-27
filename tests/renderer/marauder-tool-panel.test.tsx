/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { MARAUDER_ABILITY_IDS } from "../../src/domain/marauder/types";
import type { MarauderDispute, MarauderDisputeCommand } from "../../src/domain/marauder/types";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import { MarauderHistory, MarauderPanel } from "../../src/renderer/MarauderPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

function fixture(stage: MarauderDispute["stage"] = "READY", change?: (state: SliceState) => void): SliceProjection {
  const state = createSliceRun("marauder-tool-ui", sliceDefaultCreationSelection, "marauder-tool-ui-seed");
  state.week = 12;
  state.activeEvent = null;
  state.character.name = "艾琳";
  state.health = 100;
  state.mind = 100;
  state.actionsRemaining = 3;
  state.progression = {
    pathwayId: "error", sequence: 9, promotionWeek: 5, acting: 100,
    mastery: Object.fromEntries(MARAUDER_ABILITY_IDS.map((id) => [id, 0])),
  };
  state.marauder.discovered = true;
  state.marauder.guidanceKnown = true;
  state.marauder.reflected = true;
  for (const entry of Object.values(state.marauder.cases)) {
    entry.status = "RESOLVED";
    entry.method = "ORDINARY";
    entry.attemptWeek = 11;
    entry.conclusion = "LIMITED";
  }
  for (const original of Object.values(state.marauder.originals)) {
    original.custodian = "OWNER";
    original.location = "原主人手中";
    original.version = 3;
  }
  state.marauder.dispute.stage = stage;
  if (stage === "RESOLVED") {
    state.marauder.dispute.outcome = "ENEMY_SURRENDERED";
    state.marauder.dispute.startHistoryIndex = 0;
  }
  change?.(state);
  return projectSliceState(state);
}

function heldFixture(): SliceProjection {
  return fixture("RESOLVED", (state) => {
    state.marauder.dispute.weapon.custodian = "PLAYER";
    state.marauder.dispute.weapon.location = "PLAYER_HAND";
    state.marauder.dispute.weapon.version = 2;
    state.marauder.dispute.attention = 1;
  });
}

function resources(state: SliceProjection): SeerResources {
  return {
    health: state.health, maxHealth: state.maxHealth, mind: state.mind, maxMind: state.maxMind,
    spirituality: state.spirituality, maxSpirituality: state.maxSpirituality,
    cash: "2镑", actionsRemaining: state.actionsRemaining,
  };
}

function panel(state: SliceProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MarauderPanel marauder={state.marauder} resources={resources(state)} busy={false} blocked={false} onCommand={onCommand} />) };
}

function encounter() {
  return within(screen.getByRole("region", { name: "维修院原工具争端" }));
}

function toolRecord() {
  return within(screen.getByRole("region", { name: "争端原短棍的归属与持有" }));
}

function field(label: string): string | null {
  return toolRecord().getByText(label, { selector: "dt" }).nextElementSibling?.textContent ?? null;
}

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:30:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}

function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:31:00Z", replayed: false, state,
  } };
}

async function enter(api: SliceBridge) {
  window.sliceGame = api;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  await openMarauder();
}

async function openMarauder() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await screen.findByRole("region", { name: "维修院原工具争端" });
}

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Marauder optional original-tool encounter", () => {
  it("keeps the encounter and its commands out of an unpromoted dossier", () => {
    const state = fixture();
    state.marauder.promoted = false;
    panel(state);
    expect(screen.queryByRole("region", { name: "维修院原工具争端" })).toBeNull();
    expect(screen.queryByText("marauder-simon-club")).toBeNull();
    expect(screen.queryByRole("button", { name: /空出手后介入|沿原通道离开/ })).toBeNull();
  });

  it("keeps original weapon facts absent until the committed observation arrives", async () => {
    const unseen = fixture("UNSEEN");
    expect(unseen.marauder.dispute.weapon).toBeNull();
    const { onCommand, rerender } = panel(unseen);
    expect(encounter().getByText("完成三案后可了解这一可选争端。")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "争端原短棍的归属与持有" })).toBeNull();
    expect(screen.queryByText("marauder-simon-club")).toBeNull();
    expect(screen.queryByText("塞蒙", { selector: "dd" })).toBeNull();
    await userEvent.click(encounter().getByRole("button", { name: /^查看维修院原工具争端/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "OBSERVE_DISPUTE" });
    expect(screen.queryByText("marauder-simon-club")).toBeNull();
    const observed = fixture("OBSERVED");
    rerender(<MarauderPanel marauder={observed.marauder} resources={resources(observed)} busy={false} blocked={false} onCommand={onCommand} />);
    expect(field("原物编号")).toBe("marauder-simon-club");
    expect(field("原主人")).toBe("塞蒙");
    expect(field("当前持有／保管")).toBe("塞蒙");
    expect(field("已知位置")).toBe("塞蒙手中");
    expect(field("原物记录版本")).toBe("1");
  });

  it("separates the encounter from the three peaceful cases and dispatches exact preparation", async () => {
    const { onCommand } = panel(fixture("OBSERVED"));
    const cases = screen.getByRole("region", { name: "偷盗者原物实践" });
    expect(within(cases).getAllByRole("option")).toHaveLength(3);
    expect(within(cases).queryByRole("button", { name: /请旁人离开|沿原通道离开/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^请旁人离开并确认普通退路/ })).toHaveLength(1);
    const generic = screen.queryByRole("group", { name: "偷盗者成长行动" });
    if (generic) expect(within(generic).queryByRole("button", { name: /请旁人离开|沿原通道离开/ })).toBeNull();
    await userEvent.click(encounter().getByRole("button", { name: /^请旁人离开并确认普通退路/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE_DISPUTE" });
    expect(encounter().getByText("现场状态：已观察，尚未介入")).toBeTruthy();
    expect(field("已知位置")).toBe("塞蒙手中");
  });

  it("uses the public own-club block and only enables the ready action after a new projection", async () => {
    const holdingOwnClub = fixture("READY", (state) => { state.town.clubLocation = "HAND"; });
    const { onCommand, rerender } = panel(holdingOwnClub);
    const start = encounter().getByRole("button", { name: /^空出手后介入原持棍威胁/ });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    expect(start.textContent).toContain("1行动 · 可能伤亡");
    expect(encounter().getByText("先把自己的短棍收进行囊，空出取物的手；本场不会免费切换原工具。")).toBeTruthy();
    fireEvent.click(start);
    expect(onCommand).not.toHaveBeenCalled();
    const ready = fixture("READY", (state) => { state.town.clubLocation = "BAG"; });
    rerender(<MarauderPanel marauder={ready.marauder} resources={resources(ready)} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(encounter().getByRole("button", { name: /^空出手后介入原持棍威胁/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "START_DISPUTE" });
    expect(encounter().getByText("现场状态：已确认普通退路，尚未开战")).toBeTruthy();
    expect(field("当前持有／保管")).toBe("塞蒙");
  });

  it("keeps the public leave action available at zero AP, zero mind and zero mastery", async () => {
    const state = fixture("READY", (raw) => { raw.actionsRemaining = 0; raw.mind = 0; });
    const { onCommand } = panel(state);
    expect(state.marauder.abilities.every((ability) => ability.mastery === 0)).toBe(true);
    expect((encounter().getByRole("button", { name: /^空出手后介入/ }) as HTMLButtonElement).disabled).toBe(true);
    const leave = encounter().getByRole("button", { name: /^沿原通道离开，不介入/ });
    expect((leave as HTMLButtonElement).disabled).toBe(false);
    expect(leave.textContent).toContain("0行动 · 已花行动不返");
    await userEvent.click(leave);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_DISPUTE" });
    expect(encounter().queryByText(/本场结果/)).toBeNull();
    expect(field("已知位置")).toBe("塞蒙手中");
  });

  it("shows actual possession separately from the unchanged owner and retained attention", () => {
    panel(heldFixture());
    expect(field("原主人")).toBe("塞蒙");
    expect(field("当前持有／保管")).toBe("你");
    expect(field("已知位置")).toBe("你手中");
    expect(field("原物记录版本")).toBe("2");
    expect(field("现场注意")).toBe("1");
    expect(encounter().getByText("本场结果：塞蒙停止抵抗")).toBeTruthy();
    expect(encounter().getByRole("button", { name: /^携同一原短棍交存登记柜/ }).textContent).toContain("1行动 · 不转为自己的战利品");
  });

  it.each([
    ["ENEMY_DEAD", "塞蒙死亡", 2],
    ["PLAYER_DEAD", "本人死亡", 3],
  ] as const)("preserves the actual ground record after %s without inventing a pickup", (outcome, label, version) => {
    panel(fixture("RESOLVED", (state) => {
      state.marauder.dispute.outcome = outcome;
      state.marauder.dispute.weapon.custodian = "SCENE";
      state.marauder.dispute.weapon.location = "GROUND";
      state.marauder.dispute.weapon.version = version;
    }));
    expect(field("原主人")).toBe("塞蒙");
    expect(field("当前持有／保管")).toBe("原现场");
    expect(field("已知位置")).toBe("实际倒地处");
    expect(field("原物记录版本")).toBe(String(version));
    expect(encounter().getByText(`本场结果：${label}`)).toBeTruthy();
    expect(encounter().queryByRole("button")).toBeNull();
  });

  it.each(["busy", "blocked"] as const)("does not dispatch encounter commands while %s", (lock) => {
    const state = fixture();
    const onCommand = vi.fn();
    render(<MarauderPanel marauder={state.marauder} resources={resources(state)} busy={lock === "busy"} blocked={lock === "blocked"} onCommand={onCommand} />);
    for (const button of encounter().getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["history", "readOnly"] as const)("renders the %s record without handlers or action controls", async (view) => {
    const state = heldFixture();
    const onCommand = vi.fn();
    if (view === "history") render(<MarauderHistory marauder={state.marauder} />);
    else render(<MarauderPanel marauder={state.marauder} resources={resources(state)} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(field("当前持有／保管")).toBe("你");
    expect(field("原主人")).toBe("塞蒙");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    await userEvent.click(toolRecord().getByText("marauder-simon-club"));
    await userEvent.keyboard("{Enter}{Escape}");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(["OBSERVE_DISPUTE", "PREPARE_DISPUTE", "START_DISPUTE", "LEAVE_DISPUTE", "RETURN_TOOL"] as const)("retries the exact failed %s command once without optimistic changes or double submission", async (type) => {
    const state = type === "RETURN_TOOL" ? heldFixture()
      : fixture(type === "OBSERVE_DISPUTE" ? "UNSEEN" : type === "PREPARE_DISPUTE" ? "OBSERVED" : "READY", (raw) => {
        if (type === "LEAVE_DISPUTE") { raw.actionsRemaining = 0; raw.mind = 0; }
      });
    const entry = state.marauder.actions.find((action) => action.command.type === type)!;
    expect(entry.enabled).toBe(true);
    const api = bridge(state);
    let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api);
    const before = screen.getByRole("region", { name: "维修院原工具争端" }).textContent;
    const name = new RegExp(`^${entry.label}`);
    const button = encounter().getByRole("button", { name });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    const expectedCommand: MarauderDisputeCommand = { type };
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "MARAUDER", command: expectedCommand });
    await act(async () => {
      finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "原工具争端模拟保存失败", retryable: true } });
    });
    expect(screen.getByRole("alert").textContent).toContain("原工具争端模拟保存失败");
    expect(screen.getByRole("region", { name: "维修院原工具争端" }).textContent).toBe(before);
    expect((encounter().getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "MARAUDER", command: expectedCommand });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("shows registration-desk custody only after the saved return receipt and preserves ownership", async () => {
    const state = heldFixture();
    const next = fixture("RESOLVED", (raw) => {
      raw.revision = state.revision + 1;
      raw.actionsRemaining = state.actionsRemaining - 1;
      raw.marauder.dispute.weapon.custodian = "DESK";
      raw.marauder.dispute.weapon.location = "RETURN_DESK";
      raw.marauder.dispute.weapon.version = 3;
      raw.marauder.dispute.attention = 1;
    });
    const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; }));
    await enter(api);
    await userEvent.click(encounter().getByRole("button", { name: /^携同一原短棍交存登记柜/ }));
    expect(field("当前持有／保管")).toBe("你");
    expect(field("原物记录版本")).toBe("2");
    const envelope = vi.mocked(api.submitIntent).mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "MARAUDER", command: { type: "RETURN_TOOL" } });
    await act(async () => { finish(receipt(next, envelope)); });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await openMarauder();
    expect(field("原物编号")).toBe("marauder-simon-club");
    expect(field("原主人")).toBe("塞蒙");
    expect(field("当前持有／保管")).toBe("艾德温登记柜");
    expect(field("已知位置")).toBe("原登记柜");
    expect(field("原物记录版本")).toBe("3");
    expect(toolRecord().getByText(/登记柜保管也不等于原主人已经领回/)).toBeTruthy();
    expect(encounter().queryByRole("button", { name: /^携同一原短棍交存登记柜/ })).toBeNull();
  });
});
