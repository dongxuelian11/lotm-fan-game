/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { APOTHECARY_ABILITIES } from "../../src/domain/apothecary/content";
import type { ApothecaryAction, ApothecaryProjection } from "../../src/domain/apothecary/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ApothecaryPanel } from "../../src/renderer/ApothecaryPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: ApothecaryAction = {
  id: "discover", label: "拜访药铺导师", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
function apothecary(patch: Partial<ApothecaryProjection> = {}): ApothecaryProjection {
  return {
    title: "药师之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    clinic: { materials: 0, healing: 0, calming: 0, spent: 0 }, cases: [], ...patch,
  };
}
function bottled(): ApothecaryProjection {
  return apothecary({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核，只能取得导师三瓶独立成品；供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["apothecary-potion-1", "apothecary-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "apothecary-potion-1", title: "第一瓶药师魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "apothecary-potion-1", confirmed: true } },
      { id: "apothecary-potion-2", title: "第二瓶药师魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "apothecary-potion-2", confirmed: true } },
      { id: "apothecary-potion-3", title: "第三瓶药师魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "apothecary-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: ApothecaryProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ApothecaryPanel apothecary={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("apothecary-renderer-run", sliceDefaultCreationSelection, "apothecary-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    apothecary: apothecary({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "药师 · 序列9" : "药师之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? APOTHECARY_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "moon" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(APOTHECARY_ABILITIES.map((ability) => [ability.id, 0])) : {},
      acting: 0, promotionWeek: promoted ? 5 : null,
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
async function openApothecary() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "药师之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function patients(): ApothecaryProjection["cases"] {
  return ["patient-one", "patient-two", "patient-three"].map((id, index) => ({
    id, title: `公开病人${index + 1}`, story: `病人公开说明${index + 1}`,
    observations: [], result: null, status: "尚未检查", health: null, mind: null,
  }));
}
function action(command: ApothecaryAction["command"], enabled = true, label = `公开操作${command.type}`): ApothecaryAction {
  const key = "caseId" in command ? command.caseId : "kind" in command ? command.kind : command.type;
  return {
    id: `${command.type}-${key}`, label, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "实际公开限制", command,
  };
}

describe("Apothecary pathway dossier", () => {
  it("offers the fifth ordinary route inside growth while retaining one dashboard goal and Town entry", async () => {
    const value = bridge(fixture());
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /随身物品与商店/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "药师之路" })).toBeNull();
    expect(screen.queryByRole("region", { name: "药师接诊记录" })).toBeNull();
    await openApothecary();
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路", "药师之路"]) {
      expect(within(tabs).getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("region", { name: "药师成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /晋升/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect((screen.getByRole("button", { name: /^工作，/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows actual finite finished bottles without inventing a potion recipe or brewing command", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应展示的未知配方材料", quantity: 7, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("不应展示的未知配方材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制药|制造/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "药铺实际耗材" })).toBeNull();
  });

  it("cancels freely, restores focus and confirms exactly one independently chosen original bottle at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶药师魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶药师魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶药师魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶药师魔药」/ }));
    expect(screen.getByText("apothecary-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "药师服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶药师魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "apothecary-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("discards stale confirmation when the original bottle action disappears", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶药师魔药」/ }));
    rerender(<ApothecaryPanel apothecary={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected patient with unavailable observations and vital values before examination", async () => {
    const list = patients();
    const value = apothecary({ promoted: true, cases: list, actions: list.map((patient) => action({ type: "EXAMINE", caseId: patient.id })) });
    const { onCommand } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前接诊记录" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作EXAMINE/ })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "已取得的检查记录" }).textContent).toContain("尚未检查，没有可用的观察记录");
    const card = screen.getByRole("region", { name: "当前接诊记录" });
    expect(within(card).getByText("病人健康").nextElementSibling?.textContent).toBe("尚未检查");
    expect(within(card).getByText("病人精神").nextElementSibling?.textContent).toBe("尚未检查");
    expect(screen.queryByRole("region", { name: "实际处置结果" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^公开操作CARE/ })).toBeNull();
    expect(screen.queryByText("病人公开说明2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择接诊记录" }), "patient-two");
    expect(screen.getByText("病人公开说明2")).toBeTruthy();
    expect(screen.queryByText("病人公开说明1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作EXAMINE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "EXAMINE", caseId: "patient-two" });
    expect(screen.getByRole("region", { name: "已取得的检查记录" }).textContent).toContain("尚未检查");
  });

  it("shows only newly projected observations and sends actual care or referral choices without optimistic results", async () => {
    const list = patients();
    const value = apothecary({ promoted: true, cases: list, actions: [action({ type: "EXAMINE", caseId: list[0]!.id })] });
    const { onCommand, rerender } = panel(value);
    const examined = { ...list[0]!, status: "已检查，等待选择", observations: ["实际观察到的公开伤情", "已核实的公开精神状态"], health: 62, mind: 87 };
    const commands: ApothecaryAction[] = [
      action({ type: "CARE", caseId: examined.id, choice: "CARE" }, true, "公开护理选择"),
      { ...action({ type: "CARE", caseId: examined.id, choice: "REFER" }, true, "公开转诊选择"), id: "refer-patient-one" },
    ];
    rerender(<ApothecaryPanel apothecary={{ ...value, cases: [examined, ...list.slice(1)], actions: commands }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const observations = screen.getByRole("region", { name: "已取得的检查记录" });
    for (const fact of examined.observations) expect(within(observations).getByText(fact)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "当前接诊记录" })).getByText("62")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^公开操作EXAMINE/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开护理选择/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CARE", caseId: "patient-one", choice: "CARE" });
    expect(screen.queryByRole("region", { name: "实际处置结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开转诊选择/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CARE", caseId: "patient-one", choice: "REFER" });
    const resolved = { ...examined, status: "已转诊", result: "已实际转交专业诊所，后果保留。", health: 62, mind: 87 };
    rerender(<ApothecaryPanel apothecary={{ ...value, cases: [resolved], actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际处置结果" }).textContent).toContain(resolved.result);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("displays real clinic inventory and forwards supply, preparation and self-use commands without changing quantities", async () => {
    const clinic = { materials: 7, healing: 3, calming: 2, spent: 5 };
    const commands: ApothecaryAction[] = [
      action({ type: "BUY_SUPPLIES" }),
      action({ type: "PREPARE_MEDICINE", kind: "HEALING" }, true, "准备恢复游戏药剂"),
      action({ type: "PREPARE_MEDICINE", kind: "CALMING" }, true, "准备安定游戏药剂"),
      action({ type: "USE_HEALING" }),
    ];
    const { onCommand } = panel(apothecary({ promoted: true, clinic, actions: commands }));
    const inventory = screen.getByRole("region", { name: "药铺实际耗材" });
    for (const [label, count] of [["可用游戏材料", 7], ["外伤护理剂", 3], ["安神剂", 2], ["已耗用/废弃份数", 5]] as const) {
      expect(within(inventory).getByText(label).nextElementSibling?.textContent).toBe(String(count));
    }
    expect(inventory.textContent).toContain("仅为虚构游戏道具");
    expect(inventory.textContent).toContain("不是现实药方或医疗建议");
    for (const entry of commands) {
      const button = screen.getByRole("button", { name: new RegExp(`^${entry.label}`) });
      expect(button.textContent).toContain(entry.cost);
      await userEvent.click(button);
      expect(onCommand).toHaveBeenLastCalledWith(entry.command);
    }
    expect(within(inventory).getByText("可用游戏材料").nextElementSibling?.textContent).toBe("7");
    expect(within(inventory).getByText("外伤护理剂").nextElementSibling?.textContent).toBe("3");
  });

  it("obeys actual disabled reasons, busy and blocked states without blanket prohibitions at zero AP", async () => {
    const value = apothecary({ promoted: true, cases: patients(), actions: [action({ type: "EXAMINE", caseId: "patient-one" }, false), action({ type: "BUY_SUPPLIES" })] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^公开操作EXAMINE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("实际公开限制")).toBeTruthy();
    const supplies = screen.getByRole("button", { name: /^公开操作BUY_SUPPLIES/ });
    expect((supplies as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(supplies);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BUY_SUPPLIES" });
    rerender(<ApothecaryPanel apothecary={value} resources={resources} busy={true} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^公开操作BUY_SUPPLIES/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择接诊记录" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("正在结算并保存");
    rerender(<ApothecaryPanel apothecary={value} resources={resources} busy={false} blocked={true} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^公开操作BUY_SUPPLIES/ }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("does not invent an action for medicine or an examined patient absent public commands", () => {
    const patient = { ...patients()[0]!, observations: ["已经公开的检查信息"], health: 70, mind: 80 };
    panel(apothecary({ promoted: true, clinic: { materials: 4, healing: 2, calming: 1, spent: 0 }, cases: [patient], actions: [] }));
    expect(screen.getByText("已经公开的检查信息")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows only acquired S9 abilities with actual mastery and digestion and prioritizes the final reflection", async () => {
    const reflect = action({ type: "REFLECT" });
    const { onCommand } = panel(apothecary({ promoted: true, acting: 96, digestion: "已记录三位病人的实际处置。", actions: [action({ type: "BUY_SUPPLIES" }), reflect], abilities: APOTHECARY_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 })) }));
    const abilities = screen.getByRole("region", { name: "药师能力与消化" });
    for (const [index, ability] of APOTHECARY_ABILITIES.entries()) expect(within(abilities).getByText(`${ability.label} · 掌握 ${index * 7}`)).toBeTruthy();
    expect(abilities.textContent).toContain("扮演进度 96");
    expect(abilities.textContent).toContain("已记录三位病人的实际处置");
    expect(screen.getByRole("region", { name: "药师成长下一步" }).textContent).toContain(`下一步：${reflect.label}`);
    expect(screen.queryByRole("heading", { name: /驯兽|吸血鬼/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REFLECT/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REFLECT" });
  });

  it("names the promoted Apothecary, defaults to its dossier, and keeps other channels read-only", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "已学占卜家配方材料", quantity: 2, unit: "份" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`药师 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("药师 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "药师成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "驯兽师晋升" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("已学占卜家配方材料");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "药师能力与消化" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps known Apothecary bottles read-only after choosing another pathway", async () => {
    const state = fixture(false, { apothecary: bottled(), progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } });
    const value = bridge(state);
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "药师经历" }));
    const history = screen.getByRole("region", { name: "已了解的药师渠道" });
    expect(history.textContent).toContain("第一瓶药师魔药");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "药师能力与消化" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each([false, true])("a fully digested Apothecary offers the available S8 guide without losing known investigation (investigation=%s)", async (investigation) => {
    const state = fixture(true, {
      actionsRemaining: 0, canAct: false,
      apothecary: apothecary({ promoted: true, acting: 100, actions: [], cases: patients() }),
      investigateTargets: investigation ? [{ id: "KNOWN-CASE", label: "实际公开的后续调查", description: "可以调查的已知目标" }] : [],
      progression: { pathwayId: "moon", sequence: 9, acting: 100, mastery: {}, promotionWeek: 5 },
    });
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(guide.textContent).toContain("准备序列8晋升");
    await userEvent.click(within(guide).getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "驯兽师成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    if (investigation) {
      await userEvent.click(within(guide).getByRole("button", { name: "查看已知调查" }));
      expect(screen.getByRole("dialog", { name: "选择调查目标" }).textContent).toContain("实际公开的后续调查");
      await userEvent.click(screen.getByRole("button", { name: "关闭选择调查目标" }));
    }
    await openApothecary();
    expect(screen.getByRole("region", { name: "药师成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.getByRole("button", { name: "驯兽师晋升" })).toBeTruthy();
    expect(screen.getAllByRole("region", { name: "当前接诊记录" })).toHaveLength(1);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "BUY_SUPPLIES"] as const)("locks and retries the same failed %s envelope at zero AP without duplicate commands", async (type) => {
    const buying = type === "BUY_SUPPLIES";
    const state = fixture(buying, { apothecary: buying ? apothecary({ promoted: true, actions: [action({ type: "BUY_SUPPLIES" })] }) : bottled(), actionsRemaining: 0, canAct: false });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openApothecary();
    if (!buying) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶药师魔药」/ }));
    const confirm = screen.getByRole("button", { name: buying ? /^公开操作BUY_SUPPLIES/ : "确认服用「第二瓶药师魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "药师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("药师模拟保存失败");
    expect((screen.getByRole("button", { name: buying ? /^公开操作BUY_SUPPLIES/ : "确认服用「第二瓶药师魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "APOTHECARY", command: buying ? { type: "BUY_SUPPLIES" } : { type: "CONSUME", bottleId: "apothecary-potion-2", confirmed: true } });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
