import { PATTERN_COUNT, TILE_MODES } from './tileTypes';
import type { TileMode, TileRun } from './tileTypes';

const STORAGE_KEY = 'warmup.tiles.v1';
const HISTORY_LIMIT = 60;

interface StoredTileProgress {
  version: 1;
  recent: TileRun[];
  best: TileRun[];
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function count(value: unknown): value is number {
  return nonnegative(value) && Number.isSafeInteger(value);
}

function isCompletePattern(run: TileRun): boolean {
  return run.reason === 'complete' && run.patterns === PATTERN_COUNT && run.taps === PATTERN_COUNT * 4;
}

function isTileRun(value: unknown): value is TileRun {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const run = value as Partial<TileRun>;
  if (typeof run.id !== 'string' || run.id.trim().length === 0
    || !TILE_MODES.some((mode) => mode.id === run.mode)
    || typeof run.completedAt !== 'string' || !Number.isFinite(Date.parse(run.completedAt))
    || !nonnegative(run.activeMs) || !count(run.taps) || !count(run.patterns)
    || (run.reason !== 'white' && run.reason !== 'timeout' && run.reason !== 'complete')) return false;

  if (run.mode !== 'pattern') return run.patterns === 0 && run.reason !== 'complete';
  if (run.taps > PATTERN_COUNT * 4 || run.patterns !== Math.floor(run.taps / 4)) return false;
  return run.reason === 'complete'
    ? run.patterns === PATTERN_COUNT && run.taps === PATTERN_COUNT * 4
    : run.reason === 'white' && run.patterns < PATTERN_COUNT;
}

function newestFirst(a: TileRun, b: TileRun): number {
  return Date.parse(b.completedAt) - Date.parse(a.completedAt);
}

function uniqueRuns(runs: TileRun[]): TileRun[] {
  const seen = new Set<string>();
  return runs.filter((run) => {
    if (seen.has(run.id)) return false;
    seen.add(run.id);
    return true;
  });
}

function isBetter(candidate: TileRun, current: TileRun): boolean {
  return candidate.mode === 'pattern'
    ? candidate.activeMs < current.activeMs
    : candidate.taps > current.taps;
}

export function getTileBest(runs: TileRun[], mode: TileMode): TileRun | undefined {
  let best: TileRun | undefined;
  for (const run of runs) {
    if (run.mode !== mode || !isTileRun(run) || (run.mode === 'pattern' && !isCompletePattern(run))) continue;
    if (!best || isBetter(run, best)) best = run;
  }
  return best;
}

export function tileScoreLabel(result: TileRun): string {
  if (result.mode !== 'pattern') return `${result.taps} tiles`;
  return isCompletePattern(result) ? `${(result.activeMs / 1000).toFixed(2)} s` : '—';
}

function collectBests(runs: TileRun[]): TileRun[] {
  const best = new Map<TileMode, TileRun>();
  for (const run of runs) {
    if (run.mode === 'pattern' && !isCompletePattern(run)) continue;
    const previous = best.get(run.mode);
    if (!previous || isBetter(run, previous)) best.set(run.mode, run);
  }
  return [...best.values()];
}

function parseStored(raw: string | null): StoredTileProgress {
  const empty: StoredTileProgress = { version: 1, recent: [], best: [] };
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return empty;
    const value = parsed as Partial<StoredTileProgress>;
    if (value.version !== 1 || !Array.isArray(value.recent) || !Array.isArray(value.best)) return empty;
    const recent = uniqueRuns(value.recent.filter(isTileRun)).sort(newestFirst).slice(0, HISTORY_LIMIT);
    const best = collectBests(uniqueRuns([...value.best.filter(isTileRun), ...recent]));
    return { version: 1, recent, best };
  } catch {
    return empty;
  }
}

export function readTileRuns(): TileRun[] {
  try {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    return uniqueRuns([...stored.recent, ...stored.best]).sort(newestFirst);
  } catch {
    return [];
  }
}

export function saveTileRun(result: TileRun): boolean {
  if (!isTileRun(result)) return false;
  try {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    const recent = uniqueRuns([result, ...stored.recent]).sort(newestFirst).slice(0, HISTORY_LIMIT);
    const best = collectBests(uniqueRuns([result, ...stored.best, ...stored.recent]));
    const next: StoredTileProgress = { version: 1, recent, best };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
