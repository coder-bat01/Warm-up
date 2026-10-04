import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Grid2X2, Pause, Play, RotateCcw, TrendingUp, X } from 'lucide-react';
import { TileGame } from './tileGame';
import { getTileBest, tileScoreLabel } from './tileProgress';
import { PATTERN_COUNT, TILE_MODES } from './tileTypes';
import type { TileMode, TileRun, TileSnapshot } from './tileTypes';

const previewCells = Array.from({ length: 16 }, (_, index) => index);
const emptySnapshot: TileSnapshot = { phase: 'countdown', countdown: 3, elapsedMs: 0, remainingMs: 30000, taps: 0, patterns: 0 };
const endLabels = { white: 'White tile tapped', timeout: 'Time’s up', complete: 'All patterns cleared' };
const historyDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

export default function TilePractice({ runs, storageError, onSave }: { runs: TileRun[]; storageError: boolean; onSave(result: TileRun): void }) {
  const [mode, setMode] = useState<TileMode>('frenzy');
  const [run, setRun] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<TileSnapshot>(emptySnapshot);
  const [result, setResult] = useState<TileRun | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TileGame | null>(null);
  const serial = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const selected = TILE_MODES.find(item => item.id === mode)!;
  const { best, recent } = useMemo(() => ({
    best: getTileBest(runs, mode),
    recent: runs.filter(item => item.mode === mode).slice(0, 5),
  }), [runs, mode]);
  const running = run !== null;

  const start = () => {
    setResult(null);
    setSnapshot({ ...emptySnapshot, remainingMs: mode === 'endurance' ? 10000 : mode === 'frenzy' ? 30000 : 0 });
    setRun(++serial.current);
  };
  const exit = useCallback(() => { setRun(null); setResult(null); }, []);
  const selectMode = (next: TileMode) => { exit(); setMode(next); };
  const onComplete = useCallback((completed: TileRun) => {
    onSave(completed);
    setResult(completed);
    setRun(null);
  }, [onSave]);

  useEffect(() => {
    if (run === null || !boardRef.current) return;
    const engine = new TileGame(boardRef.current, mode, { onUpdate: setSnapshot, onComplete });
    engineRef.current = engine;
    return () => { engine.destroy(); if (engineRef.current === engine) engineRef.current = null; };
  }, [run, mode, onComplete]);
  useEffect(() => {
    if (!running) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (snapshot.phase === 'paused') exit(); else engineRef.current?.pause();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [running, snapshot.phase, exit]);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  return <>
      <section className="practice-card tile-game" aria-label="Don’t tap practice">
        <div className="arena-header">
          <div className="arena-heading">
            <h2>Don’t tap <span className="tile-mode-name">/ {selected.name}</span></h2>
            {!running && !result && <p>Tap black tiles. Leave white tiles alone.</p>}
            {running && <span className="session-state"><span className={snapshot.phase === 'paused' ? 'state-dot paused' : 'state-dot'} />{snapshot.phase === 'paused' ? 'Paused' : snapshot.phase === 'countdown' ? 'Getting ready' : 'In practice'}</span>}
          </div>
          {running && <div className="arena-actions">
            <button className="icon-button" onClick={() => engineRef.current?.pause()} aria-label="Pause practice" title="Pause (Esc)"><Pause size={18} /></button>
            <button className="icon-button" onClick={start} aria-label="Restart session" title="Restart"><RotateCcw size={18} /></button>
            <button className="icon-button" onClick={exit} aria-label="Exit practice" title="Exit"><X size={18} /></button>
          </div>}
        </div>
        <div className="session-format tile-mode-picker" role="group" aria-label="Don’t tap modes">
          {TILE_MODES.map(item => <button key={item.id} className={`btn btn-secondary${mode === item.id ? ' selected' : ''}`} aria-label={`${item.name} mode`} aria-pressed={mode === item.id} onClick={() => selectMode(item.id)}>{item.name}</button>)}
        </div>
        {!result && <div className="session-format tile-rule-strip">
          <span className="setup-title"><Grid2X2 size={15} aria-hidden="true" /> 4 × 4 tiles</span>
          <span className="tile-rule">{selected.rule}</span>
        </div>}
        <div className="tile-play-area" hidden={result !== null}>
          <div className="tile-stage" aria-label="Tile practice board">
            <div className="tile-engine-host" ref={boardRef} />
            {!running && !result && <div className="tile-board tile-preview" aria-hidden="true">
              {previewCells.map(index => <span key={index} className="tile-cell" data-state={index === 1 || index === 6 || index === 12 || mode === 'pattern' && index === 8 ? 'black' : 'white'} />)}
            </div>}
            {running && snapshot.phase === 'countdown' && <div className="arena-overlay tile-countdown" role="status">
              <span className="eyebrow">Starting in</span><strong className="countdown-number">{snapshot.countdown}</strong><p>Black tiles only.</p>
            </div>}
            {running && snapshot.phase === 'paused' && <div className="arena-overlay tile-pause">
              <Pause size={22} className="pause-symbol" aria-hidden="true" /><h3>Session paused</h3><p>Your time and tiles stay put.</p>
              <button className="btn btn-primary" onClick={() => engineRef.current?.resume()}><Play size={15} /> Resume session</button>
            </div>}
          </div>
          <div className="tile-play-copy">
            {!running ? <>
              <h3>Black tiles only.</h3>
              <p className="idle-instruction">{selected.description}</p>
              <button className="btn btn-primary start-button" onClick={start}><Play size={16} fill="currentColor" /> Start session</button>
              <span className="idle-footnote">Mouse, touch, or keyboard. No setup needed.</span>
            </> : <>
              <span className="eyebrow">{mode === 'pattern' ? 'Patterns cleared' : 'Successful taps'}</span>
              <strong className="tile-live-score mono">{mode === 'pattern' ? `${snapshot.patterns} / ${PATTERN_COUNT}` : snapshot.taps}</strong>
              <div className="tile-live-time"><span>{mode === 'pattern' ? 'Active time' : 'Time left'}</span><strong className="mono">{mode === 'pattern' ? seconds(snapshot.elapsedMs) : `${(snapshot.remainingMs / 1000).toFixed(1)} s`}</strong></div>
              {mode === 'endurance' ? <p className="tile-live-note">{40 - snapshot.taps % 40} more taps earns +10 seconds.</p> : mode === 'pattern' ? <p className="tile-live-note">{snapshot.taps} / {PATTERN_COUNT * 4} tiles. Clear every black tile before the next pattern.</p> : <p className="tile-live-note">Tap any black tile. One white tile ends the round.</p>}
              <span className="tile-input-note">Tab to a tile, then Enter or Space to tap.</span>
            </>}
          </div>
        </div>
        {result && <div className="results-screen tile-results" ref={resultRef} tabIndex={-1}>
          <div className="results-heading">
            <span className="completion-check">{result.reason === 'complete' ? <Check size={24} /> : <Grid2X2 size={24} />}</span>
            <div><h2>{endLabels[result.reason]}</h2><p>{result.reason === 'white' ? 'Only black tiles count. Start another round when you’re ready.' : result.reason === 'complete' ? 'All 10 patterns completed. Lower time is better.' : 'Round complete. More successful taps is better.'}</p></div>
          </div>
          <div className="result-card">
            <div className="result-title"><h3>{selected.name}</h3>{best?.id === result.id && <span className="record-badge"><TrendingUp size={13} /> Personal best</span>}</div>
            <div className="result-primary"><strong>{mode === 'pattern' && result.reason !== 'complete' ? `${result.taps} / ${PATTERN_COUNT * 4}` : tileScoreLabel(result)}</strong><span>{mode === 'pattern' ? result.reason === 'complete' ? 'Complete-run time' : 'Tiles cleared' : 'Successful taps'}</span></div>
            <div className="result-details"><span>Active time <b>{seconds(result.activeMs)}</b></span>{mode === 'pattern' && <span>Patterns cleared <b>{result.patterns} / {PATTERN_COUNT}</b></span>}</div>
          </div>
          <div className="results-actions"><button className="btn btn-primary" onClick={start}><RotateCcw size={16} /> Repeat session</button><button className="btn btn-secondary" onClick={exit}>Back to practice</button></div>
          <p className="saved-note">{storageError ? 'Available this visit. Browser storage is unavailable.' : 'Saved on this device. Tile scores are separate from cursor drills.'}</p>
        </div>}
      </section>
      <div className="context-row">
        {running ? <span className="keyboard-note"><kbd>esc</kbd> to pause<span>·</span> again to exit</span> : <details className="how-to" key={mode}>
          <summary>How it works <ChevronDown size={14} /></summary><p>{selected.instruction}</p><small>Inspired by <a href="https://www.donttap.com/" target="_blank" rel="noopener noreferrer">DontTap</a>. Original Warmup interface; no external game assets.</small>
        </details>}
        {!running && <div className="personal-best"><TrendingUp size={15} /><span>Personal best</span><strong>{best ? tileScoreLabel(best) : 'No score yet'}</strong></div>}
      </div>
      <details className="tile-history" key={`history-${mode}`}>
        <summary>Recent {selected.name.toLowerCase()} rounds <ChevronDown size={14} /></summary>
        {recent.length ? <div className="progress-table-wrap" tabIndex={0} role="region" aria-label="Recent tile rounds">
          <table><caption className="sr-only">Latest saved {selected.name} rounds, newest first</caption><thead><tr><th scope="col">When</th><th scope="col">Score</th><th scope="col">Ended by</th></tr></thead><tbody>{recent.map(item => <tr key={item.id}>
            <td><time dateTime={item.completedAt}>{historyDate.format(new Date(item.completedAt))}</time></td><td className="mono">{item.mode === 'pattern' && item.reason !== 'complete' ? `${item.taps} / ${PATTERN_COUNT * 4} tiles` : tileScoreLabel(item)}</td><td>{endLabels[item.reason]}</td>
          </tr>)}</tbody></table>
        </div> : <p>Complete a round to save its score on this device.</p>}
      </details>
  </>;
}
