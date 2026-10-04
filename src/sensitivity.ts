import type { AimGame, AimProfile, AimPreferences, GameAimSettings } from './types';

const PROFILE_STORAGE_KEY = 'warmup.aim-profiles.v1';
const YAW: Record<AimGame, number> = { valorant: 0.07, cs2: 0.022 };

export const EMPTY_AIM_PREFERENCES: AimPreferences = {
  mode: 'cursor',
  game: 'valorant',
  profiles: {
    valorant: { dpi: '', sensitivity: '' },
    cs2: { dpi: '', sensitivity: '' },
  },
  calibrationUnitsPerCm: { valorant: null, cs2: null },
};

function isGame(value: unknown): value is AimGame {
  return value === 'valorant' || value === 'cs2';
}

function isProfileInput(value: unknown): value is GameAimSettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && typeof (value as GameAimSettings).dpi === 'string'
    && typeof (value as GameAimSettings).sensitivity === 'string';
}

export function calculateCm360(game: AimGame, dpi: number, sensitivity: number): number | null {
  if (!Number.isFinite(dpi) || dpi <= 0 || !Number.isFinite(sensitivity) || sensitivity <= 0) return null;
  const cm360 = 360 * 2.54 / (dpi * sensitivity * YAW[game]);
  return Number.isFinite(cm360) && cm360 > 0 ? cm360 : null;
}

export function createAimProfile(preferences: AimPreferences): AimProfile | null {
  const values = preferences.profiles[preferences.game];
  const dpi = Number(values.dpi);
  const sensitivity = Number(values.sensitivity);
  if (!values.dpi.trim() || !values.sensitivity.trim() || dpi < 100 || dpi > 64000 || sensitivity <= 0 || sensitivity > 1000) return null;
  const cm360 = calculateCm360(preferences.game, dpi, sensitivity);
  if (cm360 === null || cm360 < 0.1 || cm360 > 100000) return null;
  const inputUnitsPerCm = preferences.calibrationUnitsPerCm[preferences.game] ?? dpi / 2.54;
  if (!Number.isFinite(inputUnitsPerCm) || inputUnitsPerCm <= 0) return null;
  return { game: preferences.game, dpi, sensitivity, cm360, inputUnitsPerCm };
}

export function isAimProfile(value: unknown): value is AimProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const profile = value as Partial<AimProfile>;
  if (!isGame(profile.game) || typeof profile.dpi !== 'number' || !Number.isFinite(profile.dpi) || profile.dpi < 100 || profile.dpi > 64000
      || typeof profile.sensitivity !== 'number' || !Number.isFinite(profile.sensitivity) || profile.sensitivity <= 0 || profile.sensitivity > 1000
      || typeof profile.cm360 !== 'number' || !Number.isFinite(profile.cm360) || profile.cm360 < 0.1 || profile.cm360 > 100000
      || typeof profile.inputUnitsPerCm !== 'number' || !Number.isFinite(profile.inputUnitsPerCm) || profile.inputUnitsPerCm <= 0 || profile.inputUnitsPerCm > 100000) return false;
  const calculated = calculateCm360(profile.game, profile.dpi, profile.sensitivity);
  return calculated !== null && Math.abs(calculated - profile.cm360) <= calculated * 1e-9;
}

export function readAimPreferences(): AimPreferences {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...EMPTY_AIM_PREFERENCES, profiles: { ...EMPTY_AIM_PREFERENCES.profiles } };
    const value = parsed as Partial<AimPreferences>;
    const profiles = value.profiles;
    const calibrations = value.calibrationUnitsPerCm;
    const calibrationFor = (game: AimGame) => {
      const inputUnitsPerCm = calibrations?.[game];
      return typeof inputUnitsPerCm === 'number' && Number.isFinite(inputUnitsPerCm) && inputUnitsPerCm > 0 && inputUnitsPerCm <= 100000 ? inputUnitsPerCm : null;
    };
    return {
      mode: value.mode === 'fps' ? 'fps' : 'cursor',
      game: isGame(value.game) ? value.game : 'valorant',
      profiles: {
        valorant: isProfileInput(profiles?.valorant) ? profiles.valorant : { dpi: '', sensitivity: '' },
        cs2: isProfileInput(profiles?.cs2) ? profiles.cs2 : { dpi: '', sensitivity: '' },
      },
      calibrationUnitsPerCm: { valorant: calibrationFor('valorant'), cs2: calibrationFor('cs2') },
    };
  } catch {
    return { ...EMPTY_AIM_PREFERENCES, profiles: { ...EMPTY_AIM_PREFERENCES.profiles } };
  }
}

export function saveAimPreferences(preferences: AimPreferences): boolean {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function requestPointerLock(element: HTMLElement): Promise<void> {
  if (typeof element.requestPointerLock !== 'function') return Promise.reject(new Error('Pointer lock is not supported by this browser.'));
  if (document.pointerLockElement === element) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      document.removeEventListener('pointerlockchange', changed);
      document.removeEventListener('pointerlockerror', failed);
      if (error) reject(error);
      else resolve();
    };
    const changed = () => { if (document.pointerLockElement === element) finish(); };
    const failed = () => finish(new Error('Mouse lock was denied. Choose desktop cursor input or retry.'));
    const timeout = window.setTimeout(() => finish(new Error('Mouse lock did not start. Choose desktop cursor input or retry.')), 4000);
    document.addEventListener('pointerlockchange', changed);
    document.addEventListener('pointerlockerror', failed, { once: true });
    try {
      const result = element.requestPointerLock();
      if (result && typeof result.then === 'function') {
        result.then(changed, (error: unknown) => finish(error instanceof Error ? error : new Error('Mouse lock was denied. Choose desktop cursor input or retry.')));
      } else changed();
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Mouse lock was denied. Choose desktop cursor input or retry.'));
    }
  });
}

