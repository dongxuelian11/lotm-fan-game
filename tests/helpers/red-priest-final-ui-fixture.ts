import { expect } from 'vitest';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { RedPriestAction, RedPriestProjection } from '../../src/domain/red-priest/types.js';
import { hash, json, type FilePin, type Row } from './red-priest-capture-fixture.js';
import { assertStoryBoundary, bindStoryRow, storyObserved, type StoryProof, type StoryRow } from './red-priest-story-fixture.js';
import { RED_PRIEST_FINAL_UI_OBSERVED } from './red-priest-final-ui-observed.js';

export interface FinalUiObservation {
  format: 'RED_PRIEST_CAPTURE_FINAL_UI_OBSERVED_V1'; proofSha256: string;
  runtimeFreezeSha256: string; saveRuntimeFreezeSha256: string;
  currentPublicSha256: string; playerChapterSha256: string; publicSliceSha256: string;
  /** Additional files only. The original156 and the story-only9 remain unchanged. */
  files: Record<string, FilePin>;
}
export interface FinalUiRow extends StoryRow {
  priorRuntimePublicBeforeSha256: string; priorRuntimePublicSha256: string;
  appendedTravelBefore: RedPriestAction | null; appendedTravelAfter: RedPriestAction | null;
  publicSliceBeforeSha256: string; publicSliceSha256: string;
  playerChapterBeforeSha256: string; playerChapterSha256: string; exactPlayerTextRelation: boolean;
}
export interface FinalUiProof extends Omit<StoryProof, 'replay'> {
  priorStoryProof: { proofFile: string; proofSha256: string };
  projectionContracts: { capture: string; persistence: string; relation: string; files: Array<FilePin & { file: string }> };
  publicSliceSha256: string; playerChapterSha256: string;
  travelNegativeTests: StoryProof['normalizerNegativeTests']; ineligibleTravelNegativeTests: StoryProof['normalizerNegativeTests'];
  replay: Omit<StoryProof['replay'], 'rows'> & { appendedTravelChecks: number; exactPlayerTextRelation: boolean; rows: FinalUiRow[] };
}
export function finalUiObserved(): FinalUiObservation {
  if (!RED_PRIEST_FINAL_UI_OBSERVED) throw Error('PENDING: require the completed reviewed final UI proof');
  return RED_PRIEST_FINAL_UI_OBSERVED;
}
export function finalUiProof(): FinalUiProof {
  const proof = json<FinalUiProof>('proofs/final-ui-equivalence.json');
  expect(proof.format).toBe('RED_PRIEST1051_FINAL_UI_TRANSITION_V1');
  expect(proof.priorStoryProof.proofSha256).toBe(storyObserved().proofSha256);
  expect(proof.continuedPublicSha256).toBe(finalUiObserved().currentPublicSha256);
  return proof;
}
/** Independent oracle for the one appended action in this sealed history. It
 * derives the exact original route/resource gate; it never changes state,
 * manufactures a command, or removes any existing action. */
export function stripCapturedGarrisonTravel(view: RedPriestProjection, state: SliceState): { prior: RedPriestProjection; appended: RedPriestAction | null } {
  const root = state.redPriest, frame = root.frame!, budget = frame.budget, campaign = root.campaign!;
  const eligible = budget.sequence === 1 && frame.location === 'loen-headquarters'
    && campaign.location !== 'loen-headquarters' && ['ARMISTICE', 'WITHDRAWN'].includes(campaign.phase);
  const prior = structuredClone(view);
  if (!eligible) return { prior, appended: null };
  expect(state.status).toBe('ACTIVE'); expect(budget.status).toBe('ACTIVE');
  expect(root.guidanceKnown).toBe(true); expect(root.source).not.toBeNull(); expect(root.journal.length).toBeLessThan(4096);
  expect(state.revision + 1).toBe(root.source!.revision + 2 + root.journal.length);
  expect(root.epilogue).toBeNull(); expect(campaign.phase).toBe('ARMISTICE'); expect(campaign.location).toBe('eastern-stores');
  expect(root.materials!.status).toBe('ACTIVE'); expect(campaign.nodes['eastern-stores']!.consolidated).toBe(true);
  // The five original route durations are1+1+2+1+2 weeks, at10p/week.
  const reason = budget.actions < 1 || budget.cash < 70 || budget.spirituality < 0 ? '实际行动、费用或灵性不足。' : null;
  const appended: RedPriestAction = { id: `red-priest-action-${view.actions.length}`,
    command: { type: 'TRAVEL', to: 'eastern-stores' }, label: '前往东南粮仓地',
    cost: '1行动；沿已行经大陆路线逐周结算旅费、生活费与旧还款', enabled: reason === null, reason };
  expect(view.actions.filter(action => action.command.type === 'TRAVEL' && action.command.to === campaign.location)).toHaveLength(1);
  expect(view.actions.at(-1)).toEqual(appended); prior.actions.pop();
  return { prior, appended };
}
export function assertFinalUiBoundary(view: RedPriestProjection, state: SliceState, captured: Row, check: FinalUiRow, priorStory: StoryRow, boundary: 'Before' | 'After'): void {
  bindStoryRow(check, captured); bindStoryRow(priorStory, captured);
  const before = boundary === 'Before', localHash = hash(view);
  expect(localHash).toBe(before ? check.publicBeforeSha256 : check.publicSha256);
  const { prior, appended } = stripCapturedGarrisonTravel(view, state);
  expect(check[`appendedTravel${boundary}`]).toEqual(appended);
  expect(hash(prior)).toBe(before ? check.priorRuntimePublicBeforeSha256 : check.priorRuntimePublicSha256);
  expect(hash(prior)).toBe(before ? priorStory.publicBeforeSha256 : priorStory.publicSha256);
  // The old story oracle then restores exactly its one field and compares the
  // complete captured hash. All pre-existing action IDs/order/costs survive.
  assertStoryBoundary(prior, state, captured, priorStory, boundary);
  expect(check.exactPlayerTextRelation).toBe(true);
  const player = projectPlayerText({ redPriest: view }, state.character.name).redPriest;
  expect(hash(player)).toBe(before ? check.playerChapterBeforeSha256 : check.playerChapterSha256);
  expect(hash(view), 'Read-only display transform preserves the authored projection').toBe(localHash);
}
