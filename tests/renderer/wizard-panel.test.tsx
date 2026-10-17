/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { WIZARD_ABILITIES, WIZARD_CONSUMPTION_RISK, WIZARD_SPELLS } from "../../src/domain/wizard/content";
import type { WizardAction, WizardCommand, WizardProjection } from "../../src/domain/wizard/types";
import { COMBAT_SCHOLAR_ABILITIES } from "../../src/domain/combat-scholar/content";
import { PRYER_ABILITIES } from "../../src/domain/pryer/content";
import type { SliceProjection } from "../../src/domain/slice/types";
import { WizardPanel } from "../../src/renderer/WizardPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: WizardCommand, label = `公开操作${command.type}`, enabled = true, cost = "1行动 · 公开成本"): WizardAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
function wizard(patch: Partial<WizardProjection> = {}): WizardProjection {
  return {
    title: "巫师晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [], bottles: [], abilities: [], lessons: WIZARD_SPELLS.map((spell) => ({ ...spell, learned: false })),
    acting: 0, digestion: "格斗学者消化100；序列8已完成8/8整周。", pollution: 3,
    risk: WIZARD_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): WizardProjection {
  return wizard({ guidanceKnown: true,
    supplies: "三瓶独立成品，指导240便士；四次实际劳动抵1800便士，原价2010便士。",
    actions: ["wizard-potion-1", "wizard-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一瓶")),
    bottles: [
      { id: "wizard-potion-1", title: "第一瓶巫师魔药", source: "伊蕾独立保管的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "wizard-potion-1", confirmed: true } },
      { id: "wizard-potion-2", title: "第二瓶巫师魔药", source: "伊蕾独立保管的第二进阶原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "wizard-potion-2", confirmed: true } },
      { id: "wizard-potion-3", title: "第三瓶巫师魔药", source: "伊蕾独立保管的第三进阶原瓶", status: "指导者保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "wizard-potion-3", confirmed: true } },
    ],
  });
}
function cases(): WizardProjection["cases"] {
  return [
    { id: "paper-marker", title: "纸标与牵引边界", story: "纸标只在可见范围内移动。", observations: [], preparation: null, result: null, status: "AVAILABLE", effectOpen: "没有尚待结束的效果" },
    { id: "soft-impact", title: "软垫与短时护持", story: "成年伙伴同意一次有限软垫冲击。", observations: [], preparation: null, result: null, status: "AVAILABLE", effectOpen: "没有尚待结束的效果" },
    { id: "veiled-tag", title: "原标与局部模糊", story: "遮蔽只作用于原标签局部。", observations: [], preparation: null, result: null, status: "AVAILABLE", effectOpen: "没有尚待结束的效果" },
  ];
}
function effectOpen(failed = false): WizardProjection {
  return wizard({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "veiled-tag" ? {
      ...entry, status: failed ? "OBSERVED" : "EXAMINED", effectOpen: "局部效果仍在，先实际结束",
      result: failed ? "此前法术检验未成，成本保留。" : "实际检验已记录，仍需结束效果。",
    } : entry),
    actions: [action({ type: "END", caseId: "veiled-tag" }, "实际结束本次法术效果", true, "0行动 · 0灵性 · 不退成本")],
  });
}
function panel(value: WizardProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<WizardPanel wizard={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("wizard-renderer-run", sliceDefaultCreationSelection, "wizard-renderer-seed");
raw.week = 10; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 8 | 7 | null = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), investigateTargets: [], canAct: true, actionBlockedReason: null,
    wizard: wizard({ promoted: sequence === 7, title: sequence === 7 ? "巫师 · 序列7" : "巫师晋升",
      abilities: sequence === 7 ? WIZARD_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    combatScholar: { ...structuredClone(base.combatScholar), discovered: sequence !== null, promoted: sequence !== null, actions: [],
      acting: sequence === null ? 0 : 100,
      abilities: sequence !== null ? COMBAT_SCHOLAR_ABILITIES.map((ability) => ({ ...ability, mastery: 44 })) : [],
    },
    pryer: { ...structuredClone(base.pryer), discovered: sequence !== null, promoted: sequence !== null, actions: [],
      abilities: sequence !== null ? PRYER_ABILITIES.map((ability) => ({ ...ability, mastery: 32 })) : [],
    },
    progression: { pathwayId: sequence === null ? null : "hermit", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
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
async function openWizard() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  if (!screen.queryByRole("region", { name: "巫师成长下一步" })) {
    const tab = screen.queryByRole("button", { name: /^巫师(?:晋升|成长)$/ });
    if (tab) await userEvent.click(tab);
  }
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Wizard sequence-seven public G-spell dossier", () => {
  it("keeps exactly fifteen ordinary routes and never exposes S7 as a new starting pathway", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "窥秘人之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^巫师/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("offers S8 digestion and eight-full-week promotion guidance without consuming anything", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("格斗学者消化已达100");
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("八个完整周");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "巫师成长下一步" }).textContent).toContain("本页显示三项有限法术、课程、实践情境与成品渠道，具体数值以当前说明为准。晋升不会自动学会所有法术，也不自动加入组织。");
    expect(screen.getByRole("button", { name: "巫师晋升" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens S7 from the task button and preserves both earlier histories without mutation controls", async () => {
    const state = fixture(7);
    state.pryer.cases = [{ id: "intrusive-page", title: "旧原页", story: "旧公开故事", observations: ["原观察仍保留"], preparation: "原准备", result: "旧错误报告已更正", status: "RESOLVED", readingOpen: "已实际合页", overclaims: 1 }];
    state.pryer.bottles = [{ id: "pryer-potion-1", title: "旧窥秘人原瓶", source: "莉奈原瓶", status: "已耗用", chance: 70, command: { type: "CONSUME", bottleId: "pryer-potion-1", confirmed: true } }];
    state.combatScholar.cases = [{ id: "halted-exercise", title: "旧停止演练", story: "旧演练现场", observations: ["原铃实际响起"], preparation: "普通协作原准备", result: "已实际停止并报告", status: "RESOLVED", exerciseOpen: "已实际停止" }];
    state.combatScholar.bottles = [{ id: "combat-scholar-potion-1", title: "旧格斗学者原瓶", source: "塔文原瓶", status: "已耗用", chance: 70, command: { type: "CONSUME", bottleId: "combat-scholar-potion-1", confirmed: true } }];
    const api = bridge(state); await enter(api);
    expect(screen.getByText("巫师 · 序列7 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看巫师成长" }));
    expect(screen.getByRole("region", { name: "巫师能力与消化" }).textContent).toContain("窥秘人与格斗学者时期的能力、消化成果及原掌握记录继续保留。只可使用实际学会的法术；有限应用不能读取思想、复制其它途径能力或保证命中，不提前开放卷轴、神秘再现与高阶窥秘之眼。");
    await userEvent.click(screen.getByRole("button", { name: "窥秘人经历" }));
    const history = within(screen.getByRole("region", { name: "窥秘人渠道经历" }));
    expect(history.getByText("原观察仍保留")).toBeTruthy();
    expect(history.getByText("旧错误报告已更正")).toBeTruthy();
    expect(history.getByText(/过度断言记录：1/)).toBeTruthy();
    expect(history.getByText("来源：莉奈原瓶")).toBeTruthy();
    for (const ability of PRYER_ABILITIES) expect(history.getByText(new RegExp(`${ability.label} · 掌握 32`))).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText(/已选择其它途径/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "格斗学者经历" }));
    const scholarHistory = within(screen.getByRole("region", { name: "格斗学者时期的经历" }));
    expect(scholarHistory.getByText("原铃实际响起")).toBeTruthy();
    expect(scholarHistory.getByText("已实际停止并报告")).toBeTruthy();
    expect(scholarHistory.getByText("来源：塔文原瓶")).toBeTruthy();
    for (const ability of COMBAT_SCHOLAR_ABILITIES) expect(scholarHistory.getByText(new RegExp(`${ability.label} · 掌握 44`))).toBeTruthy();
    expect(scholarHistory.queryByRole("button")).toBeNull(); expect(scholarHistory.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "巫师成长" }));
    expect(screen.getByRole("region", { name: "巫师成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows independent bottle provenance and public terms without unverified recipe ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "未核实原料不应显示", quantity: 1, unit: "份" }] });
    expect(screen.getByRole("region", { name: "巫师成品渠道与配方边界" }).textContent).toContain("本阶段只使用独立成品原瓶，不提供完整配方、材料或调配。每瓶来源、劳动与供应条件以公开记录为准。");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("未核实原料不应显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels with Escape or the explicit button, restores focus and confirms the exact original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶巫师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}"); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("wizard-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "巫师服用风险与四档结果" }).textContent).toContain(WIZARD_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶巫师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "wizard-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "inside"] as const)("invalidates bottle confirmation when public state becomes %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<WizardPanel wizard={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted", insideCase: change === "inside" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility instead of deriving readiness from visible resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "序列8尚未度过八个完整周。";
    rerender(<WizardPanel wizard={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶巫师魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(reason)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows three separately learned G lessons without treating promotion as learning", () => {
    panel(wizard({ promoted: true, abilities: WIZARD_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) }));
    const lessons = within(screen.getByRole("region", { name: "巫师已知法术与学习" }));
    expect(lessons.getByText("三项法术共用“法术研习”掌握记录。学习每项需1行动、60便士，知识难度12；失败后下周才能重试。已学会与否、可用条件和本次成本以公开记录和按钮为准。")).toBeTruthy();
    expect(lessons.getByText(/1行动、60便士，知识难度12/)).toBeTruthy();
    expect(lessons.getByText(/失败后下周才能重试/)).toBeTruthy();
    for (const spell of WIZARD_SPELLS) expect(lessons.getByRole("heading", { name: `${spell.label} · 尚未学会` })).toBeTruthy();
    expect(screen.getByRole("region", { name: "巫师能力与消化" }).textContent).toContain("不提前开放卷轴、神秘再现与高阶窥秘之眼");
    expect(screen.queryByRole("button", { name: /复活|卷轴|神秘再现|高阶窥秘/ })).toBeNull();
  });

  it.each(WIZARD_SPELLS)("submits the exact public $id learning intent without inventing success", async (spell) => {
    const command: WizardCommand = { type: "LEARN_SPELL", spellId: spell.id };
    const value = wizard({ promoted: true, actions: [action(command, `学习${spell.label}`, true, "1行动 · 60便士 · 知识难度12")] });
    const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^学习${spell.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(screen.getByRole("heading", { name: `${spell.label} · 尚未学会` })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: `${spell.label} · 已学会` })).toBeNull();
  });

  it("uses committed lesson flags and public eligibility through failure, next-week retry and success", async () => {
    const command: WizardCommand = { type: "LEARN_SPELL", spellId: "light-touch" };
    const reason = "本周学习未成，下周可以重新学习。";
    const value = wizard({ promoted: true, cases: cases(), actions: [{ ...action(command, "重学有限牵引", false), reason }] });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择法术实践" }), "soft-impact");
    expect((screen.getByRole("button", { name: /^重学有限牵引/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(reason)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "有限牵引 · 尚未学会" })).toBeTruthy();
    rerender(<WizardPanel wizard={{ ...value, actions: [action(command, "重学有限牵引")] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /^重学有限牵引/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(screen.getByRole("heading", { name: "有限牵引 · 尚未学会" })).toBeTruthy();
    rerender(<WizardPanel wizard={{ ...value, actions: [], lessons: value.lessons.map((lesson) => ({ ...lesson, learned: lesson.id === "light-touch" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("heading", { name: "有限牵引 · 已学会" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "短时护持 · 尚未学会" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "选择法术实践" }) as HTMLSelectElement).value).toBe("soft-impact");
    expect(screen.queryByRole("button", { name: /^重学有限牵引/ })).toBeNull();
  });

  it("passes both preparation methods unchanged and never invents observations or a result", async () => {
    const choices = (["MAGIC", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "soft-impact", method }, `选择${method}`));
    const value = wizard({ promoted: true, cases: cases(), actions: choices });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择法术实践" }), "soft-impact");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "已取得的现场观察" }).textContent).toContain("仍未确认");
    expect(screen.getByRole("region", { name: "实际方法与准备" }).textContent).toContain("不会自动生成结果");
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    rerender(<WizardPanel wizard={{ ...value, actions: [action({ type: "OBSERVE", caseId: "paper-marker" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择法术实践" }) as HTMLSelectElement).value).toBe("soft-impact");
  });

  it.each([false, true])("selects the exact open case from END after a failed practice=%s at zero AP and mind", async (failed) => {
    const { onCommand, rerender } = panel(wizard({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择法术实践" }), "soft-impact");
    const value = effectOpen(failed);
    value.actions.push(action({ type: "REPORT", caseId: "veiled-tag" }), action({ type: "REFLECT" }), action({ type: "LEARN_SPELL", spellId: "light-touch" }));
    rerender(<WizardPanel wizard={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择法术实践" }) as HTMLSelectElement;
    expect(selector.value).toBe("veiled-tag"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("效果状态：局部效果仍在，先实际结束")).toBeTruthy();
    const stop = screen.getByRole("button", { name: /^实际结束本次法术效果/ }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
    expect((screen.getByRole("button", { name: /^公开操作REPORT/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^公开操作REFLECT/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^公开操作LEARN_SPELL/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(stop);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END", caseId: "veiled-tag" });
    expect(screen.getByText("效果状态：局部效果仍在，先实际结束")).toBeTruthy();
  });

  it.each(["busy", "blocked"] as const)("keeps all effect controls locked while %s", (lock) => {
    render(<WizardPanel wizard={effectOpen()} resources={resources} busy={lock === "busy"} blocked={lock === "blocked"} onCommand={vi.fn()} />);
    expect((screen.getByRole("button", { name: /^实际结束本次法术效果/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "LEARN_SPELL", "OBSERVE", "PREPARE", "PERFORM", "END", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the same failed %s envelope and keeps committed facts unchanged", async (type) => {
    const acquiring = ["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: WizardCommand = type === "CONSUME" ? { type, bottleId: "wizard-potion-2", confirmed: true }
      : type === "POTION_WORK" || type === "BUY_POTION" ? { type, bottleId: "wizard-potion-3" }
      : type === "REFLECT" || type === "LEARN_GUIDANCE" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "LEARN_SPELL" ? { type, spellId: "light-touch" }
      : type === "PREPARE" ? { type, caseId: "veiled-tag", method: "MAGIC" }
      : { type, caseId: "veiled-tag" };
    const list = cases(); list[2]!.status = type === "REPORT" ? "EXAMINED" : type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(acquiring ? 8 : 7, { wizard: type === "CONSUME" ? bottled() : wizard({ promoted: !acquiring, cases: list, insideCase: type === "END", actions: [action(command)] }), actionsRemaining: 0, spirituality: 0, canAct: false, mind: type === "END" ? 0 : 88 });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next = { ...state, revision: state.revision + 1, wizard: { ...state.wizard, insideCase: false, actions: [] } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(next, envelope));
    api.submitIntent = submit; await enter(api); await openWizard();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶巫师魔药」" : new RegExp(`^${action(command).label}`);
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "巫师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("巫师模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "WIZARD", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    if ("caseId" in command) expect((screen.getByRole("combobox", { name: "选择法术实践" }) as HTMLSelectElement).value).toBe("veiled-tag");
  });

  it.each([false, true])("reloads an open effect after failed check=%s and unlocks only after its END receipt", async (failed) => {
    const state = fixture(7, { wizard: effectOpen(failed), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next = { ...state, revision: state.revision + 1, wizard: { ...state.wizard, insideCase: false, actions: [], cases: state.wizard.cases.map((entry) => ({ ...entry, effectOpen: "已经实际结束" })) } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "立即结束本次法术效果" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次法术效果");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) expect(button.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际结束本次法术效果/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("效果状态：局部效果仍在，先实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "WIZARD", command: { type: "END", caseId: "veiled-tag" } });
    expect(screen.getByText("效果状态：已经实际结束")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("does not infer an open effect from localized prose or EXAMINED status", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", effectOpen: "原铃已响：这里只是历史文字" };
    const api = bridge(fixture(7, { wizard: wizard({ promoted: true, cases: list }), actionsRemaining: 1 }));
    await enter(api); expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openWizard(); expect(screen.queryByRole("region", { name: "立即结束本次法术效果" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择法术实践" }) as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["RETURN", "SETTLE", "CLOSE", "STOP"] as const)("preserves older %s safety exit ahead of a simultaneous wizard effect", async (exit) => {
    const state = fixture(7, { wizard: effectOpen(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    if (exit === "RETURN" || exit === "SETTLE") state.progression = { pathwayId: "demoness", sequence: exit === "RETURN" ? 9 : 8, mastery: {}, acting: 0, promotionWeek: 5 };
    if (exit === "RETURN") state.assassin = { ...state.assassin, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "upper-draft", title: "上层原平台", story: "本人仍在原平台。", status: "EXAMINED", position: "上层平台", observations: [], preparation: null, result: "必须实际返回。" }],
      actions: [{ id: "legacy-return", label: "旧实践的普通楼梯返回", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }],
    };
    else if (exit === "SETTLE") state.instigator = { ...state.instigator, promoted: true, insideCase: true,
      cases: [{ id: "queue-grievance", title: "旧争执现场", story: "争执仍在升温。", status: "EXAMINED", tension: "仍在激化", observations: [], preparation: null, result: "必须实际停止挑动。" }],
      actions: [{ id: "legacy-settle", label: "旧实践的停止挑动", cost: "0行动", enabled: true, reason: null, command: { type: "SETTLE", caseId: "queue-grievance" } }],
    };
    else if (exit === "CLOSE") state.pryer = { ...state.pryer, insideCase: true,
      cases: [{ id: "intrusive-page", title: "旧原页", story: "原页仍打开。", status: "OBSERVED", readingOpen: "尚未合页", overclaims: 0, observations: [], preparation: null, result: "必须实际合页。" }],
      actions: [{ id: "legacy-close", label: "旧实践的实际合页", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "intrusive-page" } }],
    };
    else state.combatScholar = { ...state.combatScholar, insideCase: true,
      cases: [{ id: "halted-exercise", title: "旧演练现场", story: "演练仍未结束。", status: "OBSERVED", exerciseOpen: "仍未停止", observations: [], preparation: null, result: "必须实际停止演练。" }],
      actions: [{ id: "legacy-stop", label: "旧实践的实际停止", cost: "0行动", enabled: true, reason: null, command: { type: "STOP", caseId: "halted-exercise" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const label = exit === "RETURN" ? "旧实践的普通楼梯返回" : exit === "SETTLE" ? "旧实践的停止挑动" : exit === "CLOSE" ? "旧实践的实际合页" : "旧实践的实际停止";
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "巫师成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual(exit === "RETURN"
      ? { type: "ASSASSIN", command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }
      : exit === "SETTLE" ? { type: "INSTIGATOR", command: { type: "SETTLE", caseId: "queue-grievance" } }
      : exit === "CLOSE" ? { type: "PRYER", command: { type: "CLOSE", caseId: "intrusive-page" } }
      : { type: "COMBAT_SCHOLAR", command: { type: "STOP", caseId: "halted-exercise" } });
  });

  it("keeps a consumed failed bottle gone and confirms a different original with updated resources", async () => {
    const state = fixture(8, { wizard: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      wizard: { ...state.wizard, bottles: state.wizard.bottles.map((bottle) => bottle.id === "wizard-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.wizard.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openWizard();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶巫师魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("wizard-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
});
