import type { Mode, RunConfig, SessionResult } from './types';
import { isAimProfile } from './sensitivity';

const STORAGE_KEY = 'warmup.sessions.v1';
const HISTORY_LIMIT = 60;

interface StoredProgress {
  version: 1;
  recent: SessionResult[];
  best: SessionResult[];
}

type ScoringConfig = RunConfig | SessionResult;

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function count(value: unknown): value is number {
  return nonnegative(value) && Number.isSafeInteger(value);
}

function isSession(value: unknown): value is SessionResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const session = value as Partial<SessionResult>;
  const settings = session.settings;
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return false;
  return typeof session.id === 'string' && session.id.length > 0
    && typeof session.mode === 'string' && ['reaction', 'target', 'flick', 'tracking'].includes(session.mode)
    && (settings.duration === 30 || settings.duration === 60)
    && typeof settings.size === 'string' && ['easy', 'medium', 'hard'].includes(settings.size)
    && typeof settings.speed === 'string' && ['slow', 'steady', 'fast'].includes(settings.speed)
    && (session.reactionStyle === 'rounds' || session.reactionStyle === 'timed')
    && typeof session.guided === 'boolean'
    && typeof session.completedAt === 'string' && Number.isFinite(Date.parse(session.completedAt))
    && nonnegative(session.activeMs)
    && count(session.hits) && count(session.misses) && count(session.premature)
    && Array.isArray(session.reactionTimes) && session.reactionTimes.every(nonnegative)
    && nonnegative(session.trackingMs) && session.trackingMs <= session.activeMs
    && (session.aim === undefined || isAimProfile(session.aim));
}

function newestFirst(a: SessionResult, b: SessionResult): number {
  return Date.parse(b.completedAt) - Date.parse(a.completedAt);
}

function uniqueSessions(sessions: SessionResult[]): SessionResult[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (seen.has(session.id)) return false;
    seen.add(session.id);
    return true;
  });
}

export function settingsKey(config: ScoringConfig): string {
  const { mode, settings, reactionStyle } = config;
  if (mode === 'reaction') {
    return reactionStyle === 'rounds' ? 'reaction:rounds' : `reaction:timed:${settings.duration}`;
  }
  const key = `${mode}:${settings.duration}:${settings.size}${mode === 'tracking' ? `:${settings.speed}` : ''}`;
  if (!config.aim) return key;
  return `${key}:aim:${config.aim.game}:${config.aim.dpi}:${config.aim.sensitivity}:${config.aim.inputUnitsPerCm}`;
}

export function scoreValue(result: SessionResult): number | null {
  if (result.mode === 'reaction') {
    if (result.reactionTimes.length === 0) return null;
    const times = [...result.reactionTimes].sort((a, b) => a - b);
    const middle = Math.floor(times.length / 2);
    return times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
  }
  if (result.mode === 'flick') return result.hits > 0 ? result.averageHitMs : null;
  if (result.activeMs <= 0) return null;
  if (result.mode === 'target') return result.hits * 1000 / result.activeMs;
  return Math.min(100, result.trackingMs / result.activeMs * 100);
}

export function metricName(mode: Mode): string {
  switch (mode) {
    case 'reaction': return 'Median reaction';
    case 'target': return 'Hits per second';
    case 'flick': return 'Average hit time';
    case 'tracking': return 'On-target coverage';
  }
}

export function scoreLabel(result: SessionResult): string {
  const score = scoreValue(result);
  if (score === null) return '—';
  if (result.mode === 'target') return `${score.toFixed(2)} hits/s`;
  if (result.mode === 'tracking') return `${score.toFixed(1)}%`;
  return `${Math.round(score)} ms`;
}

function isBetter(candidate: SessionResult, current: SessionResult): boolean {
  const next = scoreValue(candidate);
  const previous = scoreValue(current);
  if (next === null) return false;
  if (previous === null) return true;
  return candidate.mode === 'reaction' || candidate.mode === 'flick' ? next < previous : next > previous;
}

export function getBest(sessions: SessionResult[], config: ScoringConfig): SessionResult | undefined {
  const key = settingsKey(config);
  let best: SessionResult | undefined;
  for (const session of sessions) {
    if (settingsKey(session) !== key || scoreValue(session) === null) continue;
    if (!best || isBetter(session, best)) best = session;
  }
  return best;
}

function collectBests(sessions: SessionResult[]): SessionResult[] {
  const best = new Map<string, SessionResult>();
  for (const session of sessions) {
    if (scoreValue(session) === null) continue;
    const key = settingsKey(session);
    const previous = best.get(key);
    if (!previous || isBetter(session, previous)) best.set(key, session);
  }
  return [...best.values()];
}

function parseStored(raw: string | null): StoredProgress {
  const empty: StoredProgress = { version: 1, recent: [], best: [] };
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return empty;
    const value = parsed as Partial<StoredProgress>;
    if (value.version !== 1 || !Array.isArray(value.recent) || !Array.isArray(value.best)) return empty;
    const recent = uniqueSessions(value.recent.filter(isSession)).sort(newestFirst).slice(0, HISTORY_LIMIT);
    const best = collectBests(uniqueSessions([...value.best.filter(isSession), ...recent]));
    return { version: 1, recent, best };
  } catch {
    return empty;
  }
}

export function readSessions(): SessionResult[] {
  try {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    return uniqueSessions([...stored.recent, ...stored.best]).sort(newestFirst);
  } catch {
    return [];
  }
}

export function saveSession(result: SessionResult): boolean {
  if (!isSession(result)) return false;
  try {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    const recent = uniqueSessions([result, ...stored.recent]).sort(newestFirst).slice(0, HISTORY_LIMIT);
    const best = collectBests(uniqueSessions([result, ...stored.best, ...stored.recent]));
    const next: StoredProgress = { version: 1, recent, best };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearSessions(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
