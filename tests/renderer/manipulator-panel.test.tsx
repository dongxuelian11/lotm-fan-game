/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManipulatorAction, ManipulatorCommand, ManipulatorProjection } from "../../src/domain/manipulator/types";
import { MANIPULATOR_CONSUMPTION_RISK, MANIPULATOR_DONORS, MANIPULATOR_FORMULA, MANIPULATOR_FORMULA_ALTERNATIVES } from "../../src/domain/manipulator/content";
import type { DreamwalkerProjection } from "../../src/domain/dreamwalker/types";
import { ManipulatorDreamwalkerHistory, ManipulatorPanel } from "../../src/renderer/ManipulatorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const resources: SeerResources = { health: 76, maxHealth: 100, mind: 88, maxMind: 100, spirituality: 12, maxSpirituality: 120, cash: "2镑 3苏勒 4便士", actionsRemaining: 0 };
function action(command: ManipulatorCommand, label = "执行当前公开行动", enabled = true, cost = "当前公开成本"): ManipulatorAction {
  return { id: JSON.stringify(command), label, command, enabled, cost, reason: enabled ? null : "当前实际条件尚未满足。" };
}
function ritual(): ManipulatorProjection["ritual"] {
  return { title: "四区原纪念集会", status: "尚未预约", venue: "原礼堂容量12000，原出口已知", appointment: "尚无预约", emotion: "尚无本次共同情绪",
    actualPresent: 0, registeredCount: 12000, requiredCount: 10000, currentEventId: null, windowOpen: false,
    groups: (["MP4-NORTH", "MP4-EAST", "MP4-SOUTH", "MP4-WEST"] as const).map((id, index) => ({ id, title: ["北区代表团", "东区代表团", "南区代表团", "西区代表团"][index]!, source: "互不重复的原成年成员", registeredCount: 3000, presentCount: 0, arrivedCount: 0, location: "当前在原城区", emotion: "尚无本次共鸣", arrival: "尚未实际到场" })), history: [] };
}
function life(): ManipulatorProjection["life"] {
  return { title: "自愿心灵、有限人格与普通图解", source: "三项有限原创G场景", environment: "原人、原板、原铃、原纸与原账簿分别记录。", insideCase: false, reflected: false,
    practice: { activeCase: null, contact: "NONE", consent: false, persona: null, personaHistory: [], createdPersonas: 0, totalMindSpent: 0,
      paper: { id: "MP4-COMPARISON-PAPER", holder: "DESK" }, board: { id: "MP4-LOCKED-BOARD", locked: true, marking: "THREE_BLUE_LINES" },
      bell: { id: "MP4-ORIGINAL-BELL", marking: "THREE_NOTCHES" }, ledger: { id: "MP4-ORIGINAL-LEDGER", entry: "PARCEL_SHELF_B" },
      parcel: { id: "MP4-PARCEL", location: "SHELF_B" }, diagram: { id: "MP4-INERT-DIAGRAM", nature: "ORDINARY_INERT_PAPER", infections: 0 } },
    cases: ([
      { id: "consenting-island", title: "原米拉与错归档包裹", story: "31岁原米拉只允许接触当前担心，仍须现实复核。" },
      { id: "divided-attention", title: "同一原板、原铃与人格", story: "一位人格关注原板，本人查看原铃，没有独立肉身。" },
      { id: "plague-model", title: "没有感染的普通图解", story: "成年教员与玩家只比较普通纸面假想连线。" },
    ] as const).map((entry) => ({ ...entry, observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: false, returned: false, closes: 0 })) };
}
function encounter(): ManipulatorProjection["encounter"] {
  return { title: "原鲁兰的可选仓库冲突", story: "40岁原鲁兰持自己的原棍，二米净空原地面与普通出口已知。", status: "AVAILABLE", inside: false,
    enemy: { id: "MP4-RULAN", name: "鲁兰", age: 40, source: "ORIGINAL_WAREHOUSE_WATCHER", health: 100, mind: 100, status: "RESISTING", weaponId: "MP4-RULAN-CLUB", weaponLocation: "HAND" }, mentalPlague: 0, helpHistory: [], actions: [] };
}
function batches(): ManipulatorProjection["batches"] {
  return [1, 2, 3].map((number) => ({ id: `manipulator-batch-${number}`, title: `第${number}批操纵师原材料`, source: `原供应方第${number}批封签`, status: "三种原材料已实际取得", labourSteps: 5, price: 900,
    materials: [
      { id: `heart-${number}`, name: "树人导师的结晶之心", quantity: 1, unit: "颗", status: "玩家持有" },
      { id: `blood-${number}`, name: "老年心灵巨龙的血液", quantity: 80, unit: "毫升", status: "玩家持有" },
      { id: `leaves-${number}`, name: "树人导师的金色树叶", quantity: 3, unit: "片", status: "玩家持有" },
    ], tears: [], bottleId: null }));
}
function projection(patch: Partial<ManipulatorProjection> = {}): ManipulatorProjection {
  return { title: "操纵师之路", discovered: true, guidanceKnown: true, promoted: false, formulaKnown: true,
    formula: MANIPULATOR_FORMULA.map((entry) => ({ ...entry })), formulaAlternatives: MANIPULATOR_FORMULA_ALTERNATIVES,
    story: "原著能力与原创G有限场景分别保留。", supplies: "三批独立原材料，购买不包含七滴泪水。", actions: [], batches: batches(),
    donors: MANIPULATOR_DONORS.map((entry) => ({ ...entry, consent: "本次原会面自愿赠出一滴", willing: true, collectedBatchIds: [] })),
    bottles: [], abilities: [], acting: 0, digestion: "梦境行者消化100，晋升后已过12/12整周。", pollution: 3, risk: MANIPULATOR_CONSUMPTION_RISK,
    ritual: ritual(), life: life(), encounter: encounter(), insideCase: false, environment: "原会所与原礼堂", ...patch };
}
const consume = action({ type: "CONSUME", bottleId: "manipulator-potion-2", confirmed: true }, "核对并服用第二原瓶", true, "0行动 · 消耗这一原瓶并散场");
const leave = action({ type: "LEAVE_GATHERING" }, "实际散场，让四区原成员回家", true, "0行动 · 原费用不退");
function gathered(): ManipulatorProjection {
  const value = projection({ actions: [consume, leave], insideCase: true });
  value.ritual = { ...value.ritual, currentEventId: "MP4-RITE-2", status: "本周实际在原礼堂", appointment: "第79周预约，第80周实际赴会", actualPresent: 12000, windowOpen: true, emotion: "原成员自愿讲述纪念与互助，实际同场共鸣",
    groups: value.ritual.groups.map((group) => ({ ...group, presentCount: 3000, arrivedCount: 3000, location: "当前在原礼堂", emotion: "本次共同情绪共鸣", arrival: "本次实际入场3000人" })) };
  value.bottles = [{ id: "manipulator-potion-2", title: "第二瓶操纵师魔药", source: "本批三种材料与七滴独立原泪滴已实际消耗", status: "玩家持有，尚未服用", chance: 43, command: consume.command }];
  return value;
}
function panel(value: ManipulatorProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ManipulatorPanel manipulator={value} resources={resources} busy={false} onCommand={onCommand} />) };
}
async function openBottle() { await userEvent.click(screen.getByRole("button", { name: /^核对并服用第二原瓶/ })); }
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Manipulator real ingredients, voluntary tears, present crowds and bounded mental contact", () => {
  it("shows the complete verified formula after guidance, with exact alternatives and no invented mass", () => {
    const value = projection(); const { rerender } = panel(value);
    const formula = screen.getByRole("region", { name: "操纵师完整配方与开放分支" });
    expect(formula.textContent).toContain("老年心灵巨龙的完整大脑");
    expect(formula.textContent).toContain("树人导师的结晶之心");
    expect(formula.textContent).toContain("操纵师非凡特性");
    expect(formula.textContent).toContain("80 毫升"); expect(formula.textContent).toContain("3 片");
    expect(formula.textContent).toContain("七名不同"); expect(formula.textContent).toContain("人各1滴");
    expect(formula.textContent).toContain("没有纯水"); expect(formula.textContent).toContain("不另编重量");
    expect(formula.textContent).not.toMatch(/\d+\s*(克|千克)/);
    rerender(<ManipulatorPanel manipulator={{ ...value, guidanceKnown: false, formulaKnown: false, formula: [{ name: "尚未公开的配方项", quantity: 99, unit: "份" }] }} resources={resources} busy={false} onCommand={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "操纵师完整配方与开放分支" })).toBeNull();
    expect(screen.queryByText("尚未公开的配方项")).toBeNull();
  });

  it("separates batch payment, each of seven original donors and actual brewing without optimistic inventory", async () => {
    const batchId = "manipulator-batch-2";
    const commands: ManipulatorCommand[] = [{ type: "MATERIAL_WORK", batchId }, { type: "BUY_MATERIALS", batchId },
      ...MANIPULATOR_DONORS.map((donor): ManipulatorCommand => ({ type: "COLLECT_TEAR", batchId, donorId: donor.id })), { type: "BREW", batchId }];
    const labels = ["核对本批原封签", "购买本批三种原材料", ...MANIPULATOR_DONORS.map((donor) => `实际拜访${donor.name}并取得本批一滴`), "实际消耗十件原物并调配原瓶"];
    const value = projection({ actions: commands.map((command, index) => action(command, labels[index]!, index < 9)) });
    const { onCommand } = panel(value);
    const batch = screen.getByRole("article", { name: "当前原材料批次" });
    expect(batch.textContent).toContain(batchId); expect(batch.textContent).toContain("本批实际泪滴 0 / 7");
    expect(batch.textContent).toContain("80 毫升"); expect(batch.textContent).toContain("3 片");
    await userEvent.click(screen.getByRole("button", { name: /^购买本批三种/ }));
    for (const donor of MANIPULATOR_DONORS) {
      const group = screen.getByLabelText(`${donor.name}的原故事与当前同意`);
      await userEvent.click(within(group).getByText(new RegExp(`^${donor.name} ·`)));
      expect(group.textContent).toContain(donor.story); expect(group.textContent).toContain(donor.location);
      expect(group.textContent).toContain(`${donor.age}岁`); expect(group.textContent).toContain("当前自愿");
      await userEvent.click(within(group).getByRole("button"));
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(commands.slice(1, 9));
    expect(batch.textContent).toContain("本批实际泪滴 0 / 7");
    expect((screen.getByRole("button", { name: /^实际消耗十件/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps fresh batch identity and current donor refusal rather than reusing another batch's drop", async () => {
    const value = projection({ actions: [action({ type: "COLLECT_TEAR", batchId: "manipulator-batch-3", donorId: "MP4-D1" }, "再次实际拜访艾琳", false)] });
    value.donors[0]!.willing = false; value.donors[0]!.consent = "本次婉拒，不能采集"; value.donors[0]!.collectedBatchIds = ["manipulator-batch-1"];
    const { onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前材料批次" }), "manipulator-batch-3");
    const donor = screen.getByLabelText("艾琳的原故事与当前同意"); await userEvent.click(within(donor).getByText(/^艾琳 ·/));
    expect(donor.textContent).toContain("本批尚未取得"); expect(donor.textContent).toContain("本次婉拒");
    fireEvent.click(within(donor).getByRole("button")); expect(onCommand).not.toHaveBeenCalled();
  });

  it("distinguishes registered, ever arrived and currently present while preserving the zero-action exit", async () => {
    const value = gathered(); value.ritual.actualPresent = 9000; value.ritual.windowOpen = false;
    value.ritual.groups[3] = { ...value.ritual.groups[3]!, presentCount: 0, location: "当前在原城区", emotion: "尚无本次共鸣" };
    value.actions = [{ ...consume, enabled: false, reason: "当前实际在场9000人，不满10000人。" }, leave];
    const { onCommand } = panel(value);
    const gathering = screen.getByRole("region", { name: "操纵师当前实际聚会" });
    expect(gathering.textContent).toContain("9000 / 至少 10000 人"); expect(gathering.textContent).toContain("12000 人，登记不等于到场");
    expect(gathering.textContent).toContain("当前没有合格共鸣窗口");
    expect(screen.getByLabelText("西区代表团实际到场记录").textContent).toContain("当前实际在场 0 人 · 本次实际到过 3000 人");
    expect((screen.getByRole("button", { name: /^核对并服用/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际散场/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(leave.command);
  });

  it("forwards four distinct arrivals and a separately gated common-emotion action", async () => {
    const value = projection();
    value.actions = [...value.ritual.groups.map((group) => action({ type: "ARRIVE_GROUP", groupId: group.id }, `让${group.title}实际入场`, true, "0行动")),
      action({ type: "RESONATE" }, "以自愿纪念故事尝试本次共鸣", false, "0行动 · 本场一次")];
    const { onCommand } = panel(value);
    for (const group of value.ritual.groups) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^让${group.title}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(value.actions.slice(0, 4).map((entry) => entry.command));
    expect((screen.getByRole("button", { name: /^以自愿纪念/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "操纵师当前实际聚会" }).textContent).toContain("0 / 至少 10000 人");
  });

  it("reviews the exact original bottle, current crowd and public chance before confirmation", async () => {
    const value = gathered(); const { onCommand } = panel(value); await openBottle();
    const review = screen.getByRole("region", { name: "这瓶操纵师魔药的服用确认" });
    expect(review.textContent).toContain("manipulator-potion-2"); expect(review.textContent).toContain("MP4-RITE-2");
    expect(review.textContent).toContain("12000 / 至少 10000 人"); expect(review.textContent).toContain("43%");
    expect(review.textContent).toContain(MANIPULATOR_CONSUMPTION_RISK);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第二瓶操纵师魔药" }));
    expect(onCommand).not.toHaveBeenCalled(); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "这瓶操纵师魔药的服用确认" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^核对并服用第二原瓶/ }));
    await openBottle(); await userEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶操纵师魔药」" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command);
  });

  it("locks the submitted intent across double clicks, save errors, Escape and outer retries", async () => {
    const value = gathered(); const { onCommand, rerender } = panel(value); await openBottle();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶操纵师魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    const error = { message: "本次保存失败，请重试原操作。", retryable: true };
    rerender(<ManipulatorPanel manipulator={value} resources={resources} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain(error.message);
    expect((screen.getByRole("button", { name: /^暂不服用/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); fireEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶操纵师魔药」" }));
    expect(screen.getByText("manipulator-potion-2")).toBeTruthy(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    rerender(<ManipulatorPanel manipulator={value} resources={resources} busy={true} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("button", { name: "正在结算并保存…" })).toBeTruthy();
    rerender(<ManipulatorPanel manipulator={value} resources={resources} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第二瓶操纵师魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("uses live public eligibility, dismisses revoked consumption and retains committed failure history", async () => {
    const value = gathered(); const { onCommand, rerender } = panel(value); await openBottle();
    const disabled = { ...value, actions: [{ ...consume, enabled: false, reason: "当前共同情绪窗口已失效。" }, leave], bottles: value.bottles.map((bottle) => ({ ...bottle, chance: 17 })) };
    rerender(<ManipulatorPanel manipulator={disabled} resources={{ ...resources, health: 0, mind: 0 }} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("17%")).toBeTruthy(); expect(screen.getByText("当前共同情绪窗口已失效。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认服用「第二瓶操纵师魔药」" })); expect(onCommand).not.toHaveBeenCalled();
    const failed = { ...value, actions: [], bottles: value.bottles.map((bottle) => ({ ...bottle, status: "已耗用，原失败与排异保留" })),
      ritual: { ...ritual(), history: [{ id: "MP4-RITE-2", summary: "12000人曾实际到场，原瓶失败后全体实际回家。" }] } };
    rerender(<ManipulatorPanel manipulator={failed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶操纵师魔药的服用确认" })).toBeNull();
    expect(screen.getByText("已耗用，原失败与排异保留")).toBeTruthy();
    expect(screen.getByRole("region", { name: "操纵师当前实际聚会" }).textContent).toContain("0 / 至少 10000 人");
    expect(screen.getByText(/12000人曾实际到场/)).toBeTruthy();
  });

  it("shows explicit current consent and keeps zero-action mental stopping available at zero resources", async () => {
    const stop = action({ type: "STOP" }, "停止原米拉心灵接触", true, "0行动 · 不退款");
    const verify = action({ type: "VERIFY", caseId: "consenting-island" }, "退出后实际复核原账簿与原包裹", false, "0行动");
    const value = projection({ promoted: true, actions: [stop, verify], insideCase: true });
    value.life.insideCase = true; value.life.practice.activeCase = "consenting-island"; value.life.practice.contact = "MIRA_MIND"; value.life.practice.consent = true;
    value.life.cases[0] = { ...value.life.cases[0]!, status: "ACTIVE", contactOpen: true, result: "已付3灵性，当前接触失败；没有线索，仍须停止。" };
    const onCommand = vi.fn(); render(<ManipulatorPanel manipulator={value} resources={{ ...resources, health: 0, mind: 0, spirituality: 0 }} busy={false} onCommand={onCommand} />);
    const current = screen.getByRole("region", { name: "操纵师当前心灵接触与原物" });
    expect(current.textContent).toContain("米拉仅同意本次当前问题"); expect(current.textContent).toContain("MP4-ORIGINAL-LEDGER"); expect(current.textContent).toContain("MP4-PARCEL");
    expect(screen.getByRole("region", { name: "操纵师实际生活结果" }).textContent).toContain("当前接触失败");
    expect((screen.getByRole("combobox", { name: "选择当前生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^退出后实际复核/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^停止原米拉/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(stop.command);
    expect(current.textContent).toContain("仍在原米拉的心灵接触中");
  });

  it("shows one real persona, preserves its cost and requires separate rejoining and original-paper return", async () => {
    const rejoin = action({ type: "WITHDRAW_PERSONA" }, "明确重归同一人格", true, "0行动 · 无退款");
    const paper = action({ type: "RETURN_PAPER" }, "亲手归还同一比较纸", true, "0行动");
    const value = projection({ promoted: true, actions: [rejoin, paper], insideCase: true });
    value.life.insideCase = true; const practice = value.life.practice; practice.activeCase = "divided-attention"; practice.paper.holder = "OWNER";
    practice.createdPersonas = 1; practice.totalMindSpent = 2;
    practice.persona = { id: "MP4-P1", source: "OWNER_MIND", createdWeek: 82, rejoinedWeek: null, status: "ACTIVE", taskAttempted: true, taskDone: false };
    value.life.cases[1] = { ...value.life.cases[1]!, status: "ACTIVE", contactOpen: true };
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "操纵师当前心灵接触与原物" }).textContent).toContain("MP4-P1 · 当前仍未重归本人 · 本次观察失败");
    expect(screen.getByText(/实际创建记录/).parentElement?.textContent).toContain("1 位 · 已实际付出本人精神 2");
    await userEvent.click(screen.getByRole("button", { name: /^明确重归/ })); await userEvent.click(screen.getByRole("button", { name: /^亲手归还/ }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([rejoin.command, paper.command]);
    const closed = structuredClone(value); closed.actions = []; closed.life.insideCase = false; closed.life.practice.activeCase = null;
    closed.life.practice.personaHistory = [{ ...practice.persona!, status: "REJOINED", rejoinedWeek: 82 }]; closed.life.practice.persona = null; closed.life.practice.paper.holder = "DESK";
    rerender(<ManipulatorPanel manipulator={closed} resources={resources} busy={false} onCommand={onCommand} />);
    expect(screen.getByText("当前没有在外的虚拟人格")).toBeTruthy(); expect(screen.getByText(/第82周已重归/).textContent).toContain("原观察失败保留");
    expect(screen.getByText(/已实际付出本人精神 2/)).toBeTruthy();
  });

  it("labels the ordinary diagram as inert with no real infection or ability practice", async () => {
    const value = projection({ promoted: true, actions: [action({ type: "PREPARE", caseId: "plague-model", method: "ORDINARY" }, "准备普通图解比较", true, "1行动 · 不加能力掌握")] });
    value.abilities = [{ id: "audience.s4.mental-plague", label: "精神瘟疫", mastery: 0, description: "实际作用仅在另行选择的原仓库冲突。" }];
    const { onCommand } = panel(value);
    const current = screen.getByRole("region", { name: "当前操纵师生活实践" });
    expect(current.textContent).toContain("这是普通教学模拟"); expect(current.textContent).toContain("不产生感染，也不增加任何能力掌握");
    expect(screen.getByRole("region", { name: "操纵师当前心灵接触与原物" }).textContent).toContain("MP4-INERT-DIAGRAM · 无生命静物 · 实际感染 0");
    expect(screen.queryByRole("button", { name: /感染|施放精神瘟疫/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^准备普通图解/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(screen.getByText("精神瘟疫 · 掌握 0")).toBeTruthy();
  });

  it("shows persistent original-target disease and separately gated voluntary help without healing it on click", async () => {
    const aid = action({ type: "AID_ENEMY" }, "原鲁兰自愿接受专业稳定", true, "1行动＋40便士 · 每真实周1次");
    const value = projection({ promoted: true, actions: [aid] });
    value.encounter.status = "RESOLVED"; value.encounter.mentalPlague = 2; value.encounter.enemy.status = "SURRENDERED";
    value.encounter.enemy.health = 70; value.encounter.enemy.mind = 8; value.encounter.enemy.weaponLocation = "YARD";
    value.encounter.helpHistory = [{ week: 83, before: 3, after: 2, fee: 40 }];
    const { onCommand } = panel(value);
    const encounter = screen.getByRole("region", { name: "操纵师可选原仓库冲突" });
    expect(encounter.textContent).toContain("MP4-RULAN · 健康 70 · 精神 8"); expect(encounter.textContent).toContain("MP4-RULAN-CLUB");
    expect(screen.getByLabelText("原鲁兰当前实际精神瘟疫").textContent).toContain("当前实际精神瘟疫强度 2");
    expect(encounter.textContent).toContain("已自行停止抵抗"); expect(encounter.textContent).toContain("第83周实际支付40便士");
    await userEvent.click(screen.getByRole("button", { name: /^原鲁兰自愿接受/ })); expect(onCommand).toHaveBeenCalledExactlyOnceWith(aid.command);
    expect(screen.getByLabelText("原鲁兰当前实际精神瘟疫").textContent).toContain("强度 2"); expect(encounter.textContent).toContain("健康 70 · 精神 8");
  });

  it("blocks all commands in read-only or save-error state without inventing an in-panel retry", async () => {
    const value = gathered(); const onCommand = vi.fn(); const { rerender } = render(<ManipulatorPanel manipulator={value} resources={resources} busy={false} readOnly onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^核对并服用/ })); expect(onCommand).not.toHaveBeenCalled();
    rerender(<ManipulatorPanel manipulator={value} resources={resources} busy={false} error={{ message: "保存结果未确认", retryable: false }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("keeps old Dreamwalker originals, failures, visits, travel and mastery entirely read-only", async () => {
    const value = oldDreamwalker(); render(<ManipulatorDreamwalkerHistory dreamwalker={value} />);
    const history = screen.getByRole("region", { name: "梦境行者时期的经历" });
    expect(history.textContent).toContain("原失败与已付成本保留"); expect(history.textContent).toContain("同一原尾羽已归还铃尾");
    expect(history.textContent).toContain("实际普通返程 2 次"); expect(history.textContent).toContain("原瓶已耗用");
    expect(history.textContent).toContain("掌握 17");
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0);
    expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
  });
});

function oldDreamwalker(): DreamwalkerProjection {
  return { title: "梦境行者旧记录", discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [],
    supplies: "原成品渠道记录", story: "旧原著与G边界", acting: 100, digestion: "旧阶段已消化", pollution: 3, risk: "旧四档结果",
    environment: "原静室与原160米通路", insideCase: false,
    practice: { location: "SOURCE_ROOM", dream: "NONE", outboundTrips: 2, returns: 2, wakingChecks: 2 },
    ritual: { title: "旧原契约", status: "原会面已结束", participant: "铃尾已离场", contract: "同一原契约保留", feather: "同一原尾羽已归还铃尾", emotion: "原会面情绪记录", appointment: "原预约已履行", visits: [{ id: 1, summary: "原失败与已付成本保留" }] },
    cases: [{ id: "paired-dream", title: "原梦境练习", story: "原人自愿，失败与醒后核实各自保留。", observations: ["原观察仍在"], preparation: "曾准备有限梦间穿梭", result: "原失败与已付成本保留", status: "RESOLVED", contactOpen: "原梦境已实际结束", closes: 2, sessions: 2, sessionWeeks: [70, 71], verified: true }],
    bottles: [{ id: "dreamwalker-original-bottle", title: "梦境行者原瓶", source: "原指导者的已交付成品", status: "原瓶已耗用", chance: 0, command: { type: "CONSUME", bottleId: "dreamwalker-original-bottle", confirmed: true } }],
    abilities: [{ id: "audience.s5.dream-travel", label: "梦间穿梭", mastery: 17, description: "原掌握完整保留。" }],
    actions: [{ id: "old-reflect", label: "不得重做的梦境行者反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }] };
}

// Synthetic navigation fixtures only; these are not natural progression evidence.
function navigationFixture(sequence: 4 | 5): SliceProjection {
  const raw = createSliceRun("manipulator-navigation-run", sliceDefaultCreationSelection, "manipulator-navigation-seed");
  raw.activeEvent = null; raw.character.name = "艾琳"; raw.week = 90; raw.world.city = "BACKLUND";
  raw.progression = { pathwayId: "audience", sequence, mastery: {}, acting: 100, promotionWeek: sequence === 4 ? 88 : 71 };
  raw.audience.discovered = true; raw.dreamwalker.guidanceKnown = true; raw.dreamwalker.promotionWeek = 71;
  raw.manipulator.guidanceKnown = true;
  if (sequence === 4) { raw.manipulator.promotionWeek = 88; raw.manipulator.dreamwalkerActingAtPromotion = 100; }
  return projectSliceState(raw);
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})),
  };
}
async function enter(state: SliceProjection) {
  const api = bridge(state); window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return api;
}

describe("Manipulator actual SliceApp navigation", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });

  it("opens Audience S5 advancement directly into the Manipulator panel without submitting a command", async () => {
    const state = navigationFixture(5); const api = await enter(state);
    await userEvent.click(screen.getByRole("button", { name: "查看操纵师晋升" }));
    expect(within(screen.getByRole("region", { name: "操纵师成长下一步" })).getByRole("heading", { name: state.manipulator.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "操纵师晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "梦境行者成长下一步" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current S4 growth and preserves the old Dreamwalker chapter with no repeatable controls", async () => {
    const state = navigationFixture(4); state.dreamwalker = oldDreamwalker(); const api = await enter(state);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "操纵师成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "操纵师成长" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "梦境行者经历" }));
    const history = within(screen.getByRole("region", { name: "梦境行者时期的经历" }));
    await userEvent.click(history.getByText("原梦境练习 · 已提交有限报告"));
    expect(history.getByText("原观察仍在")).toBeTruthy(); expect(history.getByText("当时的结果与报告：原失败与已付成本保留")).toBeTruthy();
    await userEvent.click(history.getByText("梦境行者原瓶 · 来源与去向"));
    expect(history.getByText("原瓶：dreamwalker-original-bottle")).toBeTruthy(); expect(history.getByText("原瓶已耗用")).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /不得重做的梦境行者反思/ })).toBeNull(); expect(screen.queryByRole("region", { name: "操纵师成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "操纵师成长" }));
    expect(screen.getByRole("region", { name: "操纵师成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
