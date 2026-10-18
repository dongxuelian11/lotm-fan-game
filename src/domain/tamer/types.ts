import type { PublicResolutionTier } from '../../shared/contracts.js';

export const TAMER_ABILITY_IDS = [
  'moon.s8.taming',
  'moon.s8.animal-intent',
  'moon.s8.physical-enhancement',
] as const;
export type TamerAbilityId = typeof TAMER_ABILITY_IDS[number];
export const TAMER_ANIMAL_IDS = ['yard-hound', 'hillside-goat', 'rookery-raven'] as const;
export type TamerAnimalId = typeof TAMER_ANIMAL_IDS[number];

export type TamerAcquisitionCommand =
  | { type: 'LEARN_GUIDANCE' }
  | { type: 'POTION_WORK'; bottleId: string }
  | { type: 'BUY_POTION'; bottleId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true }
  | { type: 'REQUEST_SUPPLY' }
  | { type: 'RECEIVE_SUPPLY' };
export type TamerActivityCommand =
  | { type: 'OBSERVE'; animalId: string }
  | { type: 'BUY_FEED'; animalId: string }
  | { type: 'TRAIN'; animalId: string }
  | { type: 'INVITE'; animalId: string }
  | { type: 'ASSIST'; animalId: string }
  | { type: 'RETURN_ANIMAL' }
  | { type: 'REFLECT' };
export type TamerCommand = TamerAcquisitionCommand | TamerActivityCommand;

/** Original S8 finished bottles, independent of the clinic's S9 supply. */
export interface TamerBottle {
  id: string; source: string; labourSteps: number;
  acquiredWeek: number | null; consumedWeek: number | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; outcome: PublicResolutionTier | null;
}
/** Ordinary living animals remain with their original owners;同行 does not transfer ownership. */
export interface TamerAnimalState {
  observed: boolean; trained: boolean; helped: boolean;
  trainingAttemptWeek: number | null; helpAttemptWeek: number | null;
  location: 'HOME' | 'WITH_PLAYER';
  foodPurchased: number; foodHeld: number; foodUsed: number; foodWeek: number | null;
}
export interface TamerState {
  guidanceKnown: boolean;
  bottles: TamerBottle[];
  resupply: { requestedWeek: number | null; deliveries: number };
  promotionWeek: number | null;
  apothecaryActingAtPromotion: number | null;
  animals: Record<string, TamerAnimalState>;
  companionId: string | null;
  reflected: boolean;
}
export interface TamerAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TamerCommand;
}
export interface TamerAnimalProjection {
  id: string; title: string; story: string; observations: string[]; intent: string | null;
  status: string; location: string; foodHeld: number;
}
export interface TamerProjection {
  title: string; discovered: boolean; guidanceKnown: boolean; promoted: boolean;
  /** Finished-potion guidance does not reveal an unverified formula. */
  formulaKnown: false;
  formula: { name: string; quantity: number; unit: string }[];
  story?: string;
  animals: TamerAnimalProjection[];
  companionName: string | null;
  supplies: string;
  actions: TamerAction[];
  bottles: { id: string; title: string; source: string; status: string; chance: number; command: TamerCommand }[];
  abilities: { id: string; label: string; mastery: number; description: string }[];
  acting: number; digestion: string; pollution: number; risk: string;
}
