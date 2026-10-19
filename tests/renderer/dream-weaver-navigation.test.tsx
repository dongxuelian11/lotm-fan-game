/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { DreamWeaverCommand } from "../../src/domain/dream-weaver/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

interface NaturalCapture {
  prefixCount: number; commands: SliceIntent[]; departureStart: unknown; guidanceStart: unknown;
  promoted: unknown; practiced: unknown; combatStart: unknown; final: unknown;
}
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// These are actual public-command captures. Never edit resources, consent, RNG, original people or objects.
const original = (): { commands: SliceIntent[]; final: unknown } => JSON.parse(readFileSync("tests/fixtures/manipulator-v01190/natural.json", "utf8"));
const natural = (): NaturalCapture => JSON.parse(readFileSync("tests/fixtures/dream-weaver-v01420/natural.json", "utf8"));
function boundary(name: string): Boundary {
  const entries = JSON.parse(readFileSync("tests/fixtures/dream-weaver-v01420/boundaries.json", "utf8")) as Record<string, Boundary>;
  if (!entries[name]) throw new Error(`Missing real Dream Weaver boundary: ${name}`);
  return entries[name];
}
function savedGame(state: unknown, failFirstSave = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This original run already exists.");
    if (failFirstSave && attempts++ === 0) return { ok: false as const, error: { code: "SAVE_FAILED", message: "本次原操作尚未保存", retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T08:00:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
const LEGACY_STAGES = ["audience", "mindreader", "psychologist", "hypnotist", "dreamwalker", "manipulator"] as const;
function expectLegacyPreserved(state: SliceState, before: SliceState) {
  for (const key of LEGACY_STAGES) expect(state[key]).toEqual(before[key]);
  expect(state.runId).toBe(before.runId); expect(state.random.seed).toBe(before.random.seed);
  expect(state.character.gender).toBe(before.character.gender);
}
async function acknowledgeSavedRound() {
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function mountGame(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T07:59:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: state.status === "DEAD" ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "人物卷宗" })
    ?? screen.queryByRole("region", { name: "织梦人" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // Previous battles remain in the save. Acknowledge their real outcomes through the UI instead of erasing them.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.dreamWeaver.insideCase) await screen.findByRole("region", { name: "织梦人" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    await userEvent.click(screen.getByRole("button", { name: "织梦人与有限外部身份" }));
    await screen.findByRole("region", { name: "织梦人" });
  }
}
function actionButton(state: SliceState, command: DreamWeaverCommand) {
  const entry = projectSliceState(state).dreamWeaver.actions.find(item => JSON.stringify(item.command) === JSON.stringify(command));
  if (!entry) throw new Error(`No actual public Dream Weaver action: ${JSON.stringify(command)}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "织梦人" }).getAttribute("aria-busy")).toBe("false"));
}
async function submitCapturedRound(game: SavedGame, intent: SliceIntent) {
  if (intent.type !== "COMBAT_ROUND") throw new Error("The actual captured intent must be a combat round.");
  const battle = projectSliceState(game.state).combat!;
  const stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
  const stance = battle.stances.find(item => item.id === intent.stance)!;
  await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(stance.label) }));
  await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
  return screen.findByRole("dialog", { name: "战斗回合结果" });
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Dream Weaver navigation from preserved real Audience captures", () => {
  it("opens and closes the optional S3 route from all 354 original commands without changing the original history", async () => {
    const old = original(), capture = natural(), game = savedGame(old.final), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(354); expect(capture.prefixCount).toBe(354);
    expect(capture.commands.slice(0, capture.prefixCount)).toEqual(old.commands);
    expect(migrateSliceState(capture.departureStart)).toEqual(before);
    expect(before.progression.sequence).toBe(4); expect(before.manipulator.promotionWeek).toBe(74);
    expect(before.manipulator.encounter.enemy.status).toBe("SURRENDERED");
    expect(before.manipulator.encounter.enemy.mind).toBe(0); expect(before.manipulator.encounter.mentalPlague).toBe(0);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "织梦人当前目标" }).textContent).toContain("操纵师需消化100");
    const summary = screen.getByText("原身体、旧人格与继承记录", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false); await userEvent.click(summary);
    const history = screen.getByRole("region", { name: "织梦人继承记录" });
    expect(history.textContent).toContain("第74周真实晋升"); expect(history.textContent).toContain("MP4-RULAN-CLUB");
    expect(history.textContent).toContain("旧同意不能继承"); expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭织梦人页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("commits the actual guidance once and keeps the independent route open without repurposing old preparations", async () => {
    const captured = boundary("guidance"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "DREAM_WEAVER", command: { type: "LEARN_GUIDANCE" } });
    expect(migrateSliceState(natural().guidanceStart)).toEqual(before);
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "LEARN_GUIDANCE" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.cash).toBe(before.cash - 500);
    expect(game.state.dreamWeaver.guidanceKnown).toBe(true); expect(game.state.dreamWeaver.preparations).toEqual([]);
    expect(game.state.dreamWeaver.preparedWeek).toBeNull(); expectLegacyPreserved(game.state, before);
    expect(screen.getByRole("button", { name: "关闭织梦人页面" })).toBeTruthy();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("retries the same actual preparation envelope after a failed save without paying the fee or action twice", async () => {
    const captured = boundary("prepare-current-week"), game = savedGame(captured.beforeLast, true), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "DREAM_WEAVER", command: { type: "PREPARE_PROMOTION" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "PREPARE_PROMOTION" }));
    await screen.findByRole("alert"); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(actionButton(game.state, { type: "PREPARE_PROMOTION" }).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭织梦人页面" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.cash).toBe(before.cash - 120);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1); expect(game.state.week).toBe(before.week);
    expect(game.state.dreamWeaver.preparedWeek).toBe(before.week); expectLegacyPreserved(game.state, before);
    expect(screen.queryByRole("button", { name: "关闭织梦人页面" })).toBeNull();
    expect(actionButton(game.state, { type: "LEAVE_PREPARATION" }).disabled).toBe(false);
  }, 15_000);

  it("opens the prepared save automatically and retains its drawer after confirming the actual successful original bottle", async () => {
    const captured = boundary("promotion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "DREAM_WEAVER" || captured.lastIntent.command.type !== "CONSUME") throw new Error("The actual promotion must consume an original bottle.");
    const command = captured.lastIntent.command;
    expect(projectSliceState(before).dreamWeaver.insideCase).toBe(true);
    await mountGame(game); expect(screen.queryByRole("button", { name: "织梦人与有限外部身份" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立织梦人原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command));
    const review = screen.getByRole("region", { name: "织梦人原瓶服用确认" });
    expect(review.textContent).toContain(command.bottleId); expect(review.textContent).toContain("本阶身体性别不改变");
    expect(review.textContent).toContain("当前灵性不补满"); expect(within(review).queryByRole("checkbox")).toBeNull();
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(actionButton(game.state, command));
    await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.progression.sequence).toBe(3);
    expect(game.state.dreamWeaver.preparedWeek).toBeNull(); expect(game.state.dreamWeaver.manipulatorActingAtPromotion).toBe(100);
    expect(game.state.injuries).toEqual(before.injuries); expectLegacyPreserved(game.state, before);
    expect(screen.getByRole("region", { name: "织梦人当前目标" }).textContent).toContain("织梦人3");
    expect(screen.queryByRole("region", { name: "织梦人原瓶服用确认" })).toBeNull();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    await userEvent.click(screen.getByRole("button", { name: "关闭织梦人页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
  }, 15_000);

  it("returns the one real message without teleporting its owner, then follows the captured ordinary route before closing", async () => {
    const capture = natural(), captured = boundary("original-message-returned"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "DREAM_WEAVER", command: { type: "RETURN_MESSAGE" } });
    expect(before.dreamWeaver.life.practice.ownerNode).toBe("FAR"); expect(before.dreamWeaver.life.practice.message.holder).toBe("OWNER");
    const failedAttempt = before.dreamWeaver.life.cases["original-message"].attempts.at(-1)!;
    expect(failedAttempt.identityAttempted).toBe(true); expect(failedAttempt.identityCreated).toBe(false);
    expect(failedAttempt.messageReadBy).toBe("OWNER"); expect(failedAttempt.spiritualitySpent).toBe(5); expect(failedAttempt.ownerMindSpent).toBe(2);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "织梦人本次尝试与代价" }).textContent).toContain("本次能力尝试失败，原成本保留");
    expect(screen.getByRole("region", { name: "原留言实体" }).textContent).toContain("本人持有，实际在原远桌");
    expect(screen.queryByRole("button", { name: "关闭织梦人页面" })).toBeNull();
    await userEvent.click(actionButton(game.state, { type: "RETURN_MESSAGE" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(screen.getByRole("region", { name: "原留言实体" }).textContent).toContain("仍在原远桌");
    expect(screen.getByRole("region", { name: "织梦人当前原场" }).textContent).toContain("本人在原远桌");
    expect(actionButton(game.state, { type: "CLOSE", caseId: "original-message" }).disabled).toBe(true);
    expect(actionButton(game.state, { type: "VERIFY", caseId: "original-message" }).disabled).toBe(true);
    const returnedAt = capture.commands.findIndex(intent => intent.type === "DREAM_WEAVER" && intent.command.type === "RETURN_MESSAGE");
    expect(returnedAt).toBeGreaterThanOrEqual(capture.prefixCount);
    const closingCommands = capture.commands.slice(returnedAt + 1, returnedAt + 4);
    expect(closingCommands).toEqual([
      { type: "DREAM_WEAVER", command: { type: "MOVE", actor: "OWNER", to: "NEAR" } },
      { type: "DREAM_WEAVER", command: { type: "VERIFY", caseId: "original-message" } },
      { type: "DREAM_WEAVER", command: { type: "CLOSE", caseId: "original-message" } },
    ]);
    for (const intent of closingCommands) {
      if (intent.type !== "DREAM_WEAVER") throw new Error("Only the original captured scene commands may close this scene.");
      await userEvent.click(actionButton(game.state, intent.command)); await settled();
    }
    const practice = game.state.dreamWeaver.life.practice;
    expect(practice.ownerNode).toBe("NEAR"); expect(practice.identity).toBeNull(); expect(practice.activeCase).toBeNull();
    expect(practice.message).toEqual({ id: "DWV3-MESSAGE", ownerId: "DWV3-IRIS", holder: "FAR_DESK" });
    expect(practice.knownMessage).toEqual(before.dreamWeaver.life.practice.knownMessage);
    expect(game.state.dreamWeaver.life.cases["original-message"].attempts.at(-1)?.ownerTravelMetres).toBe(12);
    expect(game.state.dreamWeaver.life.cases["original-message"].result).toBe("ORDINARY");
    expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.mind).toBe(before.mind); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent, ...closingCommands]);
    await userEvent.click(screen.getByRole("button", { name: "关闭织梦人页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
  }, 15_000);

  it("returns from the actually digested S3 save to ordinary life and reopens growth without renewing anyone's consent", async () => {
    const game = savedGame(natural().practiced), before = structuredClone(game.state);
    expect(before.status).toBe("ACTIVE"); expect(before.progression.sequence).toBe(3); expect(before.progression.acting).toBe(100);
    expect(before.dreamWeaver.life.reflected).toBe(true); expect(before.dreamWeaver.life.practice.identity).toBeNull();
    expect(Object.values(before.dreamWeaver.life.cases).every(entry => entry.status === "RESOLVED" && entry.returned && !entry.contactOpen)).toBe(true);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "织梦人当前目标" }).textContent).toContain("操纵师消化100/100留存");
    const peopleSummary = screen.getByText("两位成年人的本次同意与状态", { selector: "summary" });
    expect(peopleSummary.closest("details")!.open).toBe(false); await userEvent.click(peopleSummary);
    const people = screen.getByRole("region", { name: "织梦人本次成年参与者" });
    for (const person of Object.values(before.dreamWeaver.life.practice.participants)) {
      expect(people.textContent).toContain(person.id); expect(people.textContent).toContain(`精神 ${person.mind} / 100`);
    }
    expect(people.textContent).toContain("当前未同意");
    await userEvent.click(screen.getByRole("button", { name: "关闭织梦人页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "织梦人" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("shows the real new opponent and saves the captured first round before replaying its unchanged result", async () => {
    const captured = boundary("combat-first"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(migrateSliceState(natural().combatStart)).toEqual(before);
    expect(before.combat?.encounterId).toBe("DREAM_WEAVER_DISPUTE"); expect(before.dreamWeaver.encounter.targetId).toBe("DWV3-OSMOND");
    expect(before.dreamWeaver.encounter.enemySpirituality).toBe(120);
    await mountGame(game);
    const battle = projectSliceState(before).combat!, stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain("奥斯蒙德");
    expect(within(stage).getByRole("heading", { name: battle.enemyName })).toBeTruthy();
    expect(battle.dreamWeaver).toBeTruthy(); expect(stage.textContent).toContain(battle.dreamWeaver!.summary);
    expect(game.submit).not.toHaveBeenCalled();
    const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    const round = game.state.lastCombatRound!, after = structuredClone(game.state);
    expect(round.dreamWeaverOutcome).toBeTruthy();
    const displayRound = projectSliceState(game.state).lastCombatRound!;
    const displayLabels = [
      "意志检定76≤78，本人5S+2M实付，一具有限外部身份在6米内短暂牵制减势26、与本人思想共通；至多60秒且本动作结束重归，没有第二份资源、装备、独立攻击次数或替死。",
      "原奥斯蒙德本人辨认梦像的精神抵抗：实际独立原灵性−3、余117/120；本轮下一次成功织成的梦像抵抗30%提高到70%，消费后或本轮结束失效，不无限抵抗，不借本人资源。",
      "本槽判断失衡，固定优势−22.5，不重抽。",
      "外部身份意志检定100>78失败，已付5S+2M不退，未出现第二身体或牵制。",
      "继承有限鳞片：实际2S、减势14×掌握，不豁免精神、身体伤势或死亡。",
      "继承本人有限防守人格：实际3S+本人1M、减势24，本动作结束真实重归；无实体代打、额外次数或伤害免疫。"
    ];
    const displayConsequence = "同一原奥斯蒙德在独立净空石院2米外，独立灵性120/120。同一原奥斯蒙德本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。本轮有限外部身份归并、梦像停止；真实精神与灵性消耗不退，既有感染不会因停像消失。";
    expect(displayRound.moves).toEqual(round.moves.map((move, index) => ({ ...move, label: displayLabels[index] })));
    expect(displayRound.consequence).toBe(displayConsequence);
    expect(round).toEqual(migrateSliceState(captured.final).lastCombatRound);
    expect(within(result).getByRole("heading", { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
    for (const label of displayLabels) expect(result.textContent).toContain(label);
    expect(result.textContent).toContain(displayConsequence);
    await userEvent.click(within(result).getByRole("checkbox", { name: "快速显示本回合结果" }));
    expect(game.state).toEqual(after);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
      const next = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
      const replay = within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: "summary" });
      await userEvent.click(replay); expect(replay.closest("details")!.open).toBe(true);
      for (const label of displayLabels) expect(replay.closest("details")!.textContent).toContain(label);
      expect(replay.closest("details")!.textContent).toContain(displayConsequence);
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    }
  }, 15_000);

  it("commits the actual third-round death and reloads a read-only archive without reviving anyone or restoring spent resources", async () => {
    const captured = boundary("combat-terminal"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const final = migrateSliceState(captured.final);
    expect(final).toEqual(migrateSliceState(natural().final));
    expect(final.status).toBe("DEAD"); expect(final.health).toBe(0); expect(final.ending?.kind).toBe("DEATH");
    expect(final.lastCombatRound?.round).toBe(3);
    expect(final.combat).toBeNull(); expect(final.dreamWeaver.encounter.terminal).toBeTruthy();
    expect(final.dreamWeaver.encounter.enemyHealth).toBe(100); expect(final.dreamWeaver.encounter.enemyMind).toBe(90);
    expect(final.dreamWeaver.encounter.enemySpirituality).toBe(95); expect(final.dreamWeaver.encounter.mentalPlague).toBe(2);
    expect(final.dreamWeaver.encounter.helpHistory).toEqual([]);
    await mountGame(game); const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(final); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    await userEvent.click(within(result).getByRole("button", { name: "查看收尾卷宗" }));
    expect(screen.getByRole("heading", { name: final.ending!.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    cleanup(); delete window.sliceGame;
    const reloaded = savedGame(captured.final); await mountGame(reloaded);
    expect(reloaded.state).toEqual(final); expect(reloaded.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: final.ending!.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull(); expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull();
    expect(reloaded.state.manipulator.encounter).toEqual(before.manipulator.encounter);
    expect(reloaded.state.dreamWeaver.encounter).toEqual(final.dreamWeaver.encounter);
    expect(reloaded.state).toEqual(final); expect(reloaded.submit).not.toHaveBeenCalled();
  }, 15_000);
});
