import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Flame, Focus, Maximize2, Minimize2, MousePointer2, Pause, Play, RotateCcw, SlidersHorizontal, Target, TrendingUp, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PracticeEngine } from './engine';
import ProgressView from './ProgressView';
import { clearSessions, getBest, metricName, readSessions, saveSession, scoreLabel, scoreValue } from './progress';
import { createAimProfile, readAimPreferences, requestPointerLock, saveAimPreferences } from './sensitivity';
import { DEFAULT_SETTINGS, MODES, ROUTINE } from './types';
import type { AimGame, AimMode, AimPreferences, Mode, RunConfig, SessionResult, Settings, Snapshot, Speed, TargetSize } from './types';

const icons: Record<Mode, LucideIcon> = { reaction: Zap, target: Target, flick: MousePointer2, tracking: Focus };
const emptySnapshot: Snapshot = { phase: 'countdown', countdown: 3, elapsedMs: 0, remainingMs: 30000, hits: 0, misses: 0, reactionTimes: [], reactionState: 'waiting', trackingPercent: 0, averageHitMs: 0 };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.ceil(seconds % 60).toString().padStart(2, '0')}`;
const accuracy = (hits: number, misses: number) => hits + misses ? `${Math.round(hits / (hits + misses) * 100)}%` : '—';

function DrillPreview({ mode }: { mode: Mode }) {
  return <svg className="drill-preview" viewBox="0 0 240 140" fill="none" aria-hidden="true">
    {mode === 'target' ? <>
      <path className="preview-guide" d="M120 16v20m0 68v20M66 70H86m68 0h20" />
      <circle className="preview-target" cx="120" cy="70" r="24" />
      <path d="M120 62v16m-8-8h16" stroke="#39271e" strokeWidth="1.5" />
    </> : mode === 'reaction' ? <>
      <rect className="preview-wait" x="28" y="46" width="52" height="48" />
      <rect className="preview-ready" x="160" y="46" width="52" height="48" />
      <path className="preview-guide" d="M96 70h48m-8-7 8 7-8 7" />
      <text className="preview-word" x="54" y="75" textAnchor="middle">Wait</text>
      <text className="preview-word" x="186" y="75" textAnchor="middle">Click</text>
    </> : mode === 'flick' ? <>
      <path className="preview-guide" d="M68 91 171 49m-9-3 9 3-4 9" strokeDasharray="4 5" />
      <circle className="preview-target-outline" cx="44" cy="98" r="21" />
      <circle className="preview-target" cx="196" cy="42" r="21" />
    </> : <>
      <path className="preview-guide" d="M28 102C70 5 158 135 212 36" strokeDasharray="4 5" />
      <circle className="preview-target" cx="116" cy="70" r="20" />
      <path d="m108 60 8 20 3-8 9-4Z" fill="#39271e" stroke="#ffc8a6" strokeWidth="1" />
    </>}
  </svg>;
}

function ResultCard({ result, sessions }: { result: SessionResult; sessions: SessionResult[] }) {
  const best = getBest(sessions, result);
  const isBest = scoreValue(result) !== null && best && scoreValue(best) === scoreValue(result);
  return <div className="result-card">
    <div className="result-title"><span className="result-icon">{(() => { const Icon = icons[result.mode]; return <Icon size={20} />; })()}</span><h3>{MODES.find(m => m.id === result.mode)?.name}</h3>{isBest && <span className="record-badge"><TrendingUp size={13} /> Personal best</span>}</div>
    <div className="result-primary"><strong>{scoreLabel(result)}</strong><span>{metricName(result.mode)}</span></div>
    <div className="result-details">
      {result.mode === 'reaction' ? <><span>Best attempt <b>{result.reactionTimes.length ? `${Math.round(Math.min(...result.reactionTimes))} ms` : '—'}</b></span><span>Early clicks <b>{result.premature}</b></span></> : result.mode === 'tracking' ? <><span>Time on target <b>{(result.trackingMs / 1000).toFixed(1)}s</b></span><span>Active time <b>{(result.activeMs / 1000).toFixed(1)}s</b></span></> : <><span>Hits / misses <b>{result.hits} / {result.misses}</b></span><span>Accuracy <b>{accuracy(result.hits, result.misses)}</b></span></>}
    </div>
    {result.aim && <p className="result-aim">{result.aim.game === 'valorant' ? 'Valorant' : 'CS2'} · {result.aim.sensitivity} sens · {result.aim.dpi} DPI · {result.aim.cm360.toFixed(1)} cm/360 · {result.aim.inputUnitsPerCm.toFixed(1)} movement units/cm</p>}
    {result.mode === 'reaction' && <div className="attempt-results" aria-label="Reaction attempts">{result.reactionTimes.map((time, i) => <span key={i}><small>{i + 1}</small>{Math.round(time)}<em>ms</em></span>)}{!result.reactionTimes.length && <p className="muted">No valid attempts this session.</p>}</div>}
  </div>;
}

export default function App() {
  const [view, setView] = useState<'practice' | 'progress'>('practice');
  const [mode, setMode] = useState<Mode>('target');
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [sessions, setSessions] = useState<SessionResult[]>(readSessions);
  const [storageError, setStorageError] = useState(false);
  const [aimPreferences, setAimPreferences] = useState<AimPreferences>(readAimPreferences);
  const [profileStorageError, setProfileStorageError] = useState(false);
  const [aimError, setAimError] = useState('');
  const [calibrating, setCalibrating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [run, setRun] = useState<{ config: RunConfig; step: number; key: number } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [wasGuided, setWasGuided] = useState(false);
  const arenaRef = useRef<HTMLDivElement>(null);
  const practiceRef = useRef<HTMLElement>(null);
  const engineRef = useRef<PracticeEngine | null>(null);
  const serial = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const calibrationRef = useRef<{ units: number; locked: boolean; saveOnUnlock: boolean } | null>(null);
  const activeMode = run?.config.mode ?? mode;
  const selected = MODES.find(m => m.id === activeMode)!;
  const aimProfile = createAimProfile(aimPreferences);
  const currentConfig: RunConfig = run?.config ?? {
    mode, settings, reactionStyle: 'rounds', guided: false,
    ...(mode !== 'reaction' && aimPreferences.mode === 'fps' && aimProfile ? { aim: aimProfile } : {}),
  };
  const personalBest = getBest(sessions, currentConfig);

  const start = useCallback((guided: boolean) => {
    const launch = (aim?: NonNullable<RunConfig['aim']>) => {
      setAimError('');
      setView('practice'); setResults([]); setFinished(false); setWasGuided(guided);
      setSnapshot({ ...emptySnapshot, remainingMs: settings.duration * 1000 });
      const config: RunConfig = guided
        ? { mode: ROUTINE[0].mode, settings: { ...DEFAULT_SETTINGS, duration: ROUTINE[0].duration }, reactionStyle: 'timed', guided: true }
        : { mode, settings: { ...settings }, reactionStyle: 'rounds', guided: false, ...(aim ? { aim } : {}) };
      setRun({ config, step: 0, key: ++serial.current });
    };
    if (guided || mode === 'reaction' || aimPreferences.mode !== 'fps') { launch(); return; }
    if (!aimProfile) { setAimError('Enter a valid DPI and in-game sensitivity for this profile.'); return; }
    if (!arenaRef.current) { setAimError('The practice area is not ready.'); return; }
    setAimError('');
    void requestPointerLock(arenaRef.current)
      .then(() => launch(aimProfile))
      .catch(error => setAimError(error instanceof Error ? error.message : 'Mouse lock is unavailable.'));
  }, [aimPreferences, aimProfile, mode, settings]);


  const exit = useCallback(() => {
    setRun(null); setFinished(false); setResults([]); setAimError('');
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => setFullscreenError('Use your browser’s fullscreen control to return to mode selection.'));
    }
  }, []);
  const saveAimSettings = (next: AimPreferences) => {
    setAimPreferences(next);
    setProfileStorageError(!saveAimPreferences(next));
  };
  const changeAimMode = (nextMode: AimMode) => {
    setAimError('');
    saveAimSettings({ ...aimPreferences, mode: nextMode });
  };
  const changeAimGame = (game: AimGame) => {
    setAimError('');
    saveAimSettings({ ...aimPreferences, game });
  };
  const changeAimValue = (field: 'dpi' | 'sensitivity', value: string) => {
    const next = {
      ...aimPreferences,
      profiles: {
        ...aimPreferences.profiles,
        [aimPreferences.game]: { ...aimPreferences.profiles[aimPreferences.game], [field]: value },
      },
      calibrationUnitsPerCm: field === 'dpi'
        ? { ...aimPreferences.calibrationUnitsPerCm, [aimPreferences.game]: null }
        : aimPreferences.calibrationUnitsPerCm,
    };
    setAimError('');
    saveAimSettings(next);
  };
  const calibrateMouse = () => {
    if (!arenaRef.current) { setAimError('The practice area is not ready.'); return; }
    calibrationRef.current = { units: 0, locked: false, saveOnUnlock: false };
    setAimError('');
    void requestPointerLock(arenaRef.current).catch(error => {
      calibrationRef.current = null;
      setCalibrating(false);
      setAimError(error instanceof Error ? error.message : 'Mouse calibration could not start.');
    });
  };
  const resume = () => {
    if (!run?.config.aim) { engineRef.current?.resume(); return; }
    if (!arenaRef.current) { setAimError('The practice area is not ready.'); return; }
    void requestPointerLock(arenaRef.current)
      .then(() => { setAimError(''); engineRef.current?.resume(); })
      .catch(error => setAimError(error instanceof Error ? error.message : 'Mouse lock is unavailable.'));
  };
  const onComplete = useCallback((result: SessionResult) => {
    if (!saveSession(result)) setStorageError(true);
    setSessions(previous => {
      const saved = readSessions();
      return saved.some(s => s.id === result.id) ? saved : [...previous, result];
    });
    setResults(previous => [...previous, result]);
    if (run?.config.guided && run.step < ROUTINE.length - 1) {
      const step = run.step + 1;
      const next = ROUTINE[step];
      setSnapshot({ ...emptySnapshot, remainingMs: next.duration * 1000 });
      setRun({ config: { ...run.config, mode: next.mode, settings: { ...run.config.settings, duration: next.duration } }, step, key: ++serial.current });
    } else { setRun(null); setFinished(true); }
  }, [run]);

  useEffect(() => {
    const collectCalibration = (event: PointerEvent) => {
      const calibration = calibrationRef.current;
      if (calibration?.locked && document.pointerLockElement === arenaRef.current) calibration.units += Math.abs(event.movementX);
    };
    const onLockChange = () => {
      const calibration = calibrationRef.current;
      if (!calibration) return;
      if (document.pointerLockElement === arenaRef.current) {
        calibration.locked = true;
        setCalibrating(true);
        setAimError('Move the mouse horizontally 10 cm, then press Escape to save the calibration.');
        return;
      }
      if (!calibration.locked) return;
      calibrationRef.current = null;
      setCalibrating(false);
      if (!calibration.saveOnUnlock) {
        setAimError('Calibration cancelled because mouse lock ended. Start again to measure 10 cm.');
        return;
      }
      if (!Number.isFinite(calibration.units) || calibration.units <= 0) {
        setAimError('No mouse movement was recorded. Try calibrating again.');
        return;
      }
      const next = {
        ...aimPreferences,
        calibrationUnitsPerCm: {
          ...aimPreferences.calibrationUnitsPerCm,
          [aimPreferences.game]: calibration.units / 10,
        },
      };
      setAimPreferences(next);
      setProfileStorageError(!saveAimPreferences(next));
      setAimError(`Mouse scale saved: ${(calibration.units / 10).toFixed(1)} browser units per cm.`);
    };
    document.addEventListener('pointermove', collectCalibration, true);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      document.removeEventListener('pointermove', collectCalibration, true);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [aimPreferences]);

  useEffect(() => {
    if (!run || !arenaRef.current) return;
    const engine = new PracticeEngine(arenaRef.current, run.config, { onUpdate: setSnapshot, onComplete });
    engineRef.current = engine;
    return () => { engine.destroy(); if (engineRef.current === engine) engineRef.current = null; };
  }, [run, onComplete]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (calibrationRef.current && document.pointerLockElement === arenaRef.current) {
        event.preventDefault();
        calibrationRef.current.saveOnUnlock = true;
        document.exitPointerLock();
        return;
      }
      if (!run) return;
      event.preventDefault();
      if (snapshot.phase === 'paused') exit(); else engineRef.current?.pause();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [run, snapshot.phase, exit]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === practiceRef.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => { if (finished) resultsRef.current?.focus(); }, [finished]);

  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (practiceRef.current?.requestFullscreen) await practiceRef.current.requestFullscreen();
      else setFullscreenError('Fullscreen is not supported by this browser.');
    } catch { setFullscreenError('Fullscreen is unavailable. You can still practice in this window.'); }
  };
  const selectMode = (next: Mode) => { exit(); setMode(next); };
  const restart = () => start(run?.config.guided ?? wasGuided);
  const completedSeconds = run?.config.guided ? ROUTINE.slice(0, run.step).reduce((sum, step) => sum + step.duration, 0) : 0;
  const guideProgress = run?.config.guided ? Math.min(100, (completedSeconds + snapshot.elapsedMs / 1000) / 180 * 100) : finished && wasGuided ? 100 : 0;

  return <div className={`app-shell${run ? ' is-practicing' : ''}`}>
    <header className="site-header">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); exit(); setView('practice'); }} aria-label="Warmup home">
        <span className="brand-mark">w<span className="brand-spark" /></span> warmup<span className="brand-dot">.</span>
      </a>
      <nav aria-label="Main navigation">
        <button className={view === 'practice' ? 'nav-link active' : 'nav-link'} onClick={() => setView('practice')}>Practice</button>
        <button className={view === 'progress' ? 'nav-link active' : 'nav-link'} onClick={() => { exit(); setView('progress'); }}>Your progress</button>
      </nav>
    </header>
    <main>
      {view === 'progress' ? (
        <ProgressView sessions={sessions} onPractice={() => setView('practice')} onReset={() => {
          if (clearSessions()) { setSessions([]); setStorageError(false); } else setStorageError(true);
        }} />
      ) : <div className="practice-layout">
        <aside className="mode-sidebar" aria-label="Practice navigation">
          <h2 className="mode-sidebar-heading">Practice modes</h2>
          <div className="mode-list" role="group" aria-label="Practice modes">
            {MODES.map(item => {
              const ModeIcon = icons[item.id];
              return <button key={item.id} className={`mode-button${activeMode === item.id ? ' selected' : ''}`} aria-label={item.name} aria-pressed={activeMode === item.id} onClick={() => selectMode(item.id)} title={item.name}>
                <span className="mode-icon" aria-hidden="true"><ModeIcon size={22} strokeWidth={1.6} /></span>
                <span className="mode-copy">
                  <strong>{{ target: 'Targets', reaction: 'Reaction', flick: 'Flicks', tracking: 'Tracking' }[item.id]}</strong>
                  <small>{item.short}</small>
                </span>
              </button>;
            })}
          </div>
          <button className="routine-entry" aria-label="Start 3-minute warmup" onClick={() => start(true)} title="30s reaction, 60s targets, 30s flicks, 60s tracking. Medium targets and steady tracking. Countdowns add about 12 seconds.">
            <span className="routine-clock" aria-hidden="true"><Clock3 size={19} strokeWidth={1.5} /></span>
            <span className="routine-label">3-minute warmup<small>Run all four drills</small></span>
            <span className="routine-short" aria-hidden="true">3 min</span>
            <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </aside>
        <div className="practice-content">

        <section className="practice-card" ref={practiceRef} aria-label="Practice station">
          <div className="arena-header">
            <div className="arena-heading">
              <h2>{finished ? wasGuided ? 'Warmup complete' : 'Session complete' : selected.name}</h2>
              {!run && !finished && <p>{selected.description}</p>}
              {run && <span className="session-state"><span className={snapshot.phase === 'paused' ? 'state-dot paused' : 'state-dot'} />{snapshot.phase === 'paused' ? 'Paused' : snapshot.phase === 'countdown' ? 'Getting ready' : 'In practice'}</span>}
            </div>
            <div className="arena-actions">
              {!run && !finished && mode !== 'reaction' && <details className="setup" key={mode}>
                <summary><span className="setup-preview">{settings.duration}s<span> / </span>{settings.size}</span><SlidersHorizontal size={16} /><span>Setup</span></summary>
                <div className="setup-panel">
                  <h3>Session settings</h3>
                  <label htmlFor="practice-duration">Duration</label>
                  <select id="practice-duration" value={settings.duration} onChange={e => setSettings(s => ({ ...s, duration: Number(e.target.value) as 30 | 60 }))}>
                    <option value={30}>30 seconds</option><option value={60}>60 seconds</option>
                  </select>
                  <label htmlFor="practice-size">Target size</label>
                  <select id="practice-size" value={settings.size} onChange={e => setSettings(s => ({ ...s, size: e.target.value as TargetSize }))}>
                    <option value="easy">Easy — 76 px</option><option value="medium">Medium — 52 px</option><option value="hard">Hard — 32 px</option>
                  </select>
                  {mode === 'tracking' && <>
                    <label htmlFor="practice-speed">Movement speed</label>
                    <select id="practice-speed" value={settings.speed} onChange={e => setSettings(s => ({ ...s, speed: e.target.value as Speed }))}>
                      <option value="slow">Slow</option><option value="steady">Steady</option><option value="fast">Fast</option>
                    </select>
                  </>}
                  <label htmlFor="aim-input-mode">Mouse input</label>
                  <select id="aim-input-mode" value={aimPreferences.mode} onChange={event => changeAimMode(event.target.value as AimMode)}>
                    <option value="cursor">Desktop cursor</option>
                    <option value="fps">FPS sensitivity profile</option>
                  </select>
                  {aimPreferences.mode === 'fps' && <>
                    <label htmlFor="aim-game">Game profile</label>
                    <select id="aim-game" value={aimPreferences.game} onChange={event => changeAimGame(event.target.value as AimGame)}>
                      <option value="valorant">Valorant</option><option value="cs2">Counter-Strike 2</option>
                    </select>
                    <div className="aim-profile-fields">
                      <label htmlFor="aim-dpi">Mouse DPI
                        <input id="aim-dpi" type="number" min="100" max="64000" step="1" value={aimPreferences.profiles[aimPreferences.game].dpi} onChange={event => changeAimValue('dpi', event.target.value)} placeholder="e.g. 800" />
                      </label>
                      <label htmlFor="aim-sensitivity">Hipfire sensitivity
                        <input id="aim-sensitivity" type="number" min="0.001" max="1000" step="any" value={aimPreferences.profiles[aimPreferences.game].sensitivity} onChange={event => changeAimValue('sensitivity', event.target.value)} placeholder={aimPreferences.game === 'valorant' ? 'e.g. 0.4' : 'e.g. 1.27'} />
                      </label>
                    </div>
                    <p className="aim-cm360" role="status">{aimProfile ? `${aimProfile.cm360.toFixed(1)} cm / 360°` : 'Enter valid DPI and sensitivity to calculate cm/360.'}</p>
                    <button className="aim-calibrate" type="button" onClick={calibrateMouse} disabled={calibrating}>
                      <MousePointer2 size={14} aria-hidden="true" />{calibrating ? 'Move 10 cm, then press Esc' : aimPreferences.calibrationUnitsPerCm[aimPreferences.game] ? 'Recalibrate mouse' : 'Calibrate mouse'}
                    </button>
                    <small>{aimPreferences.calibrationUnitsPerCm[aimPreferences.game] ? `${aimPreferences.calibrationUnitsPerCm[aimPreferences.game]!.toFixed(1)} browser units/cm saved for ${aimPreferences.game === 'valorant' ? 'Valorant' : 'CS2'}.` : 'Optional: move the mouse exactly 10 cm horizontally while locked. Without calibration, Warmup estimates movement units from this game’s DPI.'}</small>
                    <small className="aim-limitation">This scales Warmup’s virtual crosshair only. The 2D arena has no game camera; FOV and OS mouse processing can change the in-game feel.</small>
                  </>}
                  {aimError && <p className="error-message aim-error" role="alert">{aimError}</p>}
                  <small>Personal bests use the same drill and mouse profile.</small>
                </div>
              </details>}
              {run && (!run.config.aim || snapshot.phase === 'paused') && <>
                <button className="icon-button" onClick={() => engineRef.current?.pause()} aria-label="Pause practice" title="Pause (Esc)"><Pause size={18} /></button>
                <button className="icon-button" onClick={restart} aria-label="Restart session" title="Restart"><RotateCcw size={18} /></button>
                <button className="icon-button" onClick={exit} aria-label="Exit practice" title="Exit"><X size={18} /></button>
              </>}
              {(!run?.config.aim || snapshot.phase === 'paused') && <button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>}
            </div>
          </div>

          {(run?.config.guided || finished && wasGuided) && <div className="guide-strip">
            <span><Flame size={15} /> 3-minute warmup</span>
            <div className="guide-steps">
              {ROUTINE.map((step, index) => <span key={step.mode} className={index < (run?.step ?? 4) ? 'done' : index === run?.step ? 'current' : ''}>
                {index < (run?.step ?? 4) ? <Check size={13} /> : <span className="step-number">{index + 1}</span>}
                <b>{MODES.find(m => m.id === step.mode)?.short}</b>
              </span>)}
            </div>
            <span className="mono">{Math.round(guideProgress)}%</span>
            <div className="guide-progress" style={{ width: `${guideProgress}%` }} />
          </div>}

          {finished && <div className="results-screen" ref={resultsRef} tabIndex={-1}>
            <div className="results-heading">
              <span className="completion-check"><Check size={24} /></span>
              <div><h2>{wasGuided ? 'Warmup results' : 'Session results'}</h2><p>{wasGuided ? 'All four drills completed. Scores are below.' : 'Compare your score with earlier sessions in Your progress.'}</p></div>
            </div>
            <div className={`results-grid${wasGuided ? ' combined' : ''}`}>{results.map(result => <ResultCard key={result.id} result={result} sessions={sessions} />)}</div>
            <div className="results-actions">
              <button className="btn btn-primary" onClick={() => start(wasGuided)}><RotateCcw size={16} /> {wasGuided ? 'Repeat warmup' : 'Repeat session'}</button>
              <button className="btn btn-secondary" onClick={exit}>Choose a drill</button>
            </div>
            <p className="saved-note">{storageError ? 'Available this visit. Browser storage is unavailable.' : 'Saved on this device.'}</p>
            {aimError && <p className="error-message aim-error" role="alert">{aimError}</p>}
          </div>}
          <div className={`arena${run ? ' is-active' : ''}${run?.config.aim && snapshot.phase !== 'paused' ? ' fps-aim-active' : ''}${finished ? ' is-finished' : ''}`} ref={arenaRef} aria-label={`${activeMode} practice area`} aria-hidden={finished ? 'true' : undefined}>
              {!run && !finished && <div className="idle-screen">
                <div className="idle-visual" aria-hidden="true"><DrillPreview mode={mode} /></div>
                <div className="idle-copy">
                  <h3>{{ target: 'Hit the target.', reaction: 'Wait for the signal.', flick: 'Go from side to side.', tracking: 'Stay inside the target.' }[mode]}</h3>
                  <p className="idle-instruction">
                    {{ target: 'Each hit spawns a new target. Off-target clicks count as misses.', reaction: 'Green means wait. Click anywhere when the arena turns red. Finish five valid attempts.', flick: 'Hit alternating targets on opposite sides. A miss counts, but the target stays put.', tracking: 'Follow the moving target with your cursor. No clicks needed. Your score is the percentage of time spent inside.' }[mode]}
                  </p>
                  <button className="btn btn-primary start-button" onClick={() => start(false)} disabled={mode !== 'reaction' && aimPreferences.mode === 'fps' && !aimProfile}><Play size={16} fill="currentColor" /> {mode !== 'reaction' && aimPreferences.mode === 'fps' ? 'Start FPS aim session' : 'Start session'}</button>
                  {aimError && <p className="error-message aim-error" role="alert">{aimError}</p>}
                  <span className="idle-footnote">{mode === 'reaction' ? '5 attempts, with a random 2–5s wait' : `${settings.duration}s session, ${settings.size} targets${mode === 'tracking' ? `, ${settings.speed} speed` : ''}`}</span>
                </div>
              </div>}
              {run && snapshot.phase === 'countdown' && <div className="arena-overlay countdown-overlay">
                <div className="eyebrow">{run.config.guided ? `Exercise ${run.step + 1} of 4` : 'Starting in'}</div>
                <strong className="countdown-number">{snapshot.countdown}</strong>
                <h3>{selected.name}</h3>
                <p>{run.config.aim ? 'Move the virtual crosshair. Click targets; Escape pauses.' : activeMode === 'reaction' ? 'Wait for red, then click anywhere.' : activeMode === 'tracking' ? 'Keep your cursor inside the moving target.' : 'Hit the targets. Off-target clicks count as misses.'}</p>
              </div>}
              {run && snapshot.phase === 'paused' && <div className="arena-overlay pause-overlay">
                <span className="pause-symbol"><Pause size={26} /></span>
                <h3>Session paused</h3>
                <p>Resume with your current time and score, or restart.</p>
                {aimError && <p className="error-message aim-error" role="alert">{aimError}</p>}
                <button className="btn btn-primary" onClick={resume}><Play size={16} /> Resume session</button>
                <div className="pause-actions">
                  <button onClick={restart}><RotateCcw size={14} /> Restart</button>
                  <button onClick={exit}><ArrowLeft size={14} /> Exit practice</button>
                </div>
              </div>}
            </div>
            {run && <div className={`arena-stats${activeMode === 'tracking' || activeMode === 'reaction' && run.config.reactionStyle === 'rounds' ? ' three-stats' : ''}`} aria-live="off">
              <div><span>{activeMode === 'reaction' && run.config.reactionStyle === 'rounds' ? 'Attempts' : 'Time left'}</span>
                <strong className="mono">{activeMode === 'reaction' && run.config.reactionStyle === 'rounds' ? `${snapshot.reactionTimes.length} / 5` : formatTime(Math.ceil(snapshot.remainingMs / 1000))}</strong>
              </div>
              <div><span>{activeMode === 'reaction' ? 'Last reaction' : activeMode === 'tracking' ? 'On target' : 'Hits'}</span>
                <strong className="mono">{activeMode === 'reaction' ? snapshot.reactionTimes.length ? `${Math.round(snapshot.reactionTimes.at(-1)!)} ms` : '—' : activeMode === 'tracking' ? `${snapshot.trackingPercent.toFixed(1)}%` : snapshot.hits}</strong>
              </div>
              <div><span>{activeMode === 'reaction' ? 'Best attempt' : activeMode === 'tracking' ? 'Time on target' : 'Accuracy'}</span>
                <strong className="mono">{activeMode === 'reaction' ? snapshot.reactionTimes.length ? `${Math.round(Math.min(...snapshot.reactionTimes))} ms` : '—' : activeMode === 'tracking' ? `${(snapshot.trackingPercent / 100 * snapshot.elapsedMs / 1000).toFixed(1)}s` : accuracy(snapshot.hits, snapshot.misses)}</strong>
              </div>
              {activeMode !== 'tracking' && (activeMode !== 'reaction' || run.config.reactionStyle === 'timed') && <div>
                <span>{activeMode === 'flick' ? 'Average flick' : activeMode === 'target' ? 'Hits / second' : 'Valid attempts'}</span>
                <strong className="mono">{activeMode === 'flick' ? snapshot.hits ? `${Math.round(snapshot.averageHitMs)} ms` : '—' : activeMode === 'target' ? (snapshot.elapsedMs ? snapshot.hits / (snapshot.elapsedMs / 1000) : 0).toFixed(2) : snapshot.reactionTimes.length}</strong>
              </div>}
            </div>}
          {fullscreenError && <p className="error-message" role="alert">{fullscreenError}</p>}
        </section>

        <div className="context-row">
          {run ? <span className="keyboard-note"><kbd>esc</kbd>{run.config.aim ? ' to unlock and pause · use controls while paused' : ' to pause'}{!run.config.aim && <><span>·</span> again to exit</>}</span> : <details className="how-to" key={activeMode}>
            <summary>How it works <ChevronDown size={14} /></summary>
            <p>{selected.instruction}</p>
            <small>{activeMode === 'reaction' ? 'Your score is the median of valid reactions.' : activeMode === 'tracking' ? 'Tracking needs a mouse or trackpad.' : 'Accuracy is hits divided by all clicks.'}</small>
          </details>}
          {!run && !finished && <div className="personal-best"><TrendingUp size={15} /><span>Personal best</span><strong>{personalBest ? scoreLabel(personalBest) : 'No score yet'}</strong></div>}
        </div>
        </div>
      </div>}
      {profileStorageError && <div className="storage-warning" role="alert">Mouse profiles are available this visit but could not be saved in this browser.</div>}
    </main>
    <footer>
      <span>{storageError ? 'Scores are available for this visit only.' : 'Scores stay in this browser.'}</span>
      <span>Profiles tune Warmup only; they do not change game settings.</span>
    </footer>
  </div>;
}
