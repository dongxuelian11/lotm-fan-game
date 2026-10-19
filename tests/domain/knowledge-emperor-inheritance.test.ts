import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateSageState } from '../../src/domain/sage/index.js';
import { createKnowledgeEmperorState, knowledgeEmperorInheritedView, validateKnowledgeEmperorSource, validateKnowledgeEmperorState } from '../../src/domain/knowledge-emperor/index.js';
import { getKnowledgeEmperorCurrentSite, projectKnowledgeEmperorLife, validateKnowledgeEmperorLifeState } from '../../src/domain/knowledge-emperor/life.js';
import { KNOWLEDGE_EMPEROR_ABILITY_IDS, KNOWLEDGE_EMPEROR_SOURCE_KEYS } from '../../src/domain/knowledge-emperor/types.js';
import { ke, oldHermitRoots, originalSage, promoted, rejectIntent, sageNaturalPath, taught } from './knowledge-emperor-directed-helper.js';

describe('Knowledge Emperor actual651 inheritance and authoritative continuation', () => {
  it('pins the unmodified source bytes and651 commands, separately checks raw175 and current migrated format', () => {
    expect(createHash('sha256').update(readFileSync(sageNaturalPath)).digest('hex')).toBe('a0e37a9db792f8a6906efa92dbec3b13e0c1dff00ad9df492158b7d05b569766');
    const commands = readObjectEntry<SliceIntent[]>(sageNaturalPath, 'commands'), raw = readObjectEntry<SliceState>(sageNaturalPath, 'final'), frozen = structuredClone(raw);
    expect(commands).toHaveLength(651); expect(raw.schemaVersion).toBe(175);
    const s = migrateSliceState(raw); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(s.random).toEqual(raw.random); expect(s.random).toEqual({ seed: 'pryer-natural-v048', cursor: 340 });
    for (const key of KNOWLEDGE_EMPEROR_SOURCE_KEYS) expect(s[key], key).toEqual(raw[key]);
    expect(s.character).toEqual(raw.character); expect(s.injuries).toEqual(raw.injuries); expect(s.combatHistory).toEqual(raw.combatHistory); expect(raw).toEqual(frozen);
    expect(s.knowledgeEmperor).toEqual(createKnowledgeEmperorState()); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  }, 120_000);
  it('validates history against the actual pre-S1 snapshot, retaining serious source wounds while real clinic/rest heals the live body', () => {
    const s = promoted(), before = structuredClone(s), source = s.knowledgeEmperor.sourceScene!, view = knowledgeEmperorInheritedView(s);
    expect(source.character).toMatchObject({ name: '芙宁', gender: 'FEMALE', age: 26, coreStats: { physique: 28, perception: 25, will: 26, knowledge: 24 } });
    expect(source.budget).toMatchObject({ sequence: 2, health: 40, mind: 98, spirituality: 120, acting: 100, injuryRisk: 1 });
    expect(source.budget.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['HEAVY', null]]);
    expect(s.injuries).toEqual([]); expect(s.health).toBeGreaterThan(40); expect(s.character.coreStats).toEqual({ physique: 29, perception: 26, will: 27, knowledge: 25 });
    expect(view.character).toEqual(source.character); expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(source.budget.mastery);
    expect(view.health).toBe(40); expect(view.injuries).toEqual(source.budget.injuries); expect(view.revision).toBe(source.revision); expect(view.random).toEqual(source.random);
    expect(validateSageState(view)).toBe(true); expect(view.knowledgeEmperor).toEqual(createKnowledgeEmperorState()); expect(s).toEqual(before);
    expect(view.sage).not.toBe(s.sage); expect(view.sage.encounter.currentSite).not.toBe(s.sage.encounter.currentSite);
  }, 120_000);
  it('preserves every old learned and zero mastery, all eight roots and original13-skill resources through actual promotion', () => {
    const old = originalSage(), s = promoted();
    expect(oldHermitRoots(s)).toEqual(oldHermitRoots(old)); expect(s.knowledgeEmperor.sourceHistory).toEqual(Object.fromEntries(KNOWLEDGE_EMPEROR_SOURCE_KEYS.map(key => [key, old[key]])));
    expect(Object.keys(old.progression.mastery)).toHaveLength(13); expect(Object.values(old.progression.mastery).filter(v => v === 0)).toHaveLength(3);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
    for (const id of KNOWLEDGE_EMPEROR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(Object.keys(s.progression.mastery)).toHaveLength(15); expect(s.knowledgeEmperor.sageActingAtPromotion).toBe(100);
    expect(s.knowledgeEmperor.sourceScene!.originals.workshop).toEqual(old.scrollProfessor.workshop);
    expect(s.knowledgeEmperor.encounter.workshop).toEqual(old.scrollProfessor.workshop); expect(s.knowledgeEmperor.encounter.workshop).not.toBe(s.scrollProfessor.workshop);
    expect(s.knowledgeEmperor.sourceScene!.originals.workshop.scrolls.map(v => [v.id, v.materialId, v.status, v.usedWeek])).toEqual(old.scrollProfessor.workshop.scrolls.map(v => [v.id, v.materialId, v.status, v.usedWeek]));
    expect(s.combatHistory).toEqual(old.combatHistory); expect(validateKnowledgeEmperorSource(s)).toBe(true); expect(validateKnowledgeEmperorState(s)).toBe(true);
  }, 120_000);
  it('distinguishes the current archive leaf from the separately sealed disaster and never revives old Merrin or heals old adults', () => {
    const s = promoted(), r = s.sage.ritual, site = getKnowledgeEmperorCurrentSite(s);
    expect(site).toMatchObject({ siteId: 'SG2-ARCHIVE', playerLocation: 'OUTSIDE', clockSeconds: 510, body: 'SOLID', formEnergySpent: 4, assimilationExposure: 4,
      archive: { id: 'SG2-ARCHIVE-LEAF', location: 'B', readings: 2, verifications: 2 }, conduit: { id: 'SG2-CONDUIT', from: 'A', to: 'B', metres: 4, connected: true, traversals: 2 } });
    expect(site.materials.map(m => [m.status, m.location, m.wear])).toEqual([['RETURNED', 'OWNER', 2], ['RETURNED', 'OWNER', 2], ['RETURNED', 'OWNER', 4]]);
    expect(r).toMatchObject({ siteId: 'SAGE2-OLD-ARCHIVE', status: 'STOPPED', closure: 'SEALED', location: 'OUTSIDE', records: { total: 12, damaged: 5 }, plates: { total: 4, damaged: 2 },
      core: { active: false }, routes: { plate: { active: false }, index: { active: false } } });
    expect(r.people.map(p => [p.location, p.health, p.mind])).toEqual([['OUTSIDE', 88, 82], ['OUTSIDE', 91, 79]]); expect(r.people.every(p => p.injuries.length > 0)).toBe(true);
    expect(s.sage.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 100, enemySpirituality: 77, enemyPosition: 'YARD', weaponLocation: 'HAND' });
    expect(s.knowledgeEmperor.encounter).toMatchObject({ targetId: 'KE1-DARIAN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
  }, 120_000);
  it('shows the real original current location even before promotion, then advances only the cloned new site', () => {
    const fields = <T, K extends keyof T>(value: T, keys: readonly K[]) => Object.fromEntries(keys.map(key => [key, value[key]]));
    const expectedSite = (site: ReturnType<typeof getKnowledgeEmperorCurrentSite>) => ({
      ...fields(site, ['siteId', 'introducedWeek', 'clockSeconds', 'playerLocation', 'playerTravelMetres', 'playerEnergy', 'formEnergySpent', 'assimilationExposure', 'body']),
      introducedDate: site.introducedDate ? fields(site.introducedDate, ['epoch', 'year', 'month', 'day']) : null,
      form: fields(site.form, ['active', 'expiresAt', 'anchorId']),
      iris: site.iris ? fields(site.iris, ['id', 'name', 'age', 'alive', 'willing', 'location', 'energy', 'travelMetres', 'consent']) : null,
      record: site.record ? fields(site.record, ['id', 'owner', 'quantity', 'location', 'travelMetres']) : null,
      conduit: fields(site.conduit, ['id', 'from', 'to', 'metres', 'connected', 'traversals']),
      archive: fields(site.archive, ['id', 'owner', 'quantity', 'location', 'readings', 'verifications']),
      materials: site.materials.map(material => fields(material, ['id', 'caseId', 'ownerId', 'quantity', 'status', 'location', 'wear', 'paidPennies', 'preparedWeek'])),
      actorMoves: site.actorMoves.map(move => ({ ...fields(move, ['actorId', 'from', 'to', 'mode', 'metres', 'seconds']), ...(move.itemIds ? { itemIds: [...move.itemIds] } : {}) })),
    });
    const initial = originalSage(), initialFrozen = structuredClone(initial), initialSite = initial.sage.encounter.currentSite!, initialView = projectKnowledgeEmperorLife(initial);
    expect(initialView.site).toStrictEqual(expectedSite(initialSite)); expect(initialSite.source).not.toBeNull(); expect(initialView.site).not.toHaveProperty('source');
    expect(initial).toEqual(initialFrozen); expect(initial.random).toEqual(initialFrozen.random);
    initialView.site.playerEnergy--; initialView.site.iris!.energy--; initialView.site.record!.travelMetres++; initialView.site.materials[0]!.wear++;
    expect(initial).toEqual(initialFrozen); expect(initial.random).toEqual(initialFrozen.random);
    let s = promoted(); const old = oldHermitRoots(s), original = structuredClone(s.knowledgeEmperor.sourceScene!.originals);
    for (const command of [
      { type: 'OBSERVE', caseId: 'knowledge-power' }, { type: 'CONSENT', caseId: 'knowledge-power', permission: 'OWNER' },
      { type: 'PREPARE', caseId: 'knowledge-power', method: 'ORDINARY' }, { type: 'APPROACH', caseId: 'knowledge-power' },
    ] as const) s = ke(s, command);
    expect(getKnowledgeEmperorCurrentSite(s)).toMatchObject({ playerLocation: 'ENTRY', playerEnergy: 28, playerTravelMetres: 68 });
    expect(oldHermitRoots(s)).toEqual(old); expect(s.knowledgeEmperor.sourceScene!.originals).toEqual(original);
    expect(s.sage.encounter.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 30, clockSeconds: 510 }); expect(validateKnowledgeEmperorLifeState(s)).toBe(true);
    const frozen = structuredClone(s), view = projectKnowledgeEmperorLife(s);
    expect(view.site).toStrictEqual(expectedSite(getKnowledgeEmperorCurrentSite(s))); expect(view.site).not.toHaveProperty('source');
    expect(s).toEqual(frozen); expect(s.random).toEqual(frozen.random);
    view.site.playerEnergy--; view.site.materials[0]!.wear++;
    expect(s).toEqual(frozen); expect(s.random).toEqual(frozen.random);
  }, 120_000);
  it('closes real old acquisition, workshop, ritual, life and encounter commands after guidance and promotion', () => {
    for (const s of [taught(), promoted()]) {
      for (const intent of [
        { type: 'SAGE', command: { type: 'BUY_POTION', bottleId: 'sage-potion-2' } },
        { type: 'SAGE', command: { type: 'RITUAL_VISIT' } },
        { type: 'SAGE', command: { type: 'OBSERVE', caseId: 'information-route' } },
        { type: 'SAGE', command: { type: 'ENCOUNTER_FIGHT' } },
        { type: 'SCROLL_PROFESSOR', command: { type: 'BUY_KIT' } },
        { type: 'SCROLL_PROFESSOR', command: { type: 'CRAFT_SCROLL', kind: 'IMPACT' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      expect(oldHermitRoots(s)).toEqual(oldHermitRoots(originalSage()));
    }
  }, 120_000);
  it('rejects moved original bodies, refilled old materials, invented mastery, rewritten disaster and source substitution', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.coreStats.knowledge++; },
      s => { const id = Object.keys(s.progression.mastery).find(id => !KNOWLEDGE_EMPEROR_ABILITY_IDS.includes(id as typeof KNOWLEDGE_EMPEROR_ABILITY_IDS[number]) && s.progression.mastery[id] === 0)!; s.progression.mastery[id] = 8; },
      s => { s.progression.mastery[KNOWLEDGE_EMPEROR_ABILITY_IDS[0]] = 8; },
      s => { s.sage.encounter.currentSite!.playerLocation = 'B'; }, s => { s.sage.encounter.currentSite!.iris!.energy = 100; },
      s => { s.sage.encounter.currentSite!.materials[0]!.wear = 0; }, s => { s.sage.encounter.enemySpirituality = 120; },
      s => { s.sage.ritual.core.active = true; }, s => { s.sage.ritual.records.damaged = 0; }, s => { s.sage.ritual.people[0]!.health = 100; },
      s => { s.knowledgeEmperor.sourceScene!.originals.site = structuredClone(s.sage.life.site); },
      s => { s.knowledgeEmperor.sourceScene!.budget.health = 100; }, s => { s.knowledgeEmperor.sourceScene!.character.coreStats.knowledge++; },
      s => { s.knowledgeEmperor.sourceHistory!.sage.encounter.currentSite!.record!.travelMetres++; },
      s => { s.knowledgeEmperor.sageActingAtPromotion = 99; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validateKnowledgeEmperorState(s), change.toString()).toBe(false); }
  }, 120_000);
  it('rejects future schema, unsupportedS0 and another pathway rather than silently treating them as a valid continuation', () => {
    const s = promoted(); expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    for (const wrong of [
      { ...s, progression: { ...s.progression, sequence: 0 as const } },
      { ...s, progression: { ...s.progression, pathwayId: 'audience' as const } },
    ]) { expect(validateKnowledgeEmperorState(wrong)).toBe(false); expect(() => assertValidSliceState(wrong)).toThrow(); }
  }, 120_000);
});
