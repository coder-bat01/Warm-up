import type { Phase } from './types';

export type TileMode = 'frenzy' | 'endurance' | 'pattern';
export type TileEndReason = 'white' | 'timeout' | 'complete';
export const PATTERN_COUNT = 10;

export interface TileRun {
  id: string;
  mode: TileMode;
  completedAt: string;
  activeMs: number;
  taps: number;
  patterns: number;
  reason: TileEndReason;
}

export interface TileSnapshot {
  phase: Phase;
  countdown: number;
  elapsedMs: number;
  remainingMs: number;
  taps: number;
  patterns: number;
}

export const TILE_MODES: { id: TileMode; name: string; short: string; rule: string; description: string; instruction: string }[] = [
  { id: 'frenzy', name: 'Frenzy', short: '30 seconds', rule: '30 seconds · most black tiles wins', description: 'Tap black tiles for 30 seconds. Each hit moves a tile. Touching white ends the round.', instruction: 'Tap any black tile to replace it with a new one. Score as many taps as you can in 30 active seconds. One white-tile tap ends the round.' },
  { id: 'endurance', name: 'Endurance', short: 'Keep going', rule: '10 seconds · earn 10 more every 40 taps', description: 'Start with 10 seconds. Every 40 black-tile taps adds 10 more. Keep going without touching white.', instruction: 'Start with 10 active seconds. Every 40 successful black-tile taps adds 10 seconds to the time remaining. Keep going until time runs out or you tap a white tile.' },
  { id: 'pattern', name: 'Pattern', short: 'Clear 10 boards', rule: '10 patterns · fastest complete run wins', description: 'Clear four black tiles in any order. Finish 10 patterns as fast as you can. Touching white ends the round.', instruction: 'Clear all four black tiles in each pattern, in any order. Cleared tiles are marked with a check and cannot score twice. Finish 10 patterns (40 tiles) as quickly as possible. One white-tile tap ends the round; only complete runs set a best time.' },
];
