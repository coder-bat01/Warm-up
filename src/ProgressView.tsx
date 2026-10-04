import { useEffect, useId, useRef, useState } from 'react';
import { ChartNoAxesCombined, Database, Trash2, Trophy, X } from 'lucide-react';
import { MODES } from './types';
import type { Mode, SessionResult } from './types';
import { getBest, metricName, scoreLabel, scoreValue, settingsKey } from './progress';

interface ProgressViewProps {
  sessions: SessionResult[];
  onReset(): void;
  onPractice(): void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function configLabel(result: SessionResult): string {
  if (result.mode === 'reaction') {
    return result.reactionStyle === 'rounds' ? '5 valid attempts' : `${result.settings.duration}s · Timed reactions`;
  }
  const size = `${result.settings.size[0].toUpperCase()}${result.settings.size.slice(1)} targets`;
  const base = `${result.settings.duration}s · ${size}`;
  const speed = result.mode === 'tracking' ? ` · ${result.settings.speed[0].toUpperCase()}${result.settings.speed.slice(1)} speed` : '';
  const aim = result.aim ? ` · Archived FPS: ${result.aim.game === 'valorant' ? 'Valorant' : 'CS2'} · ${result.aim.sensitivity} sens · ${result.aim.dpi} DPI · ${result.aim.inputUnitsPerCm.toFixed(1)} units/cm` : '';
  return `${base}${speed}${aim}`;
}

function ScoreChart({ sessions, mode, best }: { sessions: SessionResult[]; mode: Mode; best?: SessionResult }) {
  const id = useId();
  const points = sessions
    .map((session) => ({ session, score: scoreValue(session) }))
    .filter((point): point is { session: SessionResult; score: number } => point.score !== null)
    .sort((a, b) => Date.parse(a.session.completedAt) - Date.parse(b.session.completedAt));
  const lowerIsBetter = mode === 'reaction' || mode === 'flick';

  if (!points.length) {
    return (
      <div className="progress-chart-empty">
        <ChartNoAxesCombined size={32} aria-hidden="true" />
        <h3>No scored sessions yet</h3>
        <p className="muted">{sessions.length ? 'No valid scores recorded for these settings.' : 'No saved sessions with these settings.'}</p>
      </div>
    );
  }

  const values = points.map((point) => point.score);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const padding = highest === lowest ? Math.max(1, highest * 0.1) : (highest - lowest) * 0.15;
  const min = Math.max(0, lowest - padding);
  const max = highest + padding;
  const left = 66;
  const right = 694;
  const top = 22;
  const bottom = 190;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? (left + right) / 2 : left + index / (points.length - 1) * (right - left),
    y: bottom - (point.score - min) / (max - min) * (bottom - top),
  }));
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const first = points[0].session;
  const latest = points[points.length - 1].session;
  const units = mode === 'tracking' ? '%' : mode === 'target' ? ' hits/s' : ' ms';
  const summary = `${points.length} scored ${MODES.find((item) => item.id === mode)?.name.toLowerCase()} sessions with matching settings. First score: ${scoreLabel(first)} on ${dateFormat.format(new Date(first.completedAt))}. Latest: ${scoreLabel(latest)} on ${dateFormat.format(new Date(latest.completedAt))}.${best ? ` All-time best: ${scoreLabel(best)}.` : ''} ${lowerIsBetter ? 'Lower' : 'Higher'} is better. Points are ordered by session, not elapsed calendar time.`;

  return (
    <>
      <svg className="progress-chart-svg" viewBox="0 0 720 234" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{metricName(mode)} history</title>
        <desc id={`${id}-description`}>{summary}</desc>
        {[0, 0.5, 1].map((fraction) => {
          const y = top + fraction * (bottom - top);
          const value = max - fraction * (max - min);
          return (
            <g key={fraction}>
              <line className="chart-grid-line" x1={left} x2={right} y1={y} y2={y} />
              <text className="chart-axis-label" x={left - 12} y={y + 4} textAnchor="end">{value.toFixed(mode === 'target' ? 1 : 0)}</text>
            </g>
          );
        })}
        {coordinates.length > 1 && <path className="chart-area" d={`${path} L ${right} ${bottom} L ${left} ${bottom} Z`} />}
        <path className="chart-line" d={path} fill="none" />
        {coordinates.map((point) => (
          <circle className={point.session.id === best?.id ? 'chart-point chart-point-best' : 'chart-point'} key={point.session.id} cx={point.x} cy={point.y} r={point.session.id === best?.id ? 5 : 3.5}>
            <title>{dateFormat.format(new Date(point.session.completedAt))}, {timeFormat.format(new Date(point.session.completedAt))}: {scoreLabel(point.session)}{point.session.id === best?.id ? ' · All-time best' : ''}</title>
          </circle>
        ))}
        <text className="chart-axis-label" x={left} y={218}>{shortDateFormat.format(new Date(first.completedAt))}</text>
        {points.length > 1 && <text className="chart-axis-label" x={right} y={218} textAnchor="end">{shortDateFormat.format(new Date(latest.completedAt))}</text>}
        <text className="chart-unit-label" x={left} y={12}>{units.trim()}</text>
      </svg>
      <div className="progress-chart-caption muted">
        <span><span className="chart-legend-dot" />Session score · {lowerIsBetter ? 'Lower' : 'Higher'} is better</span>
        <span>{points.length} scored session{points.length === 1 ? '' : 's'}{points.length !== sessions.length ? ` · ${sessions.length - points.length} without a valid score` : ''}</span>
      </div>
      <p className="progress-chart-note muted">Each point uses the same test settings. Mouse settings, screen size, display refresh rate, and hardware still affect comparisons.</p>
    </>
  );
}

export default function ProgressView({ sessions, onReset, onPractice }: ProgressViewProps) {
  const [mode, setMode] = useState<Mode>(sessions[0]?.mode ?? 'target');
  const [groupKey, setGroupKey] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogTitle = useId();
  const dialogDescription = useId();
  const filterId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmReset) {
      if (!dialog.open) dialog.showModal();
      cancelRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [confirmReset]);

  const groups = new Map<string, SessionResult>();
  for (const session of [...sessions].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))) {
    if (session.mode !== mode) continue;
    const key = settingsKey(session);
    if (!groups.has(key)) groups.set(key, session);
  }
  const selectedKey = groups.has(groupKey) ? groupKey : groups.keys().next().value ?? '';
  const selectedConfig = groups.get(selectedKey);
  const filtered = sessions.filter((session) => settingsKey(session) === selectedKey)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const best = selectedConfig ? getBest(sessions, selectedConfig) : undefined;
  const latest = filtered[0];
  const modeName = MODES.find((item) => item.id === mode)?.name ?? 'Practice';

  return (
    <section className="progress-view" aria-labelledby="progress-heading">
      <div className="section-heading progress-heading">
        <div>
          <h1 id="progress-heading">Progress</h1>
          <p className="muted">Saved scores and session history, grouped by drill and settings.</p>
        </div>
        {sessions.length > 0 && (
          <button className="btn btn-secondary progress-reset" type="button" onClick={() => setConfirmReset(true)}>
            <Trash2 size={16} aria-hidden="true" /> Clear cursor history
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="panel progress-empty">
          <div className="progress-empty-icon"><ChartNoAxesCombined size={38} aria-hidden="true" /></div>
          <h2>No saved sessions</h2>
          <p className="muted">Complete a drill to save its results on this device.</p>
          <button className="btn btn-primary" type="button" onClick={onPractice}>Choose a drill</button>
        </div>
      ) : (
        <>
          <div className="panel progress-filters">
            <div className="progress-filter-fields">
              <label className="progress-filter" htmlFor={`${filterId}-mode`}>
                <span className="eyebrow">Practice mode</span>
                <select id={`${filterId}-mode`} value={mode} onChange={(event) => { setMode(event.target.value as Mode); setGroupKey(''); }}>
                  {MODES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="progress-filter" htmlFor={`${filterId}-settings`}>
                <span className="eyebrow">Matching settings</span>
                <select id={`${filterId}-settings`} value={selectedKey} disabled={groups.size === 0} onChange={(event) => setGroupKey(event.target.value)}>
                  {groups.size === 0 ? <option value="">No sessions in this mode</option> : [...groups.entries()].map(([key, config]) => <option key={key} value={key}>{configLabel(config)}</option>)}
                </select>
              </label>
            </div>
            <p className="muted progress-filter-note">{selectedConfig?.aim ? 'Archived results are read-only and are not compared with current cursor practice.' : 'Only identical test settings are compared. Guided and solo sessions count together.'}</p>
          </div>

          <div className="stat-grid progress-stats">
            <div className="stat-card"><span className="progress-stat-label">Saved sessions</span><strong className="metric-value">{sessions.length}</strong><span className="muted">Across cursor drills</span></div>
            <div className="stat-card"><span className="progress-stat-label">Personal best</span><strong className="metric-value">{best ? scoreLabel(best) : '—'}</strong><span className="muted">{best ? dateFormat.format(new Date(best.completedAt)) : 'No valid score for these settings'}</span></div>
            <div className="stat-card"><span className="progress-stat-label">Latest score</span><strong className="metric-value">{latest ? scoreLabel(latest) : '—'}</strong><span className="muted">{latest ? dateFormat.format(new Date(latest.completedAt)) : 'No sessions for these settings'}</span></div>
          </div>

          <div className="panel progress-chart-panel">
            <div className="section-heading"><h2>{metricName(mode)} history</h2><span className="progress-mode-badge">{modeName}</span></div>
            <ScoreChart sessions={filtered} mode={mode} best={best} />
          </div>

          <div className="panel progress-history-panel">
            <div className="section-heading"><h2>Session history</h2><span className="muted">{filtered.length} matching session{filtered.length === 1 ? '' : 's'}</span></div>
            {filtered.length > 0 ? (
              <div className="progress-table-wrap" tabIndex={0} role="region" aria-label="Scrollable session history">
                <table className="progress-table">
                  <caption className="sr-only">Saved {modeName.toLowerCase()} sessions with {selectedConfig ? configLabel(selectedConfig) : 'matching settings'}, newest first. Personal bests are marked.</caption>
                  <thead><tr><th scope="col">Date</th><th scope="col">Practice</th><th scope="col">Settings</th><th scope="col">{metricName(mode)}</th><th scope="col">{mode === 'reaction' ? 'Attempts' : 'Accuracy'}</th></tr></thead>
                  <tbody>{filtered.map((session) => {
                    const attempts = session.hits + session.misses;
                    const accuracy = attempts > 0 ? `${(session.hits / attempts * 100).toFixed(1)}%` : '—';
                    return (
                      <tr key={session.id} className={session.id === best?.id ? 'progress-best-row' : undefined}>
                        <td><time dateTime={session.completedAt}><span>{dateFormat.format(new Date(session.completedAt))}</span><small className="muted">{timeFormat.format(new Date(session.completedAt))}</small></time></td>
                        <td><span>{modeName}</span>{session.guided && <small className="muted">Guided warmup</small>}</td>
                        <td className="muted">{configLabel(session)}</td>
                        <td><span className="mono progress-score">{scoreLabel(session)}</span>{session.id === best?.id && <span className="progress-best-badge"><Trophy size={11} aria-hidden="true" />Best</span>}</td>
                        <td>{session.mode === 'target' || session.mode === 'flick' ? <><span className="mono">{accuracy}</span><small className="muted">{session.hits} hits · {session.misses} misses</small></> : session.mode === 'reaction' ? <><span>{session.reactionTimes.length} valid</span><small className="muted">{session.premature} early</small></> : <span className="muted">Not applicable</span>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            ) : <p className="progress-history-empty muted">No saved sessions for this mode.</p>}
            <p className="progress-storage-note muted"><Database size={13} aria-hidden="true" />Stored locally: your latest 60 cursor sessions, plus all-time bests for every settings group. Older bests remain in history.</p>
          </div>
        </>
      )}

      <dialog ref={dialogRef} className="progress-reset-dialog" aria-labelledby={dialogTitle} aria-describedby={dialogDescription} onCancel={() => setConfirmReset(false)} onClose={() => setConfirmReset(false)}>
        <button type="button" className="progress-dialog-close" aria-label="Cancel clearing history" onClick={() => setConfirmReset(false)}><X size={20} aria-hidden="true" /></button>
        <div className="progress-dialog-icon"><Trash2 size={26} aria-hidden="true" /></div>
        <h2 id={dialogTitle}>Clear cursor history?</h2>
        <p id={dialogDescription} className="muted">This removes saved cursor sessions and their personal bests from this device. It cannot be undone. Tile scores and practice settings will stay the same.</p>
        <div className="progress-dialog-actions">
          <button ref={cancelRef} className="btn btn-secondary" type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn btn-danger" type="button" onClick={() => { setConfirmReset(false); dialogRef.current?.close(); onReset(); }}><Trash2 size={16} aria-hidden="true" />Clear cursor history</button>
        </div>
      </dialog>
    </section>
  );
}
