/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

// Each row names a distinct pathway and its saved peaceful S5 checkpoint.
// Never patch a fixture or public projection to make navigation reachable.
const routes = [
  ["diviner", "marionettist", "秘偶大师", "marionettist-v0950"],
  ["hunter", "reaper", "收割者", "reaper-v0960"],
  ["audience", "dreamwalker", "梦境行者", "dreamwalker-v0970"],
  ["paragon", "astronomer", "天文学家", "astronomer-v0980"],
  ["moon", "crimsonScholar", "深红学者", "crimson-scholar-v0990"],
  ["darkness", "spiritWarlock", "灵巫", "spirit-warlock-v01000"],
  ["white-tower", "mysticismMagister", "秘术导师", "mysticism-magister-v01010"],
  ["tyrant", "oceanSinger", "海洋歌者", "ocean-singer-v01020"],
  ["sun", "priestOfLight", "光之祭司", "priest-of-light-v01030"],
  ["death", "gatekeeper", "看门人", "gatekeeper-v01040"],
  ["door", "traveler", "旅行家", "traveler-v01050"],
  ["error", "dreamStealer", "窃梦家", "dream-stealer-v01060"],
  ["warrior", "guardian", "守护者", "guardian-v01070"],
  ["demoness", "pain", "痛苦魔女", "pain-v01080"],
  ["hermit", "starMystic", "星象师", "star-mystic-v01090"],
  ["hanged-man", "shepherd", "牧羊人", "shepherd-v01100"],
  ["abyss", "desireApostle", "欲望使徒", "desire-apostle-v01110"],
  ["chained", "wraith", "怨魂", "wraith-v01120"],
  ["wheel", "winner", "赢家", "winner-v01130"],
  ["black-emperor", "mentorDisorder", "混乱导师", "mentor-disorder-v01140"],
  ["justiciar", "punishmentKnight", "惩戒骑士", "punishment-knight-v01150"],
  ["mother", "druid", "德鲁伊", "druid-v01160"],
] as const;

function practicedProjection(folder: string): SliceProjection {
  const capture = JSON.parse(readFileSync(`tests/fixtures/${folder}/natural.json`, "utf8"));
  return projectSliceState(migrateSliceState(capture.practiced));
}

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({
      ok: true as const,
      value: {
        mode: "browser" as const,
        activeState: state,
        runs: [{
          runId: state.runId,
          name: state.character.name,
          portraitId: state.character.portraitId,
          week: state.week,
          date: state.date,
          status: state.status,
          revision: state.revision,
          updatedAt: "2026-10-12T00:00:00Z",
        }],
      },
    })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(),
  };
}

async function enter(state: SliceProjection, api: SliceBridge) {
  window.sliceGame = api;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", {
    name: (name) => name.includes(state.character.name),
  }));
  await screen.findByRole("heading", { name: "人物卷宗" });

  // Some saved peaceful checkpoints still retain the previous combat receipt.
  // Dismiss it through the real UI instead of clearing saved state in the test.
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) {
    await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  }
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  delete window.sliceGame;
  vi.restoreAllMocks();
});

describe("All 22 actual S5 saves through SliceApp navigation", () => {
  it.each(routes)("opens %s / %s current S5 growth without submitting an intent", async (pathwayId, key, name, folder) => {
    const state = practicedProjection(folder);
    expect(state.progression).toMatchObject({ pathwayId, sequence: 5 });
    expect(state.status).toBe("ACTIVE");
    expect(state.activeEvent).toBeNull();
    expect(state.combat).toBeNull();
    expect(state[key].promoted).toBe(true);
    expect(state[key].title).toBe(`${name} · 序列5`);

    const api = bridge(state);
    await enter(state, api);
    expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));

    const growth = within(screen.getByRole("dialog", { name: "非凡成长" }));
    const currentPanel = growth.getByRole("region", { name: `${name}成长下一步` });
    expect(within(currentPanel).getByRole("heading", { name: `${name} · 序列5` })).toBeTruthy();
    const choices = within(growth.getByRole("group", { name: "选择成长卷宗" }));
    const currentTab = choices.getByRole("button", { name: `${name}成长` });
    expect(choices.getAllByRole("button", { pressed: true })).toEqual([currentTab]);
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
