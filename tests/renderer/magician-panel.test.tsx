/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { MAGICIAN_ABILITIES } from "../../src/domain/magician/content";
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
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
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
    expect(screen.getByText("magician-batch-2:bottle")).toBeTruthy();
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
