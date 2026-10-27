/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from "../../src/domain/slice";
import { TAMER_ABILITIES } from "../../src/domain/tamer/content";
import type { TamerAction, TamerCommand, TamerProjection } from "../../src/domain/tamer/types";
import { APOTHECARY_ABILITIES } from "../../src/domain/apothecary/content";
import type { SliceProjection } from "../../src/domain/slice/types";
import { TamerPanel } from "../../src/renderer/TamerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 45, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "实际四档：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选驯兽师原瓶消耗。";
function action(command: TamerCommand, enabled = true): TamerAction {
  const suffix = "animalId" in command ? command.animalId : "bottleId" in command ? command.bottleId : "";
  return {
    id: `${command.type}-${suffix}`, label: `公开操作${command.type}${suffix}`, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "本周剩余行动不足。", command,
  };
}
function tamer(patch: Partial<TamerProjection> = {}): TamerProjection {
  return {
    title: "驯兽师之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", animals: [], companionName: null,
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "药师消化100/100，晋升药师后6/6整周。", pollution: 3, risk,
    ...patch,
  };
}
function bottled(): TamerProjection {
  return tamer({
    guidanceKnown: true,
    supplies: "新渠道三瓶独立驯兽师成品；供应方剩余1瓶，你持有未服原瓶2瓶。完整配方资料待核。",
    actions: ["tamer-potion-1", "tamer-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true })),
    bottles: [
      { id: "tamer-potion-1", title: "第一瓶驯兽师魔药", source: "照护站实际交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "tamer-potion-1", confirmed: true } },
      { id: "tamer-potion-2", title: "第二瓶驯兽师魔药", source: "照护站实际交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "tamer-potion-2", confirmed: true } },
      { id: "tamer-potion-3", title: "第三瓶驯兽师魔药", source: "照护站实际交接的第三原瓶", status: "导师保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "tamer-potion-3", confirmed: true } },
    ],
  });
}
function animals(): TamerProjection["animals"] {
  return ["yard-hound", "hillside-goat", "rookery-raven"].map((id, index) => ({
    id, title: `公开动物${index + 1}`, story: `原主人许可的活动${index + 1}`,
    observations: [], intent: null, status: "AVAILABLE", location: "原主人照护处", foodHeld: 0,
  }));
}
function panel(value: TamerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<TamerPanel tamer={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function checkpoint(sequence: 9 | 8 = 8) {
  const raw = createSliceRun("tamer-renderer-run", sliceDefaultCreationSelection, "tamer-renderer-seed");
  raw.week = 12;
  raw.activeEvent = null;
  raw.actionsRemaining = raw.weeklyBudget;
  raw.character.name = "艾琳";
  raw.apothecary.discovered = true;
  raw.apothecary.guidanceKnown = true;
  // Synthetic valid checkpoint: both historical successful originals are retained.
  Object.assign(raw.apothecary.bottles[0]!, { acquiredWeek: 5, consumedWeek: 5, status: "CONSUMED", outcome: "SUCCESS" });
  raw.progression = {
    pathwayId: "moon", sequence, acting: sequence === 9 ? 100 : 0, promotionWeek: 5,
    mastery: Object.fromEntries([...APOTHECARY_ABILITIES, ...(sequence === 8 ? TAMER_ABILITIES : [])].map((ability, index) => [ability.id, index * 7])),
  };
  if (sequence === 8) {
    raw.tamer.guidanceKnown = true;
    raw.tamer.promotionWeek = 11;
    raw.tamer.apothecaryActingAtPromotion = 100;
    Object.assign(raw.tamer.bottles[0]!, { acquiredWeek: 11, consumedWeek: 11, status: "CONSUMED", outcome: "SUCCESS" });
  }
  raw.mind = 90;
  raw.spirituality = sequence === 8 ? 45 : 30;
  return raw;
}
function fixture(sequence: 9 | 8 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  return { ...projectSliceState(checkpoint(sequence)), investigateTargets: [], canAct: true, actionBlockedReason: null, ...patch };
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
async function openTamer() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "驯兽师晋升" }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Tamer pathway dossier", () => {
  it("offers the real S8 guide inside growth while retaining one Town entry and one dashboard goal", async () => {
    const value = bridge(fixture(9));
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /随身物品与商店/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "驯兽师晋升" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getAllByRole("button", { name: "驯兽师晋升" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "驯兽师成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /请艾琳说明驯兽师成品与风险/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /小丑晋升|挑衅者晋升|读心者晋升/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows finite original S8 bottles without inventing a formula, ingredients or brewing", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未公开的配方材料", quantity: 7, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未公开的配方材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制药|制造/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, restores focus, and independently confirms exactly the chosen original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶驯兽师魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶驯兽师魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶驯兽师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶驯兽师魔药」/ }));
    expect(screen.getByText("tamer-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：照护站实际交接的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "驯兽师服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 45", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶驯兽师魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "tamer-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["bottle", "action", "promotion"])("discards a confirmation when its %s changes", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶驯兽师魔药」/ }));
    const next = { ...value, ...(change === "bottle" ? { bottles: value.bottles.slice(1) } : change === "action" ? { actions: value.actions.slice(1) } : { promoted: true }) };
    rerender(<TamerPanel tamer={next} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one animal and only reveals intentions and observations supplied by the domain", async () => {
    const list = animals();
    const value = tamer({ promoted: true, animals: list, actions: list.map((animal) => action({ type: "OBSERVE", animalId: animal.id })) });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前动物记录" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "已经观察到的动物意图" })).toBeNull();
    expect(screen.getByText("尚未取得观察记录，不能判断它此刻的意图。")).toBeTruthy();
    expect(screen.queryByText("原主人许可的活动2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择动物记录" }), "hillside-goat");
    expect(screen.getByText("原主人许可的活动2")).toBeTruthy();
    expect(screen.queryByText("原主人许可的活动1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作OBSERVE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "OBSERVE", animalId: "hillside-goat" });
    expect(screen.queryByRole("region", { name: "已经观察到的动物意图" })).toBeNull();
    const observed = list.map((animal) => animal.id === "hillside-goat" ? {
      ...animal, status: "OBSERVED", observations: ["当面观察到它在旧门前停步。"], intent: "它对新围栏声响犹豫。", foodHeld: 2,
    } : animal);
    rerender(<TamerPanel tamer={{ ...value, animals: observed, actions: [action({ type: "BUY_FEED", animalId: "hillside-goat" }), action({ type: "TRAIN", animalId: "hillside-goat" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("当面观察到它在旧门前停步。");
    expect(screen.getByRole("region", { name: "已经观察到的动物意图" }).textContent).toContain("它对新围栏声响犹豫。");
    expect(screen.getByText("持有的对应饲料").nextElementSibling?.textContent).toBe("2 份");
    expect(screen.queryByRole("button", { name: /^公开操作OBSERVE/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作TRAIN/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "TRAIN", animalId: "hillside-goat" });
    // Issuing an intent cannot optimistically consume stock or invent successful training.
    expect(screen.getByText("持有的对应饲料").nextElementSibling?.textContent).toBe("2 份");
    expect(screen.getByText("当前进展").nextElementSibling?.textContent).toBe("已取得观察记录");
  });

  it("reveals actual animal intentions only after a committed shared-domain observation", () => {
    const raw = checkpoint();
    assertValidSliceState(raw);
    const { onCommand, rerender } = panel(projectSliceState(raw).tamer);
    expect(screen.queryByRole("region", { name: "已经观察到的动物意图" })).toBeNull();
    const observed = applySliceIntent(raw, { type: "TAMER", command: { type: "OBSERVE", animalId: "yard-hound" } });
    assertValidSliceState(observed);
    rerender(<TamerPanel tamer={projectSliceState(observed).tamer} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("奈尔留意管理员的位置");
    expect(screen.getByRole("region", { name: "已经观察到的动物意图" }).textContent).toContain("对突然接近的戒备");
    expect(screen.queryByRole("button", { name: /召唤兽群|控制人类|强制驯服|吸血鬼晋升/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders actual purchased feed and its training consumption without borrowing another animal's food", () => {
    const raw = checkpoint();
    raw.cash = 100;
    const observed = applySliceIntent(raw, { type: "TAMER", command: { type: "OBSERVE", animalId: "yard-hound" } });
    const bought = applySliceIntent(observed, { type: "TAMER", command: { type: "BUY_FEED", animalId: "yard-hound" } });
    const { onCommand, rerender } = panel(projectSliceState(bought).tamer);
    expect(screen.getByText("持有的对应饲料").nextElementSibling?.textContent).toBe("3 份");
    const trained = applySliceIntent(bought, { type: "TAMER", command: { type: "TRAIN", animalId: "yard-hound" } });
    assertValidSliceState(trained);
    rerender(<TamerPanel tamer={projectSliceState(trained).tamer} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    // Keep the same selected animal rather than letting the default follow the next enabled action.
    fireEvent.change(screen.getByRole("combobox", { name: "选择动物记录" }), { target: { value: "yard-hound" } });
    expect(screen.getByText("持有的对应饲料").nextElementSibling?.textContent).toBe("2 份");
    expect(trained.tamer.animals["yard-hound"]!.foodUsed).toBe(1);
    expect(trained.tamer.animals["hillside-goat"]!.foodHeld).toBe(0);
    expect(screen.getByRole("region", { name: "当前动物记录" }).textContent).toContain("原主人照护处");
    if (!trained.tamer.animals["yard-hound"]!.trained) {
      expect(screen.getByRole("region", { name: "当前动物记录" }).textContent).toContain("下周再来");
      expect(screen.queryByRole("button", { name: /请原主人允许本次有限同行/ })).toBeNull();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps observations readable at zero AP and follows actual disabled reasons, busy and blocked states", async () => {
    const raw = checkpoint();
    raw.tamer.animals["hillside-goat"]!.observed = true;
    raw.actionsRemaining = 0;
    const value = projectSliceState(raw).tamer;
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择动物记录" }), "hillside-goat");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("麦芽在旧门前停步");
    const train = screen.getByRole("button", { name: /实际投喂并练习基础反应/ });
    expect((train as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("需要1行动。").length).toBeGreaterThan(0);
    fireEvent.click(train);
    expect(onCommand).not.toHaveBeenCalled();
    rerender(<TamerPanel tamer={value} resources={resources} busy={true} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择动物记录" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    rerender(<TamerPanel tamer={value} resources={resources} busy={false} blocked={true} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择动物记录" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("keeps a visible zero-action return for the original animal without creating an army or ownership transfer", async () => {
    const raw = checkpoint();
    const animal = raw.tamer.animals["hillside-goat"]!;
    Object.assign(animal, { observed: true, trained: true, trainingAttemptWeek: 12, foodWeek: 12, foodPurchased: 3, foodHeld: 2, foodUsed: 1 });
    const invited = applySliceIntent(raw, { type: "TAMER", command: { type: "INVITE", animalId: "hillside-goat" } });
    invited.actionsRemaining = 0;
    assertValidSliceState(invited);
    const value = projectSliceState(invited).tamer;
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "本次有限同行" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "本次有限同行" }).textContent).toContain("动物仍归原主人");
    expect(screen.getByRole("region", { name: "当前动物记录" }).textContent).toContain("牧场的山羊麦芽");
    expect(screen.getByRole("region", { name: "当前动物记录" }).textContent).toContain("本次同行会合点");
    const returnButton = screen.getByRole("button", { name: /沿原路送回原动物/ });
    expect((returnButton as HTMLButtonElement).disabled).toBe(false);
    expect(returnButton.textContent).toContain("0行动");
    expect((screen.getByRole("button", { name: /沿原干燥小道引导麦芽/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /召唤|兽群|永久控制|强制服从/ })).toBeNull();
    await userEvent.click(returnButton);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_ANIMAL" });
    expect(screen.getByRole("region", { name: "本次有限同行" })).toBeTruthy();
    const returned = applySliceIntent(invited, { type: "TAMER", command: { type: "RETURN_ANIMAL" } });
    assertValidSliceState(returned);
    rerender(<TamerPanel tamer={projectSliceState(returned).tamer} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "本次有限同行" })).toBeNull();
    expect(returned.week).toBe(invited.week + 1);
    expect(returned.actionsRemaining).toBe(returned.weeklyBudget);
    expect(returned.tamer.animals["hillside-goat"]!.location).toBe("HOME");
    expect(returned.tamer.animals["hillside-goat"]!.foodHeld).toBe(2);
  });

  it("renders guidance, three original-bottle labour steps, payment and resupply from projected commands", async () => {
    const commands: TamerCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "tamer-potion-1" },
      { type: "POTION_WORK", bottleId: "tamer-potion-1" }, { type: "POTION_WORK", bottleId: "tamer-potion-1" },
      { type: "BUY_POTION", bottleId: "tamer-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    const { onCommand, rerender } = panel(tamer());
    for (const [index, command] of commands.entries()) {
      const current = action(command);
      current.label = `实际阶段${index + 1}`;
      current.cost = `实际领域消耗${index + 1}`;
      rerender(<TamerPanel tamer={tamer({ guidanceKnown: index > 0, actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      expect(screen.getByText(current.cost)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(current.label) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    }
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("shows both inherited S9 and newly acquired S8 abilities with actual mastery", () => {
    const value = projectSliceState(checkpoint()).tamer;
    panel(value);
    const abilities = screen.getByRole("region", { name: "驯兽师能力与消化" });
    expect(value.abilities).toHaveLength(6);
    for (const ability of value.abilities) expect(within(abilities).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(abilities.textContent).toContain("药师消化成果100/100已保留");
    expect(abilities.textContent).toContain("不能凭空召唤兽群");
  });

  it("defaults to S8, preserves old care records, and exposes only inherited pharmacy actions", async () => {
    const state = fixture(8, { actionsRemaining: 0, canAct: false });
    state.apothecary.cases[0]!.observations = ["原接诊记录仍在。"];
    state.apothecary.cases[0]!.result = "原伤口已由实际护理处置。";
    state.apothecary.actions = [
      { id: "supplies", label: "补充实际药材", cost: "12便士", enabled: true, reason: null, command: { type: "BUY_SUPPLIES" } },
      { id: "prepare", label: "实际制备护理剂", cost: "1行动", enabled: false, reason: "需要1行动。", command: { type: "PREPARE_MEDICINE", kind: "HEALING" } },
      { id: "heal", label: "使用已存护理剂", cost: "原药剂−1", enabled: true, reason: null, command: { type: "USE_HEALING" } },
      // Defensive UI filtering keeps old awards closed even if a stale projection contains them.
      { id: "old-case", label: "重复旧接诊", cost: "1行动", enabled: true, reason: null, command: { type: "EXAMINE", caseId: "workshop-cut" } },
      { id: "old-reflect", label: "重复药师反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } },
    ];
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope: SliceEnvelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    await enter(value);
    expect(screen.getByText(new RegExp(`驯兽师 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "驯兽师成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "药师经历" }));
    const history = screen.getByRole("region", { name: "药师时期的经历" });
    expect(history.textContent).toContain("成功晋升");
    expect(history.textContent).toContain("原接诊记录仍在。");
    expect(history.textContent).toContain("原伤口已由实际护理处置。");
    expect(within(screen.getByRole("region", { name: "药师接诊历史" })).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /重复旧接诊|重复药师反思|查看并准备服用/ })).toBeNull();
    expect(screen.getByRole("button", { name: /补充实际药材/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: /实际制备护理剂/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /使用已存护理剂/ }));
    expect(value.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "APOTHECARY", command: { type: "USE_HEALING" } });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "驯兽师成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /吸血鬼晋升/ })).toBeTruthy();
  });

  it("guides a zero-AP companion back to its return action before blocked life or investigation", async () => {
    const raw = checkpoint();
    Object.assign(raw.tamer.animals["yard-hound"]!, { observed: true, trained: true, trainingAttemptWeek: 12, foodWeek: 12, foodPurchased: 3, foodHeld: 2, foodUsed: 1, location: "WITH_PLAYER" });
    raw.tamer.companionId = "yard-hound";
    raw.actionsRemaining = 0;
    const state = projectSliceState(raw);
    const value = bridge(state);
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(guide.textContent).toContain("返回不消耗行动");
    await userEvent.click(within(guide).getByRole("button", { name: "安排动物返回" }));
    expect((screen.getByRole("button", { name: /沿原路送回原动物/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "驯兽师成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "OBSERVE", "BUY_FEED", "TRAIN", "INVITE", "ASSIST", "RETURN_ANIMAL", "REFLECT"] as const)("locks and retries the same failed %s envelope without duplicating a command", async (type) => {
    const consume = type === "CONSUME";
    const command: TamerCommand = consume ? { type, bottleId: "tamer-potion-2", confirmed: true }
      : type === "REFLECT" || type === "RETURN_ANIMAL" ? { type } : { type, animalId: "yard-hound" };
    const state = fixture(consume ? 9 : 8, {
      tamer: consume ? bottled() : tamer({ promoted: true, animals: animals(), companionName: type === "ASSIST" || type === "RETURN_ANIMAL" ? "公开动物1" : null, actions: [action(command)] }),
      actionsRemaining: consume ? 0 : 1, canAct: !consume,
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openTamer();
    if (consume) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶驯兽师魔药」/ }));
    const buttonName = consume ? "确认服用「第二瓶驯兽师魔药」" : new RegExp(`^公开操作${type}`);
    const confirm = screen.getByRole("button", { name: buttonName });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "驯兽师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("驯兽师模拟保存失败");
    expect((screen.getByRole("button", { name: buttonName }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: consume ? "药师之路" : "药师经历" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "TAMER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
