/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SHADOW_ASCETIC_ABILITIES, SHADOW_ASCETIC_CONSUMPTION_RISK } from "../../src/domain/shadow-ascetic/content";
import type { ShadowAsceticAction, ShadowAsceticCommand, ShadowAsceticProjection } from "../../src/domain/shadow-ascetic/types";
import { LISTENER_ABILITIES } from "../../src/domain/listener/content";
import { shadowAsceticActions, shadowAsceticCases } from "../../src/domain/shadow-ascetic/life";
import { SECRET_SUPPLICANT_ABILITIES } from "../../src/domain/secret-supplicant/content";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ShadowAsceticPanel } from "../../src/renderer/ShadowAsceticPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: ShadowAsceticCommand, label = `公开操作${command.type}`, enabled = true, cost = "1行动 · 公开成本"): ShadowAsceticAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
function shadowAscetic(patch: Partial<ShadowAsceticProjection> = {}): ShadowAsceticProjection {
  return {
    title: "隐修士晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [], bottles: [], abilities: [],
    acting: 0, digestion: "倾听者消化100；序列8已完成8/8整周。", pollution: 3,
    risk: SHADOW_ASCETIC_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): ShadowAsceticProjection {
  return shadowAscetic({ guidanceKnown: true,
    supplies: "三瓶独立成品，指导240便士；四次实际劳动抵1800便士后另付210便士，原价2010便士。",
    actions: ["shadow-ascetic-potion-1", "shadow-ascetic-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一瓶")),
    bottles: [
      { id: "shadow-ascetic-potion-1", title: "第一瓶隐修士魔药", source: "伊森·洛弗独立保管的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "shadow-ascetic-potion-1", confirmed: true } },
      { id: "shadow-ascetic-potion-2", title: "第二瓶隐修士魔药", source: "伊森·洛弗独立保管的第二进阶原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "shadow-ascetic-potion-2", confirmed: true } },
      { id: "shadow-ascetic-potion-3", title: "第三瓶隐修士魔药", source: "伊森·洛弗独立保管的第三进阶原瓶", status: "指导者保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "shadow-ascetic-potion-3", confirmed: true } },
    ],
  });
}
function cases(): ShadowAsceticProjection["cases"] {
  return [
    { id: "lamp-shift", title: "灯移了，影子也变了", story: "原灯位将在本次练习中改变。", observations: [], preparation: null, result: null, status: "AVAILABLE", shadowOpen: "没有尚待结束的实践", hidden: false },
    { id: "blocked-alcove", title: "影子后面仍是一只箱子", story: "原木箱挡住旧短线，外侧普通通道仍可走。", observations: [], preparation: null, result: null, status: "AVAILABLE", shadowOpen: "没有尚待结束的实践", hidden: false },
    { id: "agreed-watch", title: "知道藏身点的人", story: "管理员只同意本次有限观察。", observations: [], preparation: null, result: null, status: "AVAILABLE", shadowOpen: "没有尚待结束的实践", hidden: false },
  ];
}
function exposed(failed = false, hidden = false): ShadowAsceticProjection {
  return shadowAscetic({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "agreed-watch" ? {
      ...entry, status: failed ? "OBSERVED" : "EXAMINED", shadowOpen: "本次练习尚未结束：先实际退出", hidden,
      result: failed ? "此前藏匿未成，仍需退出，成本保留。" : "身体已暴露，本次实践仍须实际结束。",
    } : entry),
    actions: [action({ type: "REVEAL", caseId: "agreed-watch" }, "实际显形并沿普通退路离开", true, "0行动 · 0灵性 · 不退成本")],
  });
}
function panel(value: ShadowAsceticProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ShadowAsceticPanel shadowAscetic={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("shadowAscetic-renderer-run", sliceDefaultCreationSelection, "shadowAscetic-renderer-seed");
raw.week = 10; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 9 | 8 | 7 | null = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), investigateTargets: [], canAct: true, actionBlockedReason: null,
    shadowAscetic: shadowAscetic({ promoted: sequence === 7, title: sequence === 7 ? "隐修士 · 序列7" : "隐修士晋升",
      abilities: sequence === 7 ? SHADOW_ASCETIC_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    listener: { ...structuredClone(base.listener), discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7,
      actions: [], acting: sequence === 8 || sequence === 7 ? 100 : 0, digestion: "倾听者消化100已保留",
      abilities: sequence === 8 || sequence === 7 ? LISTENER_ABILITIES.map((ability) => ({ ...ability, mastery: 48 })) : [],
    },
    secretSupplicant: { ...structuredClone(base.secretSupplicant), discovered: sequence !== null, promoted: sequence !== null, actions: [],
      acting: sequence !== null ? 100 : 0,
      abilities: sequence !== null ? SECRET_SUPPLICANT_ABILITIES.map((ability) => ({ ...ability, mastery: 32 })) : [],
    },
    progression: { pathwayId: sequence === null ? null : "hanged-man", sequence, mastery: {}, acting: sequence === 9 || sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:01:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:02:00Z", replayed: false, state } };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openShadowAscetic() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  if (!screen.queryByRole("region", { name: "隐修士成长下一步" })) {
    const tab = screen.queryByRole("button", { name: /^隐修士(?:晋升|成长)$/ });
    if (tab) await userEvent.click(tab);
  }
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Shadow Ascetic sequence-seven public concealment dossier", () => {
  it("keeps sixteen ordinary routes and introduces sequence seven only on the same pathway at sequence eight", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "秘祈人之路" })).toBeTruthy();
    expect(choices.queryByRole("button", { name: /隐修士|倾听者/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("offers eight-full-week preparation from the current S8 guide without consuming anything", async () => {
    const api = bridge(fixture()); await enter(api);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(guide.textContent).toContain("倾听者消化已达100");
    expect(guide.textContent).toContain("八个完整周");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "隐修士成长下一步" }).textContent).toContain("阴影藏匿不等于物理免疫、穿墙、瞬移或绝对隐形。灯位与现场条件变化可能暴露真实身体，即使已经暴露，也仍须实际结束本次实践并由普通退路离开。本页的指导者、成品渠道、情境和数值以当前说明为准；晋升不自动加入组织。");
    expect(screen.getByRole("region", { name: "隐修士成长下一步" }).textContent).not.toContain("数值为；");
    expect(screen.getByRole("button", { name: "隐修士晋升" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("does not expose a new S7 dossier to the current sequence-nine character", async () => {
    const api = bridge(fixture(9)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: "倾听者晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /隐修士晋升|隐修士成长/ })).toBeNull();
  });

  it("opens S7 from the task button and keeps both earlier stages as callback-free original history", async () => {
    const state = fixture(7);
    state.listener.cases = [{ id: "broken-phrase", title: "旧倾听片段", story: "原倾听故事", observations: ["原有限片段保留"], preparation: "原普通核实准备", result: "原错误断言已更正", status: "RESOLVED", contactOpen: "已实际离开", verified: true, overclaims: 1 }];
    state.listener.bottles = [{ id: "listener-potion-1", title: "原倾听者瓶", source: "伊森原S8封瓶", status: "已耗用", chance: 70, command: { type: "CONSUME", bottleId: "listener-potion-1", confirmed: true } }];
    state.listener.actions = [{ id: "stale-s8-reflect", label: "旧S8不可反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }];
    state.secretSupplicant.actions = [{ id: "stale-s9-reflect", label: "旧S9不可反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }];
    const api = bridge(state); await enter(api);
    expect(screen.getByText("隐修士 · 序列7 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看隐修士成长" }));
    expect(screen.getByRole("region", { name: "隐修士能力与消化" }).textContent).toContain("本体仍在原处");
    await userEvent.click(screen.getByRole("button", { name: "倾听者经历" }));
    const history = within(screen.getByRole("region", { name: "倾听者时期的经历" }));
    for (const text of ["原有限片段保留", "原普通核实准备", "原错误断言已更正", "来源：伊森原S8封瓶", "过度断言记录：1"]) expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/倾听者扮演进度 100/)).toBeTruthy();
    expect(history.getByText(/已完成本次普通核实/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    for (const ability of LISTENER_ABILITIES) expect(history.getByText(new RegExp(`${ability.label} · 掌握 48`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "秘祈人经历" }));
    expect(screen.getByRole("region", { name: "秘祈人原成长记录" }).textContent).toContain("秘祈人时期扮演进度 100");
    expect(within(screen.getByRole("region", { name: "秘祈人渠道经历" })).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "隐修士成长" }));
    expect(screen.getByRole("region", { name: "隐修士成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows independent bottle terms and sources without fabricating recipe ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "未核实原料不应显示", quantity: 1, unit: "份" }] });
    expect(screen.getByRole("region", { name: "隐修士成品渠道与配方边界" }).textContent).toContain("本阶段只使用独立成品原瓶，不提供完整配方、材料或调配。每瓶来源、劳动与供应条件以公开记录为准。");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("未核实原料不应显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels without cost, restores focus and confirms only the selected original exactly once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶隐修士魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}"); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("shadow-ascetic-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "隐修士服用风险与四档结果" }).textContent).toContain(SHADOW_ASCETIC_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶隐修士魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "shadow-ascetic-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "inside"] as const)("invalidates confirmation when public state becomes %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<ShadowAsceticPanel shadowAscetic={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted", insideCase: change === "inside" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility rather than calculating readiness from resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "序列8尚未度过八个完整周。";
    rerender(<ShadowAsceticPanel shadowAscetic={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶隐修士魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(reason)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders the actual public preparation choices, including the blocked old route only where authored", async () => {
    const state = structuredClone(raw);
    state.progression.pathwayId = "hanged-man"; state.progression.sequence = 7;
    state.actionsRemaining = 4; state.mind = 80; state.health = 80;
    for (const entry of Object.values(state.shadowAscetic.cases)) entry.status = "OBSERVED";
    const publicActions = shadowAsceticActions(state);
    const value = shadowAscetic({ promoted: true, cases: shadowAsceticCases(state), actions: publicActions });
    const { onCommand } = panel(value);
    for (const caseId of ["lamp-shift", "blocked-alcove", "agreed-watch"]) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择阴影实践" }), caseId);
      const choices = publicActions.filter((entry) => entry.command.type === "PREPARE" && entry.command.caseId === caseId);
      expect(choices.map((entry) => entry.command.type === "PREPARE" && entry.command.method)).toEqual(caseId === "blocked-alcove" ? ["SHADOW", "ORDINARY", "BLOCKED_ROUTE"] : ["SHADOW", "ORDINARY"]);
      const actions = within(screen.getByRole("group", { name: "当前情境行动" }));
      expect(actions.getAllByRole("button")).toHaveLength(choices.length);
      for (const choice of choices) await userEvent.click(actions.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
      expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(publicActions.filter((entry) => entry.command.type === "PREPARE").map((entry) => entry.command));
  });

  it("keeps the lamp-shift body visible while its actual public practice still requires REVEAL", async () => {
    const state = structuredClone(raw);
    state.progression.pathwayId = "hanged-man"; state.progression.sequence = 7;
    state.actionsRemaining = 0; state.mind = 0; state.spirituality = 0;
    state.shadowAscetic.cases["lamp-shift"] = {
      status: "EXAMINED", attemptWeek: state.week, method: "SHADOW", withdrawals: 0,
      outcome: "LIGHT_CHECKED", shadowOpen: true, hidden: false,
    };
    const value = shadowAscetic({ promoted: true, insideCase: true, cases: shadowAsceticCases(state), actions: shadowAsceticActions(state) });
    const { onCommand } = panel(value);
    expect(screen.getByText("当前藏匿：未处于阴影藏匿")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain("不等于继续隐形");
    expect((screen.getByRole("combobox", { name: "选择阴影实践" }) as HTMLSelectElement).value).toBe("lamp-shift");
    const exit = value.actions.find((entry) => entry.command.type === "REVEAL")!;
    expect(exit.enabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${exit.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REVEAL", caseId: "lamp-shift" });
  });

  it.each([false, true])("shows actual failed=%s practice still open with no concealment at zero AP and mind", async (failed) => {
    const { onCommand, rerender } = panel(shadowAscetic({ promoted: true, cases: cases() }));
    expect(screen.getByRole("region", { name: "隐修士有限阴影实践" }).textContent).toContain("先观察现场，再从当前公开方法中选择阴影藏匿或普通方法。没有可用阴影时使用普通方法；藏匿不会让堵塞路线通行，也不会移动身体穿过障碍。准备、实际尝试、显形退出和报告分别提交；退出准备不能替代实际退出。普通方法与练习情境以当前说明为准。");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择阴影实践" }), "blocked-alcove");
    const value = exposed(failed, false);
    value.actions.push(action({ type: "REPORT", caseId: "agreed-watch" }), action({ type: "REFLECT" }), action({ type: "WITHDRAW", caseId: "agreed-watch" }));
    rerender(<ShadowAsceticPanel shadowAscetic={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择阴影实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("agreed-watch"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("当前藏匿：未处于阴影藏匿")).toBeTruthy();
    expect(screen.getByText("本次实践：本次练习尚未结束：先实际退出")).toBeTruthy();
    const stop = screen.getByRole("button", { name: /^实际显形并沿普通退路离开/ }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false); expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(stop);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REVEAL", caseId: "agreed-watch" });
    expect(screen.getByText("本次实践：本次练习尚未结束：先实际退出")).toBeTruthy();
  });

  it.each(["busy", "blocked"] as const)("locks the actual exit during %s", (lock) => {
    render(<ShadowAsceticPanel shadowAscetic={exposed()} resources={resources} busy={lock === "busy"} blocked={lock === "blocked"} onCommand={vi.fn()} />);
    expect((screen.getByRole("button", { name: /^实际显形并沿普通退路离开/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "OBSERVE", "PREPARE", "PERFORM", "REVEAL", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the same failed %s envelope once without replacing committed facts", async (type) => {
    const acquiring = ["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: ShadowAsceticCommand = type === "CONSUME" ? { type, bottleId: "shadow-ascetic-potion-2", confirmed: true }
      : type === "POTION_WORK" || type === "BUY_POTION" ? { type, bottleId: "shadow-ascetic-potion-3" }
      : type === "REFLECT" || type === "LEARN_GUIDANCE" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "agreed-watch", method: "SHADOW" }
      : { type, caseId: "agreed-watch" };
    const state = fixture(acquiring ? 8 : 7, { shadowAscetic: type === "CONSUME" ? bottled() : shadowAscetic({ promoted: !acquiring, cases: cases(), insideCase: type === "REVEAL", actions: [action(command)] }), actionsRemaining: 0, spirituality: 0, canAct: false, mind: type === "REVEAL" ? 0 : 88 });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next = { ...state, revision: state.revision + 1, shadowAscetic: { ...state.shadowAscetic, insideCase: false, actions: [] } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(next, envelope));
    api.submitIntent = submit; await enter(api); await openShadowAscetic();
    if ("caseId" in command && !state.shadowAscetic.insideCase) await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择阴影实践" }), command.caseId);
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶隐修士魔药」" : new RegExp(`^${action(command).label}`);
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "隐修士模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("隐修士模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SHADOW_ASCETIC", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    if ("caseId" in command) expect((screen.getByRole("combobox", { name: "选择阴影实践" }) as HTMLSelectElement).value).toBe("agreed-watch");
  });

  it("reloads an open practice with exposed body and unlocks only after a saved REVEAL receipt", async () => {
    const state = fixture(7, { shadowAscetic: exposed(false, false), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next = { ...state, revision: state.revision + 1, shadowAscetic: { ...state.shadowAscetic, insideCase: false, actions: [], cases: state.shadowAscetic.cases.map((entry) => ({ ...entry, shadowOpen: "已沿普通退路离开", hidden: false })) } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "退出尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "立即显形并退出本次实践" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际显形并退出");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) expect(button.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际显形并沿普通退路离开/ }));
    expect(screen.getByRole("alert").textContent).toContain("退出尚未保存");
    expect(screen.getByText("当前藏匿：未处于阴影藏匿")).toBeTruthy();
    expect(screen.getByText("本次实践：本次练习尚未结束：先实际退出")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "SHADOW_ASCETIC", command: { type: "REVEAL", caseId: "agreed-watch" } });
    expect(screen.getByText("本次实践：已沿普通退路离开")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("does not infer an unfinished practice from localized text, EXAMINED status or concealment display", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", shadowOpen: "本次练习尚未结束：这里只是历史文字", hidden: false };
    const api = bridge(fixture(7, { shadowAscetic: shadowAscetic({ promoted: true, cases: list }), actionsRemaining: 1 }));
    await enter(api); expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openShadowAscetic(); expect(screen.queryByRole("region", { name: "立即显形并退出本次实践" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择阴影实践" }) as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("preserves an earlier S8 actual exit ahead of a simultaneous S7 practice", async () => {
    const state = fixture(7, { shadowAscetic: exposed(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.listener = { ...state.listener, insideCase: true,
      cases: [{ id: "room-exit", title: "原倾听位置", story: "仍须沿普通退路离开。", status: "EXAMINED", contactOpen: "本次倾听尚未退出", verified: false, overclaims: 0, observations: [], preparation: null, result: "原接触仍须结束。" }],
      actions: [{ id: "legacy-leave", label: "先离开原倾听位置", cost: "0行动", enabled: true, reason: null, command: { type: "LEAVE", caseId: "room-exit" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: /^先离开原倾听位置/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "隐修士成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: "倾听者时期的经历" })).toBeNull();
    await userEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "LISTENER", command: { type: "LEAVE", caseId: "room-exit" } });
  });

  it("keeps a consumed failed bottle gone and shows updated resources for another original", async () => {
    const state = fixture(8, { shadowAscetic: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      shadowAscetic: { ...state.shadowAscetic, bottles: state.shadowAscetic.bottles.map((bottle) => bottle.id === "shadow-ascetic-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.shadowAscetic.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openShadowAscetic();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶隐修士魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("shadow-ascetic-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });

  it("stays on the new S7 dossier after promotion and shows no stale S8 or S9 actions", async () => {
    const state = fixture(8, { shadowAscetic: bottled() });
    state.listener.actions = [{ id: "old-reflect", label: "旧阶段不可再反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }];
    const next = fixture(7, { revision: state.revision + 1, listener: state.listener,
      shadowAscetic: shadowAscetic({ promoted: true, title: "隐修士 · 序列7", cases: cases(), abilities: SHADOW_ASCETIC_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) }),
    });
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api); await openShadowAscetic();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶隐修士魔药」" }));
    expect(screen.getByRole("region", { name: "隐修士成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "倾听者成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: "秘祈人成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用|旧阶段不可再反思/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "倾听者经历" }));
    expect(screen.getByRole("region", { name: "倾听者时期的经历" }).textContent).toContain("倾听者扮演进度 100");
    expect(within(screen.getByRole("region", { name: "倾听者时期的经历" })).queryByRole("button")).toBeNull();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
});
