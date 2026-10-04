import { TARGET_DIAMETERS, type Phase, type RunConfig, type SessionResult, type Snapshot } from './types';

type Callbacks = {
  onUpdate(snapshot: Snapshot): void;
  onComplete(result: SessionResult): void;
};
type ReactionState = Snapshot['reactionState'];

/** Owns the arena DOM and an active-time clock independent of React renders. */
export class PracticeEngine {
  private readonly config: RunConfig;
  private readonly callbacks: Callbacks;
  private readonly arena: HTMLElement;
  private readonly layer: HTMLDivElement;
  private readonly target: HTMLDivElement;
  private readonly signal: HTMLDivElement;
  private readonly symbol: HTMLSpanElement;
  private readonly heading: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly observer: ResizeObserver;
  private readonly diameter: number;
  private readonly timed: boolean;
  private readonly duration: number;
  private readonly trackingSpeed: number;
  private phase: Phase = 'countdown';
  private pausedPhase: 'countdown' | 'running' = 'countdown';
  private destroyed = false;
  private frameId = 0;
  private lastWall = performance.now();
  private lastUpdate = -Infinity;
  private countdownLeft = 3000;
  private elapsed = 0;
  private hits = 0;
  private misses = 0;
  private premature = 0;
  private readonly reactionTimes: number[] = [];
  private reactionState: ReactionState = 'waiting';
  private reactionDeadline = 0;
  private reactionStart = 0;
  private targetX = 0;
  private targetY = 0;
  private targetAvailable = false;
  private targetStarted = 0;
  private flickRight = false;
  private hitTimeTotal = 0;
  private lastHitWall = -Infinity;
  private lastHitX = -Infinity;
  private lastHitY = -Infinity;
  private width = 0;
  private height = 0;
  private left = 0;
  private top = 0;
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;
  private cursorX = 0;
  private cursorY = 0;
  private cursorValid = false;
  private trackingMs = 0;

  constructor(arena: HTMLElement, config: RunConfig, callbacks: Callbacks) {
    this.arena = arena;
    this.config = { ...config, settings: { ...config.settings } };
    this.callbacks = callbacks;
    this.diameter = TARGET_DIAMETERS[config.settings.size];
    this.timed = config.mode !== 'reaction' || config.reactionStyle === 'timed' || config.guided;
    this.duration = config.settings.duration * 1000;
    this.trackingSpeed = config.settings.speed === 'slow' ? 0.65 : config.settings.speed === 'fast' ? 1.65 : 1.05;

    this.layer = document.createElement('div');
    this.layer.className = `engine-layer engine-layer--${config.mode}`;
    Object.assign(this.layer.style, { position: 'absolute', inset: '0', overflow: 'hidden', touchAction: 'none', userSelect: 'none' });
    this.target = document.createElement('div');
    this.target.className = `aim-target${config.mode === 'tracking' ? ' aim-target--tracking' : ''}`;
    this.target.setAttribute('aria-hidden', 'true');
    Object.assign(this.target.style, {
      position: 'absolute', left: '0', top: '0', width: `${this.diameter}px`, height: `${this.diameter}px`,
      borderRadius: '50%', transform: 'translate(-50%, -50%)', display: 'none', pointerEvents: 'none',
      background: 'radial-gradient(circle, #fff4dc 0 7%, #ef8b3e 8% 24%, #d56427 25% 28%, #ef8b3e 29% 54%, #ffd4a1 55% 58%, #ef8b3e 59% 100%)',
    });
    this.signal = document.createElement('div');
    this.signal.className = 'reaction-signal';
    this.signal.setAttribute('role', 'status');
    this.signal.setAttribute('aria-live', 'polite');
    Object.assign(this.signal.style, { position: 'absolute', inset: '0', display: 'none', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' });
    this.symbol = document.createElement('span');
    this.symbol.className = 'reaction-symbol';
    this.symbol.setAttribute('aria-hidden', 'true');
    this.heading = document.createElement('div');
    this.heading.className = 'reaction-heading';
    this.hint = document.createElement('div');
    this.hint.className = 'reaction-hint';
    this.signal.append(this.symbol, this.heading, this.hint);
    this.layer.append(this.signal, this.target);
    this.arena.append(this.layer);
    this.layer.addEventListener('pointerdown', this.onPointerDown);
    this.layer.addEventListener('pointermove', this.onPointerMove);
    this.layer.addEventListener('pointerleave', this.onPointerLeave);
    this.layer.addEventListener('pointercancel', this.onPointerLeave);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('scroll', this.onScroll, true);
    this.observer = new ResizeObserver(this.onResize);
    this.observer.observe(arena);
    this.measure();
    this.emit(true);
    this.frameId = requestAnimationFrame(this.frame);
    if (document.hidden || !document.hasFocus()) this.pause();
  }

  pause(): void {
    if (!this.canRun()) return;
    this.advance(performance.now());
    if (this.isFinished()) return;
    this.pausedPhase = this.phase as 'countdown' | 'running';
    this.phase = 'paused';
    this.cursorValid = false;
    this.target.classList.remove('is-on-target');
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.emit(true);
  }

  resume(): void {
    if (this.destroyed || this.phase !== 'paused' || document.hidden) return;
    this.phase = this.pausedPhase;
    this.lastWall = performance.now();
    this.cursorValid = false;
    // A signal seen before pausing cannot be measured fairly after resuming.
    if (this.phase === 'running' && this.config.mode === 'reaction' &&
        (this.reactionState === 'ready' || this.reactionState === 'waiting')) this.armReaction();
    this.measure();
    this.emit(true);
    if (this.canRun()) this.frameId = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.layer.removeEventListener('pointerdown', this.onPointerDown);
    this.layer.removeEventListener('pointermove', this.onPointerMove);
    this.layer.removeEventListener('pointerleave', this.onPointerLeave);
    this.layer.removeEventListener('pointercancel', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll, true);
    this.layer.remove();
  }

  private canRun(): boolean {
    return !this.destroyed && this.phase !== 'paused' && this.phase !== 'completed';
  }

  private isFinished(): boolean {
    return this.destroyed || this.phase === 'completed';
  }

  private readonly frame = (now: number): void => {
    this.frameId = 0;
    if (!this.canRun()) return;
    this.advance(now);
    if (this.isFinished()) return;
    if (this.phase === 'running' && this.config.mode === 'reaction' &&
        this.reactionState === 'waiting' && this.elapsed >= this.reactionDeadline) {
      // Both the DOM color commit and timestamp belong to this paint's rAF,
      // not a timer callback or a later React commit. Input cannot interleave.
      this.reactionStart = this.elapsed;
      this.setReaction('ready');
      this.emit(true);
    }
    this.emit(false);
    if (this.canRun()) this.frameId = requestAnimationFrame(this.frame);
  };

  private advance(now: number): void {
    if (!this.canRun()) return;
    let dt = Math.max(0, now - this.lastWall);
    this.lastWall = now;
    if (this.phase === 'countdown') {
      if (dt < this.countdownLeft) {
        this.countdownLeft -= dt;
        return;
      }
      dt -= this.countdownLeft;
      this.countdownLeft = 0;
      this.phase = 'running';
      if (this.config.mode === 'reaction') this.armReaction();
      else if (this.config.mode === 'tracking') this.placeTracking();
      else this.spawnTarget();
      this.emit(true);
      if (this.destroyed || this.phase !== 'running') return;
    }
    const end = this.timed ? Math.min(this.duration, this.elapsed + dt) : this.elapsed + dt;
    if (this.config.mode === 'tracking') this.integrateTracking(this.elapsed, end);
    this.elapsed = end;
    if (this.config.mode === 'tracking') this.placeTracking();
    if (this.timed && this.elapsed >= this.duration) this.complete();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || this.destroyed || this.phase !== 'running') return;
    event.preventDefault();
    const now = performance.now();
    this.advance(now);
    if (this.phase !== 'running' || this.destroyed) return;
    if (this.config.mode === 'reaction') {
      if (this.reactionState === 'early' || this.reactionState === 'result') {
        this.armReaction();
      } else if (this.reactionState === 'waiting') {
        this.premature++;
        this.setReaction('early');
      } else {
        const ms = Math.max(0, this.elapsed - this.reactionStart);
        this.reactionTimes.push(ms);
        this.hits++;
        this.setReaction('result', ms);
        if (!this.timed && this.hits === 5) {
          this.complete();
          return;
        }
      }
      this.emit(true);
      return;
    }
    if (this.config.mode === 'tracking' || !this.targetAvailable) return;
    const x = event.clientX - this.left;
    const y = event.clientY - this.top;
    if (x < 0 || y < 0 || x > this.width || y > this.height) return;
    // New targets exclude the previous hit point; discard a native double
    // click's repeated point as well, including on extremely small arenas.
    if (event.detail > 1 || (now - this.lastHitWall < 350 &&
        Math.abs(x - this.lastHitX) <= 3 && Math.abs(y - this.lastHitY) <= 3)) return;
    const dx = x - this.targetX;
    const dy = y - this.targetY;
    if (dx * dx + dy * dy <= this.diameter * this.diameter / 4) {
      this.hits++;
      if (this.config.mode === 'flick') this.hitTimeTotal += this.elapsed - this.targetStarted;
      this.lastHitWall = now;
      this.lastHitX = x;
      this.lastHitY = y;
      if (this.config.mode === 'flick') this.flickRight = !this.flickRight;
      this.spawnTarget(x, y);
    } else this.misses++;
    this.emit(true);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.config.mode !== 'tracking' || !event.isPrimary || event.pointerType === 'touch' || this.phase !== 'running') return;
    // Close the preceding interval with the OLD cursor position. Movement
    // cannot retroactively turn time spent outside the circle into coverage.
    this.advance(performance.now());
    if (this.destroyed || this.phase !== 'running') return;
    this.cursorX = event.clientX - this.left;
    this.cursorY = event.clientY - this.top;
    this.cursorValid = this.cursorX >= 0 && this.cursorX <= this.width && this.cursorY >= 0 && this.cursorY <= this.height;
    this.updateTrackingHighlight();
  };

  private readonly onPointerLeave = (): void => {
    if (this.config.mode !== 'tracking') return;
    this.advance(performance.now());
    this.cursorValid = false;
    this.target.classList.remove('is-on-target');
  };
  private readonly onVisibility = (): void => { if (document.hidden) this.pause(); };
  private readonly onBlur = (): void => { this.pause(); };
  private readonly onScroll = (): void => {
    if (this.destroyed) return;
    this.advance(performance.now());
    if (this.destroyed) return;
    const rect = this.layer.getBoundingClientRect();
    this.left = rect.left;
    this.top = rect.top;
    this.cursorValid = false;
    this.target.classList.remove('is-on-target');
  };
  private readonly onResize = (): void => {
    if (this.isFinished()) return;
    this.advance(performance.now());
    if (!this.isFinished()) this.measure();
  };

  private measure(): void {
    const style = getComputedStyle(this.arena);
    // Absolute positioning normally includes the padding box; inset it so
    // coordinates and target bounds describe the arena's content box.
    this.layer.style.left = style.paddingLeft;
    this.layer.style.right = style.paddingRight;
    this.layer.style.top = style.paddingTop;
    this.layer.style.bottom = style.paddingBottom;
    const rect = this.layer.getBoundingClientRect();
    const oldWidth = this.width;
    const oldHeight = this.height;
    this.width = rect.width;
    this.height = rect.height;
    this.left = rect.left;
    this.top = rect.top;
    const radius = this.diameter / 2;
    const paddingX = Math.min(14, Math.max(0, (this.width - this.diameter) / 2));
    const paddingY = Math.min(14, Math.max(0, (this.height - this.diameter) / 2));
    this.minX = radius + paddingX;
    this.maxX = this.width - radius - paddingX;
    this.minY = radius + paddingY;
    this.maxY = this.height - radius - paddingY;
    this.cursorValid = false;
    this.target.classList.remove('is-on-target');
    const fits = this.width >= this.diameter && this.height >= this.diameter;
    if (!fits) {
      this.targetAvailable = false;
      this.target.style.display = 'none';
      return;
    }
    if (this.phase !== 'running' && !(this.phase === 'paused' && this.pausedPhase === 'running')) return;
    if (this.config.mode === 'tracking') this.placeTracking();
    else if (this.config.mode !== 'reaction' && (!this.targetAvailable ||
        this.targetX < this.minX || this.targetX > this.maxX || this.targetY < this.minY || this.targetY > this.maxY ||
        (this.config.mode === 'flick' && (oldWidth !== this.width || oldHeight !== this.height)))) this.spawnTarget();
  }

  private armReaction(): void {
    this.reactionDeadline = this.elapsed + 2000 + Math.random() * 3000;
    this.setReaction('waiting');
  }

  private setReaction(state: ReactionState, ms = 0): void {
    this.reactionState = state;
    this.signal.style.display = 'flex';
    this.signal.dataset.state = state;
    if (state === 'waiting') {
      this.signal.style.backgroundColor = '#20583e';
      this.symbol.textContent = '⌛';
      this.heading.textContent = 'Wait for red.';
      this.hint.textContent = 'Click only when the arena turns red.';
    } else if (state === 'ready') {
      this.signal.style.backgroundColor = '#a33334';
      this.symbol.textContent = '!';
      this.heading.textContent = 'Click now!';
      this.hint.textContent = 'Click anywhere in the arena.';
    } else if (state === 'early') {
      this.signal.style.backgroundColor = '#684623';
      this.symbol.textContent = '↻';
      this.heading.textContent = 'Early click';
      this.hint.textContent = 'No reaction time recorded. Click to retry.';
    } else {
      this.signal.style.backgroundColor = '#252b37';
      this.symbol.textContent = '✓';
      this.heading.textContent = `${Math.round(ms)} ms`;
      this.hint.textContent = this.timed ? 'Click to continue. The session clock is still running.' : `${this.hits} of 5 valid attempts. Click to continue.`;
    }
  }

  private spawnTarget(excludeX = -Infinity, excludeY = -Infinity): void {
    if (this.width < this.diameter || this.height < this.diameter) {
      this.targetAvailable = false;
      this.target.style.display = 'none';
      return;
    }
    let lowX = this.minX;
    let highX = this.maxX;
    if (this.config.mode === 'flick') {
      const span = this.maxX - this.minX;
      if (this.flickRight) lowX = this.maxX - span * 0.24;
      else highX = this.minX + span * 0.24;
    }
    const radiusSquared = this.diameter * this.diameter / 4;
    let x = lowX;
    let y = this.minY;
    let separated = false;
    for (let attempt = 0; attempt < 16; attempt++) {
      x = lowX + Math.random() * (highX - lowX);
      y = this.minY + Math.random() * (this.maxY - this.minY);
      const dx = x - excludeX;
      const dy = y - excludeY;
      if (dx * dx + dy * dy > radiusSquared + 16) { separated = true; break; }
    }
    if (!separated) {
      x = Math.abs(lowX - excludeX) > Math.abs(highX - excludeX) ? lowX : highX;
      y = Math.abs(this.minY - excludeY) > Math.abs(this.maxY - excludeY) ? this.minY : this.maxY;
    }
    this.targetX = x;
    this.targetY = y;
    this.targetStarted = this.elapsed;
    this.targetAvailable = true;
    this.paintTarget();
  }

  private trackingX(ms: number): number {
    return this.minX + (this.maxX - this.minX) * (0.5 + Math.sin(ms / 1000 * this.trackingSpeed) * 0.5);
  }
  private trackingY(ms: number): number {
    return this.minY + (this.maxY - this.minY) * (0.5 + Math.sin(ms / 1000 * this.trackingSpeed * 1.31 + 0.8) * 0.5);
  }

  private integrateTracking(start: number, end: number): void {
    if (!this.cursorValid || !this.targetAvailable || end <= start) return;
    const radiusSquared = this.diameter * this.diameter / 4;
    let t = start;
    let x0 = this.trackingX(t) - this.cursorX;
    let y0 = this.trackingY(t) - this.cursorY;
    // Exact circle-entry/exit fractions along short path chords, rather than
    // counting whole frames based on a single on-target sample. No frame allocations.
    while (t < end) {
      const next = Math.min(t + 8, end);
      const x1 = this.trackingX(next) - this.cursorX;
      const y1 = this.trackingY(next) - this.cursorY;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const a = dx * dx + dy * dy;
      const c = x0 * x0 + y0 * y0 - radiusSquared;
      if (a < 1e-12) {
        if (c <= 0) this.trackingMs += next - t;
      } else {
        const b = 2 * (x0 * dx + y0 * dy);
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant);
          const enter = Math.max(0, (-b - root) / (2 * a));
          const exit = Math.min(1, (-b + root) / (2 * a));
          if (exit > enter) this.trackingMs += (exit - enter) * (next - t);
        }
      }
      x0 = x1;
      y0 = y1;
      t = next;
    }
  }

  private placeTracking(): void {
    if (this.width < this.diameter || this.height < this.diameter) return;
    this.targetAvailable = true;
    this.targetX = this.trackingX(this.elapsed);
    this.targetY = this.trackingY(this.elapsed);
    this.paintTarget();
    this.updateTrackingHighlight();
  }

  private paintTarget(): void {
    this.target.style.display = 'block';
    this.target.style.transform = `translate(${this.targetX}px, ${this.targetY}px) translate(-50%, -50%)`;
  }

  private updateTrackingHighlight(): void {
    const dx = this.cursorX - this.targetX;
    const dy = this.cursorY - this.targetY;
    this.target.classList.toggle('is-on-target', this.cursorValid && this.targetAvailable && dx * dx + dy * dy <= this.diameter * this.diameter / 4);
  }

  private emit(force: boolean): void {
    if (this.destroyed) return;
    const now = this.lastWall;
    if (!force && now - this.lastUpdate < 100) return;
    this.lastUpdate = now;
    this.callbacks.onUpdate({
      phase: this.phase,
      countdown: Math.ceil(this.countdownLeft / 1000),
      elapsedMs: this.elapsed,
      remainingMs: this.timed ? Math.max(0, this.duration - this.elapsed) : 0,
      hits: this.hits,
      misses: this.config.mode === 'reaction' ? this.premature : this.misses,
      reactionTimes: this.reactionTimes.slice(),
      reactionState: this.reactionState,
      trackingPercent: this.elapsed > 0 ? Math.min(100, this.trackingMs / this.elapsed * 100) : 0,
      averageHitMs: this.hits > 0 && this.config.mode === 'flick' ? this.hitTimeTotal / this.hits : 0,
    });
  }

  private complete(): void {
    if (this.destroyed || this.phase === 'completed') return;
    this.phase = 'completed';
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.cursorValid = false;
    this.target.classList.remove('is-on-target');
    const result: SessionResult = {
      id: crypto.randomUUID(),
      mode: this.config.mode,
      settings: { ...this.config.settings },
      reactionStyle: this.config.reactionStyle,
      guided: this.config.guided,
      completedAt: new Date().toISOString(),
      activeMs: this.elapsed,
      hits: this.hits,
      misses: this.misses,
      premature: this.premature,
      reactionTimes: this.reactionTimes.slice(),
      averageHitMs: this.hits > 0 && this.config.mode === 'flick' ? this.hitTimeTotal / this.hits : 0,
      trackingMs: Math.min(this.elapsed, this.trackingMs),
    };
    this.emit(true);
    this.callbacks.onComplete(result);
  }
}
