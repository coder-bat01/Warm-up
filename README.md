# Warmup

A local-first browser app for reaction time, mouse accuracy, flick speed, cursor tracking, and black-tile tapping. Built with React 19, TypeScript, Tailwind CSS 4, and Vite.

No account, backend, leaderboard, analytics, or remote game services. Scores stay in your browser.

## Practice modes

All five modes are in the **Practice modes** sidebar. Main navigation contains only **Practice** and **Your progress**.

| Mode | What you do | Score |
| --- | --- | --- |
| **Targets** | Click randomly positioned circular targets. Each hit spawns the next target; off-target clicks count as misses. | Hits per active second, with hits, misses, and accuracy. |
| **Reaction** | Wait through a random 2–5-second delay, then click when the arena turns red and says “Click now!”. Early clicks do not count; retry until five valid attempts are complete. | Median reaction time, best attempt, all five attempts, and early clicks. |
| **Flicks** | Click targets alternating between widely separated left/right positions. A miss does not move the target. | Average active time from target spawn to hit, plus hits, misses, and accuracy. |
| **Tracking** | Keep your mouse or trackpad cursor inside a smoothly moving target without clicking. | Percentage of active practice time on target. |
| **Don’t tap** | Tap black tiles in a 4 × 4 grid. One white-tile tap ends the round. | Mode-specific tap count or completion time. |

Select a mode and press **Start session**. Every session begins with a three-second countdown.

### Cursor-drill settings

Start immediately with the defaults, or use **Change** in the **Session setup** strip above the arena:

- Targets, Flicks, and Tracking: 30 or 60 seconds.
- Target diameter: easy 76 px, medium 52 px, or hard 32 px.
- Tracking movement: slow, steady, or fast.
- Defaults: 30 seconds, medium targets, and steady tracking.
- Solo Reaction: five valid attempts, with no adjustable setup.

Cursor drills use normal browser input. Reaction states have text and symbols as well as color. Tracking requires a mouse or trackpad and does not score touch input.

### Don’t tap variants

Choose a variant above the board; there is no separate Games section.

- **Frenzy:** score as many black-tile taps as possible in 30 active seconds. Each successful tap moves a black tile to a different cell. More taps is better.
- **Endurance:** begin with 10 active seconds. Every 40 successful taps adds 10 seconds to the time remaining. Play until time expires or you tap white. More taps is better.
- **Pattern:** clear four black tiles in any order before the next board appears. Complete 10 patterns, for 40 tiles total, as quickly as possible. Cleared tiles show a check and cannot score twice. Only completed runs set best times; lower is better.

Mouse and touch score on press. Keyboard users can Tab to a tile, then press Enter or Space. Each variant has its own **Personal best** and **Recent rounds** below the board.

The tile mechanics are inspired by [DontTap](https://www.donttap.com/). Warmup uses its own interface and implementation, without embedding that site, its assets, ads, or services.

## 3-minute warmup

The sidebar’s **3-minute warmup** runs the four cursor drills in order:

1. Reaction: 30 seconds of timed practice, rather than a fixed five attempts.
2. Targets: 60 seconds.
3. Flicks: 30 seconds.
4. Tracking: 60 seconds.

Exercises advance automatically, using medium targets and steady tracking. Each exercise has a three-second countdown: total wall time is about 3 minutes 12 seconds, excluding pauses. Completed exercises are saved individually, and the end screen combines their results. Don’t tap is not part of this routine.

## Controls

- **Pause**, **Restart**, and **Exit practice** are available during a session.
- **Escape** pauses; another Escape while paused exits. Browsers may reserve Escape to leave fullscreen.
- Losing window focus or hiding the tab automatically pauses countdowns, timers, and scoring. Resume is explicit. Reaction signals are rearmed on resume.
- Switching drills or tile variants discards an unfinished session. Restart clears the current session; restarting a guided warmup returns to its first exercise.
- Results offer **Repeat session** or **Repeat warmup**. Tile results also offer **Back to practice**.
- Cursor drills have fullscreen controls; Don’t tap does not.
- Session timers exclude paused time and stop at their active-time deadline.

## Scores and progress

Scores use versioned localStorage on the current device and browser origin:

- `warmup.sessions.v1`: the latest 60 cursor sessions, plus all-time bests for each matching-settings group.
- `warmup.tiles.v1`: the latest 60 tile rounds, plus all-time bests for each tile variant.

**Your progress** contains cursor-drill charts, settings filters, recent results, and personal bests. Tile history stays below the Don’t tap board. Matching cursor settings determine comparisons: reaction format and timed duration; target/flick duration and size; tracking duration, size, and speed. Guided and solo sessions with matching settings share a group. Sessions with no valid reaction or flick score do not set a best.

Older saved results labeled **Archived FPS** remain readable in separate comparison groups. They cannot be repeated and never set bests for current cursor sessions. This is historical score support, not an available practice setting.

**Clear cursor history** requires confirmation and removes cursor sessions and bests only. It leaves tile scores and current practice settings unchanged. Clearing browser site data removes both histories.

If browser storage is unavailable, completed scores remain in memory for the current visit and the app warns that they were not saved. Tile scores and bests survive navigation between drills and progress during that visit. Unsaved results are lost when the page is reloaded or closed.

## Run locally

Use Node.js 22 or newer and npm. From a fresh clone:

```sh
git clone https://github.com/coder-bat01/Warm-up.git
cd Warm-up
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`. Vite chooses another port if that port is occupied.

### Production build

```sh
npm run build
npm run preview
```

`npm run build` runs strict TypeScript checking and creates the production app in `dist/`. Preview serves that build locally; it is not a production server.

Deploy `dist/` to a static HTTPS host. The default build assumes the app is served at the domain root. For a host using a subdirectory, set the matching Vite base when building, for example:

```sh
npm run build -- --base=/Warm-up/
```

Publishing the source repository to GitHub does not itself deploy the website. Localhost or HTTPS is needed for secure browser APIs. Scores belong to an origin, so different hosts or ports have separate histories.

### Windows and WSL

From the existing Windows checkout, run npm commands in `C:\Projects\Warm up`. Its WSL path is `/mnt/c/Projects/Warm up`.

If edits on the mounted Windows drive do not reach Vite, enable watcher polling in WSL:

```sh
CHOKIDAR_USEPOLLING=true npm run dev
```

## Implementation and verification

- `src/App.tsx`: shared navigation, cursor sessions, guided transitions, and visit-long score state.
- `src/engine.ts`: cursor gameplay, active-time timing, reaction signals, and tracking coverage.
- `src/TilePractice.tsx`: Don’t tap controls, board surface, results, and recent rounds inside Practice.
- `src/tileGame.ts`: reusable tile board, input handling, pause, deadlines, and completion.
- `src/progress.ts` and `src/tileProgress.ts`: validated storage, score eligibility, history retention, and bests.
- `src/ProgressView.tsx`: cursor history, comparisons, charts, and confirmation-protected reset.
- `src/types.ts` and `src/tileTypes.ts`: mode contracts and settings.
- `src/styles.css`: responsive layout and locally bundled typography.

Gameplay runs outside React’s frame-by-frame render cycle. The engines use `performance.now()` and `requestAnimationFrame`, send throttled UI updates, and remove animation frames and listeners on exit or mode changes.

There is no automated test script configured. Build with `npm run build`, then smoke the actual app: all five mode destinations, hit/miss scoring, reaction retry, pause/resume, restart, variant switching, Pattern completion, Endurance bonuses, reload persistence, cursor-history reset, and blocked-storage navigation. Inspect desktop, tablet, and phone layouts and browser errors.

Generated `node_modules/`, `dist/`, `.vite/`, and TypeScript build-info files are ignored by Git. Commit the source and lockfile, not generated output.

## Limitations

This measures browser input performance, not an in-game camera or raw-input pipeline. Mouse settings and acceleration, device hardware, screen and arena dimensions, browser zoom, refresh rate, and scheduling affect scores. Use consistent conditions when comparing sessions; matching settings alone does not make results hardware-independent.

Desktop mouse practice is the primary experience. Don’t tap supports touch and keyboard; Tracking requires a mouse or trackpad. Fullscreen availability depends on the browser. Scores are local, are not synchronized across devices, and are not sent to a server.
