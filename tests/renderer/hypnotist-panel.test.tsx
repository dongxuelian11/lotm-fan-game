/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HypnotistAction, HypnotistCommand, HypnotistProjection } from "../../src/domain/hypnotist/types";
import type { PsychologistProjection } from "../../src/domain/psychologist/types";
import { HypnotistPanel, HypnotistPsychologistHistory } from "../../src/renderer/HypnotistPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 80, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "意志24：大成功与成功可晋升；失败与大失败消耗原瓶，实际排异和污染保留，可按公开休养与补给继续恢复。";
function action(command: HypnotistCommand, label = "执行本次公开行动", enabled = true, cost = "本次公开成本"): HypnotistAction {
  return { id: JSON.stringify(command), label, enabled, cost, reason: enabled ? null : "当前公开条件尚未满足。", command };
}
const learn = action({ type: "LEARN_GUIDANCE" }, "听取催眠师成品用药指导", true, "360便士 · 1行动");
function hypnotist(patch: Partial<HypnotistProjection> = {}): HypnotistProjection {
  return {
    title: "催眠师晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [], acting: 0,
    digestion: "心理医生扮演100，已度过12/12个完整序列7周。", pollution: 3,
    risk, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function cases(): HypnotistProjection["cases"] {
  return [
    { id: "focused-reading", title: "本人同意的短专注", story: "本人愿意在集中注意后做一次短时阅读练习，可以随时停止。" },
    { id: "protected-choice", title: "保管责任与真实拒绝", story: "本人最重视保管原物的责任，不能把这份重视当成必然服从的理由。" },
    { id: "unnoticed-passage", title: "不引人注意的短通道", story: "心理学隐身练习中身体仍在场，须避开原物；讲话会立即结束效果。" },
  ].map((entry) => ({ ...entry, status: "AVAILABLE", observations: [], preparation: null, result: null, contactOpen: "尚未开始本次接触", closes: 0 }));
}
function bottled(): HypnotistProjection {
  const originals = [
    { id: "hypnotist-potion-1", title: "第一瓶催眠师魔药", source: "原渠道第一瓶成品，五步劳务后付款取得", chance: 71 },
    { id: "hypnotist-potion-2", title: "第二瓶催眠师魔药", source: "原渠道第二瓶成品，独立采购记录", chance: 43 },
    { id: "hypnotist-potion-3", title: "第三瓶催眠师魔药", source: "原渠道第三瓶成品，独立封装记录", chance: 61 },
  ];
  return hypnotist({ guidanceKnown: true,
    supplies: "原三瓶独立成品，每瓶3320便士或五步劳务后320便士，下一周补货；不提供未核实的完整配方。",
    actions: originals.map((bottle) => action({ type: "CONSUME", bottleId: bottle.id, confirmed: true }, `服用${bottle.id}`, true, "0行动 · 独立确认 · 消耗这一原瓶")),
    bottles: originals.map((bottle): HypnotistProjection["bottles"][number] => ({ ...bottle, status: "已取得，尚未服用", command: { type: "CONSUME", bottleId: bottle.id, confirmed: true } })),
  });
}
const refusal = "首次明确拒绝：原柜的保管是我最重视的责任，我不同意离开或交出钥匙。";
const newFact = "下一周本人明确表示：可以旁观说明，但我继续保管原柜与钥匙，不交出保管责任。";
function opened(): HypnotistProjection {
  return hypnotist({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "protected-choice" ? {
      ...entry, status: "OBSERVED", observations: ["本人当面说明了最重视的保管责任，原柜与钥匙仍在。", refusal],
      result: "本次要求被明确拒绝，保管人没有离开，原钥匙仍由本人持有。", contactOpen: "本次接触尚未实际结束",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "protected-choice" }, "实际结束被拒绝的保管交谈", true, "0行动 · 0精神 · 0灵性")],
  });
}
function panel(value: HypnotistProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<HypnotistPanel hypnotist={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
afterEach(cleanup);

describe("Hypnotist public consent, bounded effects and original-bottle confirmation", () => {
  it("shows the public S7 maturity gate and sourced finished supply without inventing an unknown formula", () => {
    const reason = "心理医生扮演100；晋升后11/12个完整周，尚未满足成熟条件。";
    const supplies = "三瓶独立成品由原指导者保管，本瓶已完成4/5步劳务。";
    const value = hypnotist({ digestion: reason, supplies, formula: [{ name: "未核实材料不得显示", quantity: 100, unit: "克" }], actions: [{ ...learn, enabled: false, reason }] });
    const { onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "催眠师成长下一步" }).textContent).toContain(reason);
    expect(screen.getByText(supplies)).toBeTruthy();
    const button = screen.getByRole("button", { name: /^听取催眠师成品用药指导/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(screen.queryByText("未核实材料不得显示")).toBeNull();
    expect(screen.getByText("尚未掌握完整魔药配方与剂量，指导仅说明有来源的独立成品原瓶。催眠与心理学隐身只按当前公开条件使用，不能保证控制他人或证明供词真相。具体故事、判定、费用与消化数值以当前说明为准。", { exact: true })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("forwards exact public guidance, per-bottle labour, payment and resupply commands with public costs", async () => {
    const commands: HypnotistCommand[] = [{ type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "hypnotist-potion-3" },
      { type: "BUY_POTION", bottleId: "hypnotist-potion-3" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }];
    const labels = ["听取成品指导", "完成第三瓶第五步劳务", "支付第三瓶余款", "申请下一批成品", "登记实际到货"];
    const costs = ["360便士 · 1行动", "1行动 · 劳务5/5 · 抵扣3000便士", "320便士 · 0行动", "1行动 · 下周到货", "0行动"];
    const { onCommand } = panel(hypnotist({ actions: commands.map((command, index) => action(command, labels[index]!, true, costs[index]!)) }));
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    for (const cost of costs) expect(screen.getByText(cost)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels an original-bottle confirmation at zero AP and returns keyboard focus without submitting", async () => {
    const { onCommand } = panel(bottled());
    const open = screen.getByRole("button", { name: "查看并准备服用「第一瓶催眠师魔药」" });
    open.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶催眠师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第一瓶催眠师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶催眠师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "查看并准备服用「第三瓶催眠师魔药」" }));
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows exact source, risk and current resources before independently confirming only the selected bottle once", async () => {
    const value = bottled(); const { onCommand } = panel(value);
    expect(screen.getByText(value.supplies)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶催眠师魔药」" }));
    expect(screen.getByText("hypnotist-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("来源：原渠道第二瓶成品，独立采购记录")).toBeTruthy();
    expect(screen.getByRole("region", { name: "催眠师服用风险与四档结果" }).textContent).toContain(risk);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 80", "3", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶催眠师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "hypnotist-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("retains the same submitted original through save failure and leaves envelope retry to the outer owner", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶催眠师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶催眠师魔药」" }));
    const error = { message: "本次服药尚未保存，可重试同一操作。", retryable: true };
    rerender(<HypnotistPanel hypnotist={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect(screen.getByRole("region", { name: "这瓶催眠师魔药的服用确认" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶催眠师魔药」" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("hypnotist-potion-1")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
    rerender(<HypnotistPanel hypnotist={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("preserves a committed failed original as history and independently offers the remaining bottles", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第一瓶催眠师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶催眠师魔药」" }));
    const failed = { ...value, actions: value.actions.slice(1), bottles: value.bottles.map((bottle, index) => index === 0 ? { ...bottle, status: "已耗用 · 原失败与排异保留" } : bottle) };
    rerender(<HypnotistPanel hypnotist={failed} resources={{ ...resources, health: 66, mind: 68 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("已耗用 · 原失败与排异保留")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看并准备服用「第一瓶催眠师魔药」" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第二瓶催眠师魔药」" }));
    expect(screen.getByText("66 / 100")).toBeTruthy(); expect(screen.getByText("68 / 100")).toBeTruthy();
    expect(screen.getByText("hypnotist-potion-2")).toBeTruthy(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("ends confirmation only when a committed promotion arrives and preserves the consumed original", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: "查看并准备服用「第三瓶催眠师魔药」" }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第三瓶催眠师魔药」" }));
    const promoted = { ...value, promoted: true, actions: [], cases: cases(), bottles: value.bottles.map((bottle, index) => index === 2 ? { ...bottle, status: "原瓶已耗用 · 已晋升催眠师" } : bottle) };
    rerender(<HypnotistPanel hypnotist={promoted} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶催眠师魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "催眠师能力与消化" })).toBeTruthy();
    expect(screen.getByText("原瓶已耗用 · 已晋升催眠师")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用|查看并准备服用/ })).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("selects cases and forwards only their exact public commands without optimistic preparation or agreement", async () => {
    const commands: HypnotistCommand[] = [{ type: "OBSERVE", caseId: "unnoticed-passage" },
      { type: "PREPARE", caseId: "unnoticed-passage", method: "ORDINARY" },
      { type: "PREPARE", caseId: "unnoticed-passage", method: "ABILITY" },
      { type: "PERFORM", caseId: "unnoticed-passage" }, { type: "WITHDRAW", caseId: "unnoticed-passage" }, { type: "REPORT", caseId: "unnoticed-passage" }];
    const labels = ["核对短通道与原物", "准备普通通行对照", "准备心理学隐身练习", "实际进行有限练习", "撤回待执行准备", "提交有限报告"];
    const { onCommand } = panel(hypnotist({ promoted: true, cases: cases(), actions: commands.map((command, index) => action(command, labels[index]!)) }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "focused-reading");
    expect(screen.queryByRole("button", { name: /^实际进行有限练习/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox"), "unnoticed-passage");
    for (const label of labels) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands);
    expect(screen.getByRole("region", { name: "有限练习与准备" }).textContent).toContain("当前没有待执行的练习");
    expect(screen.queryByRole("region", { name: "本人回应与实际结果" })).toBeNull();
  });

  it("keeps the true first refusal through actual CLOSE, new evidence, revision and a later failed attempt", async () => {
    const value = opened(); const { onCommand, rerender } = panel(value);
    expect(screen.getByText(refusal)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束被拒绝/ }));
    expect(screen.getByText(refusal)).toBeTruthy();
    const closed = { ...value, insideCase: false, actions: [action({ type: "PREPARE", caseId: "protected-choice", method: "ABILITY" }, "按下周本人回应修订旁观说明")],
      cases: value.cases.map((entry) => entry.id === "protected-choice" ? { ...entry, contactOpen: "已实际结束", closes: 1, observations: [...entry.observations, newFact] } : entry) };
    rerender(<HypnotistPanel hypnotist={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(refusal)).toBeTruthy(); expect(screen.getByText(newFact)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^按下周本人回应修订/ }));
    expect(screen.getByRole("region", { name: "本人回应与实际结果" }).textContent).toContain("本次要求被明确拒绝");
    const revised = { ...closed, cases: closed.cases.map((entry) => entry.id === "protected-choice" ? {
      ...entry, preparation: "只作旁观说明，不离开、不交出原钥匙；仍须本人自主评估。", result: "修订的旁观说明仍未完成，保留原拒绝与本次失败。",
    } : entry) };
    rerender(<HypnotistPanel hypnotist={revised} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText(refusal)).toBeTruthy(); expect(screen.getByText(newFact)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本人回应与实际结果" }).textContent).toContain("修订的旁观说明仍未完成");
    expect(screen.getByRole("region", { name: "有限练习与准备" }).textContent).toContain("仍须本人自主评估");
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([{ type: "CLOSE", caseId: "protected-choice" }, { type: "PREPARE", caseId: "protected-choice", method: "ABILITY" }]);
  });

  it("selects the actual open case and exposes only its authoritative CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(hypnotist({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "unnoticed-passage");
    const value = opened();
    rerender(<HypnotistPanel hypnotist={{ ...value, actions: [action({ type: "CLOSE", caseId: "focused-reading" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "protected-choice" }, "不可提前报告"), action({ type: "WITHDRAW", caseId: "protected-choice" }, "不可撤回代替结束"),
      action({ type: "REFLECT" }, "不可提前反思"), action({ type: "ENCOUNTER_TALK" }, "不可提前赴后门"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("protected-choice"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束被拒绝/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(close.textContent).toContain("0行动 · 0精神 · 0灵性");
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "protected-choice" });
    expect(screen.getByText(refusal)).toBeTruthy();
    expect(screen.getByText(/本次接触尚未实际结束/)).toBeTruthy();
  });

  it("does not manufacture CLOSE from prose or treat old refusal text as an active contact", async () => {
    const value = { ...opened(), actions: [] }; const { onCommand, rerender } = panel(value);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "催眠师成长下一步" }).textContent).toContain("查看当前公开结束选项");
    // Without a public CLOSE, refusal prose must not select an allegedly active case.
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("focused-reading");
    rerender(<HypnotistPanel hypnotist={{ ...value, insideCase: false }} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox"), "protected-choice");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(refusal)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("disables public interactions while busy, blocked or waiting on a save error without changing resources", () => {
    const value = hypnotist({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "focused-reading" }, "核对本人同意与注意条件"), action({ type: "REFLECT" }, "复盘实际结果")] });
    const { onCommand, rerender } = panel(value);
    for (const props of [{ busy: true }, { busy: false, blocked: true }, { busy: false, error: { message: "保存失败", retryable: true } }]) {
      rerender(<HypnotistPanel hypnotist={value} resources={resources} onCommand={onCommand} {...props} />);
      expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
      for (const button of screen.getAllByRole("button")) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
      expect(screen.getByText("灵性 12 / 80 · 污染 3")).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps focused attention and interrupted invisibility distinct, with only public mastery and actual results", async () => {
    const abilities = [{ id: "audience.s6.hypnosis", label: "有限催眠", mastery: 23, description: "需要本人集中注意，可以抵抗或停止。" },
      { id: "audience.s6.psychological-invisibility", label: "心理学隐身", mastery: 41, description: "身体仍在，讲话即结束效果。" }];
    const focusResult = "本人同意并集中注意后完成了短时阅读，随后主动停止；不证明任何供词。";
    const passageResult = "你一开口，心理学隐身立即结束；原木箱仍在，身体绕开了原箱。";
    panel(hypnotist({ promoted: true, acting: 100, abilities, actions: [], cases: cases().map((entry) => ({
      ...entry, result: entry.id === "focused-reading" ? focusResult : entry.id === "unnoticed-passage" ? passageResult : null,
    })) }));
    expect(screen.getByText("有限催眠 · 掌握 23")).toBeTruthy(); expect(screen.getByText("心理学隐身 · 掌握 41")).toBeTruthy();
    const boundary = screen.getByRole("region", { name: "催眠师能力边界" });
    for (const text of ["三项主实践可和平完成", "本人同意并集中注意", "身体仍在场", "讲话会立即结束", "本人随时可以停止", "不是真实治疗", "不能据此认定供词为真"])
      expect(boundary.textContent).toContain(text);
    expect(screen.getByText(focusResult)).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole("combobox"), "unnoticed-passage");
    expect(screen.getByText(passageResult)).toBeTruthy(); expect(screen.queryByText(focusResult)).toBeNull();
    expect(screen.queryByRole("button", { name: /控制|供词|永久|穿透/ })).toBeNull();
    expect(document.querySelector("audio, [data-controlled], .hypnotist-success")).toBeNull();
  });

  it("keeps the optional back-door encounter separate from three cases and forwards talk or ordinary combat choices", async () => {
    const talk = action({ type: "ENCOUNTER_TALK" }, "与后门罗温交涉", true, "1行动 · 按实际条件交涉");
    const fight = action({ type: "ENCOUNTER_FIGHT" }, "赴后门承担普通短棍战", true, "1行动 · 真实战斗风险");
    const environment = "原后门有2米可见净空通路；原货物仍属于货主。";
    const { onCommand } = panel(hypnotist({ promoted: true, cases: cases(), actions: [talk, fight], environment }));
    expect(screen.getAllByRole("option")).toHaveLength(3); expect(screen.getByText(environment)).toBeTruthy();
    const encounter = within(screen.getByRole("region", { name: "有限后门冲突" }));
    await userEvent.click(encounter.getByRole("button", { name: /^与后门罗温交涉/ }));
    await userEvent.click(encounter.getByRole("button", { name: /^赴后门承担普通短棍战/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([talk.command, fight.command]);
    expect(screen.queryByRole("region", { name: "本人回应与实际结果" })).toBeNull();
    expect(screen.getByText(environment)).toBeTruthy();
  });

  it("preserves S7 completed stories, observations, original IDs and bottles as read-only history", () => {
    const psychologist: PsychologistProjection = {
      title: "心理医生", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
      supplies: "原心理医生库存与耗用记录保留。", story: "原后门会谈已和平收尾。", environment: "原支持情境已结束。",
      scenes: [{ id: "night-watch", title: "原夜班会谈", story: "原支持尝试失败，实际消耗保留；下周普通交谈后完成。", status: "已完成，原失败保留",
        observations: ["当时本人拒绝继续支持。"], impression: "当时的浅层印象，未经核实不能当事实。", consent: false }],
      actions: [{ id: "old-reflect", label: "不可重新执行旧成长", enabled: true, reason: null, cost: "1行动", command: { type: "REFLECT" } }],
      bottles: [{ id: "psychologist-old", title: "心理医生旧原瓶", source: "心理医生原独立成品渠道", status: "已耗用 · 原失败保留", chance: 0, command: { type: "CONSUME", bottleId: "psychologist-old", confirmed: true } }],
      abilities: [{ id: "audience.s7.soothe", label: "原安抚", mastery: 67, description: "保留原本人同意与有限支持条件。" }],
      acting: 100, digestion: "已消化", pollution: 4, risk: "原四档风险记录",
    };
    render(<HypnotistPsychologistHistory psychologist={psychologist} />);
    const history = within(screen.getByRole("region", { name: "心理医生时期的经历" }));
    expect(history.getByText("原支持尝试失败，实际消耗保留；下周普通交谈后完成。")).toBeTruthy();
    expect(history.getByText("当时本人拒绝继续支持。")).toBeTruthy();
    expect(history.getByText("原情境ID：night-watch")).toBeTruthy(); expect(history.getByText("原瓶ID：psychologist-old")).toBeTruthy();
    expect(history.getByText("来源：心理医生原独立成品渠道")).toBeTruthy();
    expect(history.getByText("已耗用 · 原失败保留")).toBeTruthy();
    expect(history.getByText("原安抚 · 掌握 67：保留原本人同意与有限支持条件。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
  });
});
