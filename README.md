# Warmup

A focused, local-first browser warmup for reaction speed and mouse accuracy. Built with React 19, TypeScript, Tailwind CSS 4, and Vite. No account, backend, tracking service, or external game assets.

## Interface

The practice room uses the full available width with 28 px desktop gutters and no headline section. A 224 px left sidebar holds the four practice modes; the remaining width belongs to the arena. Below 1050 px, navigation becomes a compact icon-and-label rail, narrowing to 56 px on phones. The original Warmup logo and wordmark are preserved, with self-hosted Manrope typography for the interface. Live scores appear only while practicing. Results and progress use flat sections instead of nested dashboard cards.

Shape follows function: the arena and sidebar rows have square edges, controls use 2 px corners, and elevated menus/dialogs use 4 px corners. The logo keeps its original shape, and gameplay targets stay circular. Each drill has a small SVG diagram and specific input instructions before it starts; diagrams disappear during practice. Copy describes actions, measurements, and saved data rather than motivational slogans.

Choose **Targets**, **Reaction**, **Flicks**, or **Tracking** in the sidebar, then use **Start session**. The selected mode is highlighted in orange, including automatic exercise changes during the guided routine. Open **Setup** in the arena toolbar to adjust duration, target size, and tracking speed. **How it works** below the arena expands the full instructions; your settings-matched personal best appears opposite it. **3-minute warmup** at the bottom of the sidebar starts the guided routine (shown as **3 min** on narrow screens). Recent sessions and comparisons stay in **Your progress**, not on the practice surface.
The Setup panel also supports optional **FPS sensitivity profiles** for Valorant and Counter-Strike 2. Save each game’s DPI and hipfire sensitivity; Warmup calculates cm/360 and can use a pointer-locked virtual crosshair for target, flick, and tracking drills. Reaction tests and the guided routine keep their normal cursor controls. Profiles are stored locally in this browser. Optional 10 cm mouse calibration stores a separate movement scale for each game; press Escape to save it. Changing a game’s DPI clears its old calibration; sensitivity edits preserve it. During an FPS drill, Escape unlocks and pauses, then Resume locks again.

This is an aim-training scale, not a game integration: it never changes game settings and cannot reproduce a game camera, FOV, vertical sensitivity, or raw-input pipeline.

## Run locally

Install Node.js 22 LTS or newer, then run from this project directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173; it chooses the next port if occupied). On Windows, the project directory is `C:\Projects\Warm up`.

Production build and local preview:

```sh
npm run build
npm run preview
```

Deploy the generated `dist/` directory to any static HTTPS host. Use localhost or HTTPS for browser APIs. If developing on a Windows-mounted directory from WSL and changes do not appear, launch with `CHOKIDAR_USEPOLLING=true npm run dev`.

## Practice

- **Reaction:** green means wait; red and “Click now!” mean click anywhere inside the arena. A symbol and text accompany each state. The wait is randomly 2–5 active seconds. An early click does not count; click to retry. Five valid attempts finish a solo session. Results include all attempts, median, best attempt, and early clicks. Click to continue between attempts.
- **Target:** click the single circular target; a hit immediately spawns another. Off-target clicks are misses. Choose 30/60 seconds and easy/medium/hard targets (76/52/32 CSS pixels). Results include hits, misses, accuracy, and hits per active second.
- **Flick:** targets alternate between distant left/right regions. Choose the same sizes and durations. Results include hit/miss accuracy and average active time from spawn to successful hit, including time spent correcting misses.
- **Tracking:** keep your mouse or trackpad cursor inside the smoothly moving target without clicking. Choose size, duration, and slow/steady/fast movement. The score is on-target time divided by total active practice time. An absent cursor earns no credit.
- **3-Minute Warmup:** 30-second timed reaction practice → 60-second targets → 30-second flicks → 60-second tracking. Exercises advance automatically. A three-second countdown precedes each exercise, so total wall time is about 3 minutes 12 seconds, excluding pauses. The routine uses medium targets and steady tracking. Reaction practice continues until its time limit rather than stopping at five attempts.

## Controls and progress

Start session begins a three-second countdown. Toolbar controls provide pause, restart, exit, and fullscreen in desktop-cursor mode. Escape pauses; another Escape while paused exits. In FPS-profile mode, pointer lock is acquired before the countdown; Escape unlocks and pauses, and Resume reacquires the lock. Paused controls remain available outside the arena. Browsers can reserve Escape to leave fullscreen. Exit practice and Choose a drill return to the normal mode-selection screen. Restart clears the current session; a guided restart starts the whole routine again. Completed sessions offer Repeat session or Repeat warmup.

Losing window focus or hiding the tab automatically pauses countdowns, scoring, and timers. Resume is explicit. Reaction signals are rearmed after resume so a previously seen signal cannot produce a false fast score. Discarded/incomplete sessions are not saved; completed guided exercises are saved individually.

Scores and recent sessions use versioned localStorage on this device and browser origin. Your latest 60 sessions and all-time bests for each settings group are retained. Reaction medians and flick times are better when lower; target hits/second and tracking percentages are better when higher. No-valid-attempt reaction/flick sessions do not set a best. Only relevant matching settings are compared: reaction format (and timed duration), target/flick duration and size, tracking duration, size, and speed. FPS-profile results are separated by game, DPI, sensitivity, and calibrated mouse scale. Guided and solo results with identical gameplay settings share a comparison group.

Your progress includes settings-filtered score history, bests, recent results, and a confirmation-protected history reset. Invalid or blocked browser storage does not prevent practice; a warning identifies results that could not be saved.

## Implementation and verification

The DOM-based `PracticeEngine` owns the arena, an active-time `performance.now()` clock, and `requestAnimationFrame` loop. React receives throttled score updates rather than animation-frame state. Reaction color, text, and timestamp are committed together in the frame callback. Tracking motion depends on elapsed time; coverage integrates short path segments, including cursor entry/exit, rather than counting frames. Timed scores stop at their exact active-time deadline. Restart/mode changes dispose animation frames, listeners, and the ResizeObserver.

Verified in Chromium with native mouse input: five reaction attempts and premature retry, target hits/misses/double-click suppression, restart, flick accuracy/timing/separation, fullscreen, focus-loss pause, Escape exit, full real-time guided exercise order/durations/results, localStorage reload/reset, progress, and desktop/320–390 px mobile layouts. Additional throwaway simulation checks covered paused countdown/reaction/flick timing, late clicks, all target bounds, tracking frame-rate independence, absent-cursor coverage, lifecycle cleanup, settings isolation, retained old bests, and malformed/blocked storage. Production build uses TypeScript strict checking.
Additional Chromium smoke across Vite dev and compiled preview: Valorant/CS2 cm/360 equivalence (40.8 cm at 800 DPI with 0.4 Valorant or 1.2727 CS2), reload persistence, independent per-game calibration, calibration save/cancel, DPI-edit calibration invalidation, pointer-locked target/flick hits and tracking coverage, Escape pause/resume, repeat from results, profile-specific history, invalid-profile blocking, desktop-cursor practice, and 320/390 px layouts without horizontal overflow. Reaction tests and guided startup retain cursor input. Crosshair movement and calibration units used constructed PointerEvents while real browser pointer lock was active; lock acquisition, Escape, reload, and gameplay clicks used browser input.

## Limitations

FPS profiles convert game sensitivity to cm/360 and scale a virtual crosshair from browser mouse movement. Browser movement units can vary by OS, device, and acceleration; optional physical-distance calibration improves that mapping but is still not the game’s raw-input path. The training arena remains 2D and cannot duplicate game FOV, camera perspective, vertical sensitivity, recoil, or other game behavior. Display refresh and browser scheduling affect millisecond measurements. Desktop mouse is intended; tracking deliberately does not score touch input. Fullscreen availability depends on the browser. Progress and profiles are local, not synchronized, and clearing site data removes them. There is no login or leaderboard.
