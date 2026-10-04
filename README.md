# <p align="center">Warmup</p>

<p align="center">
  <strong>Fast, local-first browser practice for reaction speed, mouse accuracy, flick timing, cursor tracking, and tile agility.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.8" />
  <img src="https://img.shields.io/badge/Vite-6.3-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Privacy-Zero_Tracking-brightgreen?style=flat-square" alt="Zero Tracking" />
  <img src="https://img.shields.io/badge/License-MIT-orange?style=flat-square" alt="MIT License" />
</p>

---

## Highlights

- **Local-First & Private:** No user accounts, cloud databases, telemetry, analytics, or third-party ads. Scores remain entirely in your browser (`localStorage`).
- **Native Cursor Feel:** Uses your actual browser cursor without mouse capture or emulation layers. Real mouse acceleration and OS sensitivity are preserved naturally.
- **Decoupled 60+ FPS Engine:** Game loops run directly on `requestAnimationFrame` with sub-millisecond `performance.now()` precision, updating React state only on throttled score milestones.
- **5 Focused Drills:** Targets (precision), Reaction (reflexes), Flicks (speed), Tracking (smoothness), and Don’t Tap (tile agility).
- **3-Minute Guided Routine:** A pre-configured sequence chaining all four cursor drills for pre-match muscle activation.
- **Zero Install:** Instant load in any modern desktop or mobile browser.

---

## Table of Contents

- [Practice Modes](#practice-modes)
  - [Mode Overview](#mode-overview)
  - [1. Targets (Precision)](#1-targets-precision)
  - [2. Reaction Test (Reflexes)](#2-reaction-test-reflexes)
  - [3. Flicks (Speed)](#3-flicks-speed)
  - [4. Tracking (Control)](#4-tracking-control)
  - [5. Don’t Tap (Tile Agility)](#5-dont-tap-tile-agility)
- [3-Minute Warmup Routine](#3-minute-warmup-routine)
- [Controls & Hotkeys](#controls--hotkeys)
- [Progress & Score Storage](#progress--score-storage)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation & Development](#installation--development)
  - [Production Build](#production-build)
- [Project Architecture](#project-architecture)
- [Documentation Links](#documentation-links)
- [License](#license)

---

## Practice Modes

All drills are accessible from the unified **Practice modes** sidebar. Navigation stays simple: **Practice** for gameplay and **Your progress** for historical trends.

### Mode Overview

| Drill | Objective | Metric | Primary Input |
| --- | --- | --- | --- |
| **Targets** | Hit circular targets as fast as they appear | Hits / active second & Accuracy | Mouse / Trackpad |
| **Reaction** | Click anywhere when the arena flashes red | Median latency (ms) | Mouse / Trackpad |
| **Flicks** | Alternate hits between opposite edges | Average time-to-hit (ms) | Mouse / Trackpad |
| **Tracking** | Keep cursor centered inside moving target | On-target time percentage (%) | Mouse / Trackpad |
| **Don’t Tap** | Tap black tiles on a 4 × 4 grid; avoid white | Taps or clear time | Mouse / Touch / Keyboard |

---

### 1. Targets (Precision)
- **Gameplay:** A single circular target spawns within the arena bounds. Clicking it registers a hit and immediately spawns a new target. Clicks outside the circle register as misses.
- **Options:** Duration (30s / 60s), Target Size (Easy 76 px, Medium 52 px, Hard 32 px).
- **Score:** Hits per second, total hits, misses, and hit accuracy percentage.

### 2. Reaction Test (Reflexes)
- **Gameplay:** The screen displays a green "Wait" signal. After a randomized 2–5-second delay, the screen turns red with "Click now!". Click anywhere within the arena as quickly as possible.
- **Anti-Cheat Delay:** Premature clicks during the green phase do not register as scores; you are prompted to retry.
- **Rounds:** Standard mode requires 5 valid attempts. Guided warmup runs Reaction in a continuous 30-second sprint.
- **Score:** Median response time across all valid attempts (filters out outliers), plus individual attempt latencies.

### 3. Flicks (Speed)
- **Gameplay:** Targets alternate back and forth between distant left and right quadrants of the arena. Misses do not advance the target position, forcing quick correction.
- **Options:** Duration (30s / 60s), Target Size (76 px / 52 px / 32 px).
- **Score:** Average active time required to transition and hit each target, plus accuracy.

### 4. Tracking (Control)
- **Gameplay:** A target glides along a smooth, non-linear path inside the arena. Keep your cursor inside the circle without clicking.
- **Options:** Duration (30s / 60s), Size (76 px / 52 px / 32 px), Movement Speed (Slow, Steady, Fast).
- **Score:** Percentage of total active session time the cursor remained inside the target boundary.

### 5. Don’t Tap (Tile Agility)
Adapted from classic black-and-white tile agility games ([DontTap](https://www.donttap.com/)), completely reimplemented natively with zero external assets or advertising.
- **Frenzy:** Score as many black-tile taps as possible within a fixed 30-second window. Each tap swaps the tile position.
- **Endurance:** Starts with a 10-second timer. Every 40 successful taps grants +10 bonus seconds. Tapping white ends the run immediately.
- **Pattern:** Clear 10 consecutive boards (4 black tiles each, 40 total). Cleared tiles show a checkmark and cannot be retapped. Only complete 40-tile runs qualify for personal bests (lower time is better).
- **Inputs:** Supports pointer clicks, native touch taps (48+ px touch targets), and keyboard navigation (`Tab` to navigate, `Enter` or `Space` to tap).

---

## 3-Minute Warmup Routine

Clicking **3-minute warmup** in the sidebar launches an automated sequence designed to wake up hand-eye coordination before competitive play:

```text
[ 3s Countdown ]
       │
       ▼
1. Reaction Test    ───► 30 Seconds (Continuous Timed Sprint)
       │
       ▼
2. Target Practice  ───► 60 Seconds (Medium Targets: 52 px)
       │
       ▼
3. Flick Practice   ───► 30 Seconds (Medium Targets: 52 px)
       │
       ▼
4. Tracking         ───► 60 Seconds (Medium Targets, Steady Speed)
       │
       ▼
[ Combined Results Screen with Per-Drill Breakdowns ]
```

- Each phase starts with a 3-second countdown (total wall time: ~3 minutes 12 seconds).
- Exercises transition automatically without menu interaction.
- Individual results are saved separately under matching settings groups in your history.

---

## Controls & Hotkeys

- **Escape (`Esc`):** Pause active session. Press `Esc` a second time while paused to exit back to mode selection.
- **Auto-Pause on Blur:** Switching browser tabs or minimizing the window automatically freezes all active timers and game loops. Resuming requires an explicit click.
- **Reaction Signal Rearming:** Resuming a paused reaction test cancels any active signal and restarts the randomized wait period, preventing unfair instant clicks.
- **Fullscreen:** Cursor drills provide a fullscreen toggle button in the station header.

---

## Progress & Score Storage

All session history is stored locally on the client using isolated, versioned keys:

- `warmup.sessions.v1`: Stores the latest 60 cursor drill sessions plus all-time personal bests for each unique settings group.
- `warmup.tiles.v1`: Stores the latest 60 tile rounds plus all-time bests for Frenzy, Endurance, and Pattern modes.

### Privacy & Data Safety
- **Origin-Bound:** Scores are scoped to your exact domain/port origin (`http://localhost:5173`, your custom domain, etc.).
- **Graceful Fallback:** If `localStorage` is blocked or unavailable (e.g., restricted iframe or privacy mode), the app continues running flawlessly with visit-long in-memory score tracking.
- **Selective Reset:** The **Clear cursor history** action wipes cursor drill results without affecting tile records or preferences.

---

## Quick Start

### Prerequisites
- [Node.js 22 LTS](https://nodejs.org/) or newer
- `npm` (bundled with Node.js)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/coder-bat01/Warm-up.git
cd Warm-up

# Install dependencies
npm install

# Start Vite local development server
npm run dev
```

Open the printed URL (defaults to `http://localhost:5173/`).

> **Tip for WSL Users:** If source file changes on a mounted Windows drive (`/mnt/c/...`) do not trigger hot reload, run:
> ```bash
> CHOKIDAR_USEPOLLING=true npm run dev
> ```

### Production Build

```bash
# Type check with TypeScript and bundle production assets
npm run build

# Preview production build locally
npm run preview
```

The production output is built to `dist/`. You can serve it using any static web server (GitHub Pages, Vercel, Netlify, Cloudflare Pages, Nginx, or Caddy).

---

## Project Architecture

```text
src/
├── App.tsx             # Root application shell, navigation, and station routing
├── main.tsx            # React 19 entry point and StrictMode wrapper
├── engine.ts           # DOM-based PracticeEngine for cursor drills (rAF loop)
├── TilePractice.tsx    # Don't Tap view container, variant selector, and results
├── tileGame.ts         # High-performance tile grid engine and collision logic
├── ProgressView.tsx    # Performance analytics, charts, filters, and history table
├── progress.ts         # Validation, comparison keys, and storage for cursor drills
├── tileProgress.ts     # Validation, comparison keys, and storage for tile drills
├── types.ts            # Type definitions for cursor drills and configurations
├── tileTypes.ts        # Type definitions for tile games and snapshots
└── styles.css          # Tailwind CSS 4 setup and custom styling rules
```

For an in-depth breakdown of the decoupled rendering model, timer mathematics, and memory safety invariants, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Documentation Links

- [Architecture & Timing Model](docs/ARCHITECTURE.md) — Detailed explanation of the DOM engine, active clock, and frame lifecycle.
- [Game Modes & Formulas](docs/MODES.md) — Mathematical definitions of scores, hit detection, and rules.
- [Deployment Guide](docs/DEPLOYMENT.md) — Step-by-step guides for GitHub Pages, Vercel, Cloudflare, and custom domains.
- [Contributing Guidelines](CONTRIBUTING.md) — Information on submitting issues and pull requests.

---

## License

This project is open-source under the [MIT License](LICENSE).
Copyright © 2026 coder-bat01.
