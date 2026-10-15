import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createAncientScholarState } from '../../src/domain/ancient-scholar/index.js';
import { ANCIENT_SCHOLAR_ABILITY_IDS } from '../../src/domain/ancient-scholar/types.js';
import { addGameYears } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { AncientScholarActivityCommand, AncientScholarCaseId } from '../../src/domain/ancient-scholar/life.js';
import { applyAncientScholarActivity } from '../../src/domain/ancient-scholar/life.js';
/** Directed post-promotion unit fixture only. The unchanged natural S4 prefix,
 * full 300-year ritual and real random promotion are exercised elsewhere. */
export function ancientScholarPracticeFixture(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/bizarro-sorcerer-v01170/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.ancientScholar = createAncientScholarState(); s.date = addGameYears(s.date, 300); s.week += 15653;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.promotionWeek = s.week;
  s.ancientScholar.promotionWeek = s.week; s.ancientScholar.bizarroActingAtPromotion = 100; s.ancientScholar.formulaKnown = true;
  s.ancientScholar.ritual.location = 'RECEPTION'; s.ancientScholar.ritual.phase = 'RETURNED'; s.ancientScholar.ritual.eraClosedDate = { ...old.date };
  s.ancientScholar.ritual.records.forEach(r => { r.obtainedDate = { ...old.date }; r.verifiedDate = { ...old.date }; r.copyId = `${r.id}:VERIFIED-COPY`; r.verification = 'Directed test fixture of already verified original records'; });
  s.ancientScholar.ritual.objects = ['BR4-CARRIER-1', 'BR4-TAG-1'].map(id => ({ id, source: 'Directed test fixture of retained original objects', disposition: 'PRESERVED', text: 'Same original' }));
  for (const id of ANCIENT_SCHOLAR_ABILITY_IDS) s.progression.mastery[id] = 0;
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 40000; s.health = 90; s.mind = 100; s.spirituality = 120;
  s.character.coreStats.knowledge = 30; return s;
}
export function ancientScholarPracticeContext(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
export function practiceAct(s: SliceState, c: AncientScholarActivityCommand, roll = 1) { const ctx = ancientScholarPracticeContext(s, roll); applyAncientScholarActivity(s, c, ctx); s.revision++; return ctx; }
export function practiceBegin(s: SliceState, caseId: AncientScholarCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.ancientScholar.life.cases[caseId].status === 'AVAILABLE') practiceAct(s, { type: 'OBSERVE', caseId });
  practiceAct(s, { type: 'PREPARE', caseId, method }); practiceAct(s, { type: 'PERFORM', caseId });
}
export function practiceClose(s: SliceState, caseId: AncientScholarCaseId) { practiceAct(s, { type: 'RETURN_TO_PRESENT' }); practiceAct(s, { type: 'CLOSE', caseId }); }
export function practiceOrdinary(s: SliceState, caseId: AncientScholarCaseId) { practiceBegin(s, caseId); practiceClose(s, caseId); practiceAct(s, { type: 'REPORT', caseId }); }
