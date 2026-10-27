/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { AUDIENCE_ABILITY_IDS } from "../../src/domain/audience/types";
import { MINDREADER_ABILITY_IDS } from "../../src/domain/mindreader/types";
import { PSYCHOLOGIST_ABILITY_IDS, type PsychologistAction, type PsychologistCommand, type PsychologistProjection } from "../../src/domain/psychologist/types";
import type { SliceCombatRound, SliceProjection } from "../../src/domain/slice/types";
import { PsychologistPanel } from "../../src/renderer/PsychologistPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。每档都消耗所选原瓶。";
function action(command: PsychologistCommand, enabled = true): PsychologistAction {
  const suffix = "caseId" in command ? command.caseId + ("method" in command ? command.method : "") : "bottleId" in command ? command.bottleId : "";
  return { id: `${command.type}-${suffix}`, label: `公开操作${command.type}${suffix}`, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "本周剩余行动不足。", command };
}
function psychologist(patch: Partial<PsychologistProjection> = {}): PsychologistProjection {
  return {
    title: "心理医生之路", discovered: true, guidanceKnown: false, formulaKnown: false, promoted: false,
    formula: [], actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "读心者消化100/100，晋升读心者后8/8整周。", pollution: 3, risk,
    supplies: "三瓶独立成品药；每瓶可付全款，或完成四次实际劳务后支付余款。",
    scenes: [], environment: "尚未亲自观察争端现场。", ...patch,
  };
}
function bottled(): PsychologistProjection {
  return psychologist({ guidanceKnown: true,
    actions: ["psychologist-potion-1", "psychologist-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true })),
    bottles: [
      { id: "psychologist-potion-1", title: "第一瓶心理医生魔药", source: "实际完成四次劳务并付余款的原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "psychologist-potion-1", confirmed: true } },
      { id: "psychologist-potion-2", title: "第二瓶心理医生魔药", source: "新渠道实际供给的第二瓶成品", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "psychologist-potion-2", confirmed: true } },
      { id: "psychologist-potion-3", title: "第三瓶心理医生魔药", source: "已耗用的第三瓶成品", status: "已耗尽 · 排异，未晋升", chance: 43, command: { type: "CONSUME", bottleId: "psychologist-potion-3", confirmed: true } },
    ],
  });
}
function scenes(): PsychologistProjection["scenes"] {
  return ["night-watch", "stage-fright", "unsettled-letter"].map((id, index) => ({
    id, title: `成年当事人情境${index + 1}`, story: `本人同意的具体社会情境${index + 1}`,
    observations: [], impression: null, status: "尚未完成", consent: true,
  }));
}
const dispute = { id: "psychologist-dispute", title: "院门口的争端", story: "原物仍归本人；可以交涉或承担真实战斗风险。", observations: [], impression: null, status: "尚待处理", consent: false };
function panel(value: PsychologistProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<PsychologistPanel psychologist={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("psychologist-renderer-run", sliceDefaultCreationSelection, "psychologist-renderer-seed");
  raw.week = 24;
  raw.activeEvent = null;
  raw.arc.stage = "ENDED";
  raw.character.name = "艾琳";
  raw.audience.discovered = true;
  raw.audience.formulaKnown = true;
  raw.progression = {
    pathwayId: "audience", sequence, acting: sequence === 7 ? 0 : 100, promotionWeek: 5,
    mastery: Object.fromEntries([...AUDIENCE_ABILITY_IDS, ...(sequence !== 9 ? MINDREADER_ABILITY_IDS : []), ...(sequence === 7 ? PSYCHOLOGIST_ABILITY_IDS : [])].map((id, index) => [id, index * 2])),
  };
  if (sequence !== 9) {
    raw.mindreader.formulaKnown = true;
    raw.mindreader.promotionWeek = 13;
    raw.mindreader.audienceActingAtPromotion = 100;
  }
  if (sequence === 7) {
    raw.psychologist.guidanceKnown = true;
    raw.psychologist.promotionWeek = 22;
    raw.psychologist.mindreaderActingAtPromotion = 100;
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

describe("Psychologist S7 dossier", () => {
  it("uses the explicit G finished-bottle channel and never publishes an unverified recipe", async () => {
    const { onCommand, rerender } = panel(psychologist({ formula: [{ name: "未核材料", quantity: 1, unit: "份" }] }));
    expect(screen.queryByText("未核材料")).toBeNull();
    expect(screen.getByText(/当前渠道只提供成品魔药，不提供完整配方/)).toBeTruthy();
    expect(screen.queryByText(/游戏设定（G）/)).toBeNull();
    for (const command of [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "psychologist-potion-1" },
      { type: "BUY_POTION", bottleId: "psychologist-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ] satisfies PsychologistCommand[]) {
      const current = action(command);
      rerender(<PsychologistPanel psychologist={psychologist({ actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用|调配|制造/ })).toBeNull();
    }
  });

  it("confirms only the selected original with projected risk, chance, resources and one submission", async () => {
    const { onCommand } = panel(bottled());
    expect(screen.getAllByRole("button", { name: /查看并准备服用/ })).toHaveLength(2);
    expect(screen.getByText("已耗尽 · 排异，未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "第二瓶心理医生魔药" })).toBe(document.activeElement);
    expect(screen.getByText("psychologist-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText(risk)).toBeTruthy();
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 60", "3", "0", resources.cash]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶心理医生魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "psychologist-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancels without consuming and restores focus to the same bottle", async () => {
    const { onCommand } = panel(bottled());
    const original = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    await userEvent.click(original);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })).toBe(document.activeElement);
  });

  it("rechecks disabled confirmation and discards a disappeared original", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<PsychologistPanel psychologist={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason: "读心者尚未消化。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶心理医生魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("读心者尚未消化。")).toBeTruthy();
    fireEvent.click(confirm);
    rerender(<PsychologistPanel psychologist={{ ...value, bottles: value.bottles.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected case and does not infer shallow reading or optimistic outcomes", async () => {
    const list = scenes();
    const value = psychologist({ promoted: true, scenes: list, actions: list.map((scene) => action({ type: "OBSERVE", caseId: scene.id })) });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前心理医生情境" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作OBSERVE/ })).toHaveLength(1);
    expect(screen.getByText("尚无已公开的浅层读取记录。")).toBeTruthy();
    expect(screen.queryByText("本人同意的具体社会情境2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择社会情境" }), "stage-fright");
    expect(screen.getByRole("region", { name: "心理医生成长下一步" }).textContent).toContain("公开操作OBSERVEstage-fright");
    await userEvent.click(screen.getByRole("button", { name: /^公开操作OBSERVE/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "OBSERVE", caseId: "stage-fright" });
    expect(screen.getByText("尚未留下可用的观察记录。")).toBeTruthy();
    rerender(<PsychologistPanel psychologist={{ ...value, scenes: list.map((scene) => scene.id === "stage-fright" ? { ...scene, observations: ["手掌发抖的亲见线索"], impression: "本次读取时担忧忘词", status: "支持未成功，下周可重试" } : scene), actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("手掌发抖的亲见线索")).toBeTruthy();
    expect(screen.getByText("本次读取时担忧忘词")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "当前心理医生情境" })).getByText("支持未成功，下周可重试")).toBeTruthy();
  });

  it("sends the projected support method, discussion, referral and reflection commands unchanged", async () => {
    const { onCommand, rerender } = panel(psychologist({ promoted: true, scenes: scenes() }));
    for (const command of [
      { type: "SUPPORT", caseId: "night-watch", method: "SOOTHE" },
      { type: "SUPPORT", caseId: "night-watch", method: "SUGGEST" },
      { type: "SUPPORT", caseId: "night-watch", method: "COMMUNICATE" },
      { type: "DISCUSS", caseId: "night-watch" }, { type: "REFER", caseId: "night-watch" }, { type: "REFLECT" },
    ] satisfies PsychologistCommand[]) {
      const current = action(command);
      rerender(<PsychologistPanel psychologist={psychologist({ promoted: true, scenes: scenes(), actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${current.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
    await userEvent.click(screen.getByText("查看会谈边界与战斗风险"));
    expect(screen.getByText(/暂时平静不表示临床治愈，也不表示污染被净化/)).toBeTruthy();
    expect(screen.getByText(/精神攻击不会自动造成肉体死亡/)).toBeTruthy();
  });

  it("allows a projected zero-AP withdrawal and visibly preserves withdrawn consent", async () => {
    const withdraw = { ...action({ type: "WITHDRAW", caseId: "night-watch" }), cost: "0行动 · 结束本次会谈" };
    const value = psychologist({ promoted: true, scenes: scenes(), actions: [withdraw] });
    const { onCommand, rerender } = panel(value);
    const button = screen.getByRole("button", { name: /^公开操作WITHDRAW/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WITHDRAW", caseId: "night-watch" });
    rerender(<PsychologistPanel psychologist={{ ...value, scenes: scenes().map((scene) => ({ ...scene, consent: false })), actions: [action({ type: "SUPPORT", caseId: "night-watch", method: "SOOTHE" }, false)] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText(/当事人未同意或已退出本次支持/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^公开操作SUPPORT/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /^公开操作WITHDRAW/ })).toBeNull();
  });

  it("keeps optional encounter observation and talk or fight in its own selected scene", async () => {
    const value = psychologist({ promoted: true, scenes: [...scenes(), dispute], environment: "两位成年人仍在院门口争执，尚未开始战斗。",
      actions: [action({ type: "OBSERVE", caseId: "night-watch" }), action({ type: "OBSERVE_ENCOUNTER" })] });
    const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button", { name: /^公开操作OBSERVE_ENCOUNTER/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "psychologist-dispute");
    expect(screen.getByRole("region", { name: "当前心理医生现场环境" }).textContent).toContain("尚未开始战斗");
    expect(screen.queryByRole("button", { name: /^公开操作OBSERVEnight/ })).toBeNull();
    for (const type of ["OBSERVE_ENCOUNTER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"] as const) {
      rerender(<PsychologistPanel psychologist={{ ...value, actions: [action({ type })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^公开操作${type}`) }));
      expect(onCommand).toHaveBeenLastCalledWith({ type });
      expect(screen.getByRole("region", { name: "当前心理医生现场环境" }).textContent).toContain("尚未开始战斗");
    }
  });

  it("retains projected encounter access when only the three social scenes are supplied", async () => {
    const { onCommand } = panel(psychologist({ promoted: true, scenes: scenes(), actions: [action({ type: "ENCOUNTER_TALK" })], environment: "已经观察到的争端环境" }));
    await userEvent.click(screen.getByText("查看现场与可选争端"));
    expect(screen.getByText("已经观察到的争端环境")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作ENCOUNTER_TALK/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_TALK" });
  });

  it("folds abilities and uses the projection length and mastery rather than a fixed count", async () => {
    const abilities = [{ id: "one", label: "继承观察", mastery: 57, description: "只解释公开线索。" }, { id: "two", label: "有限安抚", mastery: 31, description: "短时平静不等于净化。" }];
    panel(psychologist({ promoted: true, actions: [], abilities }));
    const folded = screen.getByLabelText("心理医生能力与消化") as HTMLDetailsElement;
    expect(folded.open).toBe(false);
    await userEvent.click(screen.getByText("能力与消化 · 2 项能力"));
    for (const ability of abilities) expect(within(folded).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(within(folded).queryByRole("button")).toBeNull();
  });

  it.each(["busy", "blocked"])("disables all actual controls when %s", (condition) => {
    const value = psychologist({ promoted: true, scenes: scenes(), actions: [action({ type: "WITHDRAW", caseId: "night-watch" }), action({ type: "REFLECT" })] });
    const onCommand = vi.fn();
    render(<PsychologistPanel psychologist={value} resources={resources} busy={condition === "busy"} blocked={condition === "blocked"} onCommand={onCommand} />);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([9, 8, 7] as const)("routes Audience sequence %s to its current dossier", async (sequence) => {
    const value = bridge(fixture(sequence));
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("button", { name: sequence === 9 ? "观众之路" : sequence === 8 ? "读心者晋升" : "心理医生成长" }).getAttribute("aria-pressed")).toBe("true");
    if (sequence === 9) expect(screen.queryByRole("button", { name: /心理医生晋升|心理医生成长/ })).toBeNull();
    else expect(screen.getByRole("button", { name: sequence === 8 ? "心理医生晋升" : "心理医生成长" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /魔术师晋升|纵火家晋升/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("opens S7 preparation from the digested Mindreader goal and displays projected S7 resources", async () => {
    await enter(bridge(fixture(8)));
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "心理医生成长下一步" })).toBeTruthy();
    cleanup();
    const state = fixture(7);
    await enter(bridge(state));
    expect(screen.getByText(/心理医生 · 序列7 ·/, { selector: "p.slice-muted" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe(String(state.maxSpirituality));
  });

  it("preserves both earlier cases, read facts and original failures with no repeat actions", async () => {
    const state = fixture();
    state.audience.scenes = [{ id: "old-audience", title: "柜台旧事", story: "原柜台经过", observations: ["当年的亲见线索"], interpretation: "当年有保留的解读", status: "已核实" }];
    state.audience.actions = [{ id: "old-observe", label: "重复观众奖励", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "old-audience" } }];
    state.mindreader.scenes = [{ id: "old-mindreader", title: "遗失钥匙旧事", story: "原钥匙经过", observations: ["钥匙扣的划痕"], impression: "当时实际读取的担忧", dialogue: "当事人的核实结果", status: "已核实" }];
    state.mindreader.actions = [{ id: "old-bottle", label: "重新服用读心者旧瓶", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "old", confirmed: true } }];
    state.mindreader.bottles = [{ id: "old", title: "原读心者瓶", source: "原采购批次", status: "已耗尽 · 严重排异", chance: 61, command: { type: "CONSUME", bottleId: "old", confirmed: true } }];
    const value = bridge(state);
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "观众经历" }));
    await userEvent.click(screen.getByText("柜台旧事 · 已核实"));
    expect(screen.getByText("当年的亲见线索")).toBeTruthy();
    expect(screen.getByText(/当年有保留的解读/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "观众时期的经历" })).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "读心者经历" }));
    await userEvent.click(screen.getByText("遗失钥匙旧事 · 已核实"));
    expect(screen.getByText(/当时实际读取的担忧/)).toBeTruthy();
    expect(screen.getByText(/当事人的核实结果/)).toBeTruthy();
    await userEvent.click(screen.getByText("读心者原瓶 · 来源与去向"));
    expect(screen.getByText("来源：原采购批次")).toBeTruthy();
    expect(screen.getByText("已耗尽 · 严重排异")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "读心者时期的经历" })).queryByRole("button")).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["diviner", "hunter"] as const)("keeps %s S7 on its own current dossier", async (pathwayId) => {
    const state = fixture();
    state.progression.pathwayId = pathwayId;
    state.magician = { ...state.magician, promoted: pathwayId === "diviner", discovered: true };
    state.pyromaniac = { ...state.pyromaniac, promoted: pathwayId === "hunter", discovered: true };
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const name = pathwayId === "diviner" ? "魔术师成长" : "纵火家成长";
    expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: `${name}下一步` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /心理医生晋升|心理医生成长/ })).toBeNull();
  });

  it("labels only the mental consequence draw as 10/25/40 strain and preserves ordinary and Magician physical labels", async () => {
    for (const kind of ["mental", "ordinary", "magician"] as const) {
      const round: SliceCombatRound = {
        round: 1, stance: "DEFEND", first: "PLAYER", playerCount: 2, enemyCount: 1,
        playerCountRoll: 72, enemyCountRoll: 32, moves: [], playerAdvantage: 25, enemyAdvantage: 20,
        winChance: 56, winner: "PLAYER", retreat: "NONE",
        consequence: kind === "mental" ? "对手本轮精神余量下降，身体未受伤。" : "原有肉体打击后果。",
        consequenceWeights: { light: 65, heavy: 30, death: 5 },
        ...(kind === "mental" ? { consequenceRoll: 74 } : kind === "magician" ? { consequenceRoll: 74, pendingConsequence: "HEAVY" as const } : {}),
      };
      const state = fixture(7, {
        combat: {
          title: "门厅争端", round: 2, enemyName: "原门厅当事人", enemyHealth: 100, enemyMind: 75,
          enemyStatus: "RESISTING", playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [],
          consequenceWeights: { light: 65, heavy: 30, death: 5 },
          stances: [{ id: "DEFEND", label: "防守", description: "保留实际打击风险。" }], lastRound: round,
        }, lastCombatRound: round, combatHistory: [round], canAct: false,
      });
      const value = bridge(state);
      window.sliceGame = value;
      render(<SliceApp />);
      await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
      await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
      await screen.findByRole("heading", { name: "第 1 回合结果" });
      const record = document.querySelector(".slice-round-record")!;
      if (kind === "mental") {
        expect(record.textContent).toContain("精神后果盘：损耗10点 65% · 损耗25点 30% · 损耗40点 5%");
        expect(record.textContent).not.toMatch(/轻伤|重伤|死亡/);
      } else {
        expect(record.textContent).toContain("败者后果盘：轻伤 65% · 重伤 30% · 死亡 5%");
        expect(record.textContent).not.toContain("精神后果盘");
      }
      await userEvent.click(screen.getByRole("button", { name: "进入下一回合" }));
      const opponent = screen.getByRole("heading", { name: "原门厅当事人" }).closest("section")!;
      expect(within(opponent).getByText("精神 75 / 100")).toBeTruthy();
      const health = within(opponent).getByRole("progressbar", { name: "对手健康" });
      expect(health.getAttribute("aria-valuenow")).toBe("100");
      expect(health.getAttribute("aria-valuemax")).toBe("100");
      expect(value.submitIntent).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it.each(["CONSUME", "SUPPORT"] as const)("locks and retries the identical failed %s envelope", async (type) => {
    const consume = type === "CONSUME";
    const command: PsychologistCommand = consume ? { type, bottleId: "psychologist-potion-2", confirmed: true } : { type, caseId: "night-watch", method: "SOOTHE" };
    const state = fixture(consume ? 8 : 7, { psychologist: consume ? bottled() : psychologist({ promoted: true, scenes: scenes(), actions: [action(command)] }) });
    const value = bridge(state);
    let finish!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    if (consume) {
      await userEvent.click(screen.getByRole("button", { name: "心理医生晋升" }));
      await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    }
    const buttonName = consume ? "确认服用「第二瓶心理医生魔药」" : /^公开操作SUPPORT/;
    const button = screen.getByRole("button", { name: buttonName });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "心理医生模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("心理医生模拟保存失败");
    expect((screen.getByRole("button", { name: buttonName }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: consume ? "读心者晋升" : "读心者经历" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "PSYCHOLOGIST", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
