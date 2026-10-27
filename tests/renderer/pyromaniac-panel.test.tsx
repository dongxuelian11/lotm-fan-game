/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { PYROMANIAC_ABILITIES } from "../../src/domain/pyromaniac/content";
import { PYROMANIAC_ABILITY_IDS, type PyromaniacAction, type PyromaniacCommand, type PyromaniacProjection } from "../../src/domain/pyromaniac/types";
import { HUNTER_ABILITIES } from "../../src/domain/hunter/content";
import { HUNTER_ABILITY_IDS } from "../../src/domain/hunter/types";
import { PROVOKER_ABILITIES } from "../../src/domain/provoker/content";
import { PROVOKER_ABILITY_IDS } from "../../src/domain/provoker/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { PyromaniacPanel } from "../../src/renderer/PyromaniacPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。每档都消耗所选原瓶。";
function action(command: PyromaniacCommand, enabled = true): PyromaniacAction {
  const suffix = "practiceId" in command ? command.practiceId : "bottleId" in command ? command.bottleId : "";
  return { id: `${command.type}-${suffix}`, label: `公开操作${command.type}${suffix}`, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "本周剩余行动不足。", command };
}
function pyromaniac(patch: Partial<PyromaniacProjection> = {}): PyromaniacProjection {
  return {
    title: "纵火家之路", discovered: true, guidanceKnown: false, formulaKnown: false, promoted: false,
    formula: [], actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "挑衅者消化100/100，晋升挑衅者后8/8整周。", pollution: 3, risk,
    supplies: "三瓶独立成品药；每瓶可付全款，或完成四次实际劳务后支付余款。",
    practices: [], environment: "尚未亲自观察砖院。", ...patch,
  };
}
function bottled(): PyromaniacProjection {
  return pyromaniac({ guidanceKnown: true,
    actions: ["pyromaniac-potion-1", "pyromaniac-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true })),
    bottles: [
      { id: "pyromaniac-potion-1", title: "第一瓶纵火家魔药", source: "实际完成四次劳务并付余款的原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "pyromaniac-potion-1", confirmed: true } },
      { id: "pyromaniac-potion-2", title: "第二瓶纵火家魔药", source: "新货栈实际供给的第二瓶成品", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "pyromaniac-potion-2", confirmed: true } },
      { id: "pyromaniac-potion-3", title: "第三瓶纵火家魔药", source: "已耗用的第三瓶成品", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "pyromaniac-potion-3", confirmed: true } },
    ],
  });
}
function practices(): PyromaniacProjection["practices"] {
  return ["kiln-heat", "arc-target", "night-warmth"].map((id, index) => ({ id, title: `实际实践${index + 1}`, story: `真实情境与边界${index + 1}`, status: "尚未完成" }));
}
const dispute = { id: "pyromaniac-dispute", title: "原布箱旁的争议", story: "原货物仍属于库管，可以交涉，也可以明确承担战斗风险。", status: "尚待处理" };
function panel(value: PyromaniacProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PyromaniacPanel pyromaniac={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("pyromaniac-renderer-run", sliceDefaultCreationSelection, "pyromaniac-renderer-seed");
  raw.week = 24;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  raw.hunter.discovered = true;
  raw.hunter.guidanceKnown = true;
  raw.progression = {
    pathwayId: "hunter", sequence, acting: sequence === 7 ? 0 : 100, promotionWeek: 5,
    mastery: Object.fromEntries([...HUNTER_ABILITY_IDS, ...(sequence !== 9 ? PROVOKER_ABILITY_IDS : []), ...(sequence === 7 ? PYROMANIAC_ABILITY_IDS : [])].map((id, index) => [id, index * 2])),
  };
  if (sequence !== 9) {
    raw.provoker.guidanceKnown = true;
    raw.provoker.promotionWeek = 13;
    raw.provoker.hunterActingAtPromotion = 100;
  }
  if (sequence === 7) {
    raw.pyromaniac.guidanceKnown = true;
    raw.pyromaniac.promotionWeek = 22;
    raw.pyromaniac.provokerActingAtPromotion = 100;
  }
  return { ...projectSliceState(raw), investigateTargets: [], canAct: true, actionBlockedReason: null, ...patch };
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
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Pyromaniac S7 dossier", () => {
  it("keeps the sourced finished-bottle channel, four jobs and payment separate from consumption without inventing a recipe", async () => {
    const { onCommand, rerender } = panel(pyromaniac({ formula: [{ name: "未核实的材料", quantity: 1, unit: "份" }] }));
    expect(screen.queryByText("未核实的材料")).toBeNull();
    expect(screen.getByText(/每瓶可付全款，或完成四次实际劳务/)).toBeTruthy();
    const commands: PyromaniacCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "pyromaniac-potion-1" },
      { type: "BUY_POTION", bottleId: "pyromaniac-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    for (const command of commands) {
      const current = action(command);
      rerender(<PyromaniacPanel pyromaniac={pyromaniac({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("retains all three original records without making a spent bottle usable", () => {
    panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "纵火家独立原瓶" })).getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, restores focus and confirms exactly the selected bottle at zero AP with its risk and resources", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶纵火家魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    for (const text of ["pyromaniac-potion-2", "43%", "来源：新货栈实际供给的第二瓶成品", "领域成本CONSUME"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "纵火家服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 60", "3", "0", resources.cash]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶纵火家魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "pyromaniac-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["bottle", "action", "promotion"])("discards a confirmation when its %s disappears", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const next = { ...value, ...(change === "bottle" ? { bottles: value.bottles.slice(1) } : change === "action" ? { actions: value.actions.slice(1) } : { promoted: true }) };
    rerender(<PyromaniacPanel pyromaniac={next} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("rechecks a disabled original while its confirmation is open", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<PyromaniacPanel pyromaniac={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "挑衅者尚未消化。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶纵火家魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("挑衅者尚未消化。")).toBeTruthy();
    fireEvent.click(confirm);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected practice with one concrete next step and only committed outcomes", async () => {
    const list = practices();
    const value = pyromaniac({ promoted: true, actions: list.map((practice) => action({ type: "PRACTICE", practiceId: practice.id })), practices: list });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前纵火家实践" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作PRACTICE/ })).toHaveLength(1);
    expect(screen.queryByText("真实情境与边界2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择一次实践" }), "arc-target");
    expect(screen.getByText("真实情境与边界2")).toBeTruthy();
    expect(screen.getByRole("region", { name: "纵火家成长下一步" }).textContent).toContain("公开操作PRACTICEarc-target");
    await userEvent.click(screen.getByRole("button", { name: /^公开操作PRACTICE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PRACTICE", practiceId: "arc-target" });
    expect(within(screen.getByRole("region", { name: "当前纵火家实践" })).getByText("尚未完成")).toBeTruthy();
    rerender(<PyromaniacPanel pyromaniac={{ ...value, practices: list.map((entry) => entry.id === "arc-target" ? { ...entry, status: "本周未完成，下周再试" } : entry), actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("真实情境与边界2")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "当前纵火家实践" })).getByText("本周未完成，下周再试")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^公开操作PRACTICE/ })).toBeNull();
  });

  it("keeps survey, owner-led lane clearing and talk or fight in the fourth record with committed environment facts", async () => {
    const value = pyromaniac({ promoted: true, practices: [...practices(), dispute],
      environment: "原棉布箱靠近射线，尚未移动，火焰术会回退为普通动作。",
      actions: [action({ type: "PRACTICE", practiceId: "kiln-heat" }), action({ type: "SURVEY_ENCOUNTER" })],
    });
    const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button", { name: /^公开操作SURVEY/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择一次实践" }), "pyromaniac-dispute");
    expect(screen.queryByRole("button", { name: /^公开操作PRACTICE/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作SURVEY/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "SURVEY_ENCOUNTER" });
    for (const type of ["CLEAR_LANE", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"] as const) {
      rerender(<PyromaniacPanel pyromaniac={{ ...value, actions: [action({ type })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^公开操作${type}`) }));
      expect(onCommand).toHaveBeenLastCalledWith({ type });
      expect(screen.getByRole("region", { name: "当前纵火家现场环境" }).textContent).toContain("尚未移动");
    }
    rerender(<PyromaniacPanel pyromaniac={{ ...value, actions: [], environment: "原布箱已由库管沿侧路移入库房；6米砖院射线清空，产权不变。" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "当前纵火家现场环境" }).textContent).toContain("已由库管沿侧路移入库房");
    expect(screen.queryByRole("button", { name: /火焰跳跃|无敌|火焰免疫/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(4);
  });

  it("folds all ten inherited and S7 abilities with projected mastery and finite flame descriptions", async () => {
    const abilities = [...HUNTER_ABILITIES, ...PROVOKER_ABILITIES, ...PYROMANIAC_ABILITIES].map((ability, index) => ({ ...ability, mastery: index * 7 }));
    panel(pyromaniac({ promoted: true, actions: [], abilities }));
    const folded = screen.getByLabelText("纵火家能力与消化") as HTMLDetailsElement;
    expect(folded.open).toBe(false);
    await userEvent.click(screen.getByText("能力与消化 · 10 项能力"));
    for (const ability of abilities) expect(within(folded).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(folded.textContent).toContain("不意味着火焰免疫");
    expect(folded.textContent).toContain("不是活体动物");
    expect(within(folded).queryByRole("button")).toBeNull();
  });

  it.each(["busy", "blocked"])("disables all actual controls when %s", (condition) => {
    const value = pyromaniac({ promoted: true, practices: practices(), actions: [action({ type: "PRACTICE", practiceId: "kiln-heat" }), action({ type: "REFLECT" })] });
    const onCommand = vi.fn();
    render(<PyromaniacPanel pyromaniac={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"} onCommand={onCommand} />);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([9, 8, 7] as const)("routes Hunter sequence %s to its current dossier without prematurely offering S7", async (sequence) => {
    const value = bridge(fixture(sequence));
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: sequence === 9 ? "猎人之路" : sequence === 8 ? "挑衅者晋升" : "纵火家成长" }).getAttribute("aria-pressed")).toBe("true");
    if (sequence === 9) expect(screen.queryByRole("button", { name: /纵火家晋升|纵火家成长/ })).toBeNull();
    else expect(screen.getByRole("button", { name: sequence === 8 ? "纵火家晋升" : "纵火家成长" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /魔术师晋升|魔术师成长/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("still routes Diviner S7 to Magician and hides the Hunter S7 tab", async () => {
    const state = fixture();
    state.progression.pathwayId = "diviner";
    state.magician = { ...state.magician, promoted: true, discovered: true };
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: "魔术师成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "魔术师成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /纵火家晋升|纵火家成长/ })).toBeNull();
  });

  it("sends the digested Provoker goal to S7 preparation and displays the actual S7 resource maximum", async () => {
    await enter(bridge(fixture(8)));
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "纵火家成长下一步" })).toBeTruthy();
    cleanup();
    const state = fixture(7);
    await enter(bridge(state));
    expect(screen.getByText(/纵火家 · 序列7 ·/, { selector: "p.slice-muted" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe(String(state.maxSpirituality));
  });

  it("keeps both earlier dossiers and spent original failures readable with no repeat growth or consuming", async () => {
    const state = fixture();
    state.hunter.story = "原货道与原货物的结局仍保留。";
    state.hunter.actions = [{ id: "old-practice", label: "重复猎人奖励", cost: "1行动", enabled: true, reason: null, command: { type: "PRACTICE", practiceId: "old" } }];
    state.provoker.story = "原货栈交涉结果。";
    state.provoker.actions = [{ id: "old-bottle", label: "重新服用挑衅者旧瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old", confirmed: true } }];
    state.provoker.bottles = [{ id: "old", title: "原挑衅者瓶", source: "原仓库批次", status: "已耗尽 · 严重排异", chance: 61, command: { type: "CONSUME", bottleId: "old", confirmed: true } }];
    const value = bridge(state);
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "猎人经历" }));
    expect(screen.getByText("原货道与原货物的结局仍保留。")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "猎人时期的经历" })).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "挑衅者经历" }));
    expect(screen.getByRole("region", { name: "挑衅者情境历史" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "挑衅者时期的经历" })).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByText("挑衅者原瓶 · 来源与去向"));
    expect(screen.getByText("来源：原仓库批次")).toBeTruthy();
    expect(screen.getByText("已耗尽 · 严重排异")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重复猎人奖励|重新服用|查看并准备服用/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "CLEAR_LANE"] as const)("locks and retries the identical failed %s envelope", async (type) => {
    const consume = type === "CONSUME";
    const command: PyromaniacCommand = consume ? { type, bottleId: "pyromaniac-potion-2", confirmed: true } : { type };
    const state = fixture(consume ? 8 : 7, { pyromaniac: consume ? bottled() : pyromaniac({ promoted: true, practices: [dispute], actions: [action(command)] }) });
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    if (consume) {
      await userEvent.click(screen.getByRole("button", { name: "纵火家晋升" }));
      await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    }
    const buttonName = consume ? "确认服用「第二瓶纵火家魔药」" : /^公开操作CLEAR_LANE/;
    const button = screen.getByRole("button", { name: buttonName });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "纵火家模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("纵火家模拟保存失败");
    expect((screen.getByRole("button", { name: buttonName }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: consume ? "挑衅者晋升" : "挑衅者经历" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "PYROMANIAC", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
