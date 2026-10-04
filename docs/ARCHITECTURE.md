# Warmup Technical Architecture

This document describes the internal engineering design, timing models, rendering lifecycle, and data integrity guarantees of the Warmup application.

---

## 1. High-Level System Architecture

Warmup separates the user interface and analytics layer from the high-frequency gameplay loop:

```text
┌─────────────────────────────────────────────────────────────┐
│                       React 19 Shell                        │
│   (App.tsx, Navigation, ProgressView.tsx, Results Screen)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mounts & Configures
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      DOM Game Engines                       │
│    PracticeEngine (engine.ts)     TileGame (tileGame.ts)    │
│  ────────────────────────────   ──────────────────────────  │
│  • Direct DOM Target Elements   • Direct 4×4 Button Grid    │
│  • requestAnimationFrame Loop   • Sub-pixel Pointer Events  │
│  • High-res Monotonic Clock     • Keyboard & Touch Mapping  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Emits Throttled Updates
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Validated Storage Layer                   │
│   (progress.ts: warmup.sessions.v1, tileProgress.ts: v1)    │
└─────────────────────────────────────────────────────────────┘
```

### Why Decouple from React's Virtual DOM?
Aim trainers and reaction drills demand immediate input responsiveness and fluid animations that match the monitor's native refresh rate (60 Hz, 144 Hz, 240 Hz, 360 Hz+).
- In React, re-rendering state on every frame or input event causes reconciliation overhead, synthetic event wrappers, and garbage collection pauses.
- In Warmup, `PracticeEngine` and `TileGame` own their DOM subtrees directly. Targets and tiles update via direct style transforms and DOM attributes.
- React components only receive throttled snapshot updates (e.g., at 10 Hz or on key milestones like hits, misses, or phase shifts) for UI labels.

---

## 2. Timing Model & Clock Architecture

Accurate measurement requires isolating gameplay time from wall-clock variations, background throttling, and user pauses.

### High-Resolution Monotonic Clock
All timing calculations utilize `window.performance.now()`, which provides sub-millisecond timestamps that increment monotonically from page load. Unlike `Date.now()`, it cannot step backwards if the system clock synchronizes.

### Active Time vs. Wall Time
A drill's score depends strictly on **Active Time** ($T_{\text{active}}$), excluding:
1. Three-second countdown sequences.
2. User-initiated pause states (`Escape` or toolbar button).
3. Automatic background pauses triggered when the window loses focus (`window.onblur`) or becomes hidden (`document.onvisibilitychange`).

```text
Wall Time:   ├────────[ Active Drill ]────────[ Paused / Blur ]────────[ Active Drill ]────────┤
Active Time: ├────────[ Active Drill ]─────────────────────────────────[ Active Drill ]────────┤
```

### Automatic Background Pause & Rearming
When a user switches browser tabs or minimizes the window:
1. `document.addEventListener('visibilitychange')` or `window.addEventListener('blur')` triggers an immediate pause.
2. For the **Reaction Test**, if a random stimulus timer was currently running in the background, it is immediately canceled. Upon resume, the engine draws a fresh 2–5-second randomized delay so the player cannot return to an already-red arena for an artificial 0 ms reaction time.

---

## 3. Hit Detection & Collision Mathematics

### Targets & Flicks
Target boundaries are calculated against the arena's active bounding rect obtained via `getBoundingClientRect()`:

$$\text{Distance} = \sqrt{(x_{\text{pointer}} - x_{\text{target\_center}})^2 + (y_{\text{pointer}} - y_{\text{target\_center}})^2}$$

$$\text{Hit Registered} \iff \text{Distance} \le \text{Radius}$$

- If a click falls within the radius, a hit registers, and a new position is generated instantly.
- Target coordinates are bounded with a safety margin:

$$x_{\text{min}} = \text{Radius} + \text{Padding}, \quad x_{\text{max}} = \text{Arena Width} - (\text{Radius} + \text{Padding})$$

$$y_{\text{min}} = \text{Radius} + \text{Padding}, \quad y_{\text{max}} = \text{Arena Height} - (\text{Radius} + \text{Padding})$$

### Tracking Coverage Integration
Smooth cursor tracking uses non-linear trajectory movement (sinusoidal velocity curves with randomized reflection vectors).

In each frame step:
1. The engine calculates the current target center $(x_t, y_t)$ based on elapsed active time and velocity parameters.
2. The current mouse coordinates $(x_m, y_m)$ are sampled via passive `pointermove` tracking.
3. If Euclidean distance $\le \text{Radius}$, the frame duration $\Delta t = t_{\text{current}} - t_{\text{last}}$ is credited to `trackingMs`.
4. Overall coverage is:

$$\text{Coverage \%} = \min\left(100, \frac{\text{trackingMs}}{T_{\text{active}}} \times 100\right)$$

---

## 4. Don’t Tap Engine (`TileGame`)

The Don't Tap engine renders an optimized 4 × 4 button grid in a single container.

### State & Transitions
- **Frenzy:** Exactly one tile is active (black) at any given instant. Tapping black clears that tile and selects a randomly different cell from the remaining 15. Tapping any white tile ends the game with reason `'white'`.
- **Endurance:** Starts with $T_{\text{remaining}} = 10\,000\text{ ms}$. Each tap increments $C_{\text{taps}}$. Every 40 taps, the engine adds $+10\,000\text{ ms}$ to $T_{\text{remaining}}$. A deadline check precedes every tap registration; an input occurring after the clock reaches zero cannot claim an extension.
- **Pattern:** Exactly 4 black tiles are distributed across the 16 cells per pattern. Tapping an active tile marks it as `'cleared'`, disabling further input on that cell. When all 4 are cleared, pattern count increments. Reaching 10 cleared patterns (40 tiles) immediately triggers a clean victory completion (`'complete'`).

### Input De-duplication
Pointer events, touch events, and keyboard (`Enter` / `Space`) are routed through a unified, synchronous `handlePress` handler. A cell's state is checked and updated synchronously before dispatching state events, preventing duplicate scoring from hybrid touchscreen/mouse laptops.

---

## 5. Storage Layer & Data Protection

All player progress is handled by dedicated storage modules (`progress.ts` and `tileProgress.ts`).

### Schema Keys
- `warmup.sessions.v1`: Cursor drill records.
- `warmup.tiles.v1`: Don't Tap rounds.

### Validation & Defensive Deserialization
When reading from `localStorage`:
1. JSON parsing is wrapped in `try/catch`.
2. Every deserialized record is validated against strict runtime type predicates (`isSession` and `isTileRun`).
3. Out-of-bounds numbers, invalid ISO timestamps, and malformed strings are pruned automatically, protecting the app from corrupted site data.

### Retention & Pruning Algorithm
To prevent uncontrolled storage growth:
1. Storage retains the **latest 60 completed sessions**.
2. All-time personal bests for each unique configuration group are dynamically retained, even if they occurred earlier than the 60 most recent sessions.
3. Older sessions that are neither among the latest 60 nor all-time bests are systematically purged.

### In-Memory Fallback
If the browser environment blocks `localStorage` (private browsing modes, cross-origin iframes, or restrictive browser security policies):
- Writing to storage catches `DOMException` / `SecurityError` silently.
- An in-memory cache managed at the `App.tsx` level holds the player's results for the duration of the visit.
- Navigating between drills, the progress view, and Don't Tap retains visit-long scores and bests.
- Clear user feedback indicates that scores will persist for this browser visit only.

---

## 6. Lifecycle & Resource Disposal

To guarantee zero memory leaks when switching between drills or navigating views:
- **RAF Cleanup:** Every active `requestAnimationFrame` handle is captured and canceled via `cancelAnimationFrame` upon unmount or pause.
- **Listener Teardown:** Every `window`, `document`, and host element listener (`keydown`, `pointerdown`, `pointermove`, `visibilitychange`, `blur`) is registered with an exact counterpart in the teardown routine.
- **ResizeObserver Disconnection:** The layout observer monitoring arena resizing is explicitly `.disconnect()`ed.
- **Host DOM Clearing:** Engine destruction completely clears host elements (`innerHTML = ''`), releasing all element nodes and closures.
