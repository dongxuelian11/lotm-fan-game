/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySecretsSorcererCommand, projectSecretsSorcerer } from "../../src/domain/secrets-sorcerer/index";
import { SECRETS_SORCERER_CONSUMPTION_RISK } from "../../src/domain/secrets-sorcerer/content";
import type { SecretsSorcererAction, SecretsSorcererCommand, SecretsSorcererProjection } from "../../src/domain/secrets-sorcerer/types";
import type { SecretsSorcererCaseId, SecretsSorcererItemId } from "../../src/domain/secrets-sorcerer/life";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { SecretsSorcererPanel, SecretsSorcererTravelerHistory } from "../../src/renderer/SecretsSorcererPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const OLD_PATH = "tests/fixtures/traveler-v01050/natural.json";
const DIRECTED_PATH = "tests/fixtures/secrets-sorcerer-v01270/directed.json";
const oldRun = JSON.parse(readFileSync(OLD_PATH, "utf8")).final;
const original = (path: string, key = "final"): SliceState => JSON.parse(readFileSync(path, "utf8"))[key];
const directed = (key: string): SliceState => migrateSliceState(structuredClone(original(DIRECTED_PATH, key)));

/** Directed component resource/clock setup only. Original S5 journeys, records and people are untouched. */
function traveler(): SliceState {
  const s = migrateSliceState(structuredClone(oldRun));
  s.week = Math.max(s.week, s.traveler.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function apply(s: SliceState, command: SecretsSorcererCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  applySecretsSorcererCommand(s, command, context);
}
function taught() { const s = traveler(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function prepared() {
  const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "secrets-sorcerer-potion-1" });
  apply(s, { type: "SURVEY_RITUAL", targetId: "SS4-ARCH-A" }); apply(s, { type: "PREPARE_SEAL" }); return s;
}
function sealed() {
  // This directed fixture retains the actual natural live capture, without invented marks or history.
  const s = directed("sealed"); s.actionsRemaining = 1000; s.cash = 100000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.character.coreStats.will = 28; return s;
}
function promoted() {
  // Promotion uses the explicitly directed roll-1 domain branch, followed by public commands.
  const s = directed("promoted");
  if (projectSecretsSorcerer(s).ritual.currentVisit) apply(s, { type: "END_RITUAL" });
  s.activeEvent = null; s.eventQueue = []; s.actionsRemaining = 1000; s.weeklyBudget = 1000; s.cash = 100000;
  s.health = 100; s.mind = 100; s.spirituality = 120;
  s.character.coreStats.knowledge = 28; s.character.coreStats.will = 28; return s;
}
function begin(s: SliceState, caseId: SecretsSorcererCaseId, method: "ABILITY" | "ORDINARY" = "ABILITY", roll = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method });
  if (caseId === "temporary-banishment" && method === "ABILITY") apply(s, { type: "SECURE_TARGET" });
  apply(s, { type: "PERFORM", caseId }, roll);
}
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: SecretsSorcererProjection, type: SecretsSorcererCommand["type"], predicate: (a: SecretsSorcererAction) => boolean = () => true) {
  const action = value.actions.find((entry) => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`); return action;
}
function buttonFor(value: SecretsSorcererProjection, type: SecretsSorcererCommand["type"], predicate?: (a: SecretsSorcererAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
const forCase = (id: SecretsSorcererCaseId) => (action: SecretsSorcererAction) => "caseId" in action.command && action.command.caseId === id;
const forItem = (id: SecretsSorcererItemId) => (action: SecretsSorcererAction) => "itemId" in action.command && action.command.itemId === id;
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectSecretsSorcerer(s);
  return { value, onCommand, ...render(<SecretsSorcererPanel secretsSorcerer={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
function updatePanel(s: SliceState, onCommand: (command: SecretsSorcererCommand) => void) {
  return <SecretsSorcererPanel secretsSorcerer={projectSecretsSorcerer(s)} resources={resources(s)} busy={false} onCommand={onCommand} />;
}
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Secrets Sorcerer original supplies, hostile target and independent confirmations", () => {
  it("keeps the recipe unknown and shows only the selected independent original bottle", async () => {
    const s = taught(), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "秘法师配方与封印边界" });
    expect(boundary.textContent).toContain("完整配方、材料、用量与调配顺序仍未知");
    expect(boundary.textContent).toContain("继续旅行家生活"); expect(boundary.textContent).toContain("自己的实际记录属于自己的力量");
    expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    const first = findAction(value, "POTION_WORK", action => "bottleId" in action.command && action.command.bottleId === value.bottles[0]!.id);
    await userEvent.click(buttonFor(value, "POTION_WORK", action => action.id === first.id));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(first.command);
    expect(s.secretsSorcerer.bottles.every(bottle => bottle.status === "SUPPLIER" && bottle.labourSteps === 0)).toBe(true);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立秘法师原瓶" }), value.bottles[1]!.id);
    expect(screen.queryByRole("button", { name: name => name.startsWith(first.label) })).toBeNull();
    expect(buttonFor(value, "POTION_WORK", action => "bottleId" in action.command && action.command.bottleId === value.bottles[1]!.id)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|免费半神法术/ })).toBeNull();
  });

  it("reveals current hostile-body resources only after actual survey and never creates a frame locally", async () => {
    const s = taught(), { value, onCommand, rerender } = panel(s);
    expect(value.ritual.enemyHealth).toBeNull(); expect(value.ritual.hostileVerified).toBe(false);
    const action = findAction(value, "SURVEY_RITUAL"); await userEvent.click(buttonFor(value, "SURVEY_RITUAL", a => a.id === action.id));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
    expect(screen.getByRole("region", { name: "秘法师当前封印现场" }).textContent).toContain("敌意与位格尚待本人实地核实");
    apply(s, action.command); rerender(updatePanel(s, onCommand));
    const live = projectSecretsSorcerer(s), facts = screen.getByRole("region", { name: "秘法师当前封印现场" });
    expect(live.ritual.enemyHealth).toBe(100); expect(live.ritual.enemySpirituality).toBe(40);
    for (const text of ["SS4-ARCH-A", "明确敌意", "原敌体有限灵性", "尚未借领", "没有本场实际活体封印证据"]) expect(facts.textContent).toContain(text);
    expect(s.secretsSorcerer.ritual.cases).toEqual([]); expect(buttonFor(live, "PREPARE_SEAL").disabled).toBe(false);
  });

  it("reviews real death risk, finite original frame and no external captor before a distinct start", async () => {
    const s = prepared(), before = structuredClone(s.secretsSorcerer), { value, onCommand } = panel(s);
    expect(screen.getByRole("region", { name: "秘法师成长下一步" }).textContent).toContain(findAction(value, "START_RITUAL").label);
    await userEvent.click(buttonFor(value, "START_RITUAL"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "确认承担真实交战与死亡风险" }));
    const review = screen.getByRole("region", { name: "秘法师真实迎战确认" });
    for (const text of ["SS4-CASE-1", "剩余封合次数 3", "6灵性和2精神", "仅打死原目标不能完成", "不参战、不代抓", "再次独立确认服用原瓶", "真实交战可能重伤或死亡"]) expect(review.textContent).toContain(text);
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "START_RITUAL")); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(buttonFor(value, "START_RITUAL")); await userEvent.click(screen.getByRole("button", { name: "确认风险，开始真实交战" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "START_RITUAL").command);
    expect(s.secretsSorcerer).toEqual(before); expect(s.combat).toBeNull();
  });

  it("drops an obsolete frame confirmation after actual exit and a different original survey", async () => {
    const s = prepared(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "START_RITUAL"));
    apply(s, { type: "END_RITUAL" }); s.week++; apply(s, { type: "SURVEY_RITUAL", targetId: "SS4-ARCH-B" }); apply(s, { type: "PREPARE_SEAL" });
    rerender(updatePanel(s, onCommand)); expect(screen.queryByRole("region", { name: "秘法师真实迎战确认" })).toBeNull();
    await userEvent.click(buttonFor(projectSecretsSorcerer(s), "START_RITUAL"));
    const facts = screen.getByRole("region", { name: "确认前的当前封印现场" }); expect(facts.textContent).toContain("SS4-CASE-2"); expect(facts.textContent).toContain("SS4-ARCH-B");
    expect(onCommand).not.toHaveBeenCalled(); expect(s.secretsSorcerer.ritual.cases[0]!.custody).toBe("ARCHIVE");
  });

  it("keeps the same confirmed start pending through save failure without duplicate submission", async () => {
    const s = prepared(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "START_RITUAL"));
    const confirm = screen.getByRole("button", { name: "确认风险，开始真实交战" }); fireEvent.click(confirm); fireEvent.click(confirm);
    rerender(<SecretsSorcererPanel secretsSorcerer={value} resources={resources(s)} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复开战、存取原物或服药");
    expect((screen.getByRole("button", { name: "暂不迎战" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "秘法师真实迎战确认" })).toBeTruthy();
    rerender(updatePanel(s, onCommand)); fireEvent.click(screen.getByRole("button", { name: "确认风险，开始真实交战" }));
    expect(onCommand).toHaveBeenCalledTimes(1); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it("shows actual live capture and all four potion outcomes before separate zero-action drinking", async () => {
    const s = sealed(); s.actionsRemaining = 0; const before = structuredClone(s.secretsSorcerer), { value, onCommand } = panel(s);
    expect(value.ritual.phase).toBe("SEALED"); expect(value.ritual.enemyHealth).toBeGreaterThan(0); expect(value.ritual.captureEvidence).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际活体封印证据" }).textContent).toContain(value.ritual.captureEvidence!);
    await userEvent.click(buttonFor(value, "CONSUME", action => action.enabled));
    expect(screen.getByRole("region", { name: "秘法师服用风险与四档结果" }).textContent).toContain(SECRETS_SORCERER_CONSUMPTION_RISK);
    const review = screen.getByRole("region", { name: "这瓶秘法师魔药的服用确认" });
    for (const text of [value.ritual.caseId!, "原敌体仍活着封存在同一原框中", "保持旅行家5", "不覆盖真实战斗死亡"]) expect(review.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    const bottle = value.bottles.find(entry => "bottleId" in findAction(value, "CONSUME", action => action.enabled).command && entry.command.type === "CONSUME" && entry.id === s.secretsSorcerer.ritual.bottleId)!;
    const confirm = screen.getByRole("button", { name: `确认服用「${bottle.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "CONSUME", action => action.enabled).command); expect(s.secretsSorcerer).toEqual(before);
  });

  it.each([1, 100])("keeps same live sealed body and actual exit accessible after potion roll %s", async roll => {
    const s = sealed(), bottleId = s.secretsSorcerer.ritual.bottleId!; apply(s, { type: "CONSUME", bottleId, confirmed: true }, roll);
    s.actionsRemaining = 0; s.spirituality = 0; const before = structuredClone(s.secretsSorcerer.ritual), { value, onCommand } = panel(s);
    expect(value.ritual.currentVisit).toBe(true); expect(value.ritual.phase).toBe("SEALED"); expect(value.ritual.enemyHealth).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "秘法师当前封印现场" }).textContent).toContain(value.ritual.caseStatus);
    expect(screen.getByRole("region", { name: "秘法师成长下一步" }).textContent).toContain(findAction(value, "END_RITUAL").label);
    expect(buttonFor(value, "END_RITUAL").disabled).toBe(false); await userEvent.click(buttonFor(value, "END_RITUAL"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END_RITUAL" }); expect(s.secretsSorcerer.ritual).toEqual(before);
  });

  it("lets the owner keep sequence 5 by exiting with the original bottle unused", async () => {
    const s = sealed(), { value, onCommand, rerender } = panel(s), bottleId = s.secretsSorcerer.ritual.bottleId!;
    await userEvent.click(buttonFor(value, "CONSUME", action => action.enabled));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用，返回封印现场" }));
    await userEvent.click(buttonFor(value, "END_RITUAL")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "END_RITUAL" });
    apply(s, { type: "END_RITUAL" }); rerender(updatePanel(s, onCommand));
    expect(s.progression.sequence).toBe(5); expect(s.secretsSorcerer.bottles.find(bottle => bottle.id === bottleId)!.status).toBe("PLAYER");
    expect(projectSecretsSorcerer(s).ritual.caseStatus).toContain("已交还档案馆"); expect(projectSecretsSorcerer(s).ritual.caseStatus).toContain("仍在箱内");
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks original intentions while %s", condition => {
    const s = prepared(), value = projectSecretsSorcerer(s), onCommand = vi.fn();
    render(<SecretsSorcererPanel secretsSorcerer={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "START_RITUAL")); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Secrets Sorcerer original-room, finite-pocket and same-body life actions", () => {
  it.each([1, 100])("requires actual original-door exit after successful or failed hiding, roll %s", async roll => {
    const s = promoted(); begin(s, "hidden-room", "ABILITY", roll); s.actionsRemaining = 0; s.spirituality = 0;
    const before = structuredClone(s.secretsSorcerer.life), { value, onCommand, rerender } = panel(s);
    const facts = screen.getByRole("region", { name: "原隐藏房间与唯一实体门" });
    for (const text of ["SS4-ROOM", "SS4-DOOR", "原房间内", "同一原成年米拉", "旧旅行家同行记录保留"]) expect(facts.textContent).toContain(text);
    expect(buttonFor(value, "CLOSE", forCase("hidden-room")).disabled).toBe(true); expect(buttonFor(value, "EXIT_ROOM").disabled).toBe(false);
    if (roll === 100) expect(facts.textContent).toContain("当前没有生效的空间隐藏");
    await userEvent.click(buttonFor(value, "EXIT_ROOM")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "EXIT_ROOM" }); expect(s.secretsSorcerer.life).toEqual(before);
    apply(s, { type: "EXIT_ROOM" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "原隐藏房间与唯一实体门" }).textContent).toContain("本人实际位置：原房间外");
    if (roll === 1) { expect(buttonFor(projectSecretsSorcerer(s), "STOP_HIDING").disabled).toBe(false); apply(s, { type: "STOP_HIDING" }); rerender(updatePanel(s, onCommand)); }
    expect(buttonFor(projectSecretsSorcerer(s), "CLOSE", forCase("hidden-room")).disabled).toBe(false); expect(s.traveler).toEqual(oldRun.traveler);
  });

  it("shows only the selected practice and requires three actual original item transfers", async () => {
    const s = promoted(); begin(s, "original-pocket"); const { value, onCommand, rerender } = panel(s);
    expect(screen.queryByRole("region", { name: "原隐藏房间与唯一实体门" })).toBeNull();
    const facts = screen.getByRole("region", { name: "原挎包有限口袋与三件原物" });
    for (const text of ["SS4-BAG-1", "有限容量 3 件", "SS4-CARD-1", "SS4-COIN-1", "SS4-SEALED-STONE-1", "精神−1", "固定坐标", "不是无限背包"]) expect(facts.textContent).toContain(text);
    expect(buttonFor(value, "CLOSE", forCase("original-pocket")).disabled).toBe(true);
    const before = structuredClone(s.secretsSorcerer.life.pocket); await userEvent.click(buttonFor(value, "STORE_ITEM", forItem("SS4-SEALED-STONE-1")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STORE_ITEM", itemId: "SS4-SEALED-STONE-1" }); expect(s.secretsSorcerer.life.pocket).toEqual(before);
    const mind = s.mind; apply(s, { type: "STORE_ITEM", itemId: "SS4-SEALED-STONE-1" }); rerender(updatePanel(s, onCommand));
    expect(s.mind).toBe(mind - 1); expect(screen.getByRole("region", { name: "原挎包有限口袋与三件原物" }).textContent).toContain("原空间口袋内");
    expect(buttonFor(projectSecretsSorcerer(s), "TAKE_ITEM", forItem("SS4-SEALED-STONE-1")).disabled).toBe(false);
  });

  it("keeps expired original contents and exposes paid maintenance after an actual withdrawal", async () => {
    const s = promoted(); begin(s, "original-pocket"); apply(s, { type: "STORE_ITEM", itemId: "SS4-CARD-1" });
    apply(s, { type: "WITHDRAW", caseId: "original-pocket" }); s.week++; // Directed real game-week boundary, never a renderer timer.
    const before = structuredClone(s.secretsSorcerer.life.pocket), { value, onCommand, rerender } = panel(s);
    expect(value.insideCase).toBe(false); expect(value.life.pocket.expired).toBe(true);
    expect(screen.getByRole("region", { name: "原挎包有限口袋与三件原物" }).textContent).toContain("期限已过，原物仍留在口袋");
    expect(buttonFor(value, "TAKE_ITEM", forItem("SS4-CARD-1")).disabled).toBe(true); expect(buttonFor(value, "MAINTAIN_POCKET").disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前生活实践" }), "hidden-room");
    expect(buttonFor(value, "MAINTAIN_POCKET").disabled).toBe(false); await userEvent.click(buttonFor(value, "MAINTAIN_POCKET"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "MAINTAIN_POCKET" }); expect(s.secretsSorcerer.life.pocket).toEqual(before);
    apply(s, { type: "MAINTAIN_POCKET" }); rerender(updatePanel(s, onCommand));
    expect(projectSecretsSorcerer(s).life.pocket.expired).toBe(false); expect(buttonFor(projectSecretsSorcerer(s), "TAKE_ITEM", forItem("SS4-CARD-1")).disabled).toBe(false);
    expect(s.secretsSorcerer.life.pocket.items[0]!.location).toBe("POCKET"); expect(s.secretsSorcerer.life.pocket.films.at(-1)!.purpose).toBe("MAINTAIN");
  });

  it("returns each archive object explicitly and retains the player's original coin before stopping", async () => {
    const s = promoted(); begin(s, "original-pocket", "ORDINARY");
    for (const itemId of ["SS4-CARD-1", "SS4-COIN-1", "SS4-SEALED-STONE-1"] as const) { apply(s, { type: "STORE_ITEM", itemId }); apply(s, { type: "TAKE_ITEM", itemId }); }
    s.actionsRemaining = 0; s.spirituality = 0; const { value, onCommand, rerender } = panel(s);
    expect(buttonFor(value, "RETURN_ITEM", forItem("SS4-CARD-1")).disabled).toBe(false);
    await userEvent.click(buttonFor(value, "RETURN_ITEM", forItem("SS4-CARD-1"))); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_ITEM", itemId: "SS4-CARD-1" });
    apply(s, { type: "RETURN_ITEM", itemId: "SS4-CARD-1" }); apply(s, { type: "RETURN_ITEM", itemId: "SS4-SEALED-STONE-1" }); apply(s, { type: "STOP_POCKET" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectSecretsSorcerer(s), "CLOSE", forCase("original-pocket")).disabled).toBe(false);
    expect(s.secretsSorcerer.life.pocket.items.map(item => item.location)).toEqual(["DESK", "PLAYER", "DESK"]);
    expect(s.secretsSorcerer.life.pocket.links).toBe(0); expect(s.secretsSorcerer.life.pocket.films).toEqual([]);
  });

  it("requires real prior restraint and recommends performing rather than releasing a prepared target", async () => {
    const s = promoted(); apply(s, { type: "OBSERVE", caseId: "temporary-banishment" }); apply(s, { type: "PREPARE", caseId: "temporary-banishment", method: "ABILITY" });
    const { value, onCommand, rerender } = panel(s);
    expect(buttonFor(value, "PERFORM", forCase("temporary-banishment")).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "秘法师成长下一步" }).textContent).toContain(findAction(value, "SECURE_TARGET").label);
    await userEvent.click(buttonFor(value, "SECURE_TARGET")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SECURE_TARGET" });
    apply(s, { type: "SECURE_TARGET" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "秘法师成长下一步" }).textContent).toContain(findAction(projectSecretsSorcerer(s), "PERFORM", forCase("temporary-banishment")).label);
  });

  it("waits for the same banished original to return before offering actual release and closure", async () => {
    const s = promoted(); begin(s, "temporary-banishment"); s.actionsRemaining = 0; s.spirituality = 0;
    const before = structuredClone(s.secretsSorcerer.life.banishment), { value, onCommand, rerender } = panel(s);
    const facts = screen.getByRole("region", { name: "同一原回响的临时放逐与返回" });
    for (const text of ["SS4-ECHO-G", "SS4-CAGE-1", "暂时处于有限时空乱流中", "剩余 30 秒", "不能代替晋升仪式", "原笼始终关闭"]) expect(facts.textContent).toContain(text);
    expect(buttonFor(value, "RELEASE_RESTRAINT").disabled).toBe(true); expect(buttonFor(value, "CLOSE", forCase("temporary-banishment")).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "WAIT_RETURN")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "WAIT_RETURN" }); expect(s.secretsSorcerer.life.banishment).toEqual(before);
    apply(s, { type: "WAIT_RETURN" }); rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "同一原回响的临时放逐与返回" }).textContent).toContain("仍在同一原封闭笼内");
    expect(buttonFor(projectSecretsSorcerer(s), "RELEASE_RESTRAINT").disabled).toBe(false);
    apply(s, { type: "RELEASE_RESTRAINT" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectSecretsSorcerer(s), "CLOSE", forCase("temporary-banishment")).disabled).toBe(false);
    expect(s.secretsSorcerer.life.banishment.id).toBe(before.id); expect(s.secretsSorcerer.life.banishment.sceneSeconds).toBe(30);
  });

  it("preserves real Traveler journeys, the original card, Mira, bottles and abilities as read-only history", () => {
    const s = promoted(), old = projectSliceState(s).traveler; render(<SecretsSorcererTravelerHistory traveler={old} />);
    const history = screen.getByRole("region", { name: "旅行家时期的经历" }); expect(history.textContent).toContain("旅行家扮演进度 100");
    for (const text of old.ritual!.history) expect(history.textContent).toContain(text);
    for (const text of [old.practice!.position, old.practice!.card, old.practice!.companion, old.bottles[0]!.id]) expect(history.textContent).toContain(text);
    for (const entry of old.cases) { for (const text of entry.observations) expect(history.textContent).toContain(text); if (entry.result) expect(history.textContent).toContain(entry.result); }
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.traveler).toEqual(oldRun.traveler);
  });
});

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})),
  };
}
async function enterSnapshot(path: string) {
  // Runtime migration only: no clock, body, record, character, combat or resource patching.
  const old = original(path), s = migrateSliceState(structuredClone(old)), state = projectSliceState(s), api = bridge(state);
  window.sliceGame = api; render(<SliceApp />); await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) })); await screen.findByRole("heading", { name: "人物卷宗" });
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return { api, state, s, old };
}
describe("Secrets Sorcerer navigation with unchanged natural S5 and directed S4 saves", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
  it("opens advancement from the exact Traveler final history without preparing or repeating anything", async () => {
    const { api, state, s, old } = await enterSnapshot(OLD_PATH); await userEvent.click(screen.getByRole("button", { name: "查看秘法师晋升" }));
    expect(within(screen.getByRole("region", { name: "秘法师成长下一步" })).getByRole("heading", { name: state.secretsSorcerer.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "秘法师晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "旅行家成长下一步" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
    expect(s.traveler).toEqual(old.traveler); expect(s.recorder).toEqual(old.recorder); expect(s.combatHistory).toEqual(old.combatHistory);
  });
  it("opens directed S4 growth and the original S5 history without changing either snapshot", async () => {
    const { api, state, s, old } = await enterSnapshot(DIRECTED_PATH); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "秘法师成长下一步" })).toBeTruthy(); expect(screen.getByRole("button", { name: "秘法师成长" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "旅行家经历" })); const history = within(screen.getByRole("region", { name: "旅行家时期的经历" }));
    expect(history.getByRole("region", { name: "旅行家原四处坐标与实际返程" }).textContent).toContain(state.traveler.ritual!.at);
    expect(history.getByRole("region", { name: "旅行家原身体原卡与米拉" }).textContent).toContain(state.traveler.practice!.card);
    await userEvent.click(history.getByText("旅行家原瓶 · 来源与去向")); expect(history.getByText(`原瓶：${state.traveler.bottles[0]!.id}`)).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "秘法师成长" })); expect(screen.getByRole("region", { name: "秘法师成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled(); expect(s.secretsSorcerer).toEqual(old.secretsSorcerer); expect(s.traveler).toEqual(old.traveler); expect(s.recorder).toEqual(old.recorder);
  });
});
