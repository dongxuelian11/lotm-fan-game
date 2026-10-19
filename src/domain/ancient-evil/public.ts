import { publicPryerDate, publicPryerFields as fields, publicPryerInjury } from '../sage/life.js';
import { PRISONER_ABILITY_IDS } from '../prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../madman/types.js';
import { WEREWOLF_ABILITY_IDS } from '../werewolf/types.js';
import { ZOMBIE_ABILITY_IDS } from '../zombie/types.js';
import { WRAITH_ABILITY_IDS } from '../wraith/types.js';
import { PUPPET_ABILITY_IDS } from '../puppet/types.js';
import { SILENT_DISCIPLE_ABILITY_IDS } from '../silent-disciple/types.js';
import { ANCIENT_EVIL_ABILITY_IDS } from './types.js';
import type { AncientEvilAcquisitionBudget } from './types.js';
import type { AncientEvilBlock, AncientEvilCombatBody } from './encounter.js';
import type { AncientEvilOperationState } from './life.js';
import type { SilentDiscipleAttempt, SilentDiscipleLifeState } from '../silent-disciple/life.js';
import type { SilentDiscipleReflection } from '../silent-disciple/encounter.js';
import type { PuppetRoundOutcome } from '../puppet/combat.js';
import type { SilentDiscipleRoundOutcome } from '../silent-disciple/combat.js';

export const ANCIENT_EVIL_PUBLIC_MASTERY_IDS = [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS, ...ZOMBIE_ABILITY_IDS, ...WRAITH_ABILITY_IDS, ...PUPPET_ABILITY_IDS, ...SILENT_DISCIPLE_ABILITY_IDS, ...ANCIENT_EVIL_ABILITY_IDS];
export const publicAncientEvilMastery = (m: Record<string, number>): Record<string, number> => Object.fromEntries(ANCIENT_EVIL_PUBLIC_MASTERY_IDS.filter(id => Object.hasOwn(m, id)).map(id => [id, m[id]!]));
export function publicAncientEvilBudget(b: AncientEvilAcquisitionBudget): AncientEvilAcquisitionBudget { return {
  ...fields(b, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'injuryRisk']),
  coreStats: fields(b.coreStats, ['physique', 'perception', 'will', 'knowledge']), mastery: publicAncientEvilMastery(b.mastery), completedSources: [...b.completedSources], injuries: b.injuries.map(publicPryerInjury),
}; }
function publicOriginalAttempt(a: SilentDiscipleAttempt): SilentDiscipleAttempt { return {
  ...fields(a, ['week', 'method', 'closed', 'result', 'initialSpirituality', 'initialMind', 'elapsedSeconds', 'playerTravelMetres', 'spiritualitySpent', 'mindSpent', 'resolutionPaid', 'resolutionActions', 'consent', 'withdrawn', 'identityRead', 'noteRead', 'identityCompared', 'comparedForm', 'itemsStored', 'itemsReturned', 'abilityTier', 'abilitySourceId', 'abilityAtSecond', 'inputActive', 'stopped', 'formRemainingSeconds', 'linkRemainingSeconds', 'linkState', 'waitedSeconds', 'waitCompleted', 'released', 'ordinaryChecked', 'outcomeRecorded', 'outcome']),
  date: publicPryerDate(a.date), playerMoves: a.playerMoves.map(m => ({ ...fields(m, ['from', 'to', 'mode', 'metres', 'seconds']), itemIds: [...m.itemIds] })),
  steps: a.steps.map(s => fields(s, ['type', 'tier', 'atSecond', 'volunteerWilling'])), evidence: a.evidence.map(e => fields(e, ['sourceId', 'text', 'atSecond'])),
}; }
/** Keep the same original people, bodies and objects without copying authority snapshots. */
export function publicChainedOriginalSite<T extends Omit<SilentDiscipleLifeState, 'playerLocation'> & { playerLocation: string }>(s: T): Omit<SilentDiscipleLifeState, 'playerLocation'> & { playerLocation: T['playerLocation'] } {
  const projectCase = (c: SilentDiscipleLifeState['cases'][keyof SilentDiscipleLifeState['cases']]) => ({ ...fields(c, ['status', 'observedWeek', 'method', 'result', 'contactOpen', 'returned', 'closes', 'withdrawals']), attempts: c.attempts.map(publicOriginalAttempt) });
  return {
    ...fields(s, ['siteId', 'introducedWeek', 'activeCase', 'playerLocation', 'playerTravelMetres', 'clockSeconds', 'reflected']), introducedDate: s.introducedDate ? publicPryerDate(s.introducedDate) : null,
    volunteer: { ...fields(s.volunteer, ['id', 'name', 'age', 'alive', 'willing', 'location', 'bodyId', 'form', 'health', 'mind', 'spirituality']), injuries: [] },
    guide: fields(s.guide, ['id', 'name', 'location']), clothing: fields(s.clothing, ['id', 'owner', 'quantity', 'location', 'worn']), bag: fields(s.bag, ['id', 'owner', 'quantity', 'location']), tray: fields(s.tray, ['id', 'location', 'privacy']),
    note: { ...fields(s.note, ['id', 'quantity', 'location']), records: s.note.records.map(r => fields(r, ['caseId', 'text'])) },
    cases: { 'original-body': projectCase(s.cases['original-body']), 'revoked-form': projectCase(s.cases['revoked-form']), 'measured-link': projectCase(s.cases['measured-link']) },
    moon: fields(s.moon, ['id', 'status', 'announcedWeek', 'choice', 'startedWeek', 'initialMind', 'initialCash', 'mindSpent', 'cashSpent', 'remainingSeconds', 'elapsedSeconds']),
  };
}
export function publicAncientEvilOperation(o: AncientEvilOperationState): AncientEvilOperationState { return {
  ...fields(o, ['door', 'inputActive']), form: o.form ? fields(o.form, ['subjectId', 'bodyId', 'sourceAbilityId', 'sourceCaseId', 'originalForm', 'currentForm', 'castAt', 'expiresAt']) : null,
}; }
export const publicAncientEvilBlock = (b: AncientEvilBlock): AncientEvilBlock => fields(b, ['id', 'owner', 'status', 'location', 'usedRound']);
export const publicChainedReflection = (r: SilentDiscipleReflection): SilentDiscipleReflection => fields(r, ['round', 'severity', 'playerDamage', 'enemyDamage', 'playerInjuryId', 'enemyInjuryId']);
export function publicAncientEvilBody(b: AncientEvilCombatBody): AncientEvilCombatBody { return {
  ...fields(b, ['enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'enemyRisk', 'emotion', 'weaponLocation', 'enemyForm', 'enemyFormUntilSeconds', 'blocksPurchased', 'form', 'formUntilSeconds', 'link', 'linkRound', 'lastFormRound', 'contactAttempts', 'formAttempts', 'breakLinkUses', 'contactDistanceMetres', 'transfigurationAttempts', 'transfigurationSuccesses', 'pickUpUses']),
  enemyInjuries: b.enemyInjuries.map(publicPryerInjury), powerUses: fields(b.powerUses, ['DREAM_SPIKE', 'DREAM_WARD', 'RESIST_FORM']), blocks: b.blocks.map(publicAncientEvilBlock), reflectionHistory: b.reflectionHistory.map(publicChainedReflection),
}; }
/** Older outcomes have no random stream fields; only their private replay source is omitted here. */
export function projectPuppetRoundOutcome(o: PuppetRoundOutcome): Omit<PuppetRoundOutcome, 'source'> { const { source, ...facts } = structuredClone(o); return facts; }
export function projectSilentDiscipleRoundOutcome(o: SilentDiscipleRoundOutcome): Omit<SilentDiscipleRoundOutcome, 'source'> { const { source, ...facts } = structuredClone(o); return facts; }
