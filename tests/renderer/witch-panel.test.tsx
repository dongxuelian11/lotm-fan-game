/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { WITCH_ABILITIES, WITCH_BODY_CHANGE, WITCH_CONSUMPTION_RISK, WITCH_FORMULA, WITCH_FORMULA_SOURCE } from "../../src/domain/witch/content";
import { WITCH_CASE_IDS, type WitchAction, type WitchCommand, type WitchProjection } from "../../src/domain/witch/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { WitchPanel, WitchAssassinHistory, WitchInstigatorHistory } from "../../src/renderer/WitchPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 0, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const consentLabel = "我已了解并接受这瓶魔药成功晋升后的角色身体变化";
const consume = (bottleId: string): WitchCommand => ({ type: "CONSUME", bottleId, confirmed: true, bodyChangeAccepted: true });
function action(command: WitchCommand, enabled = true): WitchAction {
  const target = "caseId" in command ? command.caseId : "bottleId" in command ? command.bottleId : "batchId" in command ? command.batchId : "";
  const suffix = command.type === "PREPARE" ? command.method : "";
  return {
    id: `${command.type}-${target}-${suffix}`, label: `公开操作${command.type}${target}${suffix}`,
    cost: command.type === "PREPARE_MIRROR" || command.type === "WITHDRAW" ? "0行动 · 实际工具与记录为准" : `领域成本${command.type}`,
    enabled, reason: enabled ? null : "领域原因：本周已尝试，请下周再来。", command,
  };
}
function cases(): WitchProjection["cases"] {
  return WITCH_CASE_IDS.map((id, index) => ({
    id, title: `巫术实践${index + 1}`, story: `原现场与实际对象${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function witch(patch: Partial<WitchProjection> = {}): WitchProjection {
  return {
    title: "女巫晋升", discovered: true, formulaKnown: false, promoted: false,
    formula: [], supplies: "配方指导240便士；主材1800便士；辅材150便士；调配台60便士。每批4次真实劳务。",
    tools: "隐身粉末持有0份、使用0份；镜片持有0份、使用0份；未预备战前镜片。",
    bodyChange: WITCH_BODY_CHANGE, previousGender: null,
    actions: [action({ type: "LEARN_FORMULA" })], bottles: [], abilities: [],
    acting: 0, digestion: "教唆者消化100/100，成熟时间8/8整周。", pollution: 3,
    risk: WITCH_CONSUMPTION_RISK, cases: [], environment: "", ...patch,
  };
}
function bottled(): WitchProjection {
  const ids = ["witch-batch-1:bottle", "witch-batch-2:bottle", "witch-batch-3:bottle"];
  return witch({ formulaKnown: true, formula: [...WITCH_FORMULA], story: WITCH_FORMULA_SOURCE,
    actions: ids.slice(0, 2).map((id) => ({ ...action(consume(id)), cost: "0行动 · 独立确认 · 消耗这瓶魔药" })),
    bottles: ids.map((id, index) => ({
      id, title: `${["第一", "第二", "第三"][index]}瓶女巫魔药`,
      source: `第${index + 1}批六项原材料、4次劳务与实际调配记录`,
      status: index === 2 ? "已耗用 · 失败，未晋升" : "已调配，尚未服用",
      chance: index === 0 ? 71 : 43, command: consume(id),
    })),
  });
}
function panel(value: WitchProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<WitchPanel witch={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 9 | 8 | 7 | null = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("witch-renderer-run", sliceDefaultCreationSelection, "witch-renderer-seed");
  raw.week = 30; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, investigateTargets: [], canAct: true, actionBlockedReason: null,
    assassin: { ...state.assassin, discovered: sequence !== null, promoted: sequence !== null, acting: 100, actions: [] },
    instigator: { ...state.instigator, discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7, acting: 100, actions: [] },
    witch: witch({ title: sequence === 7 ? "女巫 · 序列7" : "女巫晋升", promoted: sequence === 7, actions: sequence === 7 ? [] : [action({ type: "LEARN_FORMULA" })] }),
    progression: { pathwayId: sequence === null ? null : "demoness", sequence, mastery: {}, acting: sequence === 7 ? 0 : 100, promotionWeek: sequence === null ? null : 5 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-12T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:01:00Z", replayed: false, state,
  } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
}
async function openWitch() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "女巫晋升" });
  if (tab) await userEvent.click(tab);
}
async function acceptBodyChange() { await userEvent.click(screen.getByRole("checkbox", { name: consentLabel })); }
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Witch sequence seven dossier", () => {
  it.each([null, 9] as const)("does not add Witch as an initial route or reveal it at sequence %s", async (sequence) => {
    const value = bridge(fixture(sequence)); await enter(value);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const tabs = screen.getByRole("group", { name: "选择成长卷宗" });
    if (sequence === null) expect(within(tabs).getAllByRole("button")).toHaveLength(22);
    expect(screen.queryByRole("button", { name: /女巫/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("retains current S8 practice and opens S7 preparation from the advancement guide", async () => {
    const value = bridge(fixture()); await enter(value);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("角色身体变化");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "教唆者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "女巫晋升" }));
    expect(screen.getByRole("region", { name: "女巫成长下一步" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "女巫角色身体变化记录" }).textContent).toContain("可以停留在序列8");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("button", { name: "女巫晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("displays six source amounts, keeps both main ingredients unquantified, and uses drops for narcissus", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByText("查看已知女巫配方 · 6 种材料"));
    const formula = screen.getByLabelText("女巫已知配方");
    expect(within(formula).getAllByRole("listitem")).toHaveLength(6);
    expect(within(formula).getAllByText("数量未注明")).toHaveLength(2);
    for (const text of ["黑渊魔鱼全部血液", "玛瑙孔雀的蛋", "80 毫升", "5 滴", "3 枚", "10 滴"]) expect(within(formula).getByText(text)).toBeTruthy();
    expect(formula.textContent).not.toContain("10 毫升");
    expect(screen.getByText(WITCH_FORMULA_SOURCE)).toBeTruthy();
    expect(screen.getByRole("region", { name: "女巫实际物资" }).textContent).toContain("4次真实劳务");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("never exposes an unknown formula just because supplies or bottles are known", () => {
    panel(witch({ formulaKnown: false, formula: [...WITCH_FORMULA] }));
    expect(screen.queryByLabelText("女巫已知配方")).toBeNull();
    expect(screen.queryByText("水仙花汁")).toBeNull();
  });

  it.each(["MALE", "FEMALE"])("requires explicit fresh character-body acceptance for an original %s character", async (gender) => {
    const state = fixture(8, { witch: bottled() }); state.character = { ...state.character, gender };
    const value = bridge(state); await enter(value); await openWitch();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const change = screen.getByRole("region", { name: "女巫晋升的角色身体变化" });
    for (const text of ["男性角色的身体将变为女性", "已经是女性的角色会增强外貌与魅力", "当前角色存档", "不代表现实玩家", "自我认同与恋爱选择不会自动改写", "继续停留在序列8"]) expect(change.textContent).toContain(text);
    const checkbox = screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement;
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶女巫魔药」" }) as HTMLButtonElement;
    expect(checkbox.checked).toBe(false); expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm); expect(value.submitIntent).not.toHaveBeenCalled();
    await acceptBodyChange(); expect(confirm.disabled).toBe(false);
    await acceptBodyChange(); expect(confirm.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("cancels with Escape or Back, restores bottle focus and resets consent for every bottle", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶女巫魔药" }));
    await acceptBodyChange();
    fireEvent.keyDown(screen.getByRole("region", { name: "这瓶女巫魔药的服用确认" }), { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    await acceptBodyChange(); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    for (const text of ["witch-batch-2:bottle", "43%", "来源：第2批六项原材料、4次劳务与实际调配记录", "0行动 · 独立确认 · 消耗这瓶魔药"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain("76 / 100");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("returns from nested confirmation with Escape and requires new consent after closing and reopening growth", async () => {
    const value = bridge(fixture(8, { witch: bottled() })); await enter(value); await openWitch();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })); await acceptBodyChange();
    fireEvent.keyDown(screen.getByRole("checkbox", { name: consentLabel }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "这瓶女巫魔药的服用确认" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })); await acceptBodyChange();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" })); await openWitch();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["MALE", "FEMALE"])("shows only the committed %s body-change result after successful consumption", async (gender) => {
    const state = fixture(8, { witch: bottled() }); state.character = { ...state.character, gender };
    const promoted: SliceProjection = { ...state, revision: state.revision + 1,
      character: { ...state.character, gender: "FEMALE" },
      progression: { ...state.progression, sequence: 7, acting: 0, promotionWeek: state.week },
      witch: { ...state.witch, title: "女巫 · 序列7", promoted: true, previousGender: gender,
        bodyChange: gender === "MALE" ? "实际保存：角色身体已转为女性。" : "实际保存：女性角色外貌与魅力已增强。",
        actions: [], bottles: state.witch.bottles.map((bottle) => bottle.id === "witch-batch-1:bottle" ? { ...bottle, status: "已耗用 · 成功晋升" } : bottle) } };
    const value = bridge(state); value.submitIntent = vi.fn(async (envelope) => receipt(promoted, envelope));
    await enter(value); await openWitch();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })); await acceptBodyChange();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶女巫魔药」" }));
    expect(screen.queryByRole("region", { name: "这瓶女巫魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "女巫角色身体变化记录" }).textContent).toContain(promoted.witch.bodyChange);
    expect(screen.getByRole("region", { name: "女巫角色身体变化记录" }).textContent).toContain(gender === "MALE" ? "晋升前角色身体记录：男性" : "晋升前角色身体记录：女性");
    expect(screen.getByRole("button", { name: "教唆者经历" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "WITCH", command: consume("witch-batch-1:bottle") });
  });

  it("only submits the accepted bottle once despite immediate repeated confirm clicks", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    await acceptBodyChange();
    const button = screen.getByRole("button", { name: "确认服用「第二瓶女巫魔药」" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume("witch-batch-2:bottle"));
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).disabled).toBe(true);
  });

  it("requires fresh acceptance even when a public action already carries bodyChangeAccepted", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶女巫魔药」" });
    fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    await acceptBodyChange(); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume("witch-batch-1:bottle"));
  });

  it.each(["busy", "blocked", "readOnly"] as const)("respects the %s lock without using local AP or spirit to disable public actions", (lock) => {
    const value = witch({ promoted: true, actions: [action({ type: "PREPARE_MIRROR" })] });
    const { onCommand, rerender } = panel(value);
    const title = /^公开操作PREPARE_MIRROR/;
    expect((screen.getByRole("button", { name: title }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<WitchPanel witch={value} resources={resources} busy={lock === "busy"} blocked={lock === "blocked"} readOnly={lock === "readOnly"} onCommand={onCommand} />);
    const button = screen.getByRole("button", { name: title }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows public disabled reasons and does not manufacture tool availability", () => {
    const { onCommand } = panel(witch({ promoted: true, tools: "实际粉末0，镜片0；无已预备镜片。", actions: [action({ type: "PREPARE_MIRROR" }, false)] }));
    expect(screen.getByText("实际粉末0，镜片0；无已预备镜片。")).toBeTruthy();
    expect(screen.getAllByText("领域原因：本周已尝试，请下周再来。", { exact: false }).length).toBeGreaterThan(0);
    const button = screen.getByRole("button", { name: /^公开操作PREPARE_MIRROR/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(WITCH_CASE_IDS)("keeps %s observation, preparation and actual outcome distinct, and submits both allowed methods", async (caseId) => {
    const commands: WitchCommand[] = [{ type: "OBSERVE", caseId }, { type: "PREPARE", caseId, method: "MAGIC" }, { type: "PREPARE", caseId, method: "ORDINARY" }, { type: "PERFORM", caseId }, { type: "REPORT", caseId }, { type: "WITHDRAW", caseId }];
    const { onCommand } = panel(witch({ promoted: true, cases: cases(), actions: commands.map((command) => action(command)) }));
    const select = screen.getByRole("combobox", { name: "选择巫术实践" }) as HTMLSelectElement;
    expect(select.options).toHaveLength(5); expect(select.value).toBe(caseId);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("尚未取得本处现场观察");
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("尚无本次准备记录");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    for (const command of commands) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${action(command).label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
    }
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("尚无本次准备记录");
    expect(screen.getByRole("region", { name: "本次实践目标与边界" }).textContent).toContain("已经支付的行动与物资不会退回");
  });

  it("keeps only source-limited S7 capabilities and factual committed body and tool records", () => {
    panel(witch({ promoted: true, previousGender: "MALE", bodyChange: "已保存：原男性角色成功晋升后身体变为女性。", tools: "粉末持有2份；镜片已实际预备1份。", abilities: WITCH_ABILITIES.map((ability) => ({ ...ability, mastery: 23 })), acting: 100, actions: [] }));
    const region = screen.getByRole("region", { name: "女巫能力与消化" });
    for (const text of ["隐身不是绝对不可发现", "镜替不复活", "不包含序列6欢愉的蛛丝或序列5疾病", "普通核对与协作同样可完成实践"]) expect(region.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "女巫角色身体变化记录" }).textContent).toContain("晋升前角色身体记录：男性");
    expect(screen.getByRole("region", { name: "女巫实际工具与战前准备" }).textContent).toContain("镜片已实际预备1份");
    expect(screen.getByRole("region", { name: "女巫成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens S7 at Witch and retains both lower histories read-only without changing original ownership", async () => {
    const state = fixture(7);
    state.assassin.draft = { id: "assassin-original-draft", owner: "诺艾拉·温瑟", custodian: "原作者实际保管", location: "原作者书桌", version: 4 };
    state.assassin.cases = [{ id: "upper-draft", title: "旧上层原稿", story: "旧原稿位置未改写", observations: ["刺客原观察"], preparation: "刺客原准备", result: "刺客原报告", status: "RESOLVED", position: "原起点" }];
    state.assassin.abilities = [{ id: "assassin.s9.lightness", label: "原轻盈身法", mastery: 23, description: "原说明" }];
    state.instigator.cases = [{ id: "stage-rivalry", title: "原争执", story: "原当事人事实", observations: ["教唆者原观察"], preparation: "教唆者原准备", result: "教唆者原报告", status: "RESOLVED", tension: "原争执已实际停止" }];
    state.instigator.bottles = [{ id: "s8-original", title: "旧教唆者原瓶", source: "原S8渠道", status: "已耗用", chance: 65, command: { type: "CONSUME", bottleId: "s8-original", confirmed: true } }];
    state.instigator.actions = [{ id: "stale", label: "不可重新停止的旧争执", cost: "0行动", enabled: true, reason: null, command: { type: "SETTLE", caseId: "stage-rivalry" } }];
    const value = bridge(state); await enter(value); await openWitch();
    expect(screen.getByText(new RegExp(`女巫 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    expect(screen.getByRole("region", { name: "女巫成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "刺客经历" }));
    const s9 = screen.getByRole("region", { name: "刺客时期的经历" });
    for (const text of ["原作者实际保管", "诺艾拉·温瑟", "刺客原观察", "刺客原准备", "刺客原报告", "原轻盈身法", "23", "已晋升女巫"]) expect(s9.textContent).toContain(text);
    expect(within(s9).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "教唆者经历" }));
    const s8 = screen.getByRole("region", { name: "教唆者时期的经历" });
    for (const text of ["教唆者原观察", "教唆者原准备", "教唆者原报告", "原争执已实际停止", "原S8渠道"]) expect(s8.textContent).toContain(text);
    expect(within(s8).queryByRole("button")).toBeNull(); expect(screen.queryByText("不可重新停止的旧争执")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" })); await openWitch();
    expect(screen.getByRole("region", { name: "女巫成长下一步" })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("has no mutation callbacks, controls or selectors in either lower history", () => {
    const state = fixture(7);
    render(<><WitchAssassinHistory assassin={state.assassin} /><WitchInstigatorHistory instigator={state.instigator} /></>);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  const retryCommands: WitchCommand[] = [
    consume("witch-batch-2:bottle"), { type: "LEARN_FORMULA" }, { type: "MATERIAL_WORK", batchId: "witch-batch-1" },
    { type: "BUY_MATERIALS", batchId: "witch-batch-1" }, { type: "BREW", batchId: "witch-batch-1" },
    { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }, { type: "BUY_SUPPLIES" }, { type: "PREPARE_MIRROR" },
    { type: "OBSERVE", caseId: "mirror-echo" }, { type: "PREPARE", caseId: "mirror-echo", method: "MAGIC" },
    { type: "PREPARE", caseId: "mirror-echo", method: "ORDINARY" }, { type: "PERFORM", caseId: "mirror-echo" },
    { type: "REPORT", caseId: "mirror-echo" }, { type: "WITHDRAW", caseId: "mirror-echo" }, { type: "REFLECT" },
  ];
  it.each(retryCommands)("retries the identical public $type envelope after save failure and double click", async (cmd) => {
    const consuming = cmd.type === "CONSUME";
    const acquiring = ["LEARN_FORMULA", "MATERIAL_WORK", "BUY_MATERIALS", "BREW", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "CONSUME"].includes(cmd.type);
    const list = cases(); list[1]!.status = cmd.type === "REPORT" ? "EXAMINED" : cmd.type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(acquiring ? 8 : 7, { witch: consuming ? bottled() : witch({ promoted: !acquiring, cases: acquiring ? [] : list, actions: [action(cmd)] }), actionsRemaining: 0, spirituality: 0, canAct: false });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next = { ...state, revision: state.revision + 1, witch: { ...state.witch, actions: [] } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(next, envelope));
    value.submitIntent = submit; await enter(value); await openWitch();
    if (consuming) { await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ })); await acceptBodyChange(); }
    const name = consuming ? "确认服用「第二瓶女巫魔药」" : new RegExp(`^${action(cmd).label}`);
    const button = screen.getByRole("button", { name });
    fireEvent.click(button); fireEvent.click(button); expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "女巫模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("女巫模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "WITCH", command: cmd });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    if ("caseId" in cmd) expect((screen.getByRole("combobox", { name: "选择巫术实践" }) as HTMLSelectElement).value).toBe("mirror-echo");
  });

  it("retains the failed consumed original and requires new consent for the next independent bottle", async () => {
    const state = fixture(8, { witch: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      witch: { ...state.witch, bottles: state.witch.bottles.map((bottle) => bottle.id === "witch-batch-1:bottle" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.witch.actions.slice(1) } };
    const value = bridge(state); value.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(value); await openWitch();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })); await acceptBodyChange();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶女巫魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "WITCH", command: consume("witch-batch-1:bottle") });
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(value.submitIntent).toHaveBeenCalledTimes(1);
  });

  it("arms an actual public mirror at zero AP without consuming it or closing ordinary navigation locally", async () => {
    const cmd: WitchCommand = { type: "PREPARE_MIRROR" };
    const state = fixture(7, { witch: witch({ promoted: true, tools: "实际镜片持有1份，尚未预备。", actions: [action(cmd)] }), actionsRemaining: 0, spirituality: 0, canAct: false });
    const value = bridge(state);
    value.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, witch: { ...state.witch, tools: "实际镜片持有1份，已预备；使用0份。", actions: [] } }, envelope));
    await enter(value); await openWitch();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作PREPARE_MIRROR/ }));
    expect(vi.mocked(value.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "WITCH", command: cmd });
    expect(screen.getByText("实际镜片持有1份，已预备；使用0份。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("keeps the normal dashboard and Escape close after Witch practice, without an invented insideCase gate", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", result: "这次隐身已实际结束；声响曾暴露位置。" };
    const value = bridge(fixture(7, { witch: witch({ promoted: true, cases: list, actions: [] }), actionsRemaining: 1 }));
    await enter(value); expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openWitch(); expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain("已实际结束");
    fireEvent.keyDown(screen.getByRole("dialog", { name: "非凡成长" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Assassin RETURN before Instigator SETTLE before Witch preparation", async () => {
    const state = fixture(8, { actionsRemaining: 0, spirituality: 0, health: 0, mind: 0 });
    state.assassin = { ...state.assassin, insideCase: true, cases: [{ id: "upper-draft", title: "原上层原稿", story: "仍在原平台", observations: ["普通楼梯已开"], preparation: null, result: null, status: "EXAMINED", position: "上层平台" }], actions: [{ id: "return", label: "实际沿原楼梯返回", cost: "0行动 · 0灵性", enabled: true, reason: null, command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }] };
    state.instigator = { ...state.instigator, insideCase: true, cases: [{ id: "stage-rivalry", title: "旧争执", story: "尚待退出", observations: [], preparation: null, result: "实际挑动曾升温", status: "EXAMINED", tension: "仍需停止影响" }], actions: [{ id: "settle", label: "实际停止原争执", cost: "0行动", enabled: true, reason: null, command: { type: "SETTLE", caseId: "stage-rivalry" } }] };
    const returned = { ...state, revision: state.revision + 1, assassin: { ...state.assassin, insideCase: false, actions: [] } };
    const settled = { ...returned, revision: returned.revision + 1, instigator: { ...state.instigator, insideCase: false, actions: [] } };
    const value = bridge(state);
    value.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(returned, envelope)).mockImplementationOnce(async (envelope) => receipt(settled, envelope));
    await enter(value); await userEvent.click(screen.getByRole("button", { name: "查看平台与返回" }));
    expect(screen.getByRole("region", { name: "刺客成长下一步" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "女巫晋升" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际沿原楼梯返回/ }));
    expect(await screen.findByRole("region", { name: "立即停止挑动并退开" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "女巫晋升" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际停止原争执/ }));
    await userEvent.click(screen.getByRole("button", { name: "女巫晋升" }));
    expect(screen.getByRole("region", { name: "女巫成长下一步" })).toBeTruthy();
    expect(vi.mocked(value.submitIntent).mock.calls.map(([envelope]) => envelope.payload.type)).toEqual(["ASSASSIN", "INSTIGATOR"]);
  });
});
