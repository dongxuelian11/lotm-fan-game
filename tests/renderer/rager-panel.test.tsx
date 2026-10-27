/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { RAGER_ABILITIES, RAGER_CONSUMPTION_RISK } from "../../src/domain/rager/content";
import { SAILOR_ABILITIES } from "../../src/domain/sailor/content";
import type { RagerAction, RagerCommand, RagerProjection } from "../../src/domain/rager/types";
import type { SliceCombatRound, SliceProjection } from "../../src/domain/slice/types";
import { SailorHistory, RagerPanel } from "../../src/renderer/RagerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const guidance: RagerAction = {
  id: "guidance", label: "学习暴怒之民服用指导", cost: "1行动 · 180便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
const risk = RAGER_CONSUMPTION_RISK;
function rager(patch: Partial<RagerProjection> = {}): RagerProjection {
  return {
    title: "暴怒之民晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "水手扮演100，已度过4/4个完整序列9周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): RagerProjection {
  return rager({
    guidanceKnown: true,
    supplies: "完整配方待核；维修站三瓶独立成品，1210便士或完成3次劳动抵1050便士后付160便士；指导180便士。",
    actions: ["rager-potion-1", "rager-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "rager-potion-1", title: "第一瓶暴怒之民魔药", source: "维修站交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "rager-potion-1", confirmed: true } },
      { id: "rager-potion-2", title: "第二瓶暴怒之民魔药", source: "维修站交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "rager-potion-2", confirmed: true } },
      { id: "rager-potion-3", title: "第三瓶暴怒之民魔药", source: "维修站交接的第三原瓶", status: "导师保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "rager-potion-3", confirmed: true } },
    ],
  });
}
function cases(): RagerProjection["cases"] {
  return ["jammed-capstan", "falling-cargo", "crowded-quay"].map((id, index) => ({
    id, title: `受监督作业${index + 1}`, story: `原作业场景与在场监督说明${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: RagerCommand, label = "观察本处现场与监督条件", enabled = true): RagerAction {
  return {
    id: JSON.stringify(command), label, cost: "1行动 · 本案公开成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: RagerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<RagerPanel rager={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("rager-renderer-run", sliceDefaultCreationSelection, "rager-renderer-seed");
  raw.week = 10;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    sailor: { ...state.sailor, discovered: sequence !== null, promoted: sequence !== null, title: "水手 · 序列9", acting: 100, actions: [] },
    rager: rager({
      promoted: sequence === 8, title: sequence === 8 ? "暴怒之民 · 序列8" : "暴怒之民晋升",
      actions: sequence === 8 ? [] : [guidance],
    }),
    progression: {
      pathwayId: sequence === null ? null : "tyrant", sequence,
      mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5,
    }, ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-11T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-11T00:01:00Z", replayed: false, state,
  } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openRager() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "暴怒之民晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Rager sequence eight dossier", () => {
  it("keeps eight ordinary entries without revealing an S8 route", async () => {
    const api = bridge(fixture(null));
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路", "不眠者之路", "阅读者之路", "水手之路"]) expect(choices.getByRole("button", { name })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /暴怒之民/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps S9 Sailor as default and opens advancement from the tab or dashboard", async () => {
    const api = bridge(fixture(9));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "水手成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暴怒之民晋升" }));
    const summary = screen.getByRole("region", { name: "暴怒之民成长下一步" });
    expect(summary.textContent).toContain("水手100消化与四个完整序列9周");
    expect(summary.textContent).not.toContain("游戏设定（G）");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "暴怒之民成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S8 to Rager and preserves exact S9 history with no obsolete actions", async () => {
    const state = fixture(8);
    state.seer.discovered = true;
    state.sailor.cases = [{ id: "wet-gangway", title: "旧栈桥搬运", story: "原水手场景", observations: ["原栈桥扶栏的磨损已查明"], equipment: ["原借绳已交还"], result: "原搬运实际结果", status: "RESOLVED" }];
    state.sailor.actions = [{ id: "stale", label: "不得重做的水手旧作业", cost: "1行动", enabled: true, reason: null, command: { type: "SURVEY", caseId: "wet-gangway" } }];
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`暴怒之民 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("暴怒之民 · 序列8 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openRager();
    expect(screen.getByRole("button", { name: "暴怒之民成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "暴怒之民成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "水手成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "水手经历" }));
    const history = screen.getByRole("region", { name: "水手时期的经历" });
    for (const text of ["原水手场景", "原栈桥扶栏的磨损已查明", "原借绳已交还", "原搬运实际结果"]) expect(within(history).getByText(text)).toBeTruthy();
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText("不得重做的水手旧作业")).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains previous originals, their exact sources and inherited mastery in readonly history", () => {
    const sailor = fixture(8).sailor;
    sailor.bottles = [{ id: "old-bottle", title: "旧水手原瓶", source: "码头导师原交接", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "old-bottle", confirmed: true } }];
    sailor.abilities = [{ id: "tyrant.s9.balance", label: "原平衡能力", mastery: 32, description: "原能力边界" }];
    render(<SailorHistory sailor={sailor} />);
    expect(screen.getByText("来源：码头导师原交接")).toBeTruthy();
    expect(screen.getByText("已服用 · 失败")).toBeTruthy();
    expect(screen.getByText("原平衡能力 · 掌握 32：原能力边界")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows finite original bottles and public costs without rendering an invented formula", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未核配方材料不得显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未核配方材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels without spending, restores focus, and confirms only one selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶暴怒之民魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("rager-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "暴怒之民服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶暴怒之民魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "rager-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("closes stale bottle confirmation when its action disappears or history becomes readonly", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<RagerPanel rager={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<RagerPanel rager={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps maturity and acquisition permission in the domain's supplied reasons", () => {
    const value = bottled();
    const reason = "水手消化不足100，且仅度过3/4完整周。";
    panel({ ...value, actions: [...value.actions.map((entry) => ({ ...entry, enabled: false, reason })), guidance,
      { id: "buy", label: "取得第三原瓶", cost: "1210便士，或实际劳动3/3抵1050便士后付160便士", enabled: false, reason: "现金不足", command: { type: "BUY_POTION", bottleId: "rager-potion-3" } },
    ] });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("1210便士，或实际劳动3/3抵1050便士后付160便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 180便士")).toBeTruthy();
  });

  it("separates observed facts, actual preparation and committed outcomes without spending on case selection", async () => {
    const list = cases();
    list[1] = { ...list[1]!, observations: ["原吊具侧边已磨损。", "监督者本人仍在安全线外。"], preparation: "原支撑点与退路已实际确认。", status: "PREPARED" };
    const { onCommand, rerender } = panel(rager({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择受监督作业" }), "falling-cargo");
    const facts = screen.getByRole("region", { name: "实际观察记录" });
    expect(facts.textContent).toContain("原吊具侧边已磨损。");
    expect(facts.textContent).not.toContain("原支撑点与退路已实际确认。");
    expect(screen.getByRole("region", { name: "实际防护与协作准备" }).textContent).toContain("原支撑点与退路已实际确认。");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    list[1] = { ...list[1]!, result: "原货物已由同伴共同安置，未增加私人财物。", status: "RESOLVED" };
    rerender(<RagerPanel rager={rager({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(list[1]!.result);
    expect(screen.getByRole("region", { name: "实际防护与协作准备" }).textContent).not.toContain(list[1]!.result);
  });

  it("presents burst and teamwork neutrally and supports projected zero-AP withdrawal", async () => {
    const list = cases();
    list[0] = { ...list[0]!, observations: ["卡住的原绞盘已停机。"], preparation: "协作者清空了工作范围。", status: "PREPARED" };
    const choices = [action({ type: "PERFORM", caseId: "jammed-capstan", method: "BURST" }, "按监督信号受控发力"), action({ type: "PERFORM", caseId: "jammed-capstan", method: "TEAM" }, "与原协作者共同操作"), { ...action({ type: "WITHDRAW", caseId: "jammed-capstan" }, "退出本次准备"), cost: "0行动" }];
    const { onCommand } = panel(rager({ promoted: true, cases: list, actions: choices }));
    const summary = screen.getByRole("region", { name: "暴怒之民成长下一步" });
    expect(summary.textContent).toContain("选择受控发力或普通协作");
    for (const entry of choices) {
      if (entry.command.type === "PERFORM") expect(summary.textContent).not.toContain(entry.label);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(entry.command);
    }
    const boundary = screen.getByRole("region", { name: "本次作业目标与边界" });
    expect(boundary.textContent).toContain("不要求主动伤人、酗酒或故意失控");
    expect(boundary.textContent).toContain("不会积累战斗怒势");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it("keeps missing facts and preparation unknown instead of inventing safety or attacks", () => {
    panel(rager({ promoted: true, cases: cases(), actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知现场与监督条件" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能确认未提供的事实");
    expect(screen.getByRole("region", { name: "实际防护与协作准备" }).textContent).toContain("尚无本次准备记录");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it("obeys backend reasons, busy, blocked and readonly while allowing projected zero-AP reflection", async () => {
    const value = rager({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "jammed-capstan" }, "观察原现场", false), { ...action({ type: "REFLECT" }, "反思实际克制与协作"), cost: "0行动" }] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^观察原现场/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("本周已尝试，须下周再来。").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /^反思实际克制/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<RagerPanel rager={value} resources={resources} {...flags} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^反思实际克制/ });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("shows the supplied five abilities, their mastery and the S7 boundary", () => {
    const abilities = [...SAILOR_ABILITIES, ...RAGER_ABILITIES].map((entry, index) => ({ ...entry, mastery: index * 7 }));
    panel(rager({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "暴怒之民能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 5 项能力" })).toBeTruthy();
    for (const ability of abilities) {
      expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(screen.queryByText(ability.id)).toBeNull();
    }
    expect(region.textContent).toContain("航海家水系法术尚未获得");
    expect(screen.getByRole("region", { name: "暴怒之民成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["CONSUME", "OBSERVE", "PREPARE", "PERFORM", "WITHDRAW", "REFLECT"] as const)("locks and retries the original failed %s envelope without speculative state", async (type) => {
    const command: RagerCommand = type === "CONSUME" ? { type, bottleId: "rager-potion-2", confirmed: true }
      : type === "REFLECT" ? { type }
      : type === "PERFORM" ? { type, caseId: "jammed-capstan", method: "TEAM" }
      : { type, caseId: "jammed-capstan" };
    const entry = action(command, `执行${type}`);
    const state = fixture(type === "CONSUME" ? 9 : 8, { rager: type === "CONSUME" ? bottled() : rager({ promoted: true, cases: cases(), actions: [entry] }) });
    const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api);
    await openRager();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const label = type === "CONSUME" ? "确认服用「第二瓶暴怒之民魔药」" : new RegExp(`^${entry.label}`);
    const confirm = screen.getByRole("button", { name: label });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "暴怒之民模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("暴怒之民模拟保存失败");
    expect((screen.getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "RAGER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});

function battle(charge = 0): NonNullable<SliceProjection["combat"]> {
  return {
    title: "原码头冲突", round: 1, enemyName: "持棍的对手", enemyHealth: 100, enemyStatus: "RESISTING",
    playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [],
    consequenceWeights: { light: 65, heavy: 30, death: 5 },
    stances: [{ id: "ATTACK", label: "进攻", description: "公开进攻姿态" }, { id: "DEFEND", label: "防守", description: "公开防守姿态" }],
    lastRound: null, rage: { charge },
  };
}
function committedRound(): SliceCombatRound {
  return {
    round: 1, stance: "ATTACK", first: "PLAYER", playerCount: 2, enemyCount: 1, playerCountRoll: 70, enemyCountRoll: 20,
    moves: [{ actor: "PLAYER", label: "首次符合条件时释放怒击", selfGain: 14, enemyReduction: 0 }],
    playerAdvantage: 14, enemyAdvantage: 5, winChance: 65, winner: "PLAYER",
    consequence: "本回合原怒势已消费，随后交换再积1层。", consequenceWeights: { light: 65, heavy: 30, death: 5 }, retreat: "NONE",
  };
}
const holdName = "本回合保留怒势";
const releaseName = "首次满足条件时释放怒击";
const roundButton = "确认姿态，结算完整回合";

describe("Rager round-level policy", () => {
  it("defaults to hold, permits advance authorization at zero charge, and spends nothing on selection", async () => {
    const api = bridge(fixture(8, { combat: battle(0), canAct: false }));
    await enter(api);
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
    const release = screen.getByRole("radio", { name: releaseName }) as HTMLInputElement;
    expect(release.disabled).toBe(false);
    const group = screen.getByRole("group", { name: "本回合怒势策略 · 当前 0 / 3 层" });
    expect(group.textContent).toContain("2层×1.25，3层×1.40");
    expect(group.textContent).toContain("本回合可能先积累怒势");
    expect(group.textContent).toContain("若没有符合条件的攻击则不消耗");
    await userEvent.click(release);
    expect(release.checked).toBe(true);
    expect(api.submitIntent).not.toHaveBeenCalled();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("submits exactly one explicit HOLD policy when the default is confirmed", async () => {
    const state = fixture(8, { combat: battle(2), canAct: false });
    const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementation(async (envelope) => receipt({ ...state, revision: state.revision + 1, combat: { ...battle(2), round: 2 } }, envelope));
    api.submitIntent = submit;
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", ragePolicy: "HOLD" });
  });

  it("submits one selected policy and resets to hold only after the committed revision and round", async () => {
    const state = fixture(8, { combat: battle(3), canAct: false });
    const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValue(first);
    api.submitIntent = submit;
    await enter(api);
    await userEvent.click(screen.getByRole("radio", { name: releaseName }));
    const confirm = screen.getByRole("button", { name: roundButton });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    const envelope = submit.mock.calls[0]![0];
    expect(envelope.payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK", ragePolicy: "RELEASE_FIRST" });
    expect((screen.getByRole("radio", { name: releaseName }) as HTMLInputElement).checked).toBe(true);
    const round = committedRound();
    const next = { ...state, revision: state.revision + 1, combat: { ...battle(1), round: 2, lastRound: round }, lastCombatRound: round, combatHistory: [round] };
    await act(async () => { finish(receipt(next, envelope)); });
    expect(screen.getByRole("heading", { name: "第 1 回合结果" })).toBeTruthy();
    expect(screen.getByText(round.consequence)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "进入下一回合" }));
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("group", { name: "本回合怒势策略 · 当前 1 / 3 层" })).toBeTruthy();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected policy and retries the exact original envelope after save failure", async () => {
    const state = fixture(8, { combat: battle(1), canAct: false });
    const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "怒势回合保存尚未确认", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, combat: { ...battle(0), round: 2 } }, envelope));
    api.submitIntent = submit;
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /^防守/ }));
    await userEvent.click(screen.getByRole("radio", { name: releaseName }));
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(screen.getByRole("alert").textContent).toContain("怒势回合保存尚未确认");
    expect((screen.getByRole("radio", { name: releaseName }) as HTMLInputElement).checked).toBe(true);
    const group = screen.getByRole("group", { name: "本回合怒势策略 · 当前 1 / 3 层" }) as HTMLFieldSetElement;
    expect(group.disabled).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: holdName }));
    expect((screen.getByRole("radio", { name: releaseName }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("button", { name: roundButton }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "DEFEND", ragePolicy: "RELEASE_FIRST" });
    // Observe the committed next round before asserting its fresh authorization state.
    await screen.findByRole("heading", { name: "第 2 回合" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
  });

  it.each([null, 9] as const)("shows no rage control and sends no policy for sequence %s", async (sequence) => {
    const { rage: _rage, ...ordinaryBattle } = battle();
    const state = fixture(sequence, { combat: ordinaryBattle, canAct: false });
    const api = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementation(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api);
    expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK" });
  });

  it("does not carry release authorization into a new battle after returning to life", async () => {
    const state = fixture(8, { combat: battle(3), canAct: false });
    const api = bridge(state);
    const ended = { ...state, revision: state.revision + 1, combat: null, canAct: true, actionsRemaining: 2 };
    const restarted = { ...ended, revision: ended.revision + 1, combat: { ...battle(0), title: "另一处有限冲突" }, canAct: false };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(ended, envelope))
      .mockImplementationOnce(async (envelope) => receipt(restarted, envelope));
    api.submitIntent = submit;
    await enter(api);
    await userEvent.click(screen.getByRole("radio", { name: releaseName }));
    await userEvent.click(screen.getByRole("button", { name: roundButton }));
    expect(screen.queryByRole("radio")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /工作，1行动/ }));
    expect(screen.getByRole("dialog", { name: "另一处有限冲突" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: holdName }) as HTMLInputElement).checked).toBe(true);
    expect(submit).toHaveBeenCalledTimes(2);
  });
});
