/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { NAVIGATOR_ABILITIES, NAVIGATOR_CONSUMPTION_RISK } from "../../src/domain/navigator/content";
import { RAGER_ABILITIES } from "../../src/domain/rager/content";
import { SAILOR_ABILITIES } from "../../src/domain/sailor/content";
import type { NavigatorAction, NavigatorCommand, NavigatorProjection } from "../../src/domain/navigator/types";
import type { SliceCombatRound, SliceProjection } from "../../src/domain/slice/types";
import { NavigatorSailorHistory, RagerHistory, NavigatorPanel } from "../../src/renderer/NavigatorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const guidance: NavigatorAction = {
  id: "guidance", label: "学习航海家服用指导", cost: "1行动 · 240便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
const risk = NAVIGATOR_CONSUMPTION_RISK;
function navigator(patch: Partial<NavigatorProjection> = {}): NavigatorProjection {
  return {
    title: "航海家晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "暴怒之民扮演100，已度过8/8个完整序列8周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): NavigatorProjection {
  return navigator({
    guidanceKnown: true,
    supplies: "完整配方待核；新渠道三瓶独立成品，2010便士或完成4次劳动抵1800便士后付210便士；指导240便士。",
    actions: ["navigator-potion-1", "navigator-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "navigator-potion-1", title: "第一瓶航海家魔药", source: "维修站交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "navigator-potion-1", confirmed: true } },
      { id: "navigator-potion-2", title: "第二瓶航海家魔药", source: "维修站交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "navigator-potion-2", confirmed: true } },
      { id: "navigator-potion-3", title: "第三瓶航海家魔药", source: "维修站交接的第三原瓶", status: "导师保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "navigator-potion-3", confirmed: true } },
    ],
  });
}
function cases(): NavigatorProjection["cases"] {
  return ["tide-crossing", "harbour-weather", "waterline-cleanup"].map((id, index) => ({
    id, title: `航行作业${index + 1}`, story: `原水域场景与同行情况${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: NavigatorCommand, label = "勘察本处水域与天气", enabled = true): NavigatorAction {
  return {
    id: JSON.stringify(command), label, cost: "1行动 · 本案公开成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: NavigatorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<NavigatorPanel navigator={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("navigator-renderer-run", sliceDefaultCreationSelection, "navigator-renderer-seed");
  raw.week = 20;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    sailor: { ...state.sailor, discovered: sequence !== null, promoted: sequence !== null, title: "水手 · 序列9", acting: 100, actions: [] },
    rager: { ...state.rager, promoted: sequence === 8 || sequence === 7, title: "暴怒之民 · 序列8", acting: 100, actions: [] },
    navigator: navigator({
      promoted: sequence === 7, title: sequence === 7 ? "航海家 · 序列7" : "航海家晋升",
      actions: sequence === 7 ? [] : [guidance],
    }),
    progression: {
      pathwayId: sequence === null ? null : "tyrant", sequence,
      mastery: {}, acting: sequence === 8 || sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5,
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
async function openNavigator() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "航海家晋升" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Navigator sequence seven dossier", () => {
  it("keeps eight ordinary starting routes and hides Navigator until S8", async () => {
    const api = bridge(fixture(null));
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(screen.queryByRole("button", { name: /航海家|暴怒之民/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("preserves the Sailor default and does not reveal S7 at S9", async () => {
    const api = bridge(fixture(9));
    await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "水手成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /航海家/ })).toBeNull();
    expect(screen.getByRole("button", { name: "暴怒之民晋升" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps S8 on Rager and opens S7 preparation from its tab or dashboard", async () => {
    const api = bridge(fixture(8));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "暴怒之民成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "航海家晋升" }));
    const summary = screen.getByRole("region", { name: "航海家成长下一步" });
    expect(summary.textContent).toContain("暴怒之民100消化与八个完整序列8周");
    expect(summary.textContent).not.toContain("游戏设定（G）");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "航海家成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S7 to Navigator with both prior dossiers available as true history", async () => {
    const state = fixture(7);
    state.seer.discovered = true;
    state.sailor.cases = [{ id: "wet-gangway", title: "旧栈桥搬运", story: "原水手场景", observations: ["原栈桥扶栏磨损已查明"], equipment: ["原借绳已经交还"], result: "水手实际搬运结果", status: "RESOLVED" }];
    state.sailor.actions = [{ id: "stale-sailor", label: "不得重做的水手旧作业", cost: "1行动", enabled: true, reason: null, command: { type: "SURVEY", caseId: "wet-gangway" } }];
    state.rager.cases = [{ id: "jammed-capstan", title: "旧绞盘作业", story: "原暴怒之民场景", observations: ["原绞盘已经停机"], preparation: "原协作者清场后退到安全线", result: "旧作业实际完成并已保存", status: "RESOLVED" }];
    state.rager.actions = [{ id: "stale-rager", label: "不得重做的暴怒之民旧作业", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "jammed-capstan" } }];
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`航海家 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("航海家 · 序列7 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openNavigator();
    expect(screen.getByRole("button", { name: "航海家成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("region", { name: "航海家成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "暴怒之民成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "暴怒之民经历" }));
    const ragerHistory = screen.getByRole("region", { name: "暴怒之民时期的经历" });
    for (const text of ["原暴怒之民场景", "原绞盘已经停机", "原协作者清场后退到安全线", "旧作业实际完成并已保存"]) expect(within(ragerHistory).getByText(text)).toBeTruthy();
    expect(within(ragerHistory).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "水手经历" }));
    const sailorHistory = screen.getByRole("region", { name: "水手时期的经历" });
    for (const text of ["原水手场景", "原栈桥扶栏磨损已查明", "原借绳已经交还", "水手实际搬运结果"]) expect(within(sailorHistory).getByText(text)).toBeTruthy();
    expect(within(sailorHistory).queryByRole("button")).toBeNull();
    expect(screen.queryByText(/不得重做/)).toBeNull();
    expect(sailorHistory.textContent).toContain("你已晋升航海家");
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("preserves exact original bottle provenance and inherited mastery in both histories", () => {
    const state = fixture(7);
    state.sailor.bottles = [{ id: "old-sailor", title: "原水手瓶", source: "水手导师原交接", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "old-sailor", confirmed: true } }];
    state.rager.bottles = [{ id: "old-rager", title: "原暴怒之民瓶", source: "维修站原交接", status: "已服用 · 成功", chance: 50, command: { type: "CONSUME", bottleId: "old-rager", confirmed: true } }];
    state.rager.abilities = [{ id: "tyrant.s8.fury", label: "原怒击", mastery: 37, description: "原物理交换边界" }];
    render(<><NavigatorSailorHistory sailor={state.sailor} /><RagerHistory rager={state.rager} /></>);
    for (const text of ["来源：水手导师原交接", "来源：维修站原交接", "已服用 · 失败", "已服用 · 成功", "原怒击 · 掌握 37：原物理交换边界"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows actual original bottles and costs, never an unverified formula", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未核材料不得显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未核材料不得显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|配方学习/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels without spending, restores focus, and confirms one selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶航海家魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    const original = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    expect(document.activeElement).toBe(original);
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶航海家魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("navigator-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "航海家服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶航海家魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "navigator-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("invalidates a stale bottle confirmation when the public action disappears or becomes history", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<NavigatorPanel navigator={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<NavigatorPanel navigator={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses the domain's supplied maturity and acquisition reasons", () => {
    const value = bottled();
    const reason = "暴怒之民消化不足100，且仅度过7/8完整周。";
    panel({ ...value, actions: [...value.actions.map((entry) => ({ ...entry, enabled: false, reason })), guidance,
      { id: "buy", label: "取得第三原瓶", cost: "2010便士，或实际劳动4/4抵1800便士后付210便士", enabled: false, reason: "现金不足", command: { type: "BUY_POTION", bottleId: "navigator-potion-3" } },
    ] });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("2010便士，或实际劳动4/4抵1800便士后付210便士")).toBeTruthy();
    expect(screen.getByText("1行动 · 240便士")).toBeTruthy();
  });

  it("separates known water facts, actual preparation and committed results", async () => {
    const list = cases();
    list[1] = { ...list[1]!, observations: ["原岸标旁的水流方向已经确认。", "云层正从外港移近。"], preparation: "已安排同伴沿岸返回。", status: "PLANNED" };
    const { onCommand, rerender } = panel(navigator({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择航行与水域作业" }), "harbour-weather");
    const facts = screen.getByRole("region", { name: "实际观察记录" });
    expect(facts.textContent).toContain("云层正从外港移近。");
    expect(facts.textContent).not.toContain("已安排同伴沿岸返回。");
    expect(screen.getByRole("region", { name: "实际计划与准备" }).textContent).toContain("已安排同伴沿岸返回。");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    list[1] = { ...list[1]!, result: "原同伴已经实际回岸，未改变天气。", status: "RESOLVED" };
    rerender(<NavigatorPanel navigator={navigator({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(list[1]!.result);
    expect(screen.getByRole("region", { name: "实际计划与准备" }).textContent).not.toContain(list[1]!.result);
  });

  it("offers projected plans equally without presenting a correct answer or selecting one", async () => {
    const list = cases();
    list[0] = { ...list[0]!, observations: ["原浮标旁的潮流朝西。"], status: "SURVEYED" };
    const choices = [action({ type: "PLAN", caseId: "tide-crossing", planId: "SHORE_GUIDE" }, "沿岸引导原同伴"), action({ type: "PLAN", caseId: "tide-crossing", planId: "CROSS_CURRENT" }, "横渡原潮流")];
    const { onCommand } = panel(navigator({ promoted: true, cases: list, actions: choices }));
    const summary = screen.getByRole("region", { name: "航海家成长下一步" });
    expect(summary.textContent).toContain("对照已知水域与天气，选择本次计划");
    for (const entry of choices) {
      expect(summary.textContent).not.toContain(entry.label);
      expect(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }).hasAttribute("aria-pressed")).toBe(false);
    }
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^横渡原潮流/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[1]!.command);
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it("keeps missing water and preparation unknown and has no invented actions", () => {
    panel(navigator({ promoted: true, cases: cases(), actions: [], environment: "" }));
    expect(screen.getByRole("region", { name: "已知水域与天气条件" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能确认未提供的事实");
    expect(screen.getByRole("region", { name: "实际计划与准备" }).textContent).toContain("尚无本次计划与准备记录");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it("supports projected zero-AP withdrawal and reflection while respecting every lock", async () => {
    const value = navigator({ promoted: true, cases: cases(), actions: [action({ type: "SURVEY", caseId: "tide-crossing" }, "勘察原水域", false), { ...action({ type: "WITHDRAW", caseId: "tide-crossing" }, "退出本次准备"), cost: "0行动" }, { ...action({ type: "REFLECT" }, "反思实际航行"), cost: "0行动" }] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^勘察原水域/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("本周已尝试，须下周再来。").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /^退出本次准备/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "WITHDRAW", caseId: "tide-crossing" });
    await userEvent.click(screen.getByRole("button", { name: /^反思实际航行/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REFLECT" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<NavigatorPanel navigator={value} resources={resources} {...flags} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^反思实际航行/ });
      expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    }
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("shows all eight supplied abilities with original mastery and finite water limits", () => {
    const abilities = [...SAILOR_ABILITIES, ...RAGER_ABILITIES, ...NAVIGATOR_ABILITIES].map((entry, index) => ({ ...entry, mastery: index * 7 }));
    panel(navigator({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "航海家能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 8 项能力" })).toBeTruthy();
    for (const ability of abilities) {
      expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(screen.queryByText(ability.id)).toBeNull();
    }
    expect(region.textContent).toContain("水系攻击不积怒势");
    expect(region.textContent).toContain("不是供气泡");
    expect(screen.getByRole("region", { name: "航海家成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["CONSUME", "SURVEY", "PLAN", "PERFORM", "WITHDRAW", "REFLECT"] as const)("retries the original failed %s envelope without speculative state", async (type) => {
    const command: NavigatorCommand = type === "CONSUME" ? { type, bottleId: "navigator-potion-2", confirmed: true }
      : type === "REFLECT" ? { type }
      : type === "PLAN" ? { type, caseId: "tide-crossing", planId: "SHORE_GUIDE" }
      : { type, caseId: "tide-crossing" };
    const entry = action(command, `执行${type}`);
    const state = fixture(type === "CONSUME" ? 8 : 7, { navigator: type === "CONSUME" ? bottled() : navigator({ promoted: true, cases: cases(), actions: [entry] }) });
    const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openNavigator();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const label = type === "CONSUME" ? "确认服用「第二瓶航海家魔药」" : new RegExp(`^${entry.label}`);
    const confirm = screen.getByRole("button", { name: label });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "航海家模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("航海家模拟保存失败");
    expect((screen.getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "NAVIGATOR", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});

function battle(charge = 0): NonNullable<SliceProjection["combat"]> {
  return {
    title: "原码头冲突", round: 1, enemyName: "持棍的对手", enemyHealth: 100, enemyStatus: "RESISTING",
    playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [],
    consequenceWeights: { light: 65, heavy: 30, death: 5 },
    stances: [{ id: "ATTACK", label: "进攻", description: "公开进攻姿态" }, { id: "DEFEND", label: "防守", description: "公开防守姿态" }],
    lastRound: null, rage: { charge }, water: { soakedRemaining: 0, bound: false, skipNext: false },
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

describe("Navigator inherits the round-level rage policy", () => {
  it("defaults to hold, permits advance authorization at zero charge, and spends nothing on selection", async () => {
    const api = bridge(fixture(7, { combat: battle(0), canAct: false }));
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
    const state = fixture(7, { combat: battle(2), canAct: false });
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
    const state = fixture(7, { combat: battle(3), canAct: false });
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
    const state = fixture(7, { combat: battle(1), canAct: false });
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
    const state = fixture(7, { combat: battle(3), canAct: false });
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

describe("Navigator public water state", () => {
  it.each([
    { soakedRemaining: 0 as const, bound: false, skipNext: false, expected: "湿润：无 · 水缚：无 · 下次能力失效：否" },
    { soakedRemaining: 2 as const, bound: true, skipNext: false, expected: "湿润：剩余 2 次能力结算 · 水缚：有 · 下次能力失效：否" },
    { soakedRemaining: 1 as const, bound: false, skipNext: true, expected: "湿润：剩余 1 次能力结算 · 水缚：无 · 下次能力失效：是" },
  ])("shows only the projected current marks: $expected", async ({ expected, ...water }) => {
    const state = fixture(7, { combat: { ...battle(), water }, canAct: false });
    const api = bridge(state);
    await enter(api);
    expect(screen.getByLabelText("对手当前水系状态").textContent?.trim()).toBe(expected);
    expect(screen.getByText("水系攻击不积怒势。实际持棍物理攻击满足条件时，仍按本回合策略释放。")).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("does not invent water marks when they are not projected", async () => {
    const { water: _water, ...withoutWater } = battle();
    await enter(bridge(fixture(8, { combat: withoutWater, canAct: false })));
    expect(screen.queryByLabelText("对手当前水系状态")).toBeNull();
    expect(screen.getByRole("radio", { name: holdName })).toBeTruthy();
  });
});
