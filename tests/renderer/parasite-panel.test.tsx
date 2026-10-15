/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyParasiteCommand, projectParasite } from "../../src/domain/parasite/index";
import { PARASITE_CONSUMPTION_RISK } from "../../src/domain/parasite/content";
import type { ParasiteAction, ParasiteCommand, ParasiteProjection } from "../../src/domain/parasite/types";
import type { ParasiteCaseId } from "../../src/domain/parasite/life";
import { projectSliceState } from "../../src/domain/slice/index";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { ParasitePanel, ParasiteDreamStealerHistory } from "../../src/renderer/ParasitePanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const oldRun = JSON.parse(readFileSync("tests/fixtures/dream-stealer-v01060/natural.json", "utf8")).final;
/** Directed component setup only. Old people, items, demonstrations, loans and outcomes remain untouched. */
function dreamStealer(): SliceState {
  const s = migrateSliceState(structuredClone(oldRun));
  s.week = Math.max(s.week, s.dreamStealer.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function apply(s: SliceState, command: ParasiteCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  applyParasiteCommand(s, command, context);
}
function taught() { const s = dreamStealer(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function purchased() { const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "parasite-potion-1" }); return s; }
function promoted() { const s = purchased(); apply(s, { type: "CONSUME", bottleId: "parasite-potion-1", confirmed: true }); return s; }
function prepare(s: SliceState, caseId: ParasiteCaseId, method: "ABILITY" | "ORDINARY" = "ABILITY") {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method });
}
function enter(s: SliceState, caseId: "shared-senses" | "limited-control", roll = 1) {
  prepare(s, caseId); apply(s, { type: "CONSENT_BASIC", caseId, confirmed: true }); apply(s, { type: "PERFORM", caseId }, roll);
}
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: ParasiteProjection, type: ParasiteCommand["type"], predicate: (action: ParasiteAction) => boolean = () => true) {
  const action = value.actions.find((entry) => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`); return action;
}
function buttonFor(value: ParasiteProjection, type: ParasiteCommand["type"], predicate?: (action: ParasiteAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
const forCase = (id: ParasiteCaseId) => (action: ParasiteAction) => "caseId" in action.command && action.command.caseId === id;
const forBottle = (id: string) => (action: ParasiteAction) => "bottleId" in action.command && action.command.bottleId === id;
const releaseMode = (mode: "EXECUTE" | "DISCARD") => (action: ParasiteAction) => action.command.type === "RELEASE_THOUGHT" && action.command.mode === mode;
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectParasite(s);
  return { value, onCommand, ...render(<ParasitePanel parasite={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
function updatePanel(s: SliceState, onCommand: (command: ParasiteCommand) => void) {
  return <ParasitePanel parasite={projectParasite(s)} resources={resources(s)} busy={false} onCommand={onCommand} />;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Parasite independent original bottles and safe committed confirmations", () => {
  it("keeps the recipe unknown, prices explicit and each original bottle independent", async () => {
    const s = taught(), before = structuredClone(s.parasite), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "寄生者配方与成品边界" });
    for (const text of ["完整配方", "仍未知", "6800", "五次", "5300", "1500", "继续窃梦家生活"]) expect(boundary.textContent).toContain(text);
    expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    const first = findAction(value, "POTION_WORK", forBottle("parasite-potion-1"));
    await userEvent.click(buttonFor(value, "POTION_WORK", forBottle("parasite-potion-1")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(first.command); expect(s.parasite).toEqual(before);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立寄生者原瓶" }), "parasite-potion-2");
    expect(screen.queryByRole("button", { name: name => name.startsWith(first.label) })).toBeNull();
    expect(buttonFor(value, "POTION_WORK", forBottle("parasite-potion-2"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: /调配|免费能力|直接晋升/ })).toBeNull();
  });

  it("shows all four medicine outcomes and actual resources before independent zero-action drinking", async () => {
    const s = purchased(); s.actionsRemaining = 0;
    const before = structuredClone(s.parasite), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.bottles[0]!.title }));
    const review = screen.getByRole("region", { name: "这瓶寄生者魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "寄生者服用风险与四档结果" }).textContent).toContain(PARASITE_CONSUMPTION_RISK);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    for (const text of ["parasite-potion-1", "0行动", "不覆盖真实战斗死亡", "不补满灵性", "免费能力库存"]) expect(review.textContent).toContain(text);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "CONSUME").command); expect(s.parasite).toEqual(before);
  });

  it("returns focus after declining without drinking or moving an original bottle", async () => {
    const s = purchased(), before = structuredClone(s.parasite), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME")); await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(buttonFor(value, "CONSUME")); expect(onCommand).not.toHaveBeenCalled(); expect(s.parasite).toEqual(before);
  });

  it("keeps the same submitted confirmation through save failure and never submits it twice", async () => {
    const s = purchased(), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME")); fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    rerender(<ParasitePanel parasite={value} resources={resources(s)} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药");
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶寄生者魔药的服用确认" })).toBeTruthy();
    rerender(updatePanel(s, onCommand)); fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    expect(onCommand).toHaveBeenCalledTimes(1); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it.each([1, 100])("dismisses a consumed bottle confirmation only after the actual committed outcome, roll %s", async roll => {
    const s = purchased(), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME")); apply(s, findAction(value, "CONSUME").command, roll); rerender(updatePanel(s, onCommand));
    expect(screen.queryByRole("region", { name: "这瓶寄生者魔药的服用确认" })).toBeNull();
    expect(s.parasite.bottles[0]!.status).toBe("CONSUMED"); expect(onCommand).not.toHaveBeenCalled();
    if (roll === 100) expect(s.progression.sequence).toBe(5);
    else expect(screen.getByRole("region", { name: "寄生者实际暂窃能力与期限" }).textContent).toContain("目前没有从此原目标取得的能力");
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks all original intentions while %s", condition => {
    const s = purchased(), value = projectParasite(s), onCommand = vi.fn();
    render(<ParasitePanel parasite={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const select of screen.getAllByRole("combobox")) expect((select as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "CONSUME")); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Parasite separate consent, one actual body and delayed choice", () => {
  it("reviews BASIC independently, retains ordinary withdrawal and never enters from preparation or a local click", async () => {
    const s = promoted(); prepare(s, "shared-senses");
    const before = structuredClone(s.parasite.life), { value, onCommand, rerender } = panel(s);
    expect(s.parasite.life.player.presence).toBe("OUTSIDE");
    expect(buttonFor(value, "PERFORM", forCase("shared-senses")).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "CONSENT_BASIC", forCase("shared-senses")));
    const review = screen.getByRole("region", { name: "寄生者初步寄生独立确认" });
    for (const text of ["托马斯·里德", "不能直接读取或干涉思想", "不包含完全寄生", "普通观察"]) expect(review.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: "暂不同意，返回现场" }));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.parasite.life).toEqual(before);
    await userEvent.click(buttonFor(value, "WITHDRAW", forCase("shared-senses")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "WITHDRAW", forCase("shared-senses")).command);
    apply(s, { type: "WITHDRAW", caseId: "shared-senses" }); rerender(updatePanel(s, onCommand));
    const ordinary = findAction(projectParasite(s), "PREPARE", action => action.command.type === "PREPARE" && action.command.caseId === "shared-senses" && action.command.method === "ORDINARY");
    expect(buttonFor(projectParasite(s), "PREPARE", action => action.id === ordinary.id).disabled).toBe(false);
    expect(s.parasite.life.player.entries).toBe(0); expect(s.parasite.life.paidKits).toBe(1);
  });

  it("submits the exact bounded FULL consent independently of BASIC, without taking the token locally", async () => {
    const s = promoted(); enter(s, "limited-control");
    const before = structuredClone(s.parasite.life), { value, onCommand } = panel(s);
    expect(buttonFor(value, "TAKE_TOKEN").disabled).toBe(true);
    await userEvent.click(buttonFor(value, "CONSENT_FULL"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "确认这一次原木片取还任务" }));
    const review = screen.getByRole("region", { name: "寄生者完全寄生独立确认" });
    for (const text of ["PR4-TOKEN-1", "再归还原桌", "不扩展为随意行动"]) expect(review.textContent).toContain(text);
    const confirm = screen.getByRole("button", { name: "确认仅控制本次取还原木片" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSENT_FULL", caseId: "limited-control", task: "MOVE_TOKEN_AND_RETURN", confirmed: true });
    expect(s.parasite.life).toEqual(before); expect(s.parasite.life.host.token).toBe("DESK");
  });

  it("discards stale consent review when that actual prepared attempt is withdrawn", async () => {
    const s = promoted(); prepare(s, "shared-senses"); const { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSENT_BASIC", forCase("shared-senses")));
    apply(s, { type: "WITHDRAW", caseId: "shared-senses" }); rerender(updatePanel(s, onCommand));
    expect(screen.queryByRole("region", { name: "寄生者初步寄生独立确认" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled(); expect(s.parasite.life.player.presence).toBe("OUTSIDE");
  });

  it("keeps the real four-metre position and affordable assisted exit before separately walking back", async () => {
    const s = promoted(); enter(s, "shared-senses"); apply(s, { type: "WALK_ROUTE", caseId: "shared-senses" });
    s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0;
    const { value, onCommand, rerender } = panel(s);
    const facts = screen.getByRole("region", { name: "寄生者实际身体同意与原物" });
    for (const text of ["四米", "外部无可操控第二身体", "0行动、0灵性", "BASIC浅层"]) expect(facts.textContent).toContain(text);
    expect(buttonFor(value, "CLOSE", forCase("shared-senses")).disabled).toBe(true);
    expect(buttonFor(value, "EXIT_HOST").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "EXIT_HOST")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "EXIT_HOST", caseId: "shared-senses" });
    apply(s, { type: "EXIT_HOST", caseId: "shared-senses" }); rerender(updatePanel(s, onCommand));
    expect(s.parasite.life.player.location).toBe("ROUTE_END");
    expect(buttonFor(projectParasite(s), "RETURN_TO_START", forCase("shared-senses")).disabled).toBe(false);
    expect(buttonFor(projectParasite(s), "CLOSE", forCase("shared-senses")).disabled).toBe(true);
    apply(s, { type: "RETURN_TO_START", caseId: "shared-senses" }); rerender(updatePanel(s, onCommand));
    expect(s.parasite.life.player.location).toBe("DESK"); expect(buttonFor(projectParasite(s), "CLOSE", forCase("shared-senses")).disabled).toBe(false);
  });

  it("shows one original token and keeps its actual return before separation accessible at zero resources", async () => {
    const s = promoted(); enter(s, "limited-control");
    apply(s, { type: "CONSENT_FULL", caseId: "limited-control", task: "MOVE_TOKEN_AND_RETURN", confirmed: true });
    apply(s, { type: "TAKE_TOKEN", caseId: "limited-control" }); s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0;
    const before = structuredClone(s.parasite.life), { value, onCommand, rerender } = panel(s);
    const facts = screen.getByRole("region", { name: "寄生者实际身体同意与原物" });
    for (const text of ["PR4-TOKEN-1", "在他的原手中", "玩家暂控原身体", "FULL", "始终属于托马斯"]) expect(facts.textContent).toContain(text);
    expect(buttonFor(value, "EXIT_HOST").disabled).toBe(true); expect(buttonFor(value, "RETURN_TOKEN").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "RETURN_TOKEN")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_TOKEN", caseId: "limited-control" }); expect(s.parasite.life).toEqual(before);
    apply(s, { type: "RETURN_TOKEN", caseId: "limited-control" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectParasite(s), "EXIT_HOST").disabled).toBe(false); expect(s.parasite.life.host.control).toBe("HOST");
    expect(s.parasite.life.host.token).toBe("DESK"); expect(s.parasite.life.player.presence).toBe("INSIDE_HOST");
  });

  it("does not trap failed entry behind a successful host scene", async () => {
    const s = promoted(); enter(s, "shared-senses", 100); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand } = panel(s);
    expect(s.parasite.life.player.presence).toBe("OUTSIDE"); expect(s.parasite.life.player.entries).toBe(0);
    expect(screen.getByRole("region", { name: "寄生者实际实践结果" }).textContent).toContain("检定未成");
    expect(buttonFor(value, "CLOSE", forCase("shared-senses")).disabled).toBe(false);
    await userEvent.click(buttonFor(value, "CLOSE", forCase("shared-senses")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "shared-senses" });
  });

  it("keeps only the current stored thought and exposes separate later execution and non-executing release", async () => {
    const s = promoted(); prepare(s, "deferred-seat"); apply(s, { type: "PERFORM", caseId: "deferred-seat" });
    const before = structuredClone(s.parasite.life), { value, onCommand } = panel(s);
    expect((screen.getByRole("combobox", { name: "选择当前寄生者生活实践" }) as HTMLSelectElement).value).toBe("deferred-seat");
    const facts = screen.getByRole("region", { name: "寄生者实际身体同意与原物" });
    for (const text of ["SIT_ON_PR4_CHAIR_1", "玩家尚未执行", "站立"]) expect(facts.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "寄生者延迟念头选择" }).textContent).toContain("不执行并释放");
    expect(buttonFor(value, "RELEASE_THOUGHT", releaseMode("EXECUTE")).disabled).toBe(true);
    expect(buttonFor(value, "RELEASE_THOUGHT", releaseMode("DISCARD")).disabled).toBe(false);
    expect(buttonFor(value, "CLOSE", forCase("deferred-seat")).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "RELEASE_THOUGHT", releaseMode("DISCARD")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RELEASE_THOUGHT", caseId: "deferred-seat", mode: "DISCARD" }); expect(s.parasite.life).toEqual(before);
  });

  it.each(["EXECUTE", "DISCARD"] as const)("shows the real delayed %s branch and only closes after actual position recovery", async mode => {
    const s = promoted(); prepare(s, "deferred-seat"); apply(s, { type: "PERFORM", caseId: "deferred-seat" });
    const { onCommand, rerender } = panel(s);
    if (mode === "EXECUTE") { apply(s, { type: "STEP_TO_CHAIR", caseId: "deferred-seat" }); rerender(updatePanel(s, onCommand)); }
    const value = projectParasite(s); expect(buttonFor(value, "RELEASE_THOUGHT", releaseMode(mode)).disabled).toBe(false);
    await userEvent.click(buttonFor(value, "RELEASE_THOUGHT", releaseMode(mode)));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RELEASE_THOUGHT", caseId: "deferred-seat", mode });
    apply(s, { type: "RELEASE_THOUGHT", caseId: "deferred-seat", mode }); rerender(updatePanel(s, onCommand));
    expect(s.parasite.life.thought.pending).toBe("NONE"); expect(s.parasite.life.thought.targetPaused).toBe(false);
    if (mode === "EXECUTE") {
      expect(s.parasite.life.player.pose).toBe("SEATED"); expect(buttonFor(projectParasite(s), "CLOSE", forCase("deferred-seat")).disabled).toBe(true);
      expect(buttonFor(projectParasite(s), "RETURN_TO_START", forCase("deferred-seat")).disabled).toBe(false);
      apply(s, { type: "RETURN_TO_START", caseId: "deferred-seat" }); rerender(updatePanel(s, onCommand));
    } else expect(s.parasite.life.player.pose).toBe("STANDING");
    expect(buttonFor(projectParasite(s), "CLOSE", forCase("deferred-seat")).disabled).toBe(false);
  });

  it("offers a genuine ordinary route without inventing consent or power mastery", async () => {
    const s = promoted(); prepare(s, "limited-control", "ORDINARY"); apply(s, { type: "PERFORM", caseId: "limited-control" });
    const spirituality = s.spirituality, { value, onCommand } = panel(s);
    expect(s.parasite.life.player.entries).toBe(0); expect(s.parasite.life.host.control).toBe("HOST");
    expect(buttonFor(value, "RETURN_TOKEN").disabled).toBe(false); await userEvent.click(buttonFor(value, "RETURN_TOKEN"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_TOKEN", caseId: "limited-control" });
    apply(s, { type: "RETURN_TOKEN", caseId: "limited-control" }); apply(s, { type: "CLOSE", caseId: "limited-control" }); apply(s, { type: "REPORT", caseId: "limited-control" });
    expect(s.spirituality).toBe(spirituality); expect(s.progression.mastery["error.s4.parasitism"]).toBe(0); expect(s.progression.acting).toBe(25);
  });
});

describe("Parasite finite conflict sources and inherited history", () => {
  it("shows the real source and zero borrowed inventory before any theft", () => {
    const s = promoted(), { value } = panel(s);
    const source = screen.getByRole("region", { name: "寄生者原对手与实际能力来源" });
    for (const text of ["拉尔夫·托伦", "39岁", "序列6", "PR4-RALF-TOREN", "32", "无追逐"]) expect(source.textContent).toContain(text);
    expect(value.encounter?.borrowed).toEqual([]); expect(screen.getByRole("region", { name: "寄生者实际暂窃能力与期限" }).textContent).toContain("三种上限是容量，不是免费库存");
    expect(buttonFor(value, "ENCOUNTER_TALK").disabled).toBe(false);
  });

  it("reviews real combat risk independently, while peaceful talk submits its original action", async () => {
    const s = promoted(), before = structuredClone(s.parasite.encounter), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "ENCOUNTER_FIGHT"));
    const review = screen.getByRole("region", { name: "寄生者真实迎战确认" });
    for (const text of ["重伤或死亡", "有限灵性", "不保证窃取成功", "不提供任意敌人寄生"]) expect(review.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: "暂不迎战" })); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(buttonFor(value, "ENCOUNTER_TALK")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_TALK" }); expect(s.parasite.encounter).toEqual(before); expect(s.combat).toBeNull();
  });

  it("submits one exact battle intent only after its risk confirmation", async () => {
    const s = promoted(), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "ENCOUNTER_FIGHT")); const confirm = screen.getByRole("button", { name: "确认风险，开始真实交战" });
    fireEvent.click(confirm); fireEvent.click(confirm); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_FIGHT" }); expect(s.combat).toBeNull();
  });

  it("retains consumed and unused Parasite bottles after promotion without further medicine commands", () => {
    const s = promoted(), { value } = panel(s);
    expect(value.bottles).toHaveLength(3);
    expect(screen.getByText("寄生者原瓶 · 来源与去向")).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`原瓶：${bottle.id}`)).toBeTruthy();
    expect(value.actions.some(action => ["CONSUME", "BUY_POTION", "POTION_WORK"].includes(action.command.type))).toBe(false);
    expect(s.parasite.bottles[0]!.status).toBe("CONSUMED"); expect(s.parasite.bottles[1]!.status).toBe("SUPPLIER");
  });

  it("renders original Dream Stealer people, actions, token and bottles as read-only history", () => {
    const s = dreamStealer(), before = structuredClone(s.dreamStealer), value = projectSliceState(s).dreamStealer;
    render(<ParasiteDreamStealerHistory dreamStealer={value} />);
    const history = screen.getByRole("region", { name: "窃梦家时期的经历" });
    expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull();
    for (const entry of value.cases) expect(history.textContent).toContain(entry.title);
    for (const bottle of value.bottles) expect(history.textContent).toContain(bottle.id);
    if (value.practice) for (const fact of [value.practice.pose, value.practice.target, value.practice.token]) expect(history.textContent).toContain(fact);
    expect(history.textContent).toContain("不会把旧动作改写为未执行的储存念头"); expect(s.dreamStealer).toEqual(before);
  });
});
