/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { MAGICIAN_ABILITIES, MAGICIAN_CONSUMPTION_RULE, MAGICIAN_CONSUMPTION_OUTCOMES, MAGICIAN_CONSUMPTION_PROTECTION, MAGICIAN_CONSUMPTION_RISK } from "../../src/domain/magician/content";
import { MAGICIAN_ABILITY_IDS, type MagicianAction, type MagicianCommand, type MagicianProjection } from "../../src/domain/magician/types";
import { CLOWN_ABILITY_IDS } from "../../src/domain/clown/types";
import { SEER_ABILITY_IDS } from "../../src/domain/seer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ClownHistory, MagicianPanel, SeerHistory } from "../../src/renderer/MagicianPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。每档都消耗所选原瓶。";
function action(command: MagicianCommand, enabled = true): MagicianAction {
  const suffix = "practiceId" in command ? command.practiceId : "bottleId" in command ? command.bottleId : "batchId" in command ? command.batchId : "injuryId" in command ? command.injuryId : "";
  return { id: `${command.type}-${suffix}`, label: `公开操作${command.type}${suffix}`, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "本周剩余行动不足。", command };
}
function magician(patch: Partial<MagicianProjection> = {}): MagicianProjection {
  return {
    title: "魔术师之路", discovered: true, formulaKnown: false, promoted: false,
    formula: [], actions: [action({ type: "LEARN_FORMULA" })], bottles: [], abilities: [],
    acting: 0, digestion: "小丑消化100/100，晋升小丑后8/8整周。", pollution: 3, risk,
    practices: [], supplies: { figurinesHeld: 0, paperSheets: 0, oilHeld: 0, lanternPrepared: false }, ...patch,
  };
}
function bottled(): MagicianProjection {
  return magician({ formulaKnown: true,
    actions: ["magician-batch-1:bottle", "magician-batch-2:bottle"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true })),
    bottles: [
      { id: "magician-batch-1:bottle", title: "第一瓶魔术师魔药", source: "第一批实际劳务材料调配", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "magician-batch-1:bottle", confirmed: true } },
      { id: "magician-batch-2:bottle", title: "第二瓶魔术师魔药", source: "第二批实际采购材料调配", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "magician-batch-2:bottle", confirmed: true } },
      { id: "magician-batch-3:bottle", title: "第三瓶魔术师魔药", source: "已耗用的第三批原料", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "magician-batch-3:bottle", confirmed: true } },
    ],
  });
}
function practices(): MagicianProjection["practices"] {
  return ["air-target", "stage-illusion", "shallow-water"].map((id, index) => ({ id, title: `实际实践${index + 1}`, story: `真实情境与边界${index + 1}`, status: "尚未完成" }));
}
function panel(value: MagicianProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<MagicianPanel magician={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("magician-renderer-run", sliceDefaultCreationSelection, "magician-renderer-seed");
  raw.week = 24;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  raw.seer.discovered = true;
  raw.seer.formulaKnown = true;
  raw.progression = {
    pathwayId: "diviner", sequence, acting: sequence === 7 ? 0 : 100, promotionWeek: 5,
    mastery: Object.fromEntries([...SEER_ABILITY_IDS, ...(sequence !== 9 ? CLOWN_ABILITY_IDS : []), ...(sequence === 7 ? MAGICIAN_ABILITY_IDS : [])].map((id, index) => [id, index * 2])),
  };
  if (sequence !== 9) {
    raw.clown.formulaKnown = true;
    raw.clown.promotionWeek = 13;
    raw.clown.seerActingAtPromotion = 100;
    raw.clown.paperStock = 20;
    raw.clown.paperSheets = 7;
    raw.clown.paperSpent = 3;
  }
  if (sequence === 7) {
    raw.magician.formulaKnown = true;
    raw.magician.promotionWeek = 22;
    raw.magician.clownActingAtPromotion = 100;
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
const scrollIntoView = vi.fn();
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  scrollIntoView.mockClear();
});
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Magician S7 dossier", () => {
  it("shows only the committed formula and keeps acquiring, brewing and consuming separate", async () => {
    const { onCommand, rerender } = panel(magician({ formula: [{ name: "尚未公开材料", quantity: 1, unit: "份" }] }));
    expect(screen.queryByText("尚未公开材料")).toBeNull();
    const commands: MagicianCommand[] = [
      { type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "magician-batch-1" },
      { type: "BUY_MATERIALS", batchId: "magician-batch-1" }, { type: "BREW", batchId: "magician-batch-1" },
      { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    for (const command of commands) {
      const current = action(command);
      rerender(<MagicianPanel magician={magician({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    }
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("reads independent bottle records without presenting spent originals as usable", () => {
    panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, restores focus, and confirms precisely one original at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶魔术师魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("第2批魔术师原瓶")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：第二批实际采购材料调配")).toBeTruthy();
    expect(screen.getByText("领域成本CONSUME")).toBeTruthy();
    expect(screen.getByRole("region", { name: "魔术师服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 60", "3", "0", resources.cash]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶魔术师魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "magician-batch-2:bottle", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["bottle", "action", "promotion"])("discards confirmation when its %s disappears", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const next = { ...value, ...(change === "bottle" ? { bottles: value.bottles.slice(1) } : change === "action" ? { actions: value.actions.slice(1) } : { promoted: true }) };
    rerender(<MagicianPanel magician={next} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("rechecks a disabled original while confirmation is open", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<MagicianPanel magician={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "小丑尚未消化。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶魔术师魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("小丑尚未消化。")).toBeTruthy();
    fireEvent.click(confirm);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected practice, uses its backend action, and does not invent a completed result", async () => {
    const list = practices();
    const value = magician({ promoted: true, actions: list.map((practice) => action({ type: "PRACTICE", practiceId: practice.id })), practices: list });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前魔术师实践" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作PRACTICE/ })).toHaveLength(1);
    expect(screen.queryByText("真实情境与边界2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择一次实践" }), "stage-illusion");
    expect(screen.getByText("真实情境与边界2")).toBeTruthy();
    expect(screen.queryByText("真实情境与边界1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作PRACTICE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PRACTICE", practiceId: "stage-illusion" });
    expect(within(screen.getByRole("region", { name: "当前魔术师实践" })).getByText("尚未完成")).toBeTruthy();
    rerender(<MagicianPanel magician={{ ...value, practices: list.map((entry) => entry.id === "stage-illusion" ? { ...entry, status: "本周未完成，下周再试" } : entry), actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("真实情境与边界2")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "当前魔术师实践" })).getByText("本周未完成，下周再试")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^公开操作PRACTICE/ })).toBeNull();
  });

  it("keeps the seventh encounter within its selected record and forwards its real talk or fight command", async () => {
    const value = magician({ promoted: true,
      practices: [...practices(), { id: "magician-dispute", title: "剧场后巷争端", story: "莫里挡在原剧场后巷，仍可选择交谈。", status: "尚未处理" }],
      actions: [action({ type: "PRACTICE", practiceId: "air-target" }), action({ type: "ENCOUNTER_TALK" }), action({ type: "ENCOUNTER_FIGHT" })],
    });
    const { onCommand } = panel(value);
    expect(screen.queryByRole("button", { name: /^公开操作ENCOUNTER/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择一次实践" }), "magician-dispute");
    const practice = screen.getByRole("region", { name: "当前魔术师实践" });
    expect(practice.textContent).toContain("仍可选择交谈");
    expect(within(practice).getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^公开操作PRACTICE/ })).toBeNull();
    await userEvent.click(within(practice).getByRole("button", { name: /^公开操作ENCOUNTER_TALK/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_TALK" });
    expect(practice.textContent).toContain("尚未处理");
  });

  it("shows real paper, figurines and lamp state without optimistic preparation or spell buttons", async () => {
    const value = magician({ promoted: true, actions: [action({ type: "PREPARE_FIGURINE" }), action({ type: "BUY_OIL" }), action({ type: "PREPARE_LANTERN" }, false)],
      supplies: { paperSheets: 7, figurinesHeld: 1, oilHeld: 0, lanternPrepared: false } });
    const { onCommand, rerender } = panel(value);
    const supplies = screen.getByRole("region", { name: "魔术师实际道具" });
    for (const text of ["7 张", "1 个", "0 份", "尚未准备"]) expect(within(supplies).getByText(text)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^公开操作PREPARE_LANTERN/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^公开操作PREPARE_FIGURINE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE_FIGURINE" });
    expect(within(supplies).getByText("7 张")).toBeTruthy();
    expect(within(supplies).getByText("1 个")).toBeTruthy();
    rerender(<MagicianPanel magician={{ ...value, supplies: { paperSheets: 6, figurinesHeld: 2, oilHeld: 1, lanternPrepared: true } }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    for (const text of ["6 张", "2 个", "1 份", "已经准备"]) expect(within(screen.getByRole("region", { name: "魔术师实际道具" })).getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /凭空|复活|无面人|立即火焰跳跃/ })).toBeNull();
  });

  it("keeps the canonical nine spells as folded descriptions with projected mastery", async () => {
    const value = magician({ promoted: true, actions: [], abilities: MAGICIAN_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 })) });
    panel(value);
    const abilities = screen.getByLabelText("魔术师能力与消化") as HTMLDetailsElement;
    expect(abilities.open).toBe(false);
    await userEvent.click(screen.getByText("能力与消化 · 9 项能力"));
    for (const ability of value.abilities) expect(within(abilities).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(abilities.textContent).toContain("不能替代已经结算的死亡");
    expect(abilities.textContent).toContain("不能转给另一个人");
    expect(within(abilities).queryByRole("button")).toBeNull();
  });

  it("only offers injury transfer for actual projected wounds and never displays a health increase", async () => {
    const current = action({ type: "TRANSFER_INJURY", injuryId: "actual-injury-4" });
    const { onCommand } = panel(magician({ promoted: true, actions: [current] }));
    await userEvent.click(screen.getByText("查看可转移的自身伤势"));
    expect(screen.getByText(/同一处伤势只能在自己的身体内部转移一次，不恢复健康/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作TRANSFER_INJURY/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "TRANSFER_INJURY", injuryId: "actual-injury-4" });
    expect(screen.queryByText(/健康\+/)).toBeNull();
  });

  it.each(["busy", "blocked"])("disables all actual controls when %s", (condition) => {
    const value = magician({ promoted: true, practices: practices(), actions: [action({ type: "PRACTICE", practiceId: "air-target" }), action({ type: "BUY_OIL" })] });
    const onCommand = vi.fn();
    render(<MagicianPanel magician={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"} onCommand={onCommand} />);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([9, 8, 7] as const)("routes sequence %s to its current dossier without prematurely offering S7", async (sequence) => {
    const value = bridge(fixture(sequence));
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: sequence === 9 ? "占卜家经历" : sequence === 8 ? "小丑晋升" : "魔术师成长" }).getAttribute("aria-pressed")).toBe("true");
    if (sequence === 9) expect(screen.queryByRole("button", { name: /魔术师晋升|魔术师成长/ })).toBeNull();
    else expect(screen.getByRole("button", { name: sequence === 8 ? "魔术师晋升" : "魔术师成长" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("sends the digested Clown dashboard goal to S7 preparation and shows backend 60 maximum after promotion", async () => {
    const value = bridge(fixture(8));
    await enter(value);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "魔术师成长下一步" })).toBeTruthy();
    cleanup();
    await enter(bridge(fixture(7)));
    expect(screen.getByText(/魔术师 · 序列7 ·/, { selector: "p.slice-muted" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe("60");
  });

  it("preserves both earlier dossiers as read-only history except for the actual shared paper purchase", async () => {
    const state = fixture();
    state.clown.story = "原护送情境仍保留。";
    state.clown.actions = [
      { id: "paper", label: "购买实际纸张", cost: "领域真实纸价", enabled: true, reason: null, command: { type: "BUY_PAPER" } },
      { id: "old-practice", label: "重复旧小丑奖励", cost: "1行动", enabled: true, reason: null, command: { type: "PRACTICE", practiceId: "old" } },
      { id: "old-bottle", label: "重新服用旧瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old", confirmed: true } },
    ];
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    expect(within(screen.getByRole("region", { name: "占卜家时期的经历" })).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(8);
    await userEvent.click(screen.getByRole("button", { name: "小丑经历" }));
    expect(screen.getByText("原护送情境仍保留。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重复旧小丑奖励|重新服用旧瓶|查看并准备服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /购买实际纸张/ }));
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "CLOWN", command: { type: "BUY_PAPER" } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "魔术师成长下一步" })).toBeTruthy();
  });

  it("historical source and failure records stay readable without reopening old actions", async () => {
    const state = fixture();
    state.clown.bottles = [{ id: "old-bottle", title: "原小丑瓶", source: "原采购批次", status: "已耗尽 · 严重排异", chance: 61, command: { type: "CONSUME", bottleId: "old-bottle", confirmed: true } }];
    const onCommand = vi.fn();
    const { rerender } = render(<ClownHistory clown={state.clown} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByText("小丑原瓶 · 来源与去向"));
    expect(screen.getByText("来源：原采购批次")).toBeTruthy();
    expect(screen.getByText("已耗尽 · 严重排异")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
    rerender(<SeerHistory seer={state.seer} />);
    expect(screen.getByRole("region", { name: "占卜家委托历史" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["CONSUME", "PRACTICE", "PREPARE_FIGURINE", "BUY_OIL", "PREPARE_LANTERN", "TRANSFER_INJURY", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "REFLECT"] as const)("locks and retries the same failed %s envelope", async (type) => {
    const consume = type === "CONSUME";
    const command: MagicianCommand = consume ? { type, bottleId: "magician-batch-2:bottle", confirmed: true }
      : type === "PRACTICE" ? { type, practiceId: "air-target" }
      : type === "TRANSFER_INJURY" ? { type, injuryId: "actual-injury-4" } : { type };
    const state = fixture(consume ? 8 : 7, { magician: consume ? bottled() : magician({ promoted: true, practices: practices(), actions: [action(command)] }) });
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    if (consume) {
      await userEvent.click(screen.getByRole("button", { name: "魔术师晋升" }));
      await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    }
    if (type === "TRANSFER_INJURY") await userEvent.click(screen.getByText("查看可转移的自身伤势"));
    const buttonName = consume ? "确认服用「第二瓶魔术师魔药」" : new RegExp(`^公开操作${type}`);
    const button = screen.getByRole("button", { name: buttonName });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "魔术师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("魔术师模拟保存失败");
    expect((screen.getByRole("button", { name: buttonName }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: "占卜家经历" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "MAGICIAN", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});

// Synthetic public projections isolate presentation; costs and availability remain domain-owned.
describe("Magician preparation batch hierarchy", () => {
  function batchActions() {
    const first = { ...action({ type: "BUY_MATERIALS", batchId: "magician-batch-1" }, false),
      label: "购入第一批剩余辅材", cost: "1行动 · 150便士", reason: "需要150便士。" };
    const second = { ...action({ type: "MATERIAL_WORK", batchId: "magician-batch-2" }),
      label: "替第二批供应者工作", cost: "1行动 · 原劳动1/4" };
    return { first, second };
  }

  it("keeps the first remaining batch next even when unaffordable and a spare batch offers work", async () => {
    const { first, second } = batchActions(), onCommand = vi.fn();
    render(<MagicianPanel magician={magician({ formulaKnown: true, actions: [first, second] })}
      resources={{ ...resources, actionsRemaining: 2, cash: "96便士" }} busy={false} blocked={false} onCommand={onCommand} />);
    const next = screen.getByRole("region", { name: "魔术师成长下一步" });
    expect(next.textContent).toContain(first.label); expect(next.textContent).toContain(first.reason);
    expect(next.textContent).not.toContain(second.label);
    const primary = screen.getByRole("button", { name: new RegExp(first.label) });
    expect((primary as HTMLButtonElement).disabled).toBe(true);
    expect(primary.textContent).toContain(first.cost);
    const summary = screen.getByText(/^其他批次 · 备用材料/), folded = summary.closest("details")!;
    expect(folded.open).toBe(false);
    expect(within(folded).getByText(second.label)).toBeTruthy();
    await userEvent.click(summary); expect(folded.open).toBe(true);
    const spare = within(folded).getByRole("button", { name: new RegExp(second.label) });
    expect(spare.textContent).toContain(second.cost);
    await userEvent.click(spare);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command);
    expect(within(screen.getByLabelText("魔术师筹备当前资源")).getByText("96便士")).toBeTruthy();
  });

  it.each([true, false])("prioritizes a prepared bottle over further material work (enabled %s)", enabled => {
    const value = bottled(), { second } = batchActions();
    const consume = { ...value.actions[0]!, enabled, reason: enabled ? null : "晋升后尚未度过8整周。" };
    panel({ ...value, bottles: value.bottles.slice(0, 2), actions: [second, consume] });
    const next = screen.getByRole("region", { name: "魔术师成长下一步" });
    expect(next.textContent).toContain(consume.label); expect(next.textContent).not.toContain(second.label);
    if (!enabled) expect(next.textContent).toContain(consume.reason);
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(!enabled);
  });

  it("advances to the next remaining batch after the first original was consumed in failure", async () => {
    const value = bottled(), { second } = batchActions();
    const third = action({ type: "MATERIAL_WORK", batchId: "magician-batch-3" });
    const failed = { ...value.bottles[0]!, status: "已耗尽 · 排异，未晋升" };
    const { onCommand } = panel({ ...value, bottles: [failed], actions: [second, third] });
    expect(screen.getByRole("region", { name: "魔术师成长下一步" }).textContent).toContain("先休养，再考虑重试");
    expect(screen.getByText(failed.status)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    const summary = screen.getByText(/^其他批次 · 备用材料/), folded = summary.closest("details")!;
    expect(folded.open).toBe(false); expect(within(folded).getByText(third.label)).toBeTruthy();
    const current = screen.getByRole("button", { name: new RegExp(second.label) });
    expect(current.closest("details")).toBeNull();
    await userEvent.click(current); expect(onCommand).toHaveBeenCalledExactlyOnceWith(second.command);
  });

  it("rerenders only projected AP and cash in the preparation budget and removes it after promotion", () => {
    const value = magician(), onCommand = vi.fn();
    const { rerender } = render(<MagicianPanel magician={value} resources={{ ...resources, actionsRemaining: 2, cash: "96便士" }} busy={false} blocked={false} onCommand={onCommand} />);
    let budget = screen.getByLabelText("魔术师筹备当前资源");
    expect(within(budget).getByText("2")).toBeTruthy(); expect(within(budget).getByText("96便士")).toBeTruthy();
    expect(budget.textContent).not.toMatch(/纸张|纸人/);
    rerender(<MagicianPanel magician={value} resources={{ ...resources, actionsRemaining: 1, cash: "246便士" }} busy={false} blocked={false} onCommand={onCommand} />);
    budget = screen.getByLabelText("魔术师筹备当前资源");
    expect(within(budget).getByText("1")).toBeTruthy(); expect(within(budget).getByText("246便士")).toBeTruthy();
    expect(budget.textContent).not.toContain("96便士"); expect(onCommand).not.toHaveBeenCalled();
    rerender(<MagicianPanel magician={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByLabelText("魔术师筹备当前资源")).toBeNull();
  });

  it("does not duplicate the compact preparation budget inside actual consumption confirmation", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getByLabelText("魔术师筹备当前资源")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(screen.queryByLabelText("魔术师筹备当前资源")).toBeNull();
    expect(screen.getByRole("region", { name: "服药前当前资源" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(screen.getByLabelText("魔术师筹备当前资源")).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });
});


describe("Magician preparation receipt scope", () => {
  it.each([8, 7] as const)("keeps receipt static only during S7 preparation, current sequence %s", async sequence => {
    const command: MagicianCommand = sequence === 8
      ? { type: "MATERIAL_WORK", batchId: "magician-batch-1" } : { type: "BUY_OIL" };
    const current = action(command);
    const state = fixture(sequence, { magician: magician({ promoted: sequence === 7, actions: [current] }) });
    const value = bridge(state);
    const record = { id: "magician-budget-result", week: state.week, title: "实际操作回执", text: "保留领域给出的本次成本和结果。" };
    const next = { ...state, revision: state.revision + 1, actionsRemaining: state.actionsRemaining - 1,
      lastResult: record, chronicle: [...state.chronicle, record] };
    value.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt(next, envelope));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    if (sequence === 8) await userEvent.click(screen.getByRole("button", { name: "魔术师晋升" }));
    await userEvent.click(screen.getByRole("button", { name: new RegExp(current.label) }));
    const feedback = screen.getByRole("status", { name: "本次行动结果" });
    expect(feedback.classList.contains("magician-preparation-feedback")).toBe(sequence === 8);
    expect(feedback.textContent).toContain(record.text);
    if (sequence === 8) expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "MAGICIAN", command });
  });
});


describe("Magician consumption risk readability", () => {
  it("preserves the exact approved complete risk text while exposing four structured outcomes", () => {
    expect(MAGICIAN_CONSUMPTION_RISK).toBe("本段数值为原创游戏规则（G）：服药必定消耗所选魔术师原瓶，0行动，意志难度18；小丑扮演须达100且小丑晋升后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。指导者在场处理这次服药排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护仅适用于本次指导服药，不适用于战斗与其它危险。");
    expect(MAGICIAN_CONSUMPTION_OUTCOMES).toEqual([
      { label: "大成功", effect: "晋升、精神−5" },
      { label: "成功", effect: "晋升、精神−10" },
      { label: "失败", effect: "未晋升、精神−20、健康−10、排异+25" },
      { label: "灾难", effect: "中断晋升、精神−40、健康−20、排异+50" },
    ]);
    expect(MAGICIAN_CONSUMPTION_RULE + MAGICIAN_CONSUMPTION_OUTCOMES.map(row => `${row.label}：${row.effect}`).join("；") + "。" + MAGICIAN_CONSUMPTION_PROTECTION).toBe(MAGICIAN_CONSUMPTION_RISK);
  });

  it("shows rule, all four outcomes and the limited protection without opening supplementary risk prose", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const risks = screen.getByRole("region", { name: "魔术师服用风险与四档结果" });
    for (const text of [MAGICIAN_CONSUMPTION_RULE, MAGICIAN_CONSUMPTION_PROTECTION]) {
      expect(within(risks).getByText(text).closest("details")).toBeNull();
    }
    for (const row of MAGICIAN_CONSUMPTION_OUTCOMES) {
      const label = within(risks).getByText(row.label, { selector: "dt" });
      const effect = within(risks).getByText(row.effect, { selector: "dd" });
      expect(label.closest("dl")).toBe(effect.closest("dl"));
      expect(label.closest("details")).toBeNull(); expect(effect.closest("details")).toBeNull();
    }
    const fullText = within(risks).getByText(risk);
    const supplementary = fullText.closest("details")!;
    expect(supplementary).not.toBeNull(); expect(supplementary.open).toBe(false);
    await userEvent.click(within(supplementary).getByText(supplementary.querySelector("summary")!.textContent!));
    expect(supplementary.open).toBe(true); expect(fullText.textContent).toBe(risk);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("places the selected original's exact chance and projected cost at the final confirmation", async () => {
    const value = bottled();
    value.actions = value.actions.map((entry, index) => ({ ...entry, cost: `0行动 · 消耗第${index + 1}瓶原瓶，不退还材料` }));
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const summary = screen.getByLabelText("本次服用确认摘要");
    expect(within(summary).getByText("43%")).toBeTruthy();
    expect(within(summary).getByText(value.actions[1]!.cost)).toBeTruthy();
    expect(summary.textContent).not.toContain("71%"); expect(summary.textContent).not.toContain(value.actions[0]!.cost);
    expect(screen.getByText("第2批魔术师原瓶")).toBeTruthy();
    expect(screen.getByText("来源：第二批实际采购材料调配")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶魔术师魔药」" });
    expect(summary.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["busy", "blocked"] as const)("keeps both confirmation controls locked when %s despite expanded readable risks", async condition => {
    const value = bottled(), onCommand = vi.fn();
    const { rerender } = panel(value, onCommand);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<MagicianPanel magician={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: condition === "busy" ? "正在结算并保存…" : "确认服用「第一瓶魔术师魔药」" });
    const cancel = screen.getByRole("button", { name: "暂不服用" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect((cancel as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm); fireEvent.click(cancel);
    expect(screen.getByRole("heading", { name: "第一瓶魔术师魔药" })).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });
});

describe("Magician recovery original-bottle records", () => {
  it("keeps associated originals open while folding only the spent bottle with all failure facts intact", async () => {
    const value = bottled(), onCommand = vi.fn();
    panel(value, onCommand);
    const summary = screen.getByText("已耗尽原瓶记录 · 1瓶"), records = summary.closest("details")!;
    expect(records.open).toBe(false);
    for (const bottle of value.bottles.slice(0, 2)) {
      const button = screen.getByRole("button", { name: `查看并准备服用「${bottle.title}」` });
      expect(button.closest("details")).toBeNull();
      expect(records.contains(button)).toBe(false);
    }
    expect(within(records).getAllByRole("article", { hidden: true })).toHaveLength(1);
    const failed = value.bottles[2]!;
    await userEvent.click(summary); expect(records.open).toBe(true);
    expect(within(records).getByRole("heading", { name: failed.title })).toBeTruthy();
    expect(within(records).getByText(`来源：${failed.source}`)).toBeTruthy();
    expect(within(records).getByText(failed.status)).toBeTruthy();
    expect(within(records).queryByRole("button")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("leaves the current material action visible before a fully consumed bottle archive", async () => {
    const value = bottled(), current = action({ type: "MATERIAL_WORK", batchId: "magician-batch-2" });
    const failed = { ...value.bottles[0]!, status: "已耗尽 · 严重排异，未晋升" };
    const { onCommand } = panel({ ...value, bottles: [failed], actions: [current] });
    const button = screen.getByRole("button", { name: new RegExp(current.label) });
    const summary = screen.getByText("已耗尽原瓶记录 · 1瓶"), records = summary.closest("details")!;
    expect(button.closest("details")).toBeNull(); expect(records.open).toBe(false);
    expect(button.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.getByRole("region", { name: "魔术师成长下一步" }).textContent).toContain("先休养，再考虑重试");
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    await userEvent.click(summary);
    expect(within(records).getByText(failed.status)).toBeTruthy();
    expect(within(records).getByText(`来源：${failed.source}`)).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith(current.command);
  });

  it("does not classify a week-blocked prepared original as spent and cancel still costs nothing", async () => {
    const value = bottled();
    value.actions = value.actions.map((entry, index) => index === 0 ? { ...entry, enabled: false, reason: "尚未满8整周。" } : entry);
    const { onCommand } = panel(value);
    const records = screen.getByText("已耗尽原瓶记录 · 1瓶").closest("details")!;
    const blocked = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    expect((blocked as HTMLButtonElement).disabled).toBe(true); expect(blocked.closest("details")).toBeNull();
    expect(records.textContent).not.toContain(value.bottles[0]!.title);
    fireEvent.click(blocked); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }).closest("details")).toBeNull();
    expect(screen.getByText("已耗尽原瓶记录 · 1瓶").closest("details")!.open).toBe(false);
  });

  it("keeps promoted original-bottle history under its established disclosure", async () => {
    const value = bottled(); panel({ ...value, promoted: true });
    expect(screen.queryByText(/^已耗尽原瓶记录/)).toBeNull();
    const summary = screen.getByText("魔术师原瓶 · 来源与去向"), records = summary.closest("details")!;
    expect(records.open).toBe(false); await userEvent.click(summary);
    for (const bottle of value.bottles) {
      expect(within(records).getByRole("heading", { name: bottle.title })).toBeTruthy();
      expect(within(records).getByText(`来源：${bottle.source}`)).toBeTruthy();
    }
    expect(within(records).queryByRole("button")).toBeNull();
  });
});

describe("Magician successful-promotion scroll entry", () => {
  const practice = action({ type: "PRACTICE", practiceId: "air-target" });
  function promotedProjection(state: SliceProjection, sameRun = true): SliceProjection {
    const next = fixture(7, { magician: magician({ promoted: true, practices: practices(), actions: [practice] }) });
    const record = { id: "promotion-scroll-result", week: state.week, title: "魔术师晋升成功", text: "原瓶已消耗，进入真实魔术师成长。" };
    return { ...next, runId: sameRun ? state.runId : "different-promoted-run", revision: state.revision + 1,
      lastResult: record, chronicle: [...state.chronicle, record] };
  }
  async function openConsumption(value: SliceBridge) {
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "魔术师晋升" }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    return screen.getByRole("dialog", { name: "非凡成长" });
  }

  it("resets the same dialog on confirmed same-run promotion once, not on later S7 practice", async () => {
    const state = fixture(8, { magician: bottled() }), value = bridge(state), promoted = promotedProjection(state);
    const practicedRecord = { id: "s7-practice-scroll-result", week: promoted.week, title: "完成本次实践", text: "后续实践不重置成长页位置。" };
    const practiced = { ...promoted, revision: promoted.revision + 1, lastResult: practicedRecord, chronicle: [...promoted.chronicle, practicedRecord] };
    value.submitIntent = vi.fn().mockImplementationOnce(async (envelope: SliceEnvelope) => receipt(promoted, envelope))
      .mockImplementationOnce(async (envelope: SliceEnvelope) => receipt(practiced, envelope));
    const dialog = await openConsumption(value);
    dialog.scrollTop = 640;
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶魔术师魔药」" }));
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBe(dialog);
    expect(dialog.scrollTop).toBe(0);
    expect(screen.getByRole("region", { name: "当前魔术师实践" })).toBeTruthy();
    dialog.scrollTop = 312;
    await userEvent.click(screen.getByRole("button", { name: new RegExp(practice.label) }));
    expect(dialog.scrollTop).toBe(312);
    expect(value.submitIntent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(value.submitIntent).mock.calls[1]![0].payload).toEqual({ type: "MAGICIAN", command: practice.command });
  });

  it("does not treat a different run's promoted projection as this run's promotion", async () => {
    // Deliberately synthetic cross-run projection exercises the UI identity guard, not save semantics.
    const state = fixture(8, { magician: bottled() }), value = bridge(state), promoted = promotedProjection(state, false);
    value.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt(promoted, envelope));
    const dialog = await openConsumption(value); dialog.scrollTop = 517;
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶魔术师魔药」" }));
    expect(screen.getByRole("region", { name: "当前魔术师实践" })).toBeTruthy();
    expect(dialog.scrollTop).toBe(517);
  });

  it("keeps failure feedback scrolling without forcing the dialog to its top", async () => {
    const state = fixture(8, { magician: bottled() }), value = bridge(state);
    const record = { id: "consumption-failed-scroll", week: state.week, title: "本次排异未晋升", text: "已消耗原瓶，仍在筹备阶段。" };
    const next = { ...state, revision: state.revision + 1, lastResult: record, chronicle: [...state.chronicle, record],
      magician: { ...state.magician, actions: state.magician.actions.slice(1) } };
    value.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt(next, envelope));
    const dialog = await openConsumption(value); dialog.scrollTop = 429; scrollIntoView.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶魔术师魔药」" }));
    expect(dialog.scrollTop).toBe(429);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
    expect(screen.getByRole("status", { name: "本次行动结果" }).textContent).toContain(record.text);
  });

  it("does not write scrollTop when loading an already-promoted run or simply reopening its dossier", async () => {
    const value = bridge(fixture(7)); await enter(value);
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

describe("Magician growth guidance follows unfinished goals", () => {
  const completedSix = (): MagicianProjection["practices"] => ["lamplit-step", "air-target", "consenting-audience", "shallow-water", "loose-rope", "paper-weapon"]
    .map((id, index) => ({ id, title: `已完成实践${index + 1}`, story: `原实践记录${index + 1}`, status: "已实际完成" }));
  const resolvedDispute = { id: "magician-dispute", title: "侧巷里的原道具箱", story: "莉亚已抱着原箱返回剧院。", status: "当面核对完成，莉亚已带原箱返回剧院" };

  it.each([true, false])("shows truthful 100-acting preparation conditions with an optional navigation callback (%s)", async hasCallback => {
    const oil = action({ type: "BUY_OIL" }), onCommand = vi.fn(), onOpenFaceless = vi.fn();
    const value = magician({ promoted: true, acting: 100, practices: [...completedSix(), resolvedDispute], actions: [oil] });
    render(<MagicianPanel magician={value} resources={resources} busy={false} blocked={false} onCommand={onCommand}
      {...(hasCallback ? { onOpenFaceless } : {})} />);
    const next = screen.getByRole("region", { name: "魔术师成长下一步" });
    expect(next.textContent).toContain("魔术师扮演已达100");
    expect(next.textContent).toContain("无面人筹备");
    expect(next.textContent).toContain("仍需实际度过12整周");
    expect(next.textContent).toContain("配方、材料与独立服药条件");
    expect(next.textContent).not.toContain(oil.label);
    if (hasCallback) {
      await userEvent.click(screen.getByRole("button", { name: "查看无面人筹备" }));
      expect(onOpenFaceless).toHaveBeenCalledTimes(1); expect(onCommand).not.toHaveBeenCalled();
    } else expect(screen.queryByRole("button", { name: "查看无面人筹备" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(oil.label) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(oil.command);
  });

  it("prioritizes the actual final reflection at 92 over optional oil without hiding supply controls", async () => {
    const reflect = action({ type: "REFLECT" }), oil = action({ type: "BUY_OIL" });
    const { onCommand } = panel(magician({ promoted: true, acting: 92, practices: [...completedSix(), resolvedDispute], actions: [oil, reflect] }));
    const next = screen.getByRole("region", { name: "魔术师成长下一步" });
    expect(next.textContent).toContain(reflect.label); expect(next.textContent).not.toContain(oil.label);
    const supplies = screen.getByRole("group", { name: "实际道具准备" });
    expect(within(supplies).getByRole("button", { name: new RegExp(oil.label) })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(reflect.label) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(reflect.command);
  });

  it("keeps a resource-blocked unfinished practice and its exact reason ahead of optional supplies", () => {
    const needed = { ...action({ type: "PRACTICE", practiceId: "lamplit-step" }, false), reason: "需要先点燃实际油灯。" };
    const oil = action({ type: "BUY_OIL" });
    panel(magician({ promoted: true, acting: 24, practices: [{ id: "lamplit-step", title: "两盏原灯之间的一步", story: "使用真实灯火。", status: "尚未完成" }], actions: [oil, needed] }));
    const next = screen.getByRole("region", { name: "魔术师成长下一步" });
    expect(next.textContent).toContain(needed.label); expect(next.textContent).toContain(needed.reason);
    expect(next.textContent).not.toContain(oil.label);
    expect((screen.getByRole("button", { name: new RegExp(needed.label) }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: new RegExp(oil.label) }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not let reading a completed practice hide another enabled growth goal", async () => {
    const pending = action({ type: "PRACTICE", practiceId: "air-target" }), oil = action({ type: "BUY_OIL" });
    panel(magician({ promoted: true, acting: 12, practices: [completedSix()[0]!, { id: "air-target", title: "尚待完成的空气弹", story: "真实固定靶。", status: "尚未完成" }], actions: [oil, pending] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择一次实践" }), "lamplit-step");
    expect(screen.getByRole("region", { name: "当前魔术师实践" }).textContent).toContain("原实践记录1");
    const next = screen.getByRole("region", { name: "魔术师成长下一步" });
    expect(next.textContent).toContain(pending.label); expect(next.textContent).not.toContain(oil.label);
  });

  it("directs the still-open actual dispute before optional supplies after the ordinary practices", () => {
    const talk = action({ type: "ENCOUNTER_TALK" }), fight = action({ type: "ENCOUNTER_FIGHT" }), oil = action({ type: "BUY_OIL" });
    panel(magician({ promoted: true, acting: 72, practices: [...completedSix(), { ...resolvedDispute, status: "可交涉或承担战斗风险", story: "原道具箱仍在现场。" }], actions: [oil, talk, fight] }));
    const next = screen.getByRole("region", { name: "魔术师成长下一步" });
    expect(next.textContent).toContain(talk.label); expect(next.textContent).not.toContain(oil.label);
    expect(screen.getByRole("button", { name: new RegExp(oil.label) })).toBeTruthy();
  });
});

 describe("Magician failed-ascent recovery guidance", () => {
  const failed = () => magician({ bottles: [bottled().bottles[2]!], actions: [action({ type: "MATERIAL_WORK", batchId: "magician-batch-2" })], pollution: 25 });
  it("prioritizes recovery without spending an action or hiding material preparation", () => {
    const onRecovery = vi.fn(), onCommand = vi.fn();
    render(<MagicianPanel magician={failed()} resources={resources} busy={false} blocked={false} onCommand={onCommand} onRecovery={onRecovery} />);
    expect(screen.getByRole("region", { name: "魔术师成长下一步" }).textContent).toContain("先休养，再考虑重试");
    expect(screen.getByText(/休养不保证晋升成功/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "魔术师材料与调配" }).textContent).toContain("领域成本MATERIAL_WORK");
    fireEvent.click(screen.getByRole("button", { name: "返回日常休养" }));
    expect(onRecovery).toHaveBeenCalledOnce();
    expect(onCommand).not.toHaveBeenCalled();
  });
  it.each(["recovered", "promoted", "no-failure"])("does not retain stale recovery guidance: %s", (condition) => {
    const value = failed();
    if (condition === "recovered") value.pollution = 0;
    if (condition === "promoted") value.promoted = true;
    if (condition === "no-failure") value.bottles = [];
    render(<MagicianPanel magician={value} resources={condition === "recovered" ? { ...resources, health: 100, mind: 100 } : resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.queryByText(/先休养，再考虑重试/)).toBeNull();
  });
  it.each(["health", "mind", "pollution"])("retains warning while %s remains unrecovered", (field) => {
    const value = { ...failed(), pollution: field === "pollution" ? 1 : 0 };
    render(<MagicianPanel magician={value} resources={{ ...resources, health: field === "health" ? 99 : 100, mind: field === "mind" ? 99 : 100 }} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.getByText(/先休养，再考虑重试/)).toBeTruthy();
  });
 });

 it("returns from failed-ascent guidance to existing daily actions without submitting", async () => {
  const value = fixture(8, { magician: magician({ bottles: [bottled().bottles[2]!], pollution: 25 }), health: 90, mind: 80 });
  const api = bridge(value);
  await enter(api);
  await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
  await userEvent.click(screen.getByRole("button", { name: "返回日常休养" }));
  expect(screen.queryByRole("button", { name: "返回日常休养" })).toBeNull();
  expect(screen.getByRole("button", { name: /休养/ })).toBeTruthy();
  expect(api.submitIntent).not.toHaveBeenCalled();
 });
