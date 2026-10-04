export type Mode = 'reaction' | 'target' | 'flick' | 'tracking';
export type TargetSize = 'easy' | 'medium' | 'hard';
export type Speed = 'slow' | 'steady' | 'fast';
export type AimGame = 'valorant' | 'cs2';
export type AimMode = 'cursor' | 'fps';
export interface GameAimSettings { dpi: string; sensitivity: string }
export interface AimPreferences {
  mode: AimMode;
  game: AimGame;
  profiles: Record<AimGame, GameAimSettings>;
  calibrationUnitsPerCm: Record<AimGame, number | null>;
}
export interface AimProfile {
  game: AimGame;
  dpi: number;
  sensitivity: number;
  cm360: number;
  inputUnitsPerCm: number;
}
export interface Settings { duration: 30 | 60; size: TargetSize; speed: Speed }
export interface RunConfig { mode: Mode; settings: Settings; reactionStyle: 'rounds' | 'timed'; guided: boolean; aim?: AimProfile }
export interface SessionResult {
  id: string;
  mode: Mode;
  settings: Settings;
  reactionStyle: 'rounds' | 'timed';
  guided: boolean;
  aim?: AimProfile;
  completedAt: string;
  activeMs: number;
  hits: number;
  misses: number;
  premature: number;
  reactionTimes: number[];
  averageHitMs: number;
  trackingMs: number;
}
export type Phase = 'countdown' | 'running' | 'paused' | 'completed';
export interface Snapshot {
  phase: Phase;
  countdown: number;
  elapsedMs: number;
  remainingMs: number;
  hits: number;
  misses: number;
  reactionTimes: number[];
  reactionState: 'waiting' | 'ready' | 'early' | 'result';
  trackingPercent: number;
  averageHitMs: number;
}
export const MODES: { id: Mode; name: string; short: string; description: string; instruction: string }[] = [
  { id: 'target', name: 'Target practice', short: 'Precision', description: 'Click each new target. Measure hits per second.', instruction: 'Each hit places a new target in the arena. Clicks outside the target count as misses. Your score is hits per second of active time.' },
  { id: 'reaction', name: 'Reaction test', short: 'Reflexes', description: 'Wait for red. Measure your reaction time.', instruction: 'Wait for red and “Click now!”, then click anywhere in the arena. Early clicks don’t count; click to retry. Solo drills end after five valid reactions. The guided warmup runs this drill for 30 seconds. Your score is the median reaction time.' },
  { id: 'flick', name: 'Flick practice', short: 'Speed', description: 'Alternate sides. Measure time to hit.', instruction: 'Click targets alternating between opposite sides of the arena. Misses do not move the target. Your score is the average time from each target appearing to a hit.' },
  { id: 'tracking', name: 'Tracking practice', short: 'Control', description: 'Follow the moving target. Measure time on target.', instruction: 'Keep your cursor inside the moving target. No clicking needed. Your score is the percentage of active time spent on target.' },
];
export const DEFAULT_SETTINGS: Settings = { duration: 30, size: 'medium', speed: 'steady' };
export const TARGET_DIAMETERS: Record<TargetSize, number> = { easy: 76, medium: 52, hard: 32 };
export const ROUTINE: { mode: Mode; duration: 30 | 60 }[] = [
  { mode: 'reaction', duration: 30 }, { mode: 'target', duration: 60 },
  { mode: 'flick', duration: 30 }, { mode: 'tracking', duration: 60 },
];
