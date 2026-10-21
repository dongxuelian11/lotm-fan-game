/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { VAMPIRE_ABILITY_IDS, type VampireAction, type VampireCommand, type VampireProjection } from "../../src/domain/vampire/types";
import { APOTHECARY_ABILITY_IDS } from "../../src/domain/apothecary/types";
import { TAMER_ABILITY_IDS } from "../../src/domain/tamer/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { VampirePanel } from "../../src/renderer/VampirePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。每档都消耗所选原瓶。";
function action(command: VampireCommand, enabled = true): VampireAction {
  const suffix = "practiceId" in command ? command.practiceId : "bottleId" in command ? command.bottleId : "";
  return { id: `${command.type}-${suffix}`, label: `公开操作${command.type}${suffix}`, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "本周剩余行动不足。", command };
}
function vampire(patch: Partial<VampireProjection> = {}): VampireProjection {
  return {
    title: "吸血鬼之路", discovered: true, guidanceKnown: false, formulaKnown: false, promoted: false,
    formula: [], actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "驯兽师消化100/100，晋升驯兽师后8/8整周。", pollution: 3, risk,
    supplies: "三瓶独立成品药；每瓶可付全款，或完成四次实际劳务后支付余款。已知主材线索为血族血源精华，完整配方尚未核实。",
    practices: [], environment: "现场光照尚未亲自观察。", bloodSummary: "持有密封血食1份，已购入2份，已耗用1份。", ...patch,
  };
}
function bottled(): VampireProjection {
  return vampire({ guidanceKnown: true,
    actions: ["vampire-potion-1", "vampire-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true })),
    bottles: [
      { id: "vampire-potion-1", title: "第一瓶吸血鬼魔药", source: "实际完成四次劳务并付余款的原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "vampire-potion-1", confirmed: true } },
      { id: "vampire-potion-2", title: "第二瓶吸血鬼魔药", source: "新货栈实际供给的第二瓶成品", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "vampire-potion-2", confirmed: true } },
      { id: "vampire-potion-3", title: "第三瓶吸血鬼魔药", source: "已耗用的第三瓶成品", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "vampire-potion-3", confirmed: true } },
    ],
  });
}
function practices(): VampireProjection["practices"] {
  return ["blood-samples", "shaded-route", "wing-step", "chain-release"].map((id, index) => ({ id, title: `实际实践${index + 1}`, story: `真实情境与边界${index + 1}`, status: "尚未完成" }));
}
const dispute = { id: "vampire-dispute", title: "遮光廊旁的争议", story: "原物仍属于委托人，可以交涉，也可以明确承担战斗风险。", status: "尚待处理" };
function panel(value: VampireProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<VampirePanel vampire={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("vampire-renderer-run", sliceDefaultCreationSelection, "vampire-renderer-seed");
  raw.week = 24;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  raw.apothecary.discovered = true;
  raw.apothecary.guidanceKnown = true;
  raw.progression = {
    pathwayId: "moon", sequence, acting: sequence === 7 ? 0 : 100, promotionWeek: 5,
    mastery: Object.fromEntries([...APOTHECARY_ABILITY_IDS, ...(sequence !== 9 ? TAMER_ABILITY_IDS : []), ...(sequence === 7 ? VAMPIRE_ABILITY_IDS : [])].map((id, index) => [id, index * 2])),
  };
  if (sequence !== 9) {
    raw.tamer.guidanceKnown = true;
    raw.tamer.promotionWeek = 13;
    raw.tamer.apothecaryActingAtPromotion = 100;
  }
  if (sequence === 7) {
    raw.vampire.guidanceKnown = true;
    raw.vampire.promotionWeek = 22;
    raw.vampire.tamerActingAtPromotion = 100;
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

describe("Vampire S7 dossier", () => {
  it("keeps source guidance, individual payment and supply separate from consuming or a fabricated recipe", async () => {
    const { onCommand, rerender } = panel(vampire({ formula: [{ name: "未核实的材料", quantity: 1, unit: "份" }] }));
    expect(screen.queryByText("未核实的材料")).toBeNull();
    expect(screen.getByText(/已知主材线索为血族血源精华/)).toBeTruthy();
    expect(screen.getByText("取得原瓶与确认服用是两个独立步骤。当前渠道只提供成品魔药，不提供完整配方，本阶段使用有限成品药渠道；已知主材线索不等于可调配的完整配方。")).toBeTruthy();
    const commands: VampireCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "vampire-potion-1" },
      { type: "BUY_POTION", bottleId: "vampire-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    for (const command of commands) {
      const current = action(command);
      rerender(<VampirePanel vampire={vampire({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("retains original failures, freely cancels and submits only the selected bottle once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶吸血鬼魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    for (const text of ["vampire-potion-2", "43%", "来源：新货栈实际供给的第二瓶成品", "领域成本CONSUME"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "吸血鬼服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 60", "3", "0", resources.cash]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶吸血鬼魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "vampire-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("rechecks projected consumption restrictions and removes stale confirmations", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<VampirePanel vampire={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "驯兽师尚未消化。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶吸血鬼魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("驯兽师尚未消化。")).toBeTruthy();
    fireEvent.click(confirm);
    rerender(<VampirePanel vampire={{ ...value, bottles: value.bottles.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<VampirePanel vampire={{ ...value, promoted: true }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one of four actual practices and preserves public failed outcomes without optimistic growth", async () => {
    const list = practices();
    const value = vampire({ promoted: true, actions: list.map((practice) => action({ type: "PRACTICE", practiceId: practice.id })), practices: list });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前吸血鬼实践" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作PRACTICE/ })).toHaveLength(1);
    expect(screen.queryByText("真实情境与边界2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择一次实践" }), "shaded-route");
    expect(screen.getByText("真实情境与边界2")).toBeTruthy();
    expect(screen.getByRole("region", { name: "吸血鬼成长下一步" }).textContent).toContain("公开操作PRACTICEshaded-route");
    await userEvent.click(screen.getByRole("button", { name: /^公开操作PRACTICE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PRACTICE", practiceId: "shaded-route" });
    expect(within(screen.getByRole("region", { name: "当前吸血鬼实践" })).getByText("尚未完成")).toBeTruthy();
    rerender(<VampirePanel vampire={{ ...value, practices: list.map((entry) => entry.id === "shaded-route" ? { ...entry, status: "本周未完成，下周再试" } : entry), actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(within(screen.getByRole("region", { name: "当前吸血鬼实践" })).getByText("本周未完成，下周再试")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^公开操作PRACTICE/ })).toBeNull();
  });

  it("keeps observation, peaceful talk and optional combat in the supplied scene record", async () => {
    const value = vampire({ promoted: true, practices: [...practices(), dispute],
      environment: "亲见遮光廊与原出口，其他区域尚未观察。",
      actions: [action({ type: "PRACTICE", practiceId: "blood-samples" }), action({ type: "OBSERVE_ENCOUNTER" })],
    });
    const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button", { name: /^公开操作OBSERVE/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择一次实践" }), "vampire-dispute");
    expect(screen.queryByRole("button", { name: /^公开操作PRACTICE/ })).toBeNull();
    for (const type of ["OBSERVE_ENCOUNTER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"] as const) {
      rerender(<VampirePanel vampire={{ ...value, actions: [action({ type })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^公开操作${type}`) }));
      expect(onCommand).toHaveBeenLastCalledWith({ type });
      expect(screen.getByRole("region", { name: "当前吸血鬼现场环境" }).textContent).toContain(value.environment);
    }
    const privateFacts = { hiddenBloodSource: "未公开人物身份", hiddenSceneTruth: "未揭露的争议答案" };
    rerender(<VampirePanel vampire={{ ...value, ...privateFacts, actions: [], practices: [{ ...dispute, status: "已交涉解决，原物已交还" }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(within(screen.getByRole("region", { name: "当前吸血鬼实践" })).getByText("已交涉解决，原物已交还")).toBeTruthy();
    expect(screen.queryByText(privateFacts.hiddenBloodSource)).toBeNull();
    expect(screen.queryByText(privateFacts.hiddenSceneTruth)).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(3);
  });

  it("shows public scene actions even when no dedicated practice record is supplied", async () => {
    const { onCommand } = panel(vampire({ promoted: true, practices: practices(), actions: [action({ type: "ENCOUNTER_TALK" })] }));
    expect(screen.getByRole("region", { name: "当前吸血鬼现场环境" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作ENCOUNTER_TALK/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_TALK" });
  });

  it("separates buying and feeding costs and obeys the public feeding disabled reason", async () => {
    const buy = { ...action({ type: "BUY_BLOOD" }), cost: "0行动 · 24便士 · 取得密封血食1份" };
    const feed = { ...action({ type: "FEED" }, false), cost: "1行动 · 消耗密封血食1份", reason: "本周已经补充过血食。" };
    const value = vampire({ promoted: true, actions: [buy, feed] });
    const { onCommand, rerender } = panel(value);
    const original = screen.getByRole("region", { name: "实际血食与身体状态" }).textContent;
    expect(screen.getByText(buy.cost)).toBeTruthy();
    expect(screen.getByText(feed.cost)).toBeTruthy();
    expect(screen.getByText(feed.reason)).toBeTruthy();
    const disabled = screen.getByRole("button", { name: /^公开操作FEED/ });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    expect(disabled.getAttribute("aria-describedby")).toBe(`vampire-reason-${feed.id}`);
    fireEvent.click(disabled);
    await userEvent.click(screen.getByRole("button", { name: /^公开操作BUY_BLOOD/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "BUY_BLOOD" });
    expect(screen.getByRole("region", { name: "实际血食与身体状态" }).textContent).toBe(original);
    rerender(<VampirePanel vampire={{ ...value, actions: [{ ...feed, enabled: true, reason: null }] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^公开操作FEED/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "FEED" });
    expect(screen.getByRole("region", { name: "实际血食与身体状态" }).textContent).toBe(original);
  });

  it("shows finite healing, human-origin digestion and only projected ability mastery", async () => {
    const abilities = [{ id: "inherited", label: "继承药物能力", mastery: 63, description: "使用实际药剂。" }, { id: "regeneration", label: "有限再生", mastery: 18, description: "保留原伤势记录。" }];
    const { onCommand } = panel(vampire({ promoted: true, actions: [action({ type: "REGENERATE" }), action({ type: "REFLECT" })], abilities }));
    const current = screen.getByRole("region", { name: "实际血食与身体状态" });
    for (const text of ["76 / 100", "12 / 60", "3", "0", resources.cash]) expect(within(current).getByText(text)).toBeTruthy();
    expect(within(current).getByText(/自愿成年来源密封血食/)).toBeTruthy();
    await userEvent.click(screen.getByText("查看身体、血食与消化边界"));
    expect(screen.getByText(/由人类服用魔药晋升/)).toBeTruthy();
    expect(screen.getByText(/不能复活，也不意味着能无视阳光/)).toBeTruthy();
    const folded = screen.getByLabelText("吸血鬼能力与消化") as HTMLDetailsElement;
    expect(folded.open).toBe(false);
    await userEvent.click(screen.getByText("能力与消化 · 2 项能力"));
    for (const ability of abilities) expect(within(folded).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(within(folded).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REGENERATE/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REGENERATE" });
    await userEvent.click(screen.getByRole("button", { name: /^公开操作REFLECT/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REFLECT" });
    expect(within(current).getByText("76 / 100")).toBeTruthy();
  });

  it("disables actual controls during settlement and unresolved errors", () => {
    const value = vampire({ promoted: true, practices: practices(), actions: [action({ type: "PRACTICE", practiceId: "blood-samples" }), action({ type: "FEED" })] });
    const onCommand = vi.fn();
    for (const condition of ["busy", "blocked"]) {
      render(<VampirePanel vampire={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"} onCommand={onCommand} />);
      expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      fireEvent.click(screen.getAllByRole("button")[0]!);
      expect(onCommand).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("routes Moon 9, 8 and 7 to the current dossier without prematurely offering S7", async () => {
    for (const sequence of [9, 8, 7] as const) {
      const value = bridge(fixture(sequence));
      await enter(value);
      expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
      await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
      const name = sequence === 9 ? "药师之路" : sequence === 8 ? "驯兽师晋升" : "吸血鬼成长";
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
      if (sequence === 9) expect(screen.queryByRole("button", { name: /吸血鬼晋升|吸血鬼成长/ })).toBeNull();
      else expect(screen.getByRole("button", { name: sequence === 8 ? "吸血鬼晋升" : "吸血鬼成长" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /魔术师晋升|纵火家晋升|心理医生晋升|鉴定师晋升/ })).toBeNull();
      expect(value.submitIntent).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("opens S7 preparation from digested Tamer guidance and uses the promoted resource maximum", async () => {
    await enter(bridge(fixture(8)));
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "吸血鬼成长下一步" })).toBeTruthy();
    cleanup();
    const state = fixture(7);
    await enter(bridge(state));
    expect(screen.getByText(/吸血鬼 · 序列7 ·/, { selector: "p.slice-muted" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe(String(state.maxSpirituality));
  });

  it("preserves earlier care and animal facts, exposes only inherited medicine actions and creates no companion", async () => {
    const state = fixture();
    state.apothecary.cases = [{ id: "old-patient", title: "原接诊记录", story: "当事人原先的陈述", observations: ["实际检查的创伤"], result: "原护理已完成", status: "RESOLVED", health: 73, mind: 81 }];
    state.apothecary.actions = [
      { id: "old-care", label: "重复旧病例奖励", cost: "1行动", enabled: true, reason: null, command: { type: "CARE", caseId: "old-patient", choice: "CARE" } },
      { id: "inherited-heal", label: "使用原护理剂", cost: "1行动 · 1护理剂", enabled: true, reason: null, command: { type: "USE_HEALING" } },
    ];
    state.tamer.animals = [{ id: "old-animal", title: "原庭院猎犬", story: "主人当年同意的那次训练", observations: ["实际嗅闻原箱"], intent: "当时愿意停留", status: "ASSISTED", location: "已回原庭院", foodHeld: 1 }];
    state.tamer.actions = [{ id: "old-invite", label: "凭历史再次召出猎犬", cost: "0行动", enabled: true, reason: null, command: { type: "INVITE", animalId: "old-animal" } }];
    state.tamer.bottles = [{ id: "old", title: "原驯兽师瓶", source: "原批次", status: "已耗尽 · 严重排异", chance: 61, command: { type: "CONSUME", bottleId: "old", confirmed: true } }];
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "药师经历" }));
    await userEvent.click(screen.getByText("原接诊记录 · 已完成本次处置"));
    expect(screen.getByText("实际检查的创伤")).toBeTruthy();
    expect(screen.getByText("原护理已完成")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重复旧病例奖励/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^使用原护理剂/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "驯兽师经历" }));
    await userEvent.click(screen.getByText("原庭院猎犬 · 已完成本次协助"));
    expect(screen.getByText("实际嗅闻原箱")).toBeTruthy();
    expect(screen.getByText("原动物位置：已回原庭院")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "驯兽师时期的经历" })).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByText("驯兽师原瓶 · 来源与去向"));
    expect(screen.getByText("来源：原批次")).toBeTruthy();
    expect(screen.getByText("已耗尽 · 严重排异")).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "药师经历" }));
    await userEvent.click(screen.getByRole("button", { name: /^使用原护理剂/ }));
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "APOTHECARY", command: { type: "USE_HEALING" } });
  });

  it("keeps the four other S7 pathways on their own current dossiers", async () => {
    for (const pathwayId of ["diviner", "hunter", "audience", "paragon"] as const) {
      const state = fixture();
      state.progression.pathwayId = pathwayId;
      state.magician = { ...state.magician, promoted: pathwayId === "diviner", discovered: true };
      state.pyromaniac = { ...state.pyromaniac, promoted: pathwayId === "hunter", discovered: true };
      state.psychologist = { ...state.psychologist, promoted: pathwayId === "audience", discovered: true };
      state.appraiser = { ...state.appraiser, promoted: pathwayId === "paragon", discovered: true };
      await enter(bridge(state));
      await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
      const name = pathwayId === "diviner" ? "魔术师成长" : pathwayId === "hunter" ? "纵火家成长" : pathwayId === "audience" ? "心理医生成长" : "鉴定师成长";
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("region", { name: `${name}下一步` })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /吸血鬼晋升|吸血鬼成长/ })).toBeNull();
      expect(screen.getByRole("region", { name: "接下来" }).textContent).not.toContain("动物同行");
      cleanup();
    }
  });

  it.each(["CONSUME", "FEED"] as const)("locks and retries the identical failed %s envelope", async (type) => {
    const consume = type === "CONSUME";
    const command: VampireCommand = consume ? { type, bottleId: "vampire-potion-2", confirmed: true } : { type };
    const state = fixture(consume ? 8 : 7, { vampire: consume ? bottled() : vampire({ promoted: true, practices: practices(), actions: [action(command)] }) });
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    if (consume) {
      await userEvent.click(screen.getByRole("button", { name: "吸血鬼晋升" }));
      await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    }
    const buttonName = consume ? "确认服用「第二瓶吸血鬼魔药」" : /^公开操作FEED/;
    const button = screen.getByRole("button", { name: buttonName });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "吸血鬼模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("吸血鬼模拟保存失败");
    expect((screen.getByRole("button", { name: buttonName }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: consume ? "驯兽师晋升" : "驯兽师经历" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "VAMPIRE", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
