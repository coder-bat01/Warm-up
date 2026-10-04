import { PATTERN_COUNT, type TileEndReason, type TileMode, type TileRun, type TileSnapshot } from './tileTypes';
import type { Phase } from './types';

type Callbacks = {
  onUpdate(snapshot: TileSnapshot): void;
  onComplete(result: TileRun): void;
};
type CellState = 'white' | 'black' | 'cleared' | 'wrong';

const CELL_COUNT = 16;
const ALL_CELLS = 0xffff;

/** Owns a reusable tile board and a clock that excludes paused time. */
export class TileGame {
  private readonly board: HTMLDivElement;
  private readonly cells: HTMLButtonElement[] = [];
  private readonly mode: TileMode;
  private readonly callbacks: Callbacks;
  private phase: Phase = 'countdown';
  private pausedPhase: 'countdown' | 'running' = 'countdown';
  private destroyed = false;
  private listening = false;
  private frameId = 0;
  private lastWall = performance.now();
  private lastUpdate = -Infinity;
  private countdownLeft = 3000;
  private elapsed = 0;
  private deadline: number;
  private taps = 0;
  private patterns = 0;
  private blackMask = 0;
  private clearedMask = 0;

  constructor(container: HTMLElement, mode: TileMode, callbacks: Callbacks) {
    this.mode = mode;
    this.callbacks = callbacks;
    this.deadline = mode === 'frenzy' ? 30000 : mode === 'endurance' ? 10000 : Infinity;
    this.board = document.createElement('div');
    this.board.className = 'tile-board';
    this.board.setAttribute('role', 'group');
    this.board.setAttribute('aria-label', `${mode} tile board, 4 rows and 4 columns`);
    this.board.style.touchAction = 'none';
    this.board.style.userSelect = 'none';
    for (let index = 0; index < CELL_COUNT; index++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'tile-cell';
      cell.dataset.tileIndex = String(index);
      this.cells.push(cell);
      this.board.append(cell);
    }
    this.newBoard();
    container.append(this.board);
    this.board.addEventListener('pointerdown', this.onPointerDown);
    this.board.addEventListener('click', this.onClick);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    this.listening = true;
    this.lastWall = performance.now();
    this.emit(true);
    if (document.hidden || !document.hasFocus()) this.pause();
    if (this.canRun()) this.frameId = requestAnimationFrame(this.frame);
  }

  pause(): void {
    if (!this.canRun()) return;
    this.advance(performance.now());
    if (!this.canRun()) return;
    this.pausedPhase = this.phase as 'countdown' | 'running';
    this.phase = 'paused';
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.updateDisabled();
    this.emit(true);
  }

  resume(): void {
    if (this.destroyed || this.phase !== 'paused' || document.hidden) return;
    this.phase = this.pausedPhase;
    this.lastWall = performance.now();
    this.updateDisabled();
    this.emit(true);
    if (this.canRun()) this.frameId = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.removeListeners();
    this.updateDisabled();
    this.board.remove();
  }

  private canRun(): boolean {
    return !this.destroyed && (this.phase === 'countdown' || this.phase === 'running');
  }

  private readonly frame = (now: number): void => {
    this.frameId = 0;
    if (!this.canRun()) return;
    this.advance(now);
    if (!this.canRun()) return;
    this.emit(false);
    if (this.canRun()) this.frameId = requestAnimationFrame(this.frame);
  };

  private advance(now: number): void {
    if (!this.canRun()) return;
    let dt = Math.max(0, now - this.lastWall);
    this.lastWall = now;
    let started = false;
    if (this.phase === 'countdown') {
      if (dt < this.countdownLeft) {
        this.countdownLeft -= dt;
        return;
      }
      dt -= this.countdownLeft;
      this.countdownLeft = 0;
      this.phase = 'running';
      started = true;
      this.updateDisabled();
    }
    this.elapsed = Math.min(this.deadline, this.elapsed + dt);
    if (this.elapsed >= this.deadline) {
      this.complete('timeout');
      return;
    }
    if (started) this.emit(true);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || this.destroyed || this.phase !== 'running') return;
    const index = this.cellIndex(event.target);
    if (index < 0) return;
    event.preventDefault();
    this.cells[index].focus({ preventScroll: true });
    this.activate(index);
  };

  private readonly onClick = (event: MouseEvent): void => {
    // Pointer activation is handled on press; native keyboard clicks have detail 0.
    if (event.detail !== 0 || this.destroyed || this.phase !== 'running') return;
    const index = this.cellIndex(event.target);
    if (index >= 0) this.activate(index);
  };

  private cellIndex(target: EventTarget | null): number {
    if (!(target instanceof HTMLButtonElement) || target.parentElement !== this.board) return -1;
    return Number(target.dataset.tileIndex);
  }

  private activate(index: number): void {
    // In particular, a 40th Endurance tap at the deadline cannot buy more time.
    this.advance(performance.now());
    if (this.destroyed || this.phase !== 'running') return;
    const bit = 1 << index;
    if ((this.clearedMask & bit) !== 0) return;
    if ((this.blackMask & bit) === 0) {
      this.paintCell(index, 'wrong');
      this.complete('white');
      return;
    }

    this.taps++;
    if (this.mode === 'pattern') {
      this.blackMask &= ~bit;
      this.clearedMask |= bit;
      this.paintCell(index, 'cleared');
      if (this.blackMask === 0) {
        this.patterns++;
        if (this.patterns === PATTERN_COUNT) {
          this.complete('complete');
          return;
        }
        this.newBoard();
      }
    } else {
      // Select before removing the tapped black tile, so it cannot replace itself.
      const replacement = this.randomCell(ALL_CELLS & ~this.blackMask, CELL_COUNT - 3);
      this.blackMask = (this.blackMask & ~bit) | (1 << replacement);
      this.paintCell(index, 'white');
      this.paintCell(replacement, 'black');
      if (this.mode === 'endurance' && this.taps % 40 === 0) this.deadline += 10000;
    }
    this.emit(false);
  }

  private newBoard(): void {
    this.blackMask = 0;
    this.clearedMask = 0;
    const blackCount = this.mode === 'pattern' ? 4 : 3;
    for (let count = 0; count < blackCount; count++) {
      const index = this.randomCell(ALL_CELLS & ~this.blackMask, CELL_COUNT - count);
      this.blackMask |= 1 << index;
    }
    for (let index = 0; index < CELL_COUNT; index++) {
      this.paintCell(index, (this.blackMask & (1 << index)) !== 0 ? 'black' : 'white');
    }
  }

  private randomCell(mask: number, count: number): number {
    let choice = Math.floor(Math.random() * count);
    for (let index = 0; index < CELL_COUNT; index++) {
      if ((mask & (1 << index)) === 0) continue;
      if (choice === 0) return index;
      choice--;
    }
    throw new Error('Tile selection mask does not match its cell count.');
  }

  private paintCell(index: number, state: CellState): void {
    const cell = this.cells[index];
    cell.dataset.state = state;
    cell.textContent = state === 'cleared' ? '✓' : '';
    const color = state === 'cleared' ? 'Cleared black' : state === 'wrong' ? 'Wrong white' : state === 'black' ? 'Black' : 'White';
    cell.setAttribute('aria-label', `${color} tile, row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}`);
    cell.disabled = this.destroyed || this.phase !== 'running' || state === 'cleared';
  }

  private updateDisabled(): void {
    for (let index = 0; index < CELL_COUNT; index++) {
      this.cells[index].disabled = this.destroyed || this.phase !== 'running' || (this.clearedMask & (1 << index)) !== 0;
    }
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.pause();
  };

  private readonly onBlur = (): void => {
    this.pause();
  };

  private removeListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    this.board.removeEventListener('pointerdown', this.onPointerDown);
    this.board.removeEventListener('click', this.onClick);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
  }

  private emit(force: boolean): void {
    if (this.destroyed) return;
    if (!force && this.lastWall - this.lastUpdate < 100) return;
    this.lastUpdate = this.lastWall;
    this.callbacks.onUpdate({
      phase: this.phase,
      countdown: Math.ceil(this.countdownLeft / 1000),
      elapsedMs: this.elapsed,
      remainingMs: this.mode === 'pattern' ? 0 : Math.max(0, this.deadline - this.elapsed),
      taps: this.taps,
      patterns: this.patterns,
    });
  }

  private complete(reason: TileEndReason): void {
    if (this.destroyed || this.phase === 'completed') return;
    this.phase = 'completed';
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.removeListeners();
    this.updateDisabled();
    const result: TileRun = {
      id: crypto.randomUUID(),
      mode: this.mode,
      completedAt: new Date().toISOString(),
      activeMs: this.elapsed,
      taps: this.taps,
      patterns: this.patterns,
      reason,
    };
    this.emit(true);
    this.callbacks.onComplete(result);
  }
}
