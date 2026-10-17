export const TOWN_CLUB_ID = 'town-short-club';
export type TownClubLocation = 'SHOP' | 'BAG' | 'HAND';
export type TownCommand =
  | { type: 'VISIT_SHOP' }
  | { type: 'BUY_CLUB' }
  | { type: 'SELL_CLUB' }
  | { type: 'EQUIP_CLUB' }
  | { type: 'UNEQUIP_CLUB' }
  | { type: 'BUY_BANDAGE' }
  | { type: 'USE_BANDAGE' };

/** One original club and three bandages; ownership is derived from their location. */
export interface TownState {
  shopKnown: boolean;
  clubLocation: TownClubLocation;
  bandagesStock: number;
  bandagesHeld: number;
  bandagesUsed: number;
}
export interface TownAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TownCommand;
}
export interface TownItem {
  id: string; label: string; description: string; quantity: number;
  location: TownClubLocation; owner: 'SHOP' | 'PLAYER' | 'BORROWED'; equipped: boolean;
}
export interface TownProjection {
  title: string; shopKnown: boolean; items: TownItem[]; actions: TownAction[]; stockSummary: string;
}
